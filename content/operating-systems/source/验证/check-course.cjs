const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const HOME=path.resolve(__dirname,'../..'),SOURCE=path.join(HOME,'source'),ROOT=path.resolve(HOME,'../..');
let checks=0;const check=(name,fn)=>{fn();checks++;};
const meta=JSON.parse(fs.readFileSync(path.join(HOME,'course.json'),'utf8'));
const files=fs.readdirSync(SOURCE).filter(f=>/^\d{2}-.*\.md$/.test(f));
const main=files.filter(f=>Number(f.slice(0,2))>0&&Number(f.slice(0,2))<99);
check('36 real chapters',()=>assert.equal(main.length,36));
check('stable course identity',()=>assert.equal(meta.id,'operating-systems'));
check('category and counts',()=>{assert.equal(meta.category,'systems');assert.equal(meta.stats.chapters,36);assert.equal(meta.groups.length,8);});
check('detailed rewrite is explicitly ongoing',()=>{assert.equal(meta.status,'ongoing');assert.deepEqual(meta.edition.detailedChapters,['01','02','03','04','05','06','07','08','09','10','11','12','13','14','15','16']);assert.deepEqual(meta.edition.nextBatch,['17','18','19','20']);});
for(let n=1;n<=36;n++)check('chapter '+n,()=>{
  const file=main.find(f=>Number(f.slice(0,2))===n);assert.ok(file);
  const text=fs.readFileSync(path.join(SOURCE,file),'utf8');
  assert.ok(text.startsWith('# '+String(n).padStart(2,'0')+' '));
  assert.ok(text.length>=600);assert.ok(/练习|自测|复盘|验收/.test(text));assert.ok(/完成条件|毕业验收/.test(text));
  assert.equal(meta.groups.filter(g=>n>=g.range[0]&&n<=g.range[1]).length,1);
  assert.equal((text.match(/^```/gm)||[]).length%2,0);
  if(n<=16)assert.ok(text.includes('零基础详细版 · 已重写'));
  else assert.ok(text.includes('旧版简稿 · 待详细重写'));
  if(n>=11&&n<=16){assert.ok(text.length>=6000);assert.ok((text.match(/^## /gm)||[]).length>=18);assert.ok(/参考答案/.test(text));}
});
const walk=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]);
const docs=walk(SOURCE).filter(f=>f.endsWith('.md'));let embedded=0,links=0;
for(const file of docs){
  const text=fs.readFileSync(file,'utf8').replace(/\r\n/g,'\n');assert.ok(!text.includes('<!-- example:'));
  for(const match of text.matchAll(/\[完整源码：([^\]]+)\]\(([^)]+)\)\s*```c\n([\s\S]*?)\n```/g)){
    check('embedded code '+match[1],()=>assert.equal(match[3].trim(),fs.readFileSync(path.resolve(path.dirname(file),match[2]),'utf8').replace(/\r\n/g,'\n').trim()));embedded++;
  }
  for(const match of text.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)){
    const href=match[1];if(/^(https?:|#)/.test(href))continue;
    const target=path.resolve(path.dirname(file),decodeURIComponent(href.split('#')[0]));
    check('local source link',()=>{assert.ok(target.startsWith(HOME+path.sep));assert.ok(fs.existsSync(target),href);});links++;
  }
}
check('every example and helper embedded',()=>assert.equal(embedded,24));
check('23 C examples',()=>assert.equal(walk(path.join(SOURCE,'示例代码')).filter(f=>f.endsWith('.c')).length,23));
const window={};vm.runInNewContext(fs.readFileSync(path.join(ROOT,'dist/data/catalog.js'),'utf8'),{window});
vm.runInNewContext(fs.readFileSync(path.join(ROOT,'dist/data/search.js'),'utf8'),{window});
const course=window.TUTORIAL_CATALOG.courses.find(c=>c.id===meta.id);
check('course appears in built catalog',()=>{assert.ok(course);assert.equal(course.chapterCount,36);assert.equal(course.groups.length,8);});
check('built course accurately labels partial detailed rewrite',()=>{assert.equal(course.status,'ongoing');assert.equal(course.summary,meta.summary);assert.deepEqual(Array.from(course.edition.detailedChapters),meta.edition.detailedChapters);});
const core=require(path.join(ROOT,'web/assets/core.js'));
for(const term of ['fork','互斥锁','页表','C语言','系统调用'])check('search '+term,()=>assert.ok(core.search(term,window.TUTORIAL_SEARCH,200).some(r=>r.courseId===meta.id)));
check('progress and bookmark isolation',()=>{
  const store=core.createStore(null),wechat=window.TUTORIAL_CATALOG.courses.find(c=>c.id==='wechat-miniprogram');
  store.toggleComplete(meta.id+'/01');store.toggleBookmark(meta.id+'/02');
  assert.equal(store.progress(course).done,1);assert.equal(store.progress(wechat).done,0);
  assert.equal(store.isBookmarked('wechat-miniprogram/02'),false);
  store.toggleComplete(meta.id+'/00');assert.equal(store.progress(course).done,1);
});
const report={date:'2026-11-05',passed:true,checks,chapters:36,detailedChapters:meta.edition.detailedChapters,examples:23,embeddedSources:embedded,localSourceLinks:links,documents:course.documentCount};
fs.writeFileSync(path.join(__dirname,'课程检查结果.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
