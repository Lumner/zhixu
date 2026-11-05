const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {build}=require('./build.cjs');
const root=path.resolve(__dirname,'..'),content=path.join(root,'content'),fixture=path.join(content,'atomic-build-failure-check');
if(path.dirname(fixture)!==content||fs.existsSync(fixture))throw Error('Safety fixture must be new');
const liveFiles=['data/catalog.js','index.html','build-report.json'];
const before=liveFiles.map(p=>fs.readFileSync(path.join(root,'dist',p)));
const oldStages=fs.readdirSync(path.join(root,'.cache')).filter(n=>n.startsWith('site-build-')).sort();
const source=path.join(fixture,'source'),meta=path.join(fixture,'course.json');
fs.mkdirSync(source,{recursive:true});
try{
  fs.writeFileSync(meta,JSON.stringify({id:'atomic-build-failure-check',category:'systems',source:'source',groups:[],stats:{chapters:0},download:'downloads/intentionally-absent.zip'}));
  assert.throws(()=>build(),/Missing download: atomic-build-failure-check/);
  liveFiles.forEach((p,i)=>assert.deepEqual(fs.readFileSync(path.join(root,'dist',p)),before[i],p));
  assert.equal(fs.existsSync(path.join(root,'.tutorial-build.lock')),false);
  assert.deepEqual(fs.readdirSync(path.join(root,'.cache')).filter(n=>n.startsWith('site-build-')).sort(),oldStages);
}finally{
  fs.unlinkSync(meta);fs.rmdirSync(source);fs.rmdirSync(fixture);
}
const result={date:new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai'}).format(new Date()),failedBuildPreservesOutput:true,lockReleased:true,stagingCleaned:true,fixtureRemoved:!fs.existsSync(fixture)};
fs.writeFileSync(path.join(root,'reports/build-safety.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result));
