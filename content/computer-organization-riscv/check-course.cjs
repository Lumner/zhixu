'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),vm=require('node:vm');
const home=__dirname,source=path.join(home,'source'),root=path.resolve(home,'../..');
const meta=JSON.parse(fs.readFileSync(path.join(home,'course.json'),'utf8'));
const walk=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]);
const markdown=walk(source).filter(f=>f.endsWith('.md'));
const lessons=markdown.filter(f=>path.dirname(f)===source&&/^\d{2}-/.test(path.basename(f))&&!/^(00|99)-/.test(path.basename(f)));
assert.equal(lessons.length,32);assert.equal(meta.stats.chapters,32);
let internalLinks=0;
for(let number=1;number<=32;number++){
  const file=lessons.find(f=>path.basename(f).startsWith(String(number).padStart(2,'0')+'-'));
  assert.ok(file,'Missing lesson '+number);
  const text=fs.readFileSync(file,'utf8');assert.ok(text.startsWith('# '));assert.ok(text.length>1000,'Short placeholder: '+file);
  assert.equal(meta.groups.filter(g=>number>=g.range[0]&&number<=g.range[1]).length,1,'Group coverage '+number);
}
for(const file of markdown){
  const text=fs.readFileSync(file,'utf8');
  for(const match of text.matchAll(/\[[^\]\n]*\]\(([^)\n]+)\)/g)){
    const href=match[1];if(/^(https?:|mailto:|#)/.test(href))continue;
    const target=path.resolve(path.dirname(file),decodeURIComponent(href.split('#')[0]));
    assert.ok(target.startsWith(source+path.sep),'Link outside source '+href);
    assert.ok(fs.existsSync(target),path.basename(file)+' missing link '+href);internalLinks++;
  }
  assert.equal((text.match(/^```/gm)||[]).length%2,0,'Unclosed code fence '+file);
}
const exampleDirs=fs.readdirSync(path.join(source,'示例代码'),{withFileTypes:true}).filter(e=>e.isDirectory());
assert.equal(exampleDirs.length,meta.stats.examples);for(const e of exampleDirs)assert.ok(fs.existsSync(path.join(source,'示例代码',e.name,'README.md')));
const report={date:new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai'}).format(new Date()),sourceChapters:lessons.length,sourceMarkdown:markdown.length,exampleGroups:exampleDirs.length,internalSourceLinks:internalLinks,generatedChecked:false};
if(!process.argv.includes('--source-only')){
  const win={};vm.runInNewContext(fs.readFileSync(path.join(root,'dist/data/catalog.js'),'utf8'),{window:win});
  vm.runInNewContext(fs.readFileSync(path.join(root,'dist/data/search.js'),'utf8'),{window:win});
  const course=win.TUTORIAL_CATALOG.courses.find(c=>c.id===meta.id),core=require(path.join(root,'web/assets/core.js'));
  assert.ok(course);assert.equal(course.category,'systems');assert.equal(course.chapterCount,32);assert.equal(course.groups.length,8);
  for(const q of ['RISC-V','补码','流水线','TLB','DMA'])assert.ok(core.search(q,win.TUTORIAL_SEARCH).some(r=>r.courseId===meta.id),'Search '+q);
  const store=core.createStore(null);store.toggleComplete(meta.id+'/01');store.toggleBookmark(meta.id+'/02');
  assert.equal(store.progress(course).done,1);assert.equal(store.isComplete('wechat-miniprogram/01'),false);assert.equal(store.isBookmarked('wechat-miniprogram/02'),false);
  assert.ok(fs.statSync(path.join(root,'dist',course.download)).size>1000);
  report.generatedChecked=true;report.generatedDocuments=course.documentCount;report.courseProgressIsolated=true;report.searchTerms=5;
}
console.log(JSON.stringify(report,null,2));
