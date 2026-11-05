const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{spawnSync}=require('node:child_process');
const ROOT=path.resolve(__dirname,'..'),OUT=path.join(ROOT,'dist'),core=require('../web/assets/core.js');
let count=0;const check=(label,fn)=>{fn();count++;};
function script(file,window){vm.runInNewContext(fs.readFileSync(file,'utf8'),{window},{filename:file});}
const window={};script(path.join(OUT,'data/catalog.js'),window);script(path.join(OUT,'data/search.js'),window);
const {courses,site}=window.TUTORIAL_CATALOG;
check('All source courses are registered',()=>assert.equal(courses.length,fs.readdirSync(path.join(ROOT,'content'),{withFileTypes:true}).filter(e=>e.isDirectory()&&fs.existsSync(path.join(ROOT,'content',e.name,'course.json'))).length));
check('Existing course preserves36 chapters',()=>assert.equal(courses.find(c=>c.id==='wechat-miniprogram').chapterCount,36));
check('Course learning stages cover every lesson',()=>{for(const c of courses){assert.equal(new Set(c.documents.map(d=>d.id)).size,c.documents.length);assert.ok(c.documents.filter(d=>d.kind==='chapter').every(d=>c.groups.some(g=>g.id===d.group)));}});
check('Categories are unique and valid',()=>{assert.equal(new Set(site.categories.map(c=>c.id)).size,site.categories.length);for(const c of courses)assert.ok(site.categories.some(x=>x.id===c.category));});
check('Supplementary stages follow numeric order',()=>{for(const c of courses)for(const kind of ['exercise','code','checklist']){const stages=c.documents.filter(d=>d.kind===kind&&d.stage!==null).map(d=>d.stage);assert.deepEqual(stages,stages.slice().sort((a,b)=>a-b));}});
check('Chinese stage numbers are parsed correctly',()=>{const {stageOf}=require('./build.cjs');for(const [name,n] of [['第一阶段',1],['第九阶段',9],['第十阶段',10],['第十六阶段',16],['第二十一阶段',21],['第12阶段',12]])assert.equal(stageOf(name),n);});
let documentCount=0,localLinks=0,diagramCount=0;
for(const c of courses)for(const d of c.documents){
  let payload;script(path.join(OUT,'data/content',c.id,d.id+'.js'),{TutorialContent:{register(key,data){assert.equal(key,c.id+'/'+d.id);payload=data;}}});
  check('Document data '+d.id,()=>{assert.equal(payload.id,d.id);assert.equal(payload.courseId,c.id);assert.ok(payload.html.length>0);assert.ok(fs.existsSync(path.join(OUT,...decodeURIComponent(payload.raw).split('/'))));});
  check('Generated HTML cannot activate raw scripts '+d.id,()=>{assert.ok(!/<script(?:\s|>)/i.test(payload.html));assert.ok(!/href\s*=\s*["']javascript:/i.test(payload.html));});
  for(const match of payload.html.matchAll(/(?:href|src)="([^"]+)"/g)){
    const url=match[1].replace(/&amp;/g,'&');
    if(url.startsWith('#/learn/')){const r=core.route(url);assert.ok(courses.find(x=>x.id===r.courseId)?.documents.some(x=>x.id===r.docId),url);localLinks++;}
    if(url.startsWith('files/')){const file=path.resolve(OUT,decodeURIComponent(url.split('#')[0]));assert.ok(file.startsWith(OUT+path.sep));assert.ok(fs.existsSync(file),url);localLinks++;}
  }
  assert.equal(new Set(payload.toc.map(h=>h.id)).size,payload.toc.length);
  diagramCount+=(payload.html.match(/class="course-diagram/g)||[]).length;documentCount++;
}
check('All current diagrams are rendered',()=>assert.ok(diagramCount>=6));
check('Course full ZIP is available',()=>{for(const c of courses)if(c.download)assert.ok(fs.statSync(path.join(OUT,c.download)).size>1000);});
check('Search finds code terms and Chinese knowledge',()=>{for(const q of ['setData','草稿','TypeScript','生命周期','SystemVerilog','always_ff','补码','FIFO'])assert.ok(core.search(q,window.TUTORIAL_SEARCH).length>0,q);});
check('Digital logic course has complete main sequence',()=>{
  const c=courses.find(c=>c.id==='digital-logic');assert.ok(c);assert.equal(c.chapterCount,32);
  assert.deepEqual(Array.from(c.documents.filter(d=>d.kind==='chapter'),d=>d.number),Array.from({length:32},(_,i)=>i+1));
  assert.equal(c.groups.length,7);assert.equal(c.documents.filter(d=>d.kind==='exercise').length,7);
});
check('Progress is isolated between courses',()=>{
  const s=core.createStore(null),w=courses.find(c=>c.id==='wechat-miniprogram'),d=courses.find(c=>c.id==='digital-logic');
  s.toggleComplete('digital-logic/01');assert.equal(s.progress(d).done,1);assert.equal(s.progress(w).done,0);
  s.toggleBookmark('digital-logic/01');assert.equal(s.isBookmarked('wechat-miniprogram/01'),false);
});
check('Concurrent build refuses before changing output',()=>{
  const lock=path.join(ROOT,'.tutorial-build.lock'),before=fs.readFileSync(path.join(OUT,'data/catalog.js'),'utf8');
  const fd=fs.openSync(lock,'wx');
  try{
    fs.writeFileSync(fd,JSON.stringify({pid:process.pid,test:true}));
    assert.throws(()=>require('./build.cjs').build(),/另一个构建/);
    assert.equal(fs.readFileSync(path.join(OUT,'data/catalog.js'),'utf8'),before);
    assert.ok(fs.existsSync(lock));
  }finally{fs.closeSync(fd);fs.unlinkSync(lock);}
});
check('Search rejects whitespace as query',()=>assert.equal(core.search('  ',window.TUTORIAL_SEARCH).length,0));
check('Malformed route does not crash',()=>assert.equal(core.route('#/learn/%E0%A4').type,'home'));
check('Deep links preserve section',()=>assert.equal(core.route('#/learn/wechat-miniprogram/03?section=hello').section,'hello'));
check('Progress counts only lessons',()=>{const c=courses[0],s=core.createStore(null),d=c.documents.find(x=>x.kind==='chapter');s.toggleComplete(c.id+'/'+d.id);assert.equal(s.progress(c).done,1);s.toggleComplete(c.id+'/00');assert.equal(s.progress(c).done,1);});
check('Bookmarks and completion survive storage reload',()=>{let text='';const storage={getItem:()=>text,setItem:(_,value)=>{text=value;}},a=core.createStore(storage);a.toggleComplete('wechat-miniprogram/01');a.toggleBookmark('wechat-miniprogram/02');a.visit('wechat-miniprogram','03');const b=core.createStore(storage);assert.equal(b.isComplete('wechat-miniprogram/01'),true);assert.equal(b.isBookmarked('wechat-miniprogram/02'),true);assert.equal(b.snapshot().last.docId,'03');});
check('Broken storage falls back to memory',()=>{const s=core.createStore({getItem(){throw Error();},setItem(){throw Error();}});assert.equal(s.toggleBookmark('wechat-miniprogram/01'),true);assert.equal(s.persistent(),false);});
check('Malformed local preferences are bounded',()=>{const s=core.createStore({getItem:()=>JSON.stringify({prefs:{font:900,theme:'bad'},completed:['<script>']}),setItem(){}});assert.equal(s.snapshot().prefs.font,17);assert.equal(s.snapshot().prefs.theme,'system');assert.equal(s.snapshot().completed.length,0);});
check('Snapshot cannot mutate store',()=>{const s=core.createStore(null);s.toggleBookmark('wechat-miniprogram/01');s.snapshot().bookmarks.length=0;assert.equal(s.isBookmarked('wechat-miniprogram/01'),true);});
for(const file of ['assets/core.js','assets/app.js','data/catalog.js','data/search.js'])check('JS syntax '+file,()=>{const r=spawnSync(process.execPath,['--check',path.join(OUT,file)],{encoding:'utf8',windowsHide:true});assert.equal(r.status,0,r.stderr);});
check('No remote runtime scripts/fonts required',()=>{const html=fs.readFileSync(path.join(OUT,'index.html'),'utf8');assert.ok(!/<script[^>]+src=["']https?:/i.test(html));assert.ok(!/<link[^>]+href=["']https?:/i.test(html));});
fs.mkdirSync(path.join(ROOT,'reports'),{recursive:true});const report={date:new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai'}).format(new Date()),checks:count,courses:courses.length,chapters:courses.reduce((n,c)=>n+c.chapterCount,0),documents:documentCount,localDocumentAndFileLinks:localLinks,diagrams:diagramCount,browserQA:false};
fs.writeFileSync(path.join(ROOT,'reports/checks.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
