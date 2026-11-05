const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),source=path.join(root,'content/digital-logic/source');
const walk=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.name==='.build'?[]:e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]);
const files=walk(source),chapters=files.filter(f=>/^\d{2}-/.test(path.basename(f))&&path.dirname(f)===source&&Number(path.basename(f).slice(0,2))>0&&Number(path.basename(f).slice(0,2))<99);
assert.equal(chapters.length,32);
let links=0;
for(const file of files.filter(f=>f.endsWith('.md'))){
  const md=fs.readFileSync(file,'utf8');assert.ok(/^#\s/m.test(md),file);
  if(chapters.includes(file)){
    assert.ok(md.length>=650,'Insufficient chapter explanation: '+file);
    assert.ok(/目标/.test(md)&&/练习|验收/.test(md),file);
  }
  for(const [,href] of md.matchAll(/\]\(([^)]+)\)/g)){
    if(/^(?:https?:|#)/.test(href))continue;
    const target=path.resolve(path.dirname(file),decodeURIComponent(href.split('#')[0]));
    assert.ok(target.startsWith(source+path.sep),href);assert.ok(fs.existsSync(target),file+' -> '+href);links++;
  }
}
const labs=fs.readdirSync(path.join(source,'示例代码')).filter(n=>/^\d{2}-/.test(n));assert.equal(labs.length,15);
const normalized=text=>text.replace(/\r\n/g,'\n');
const appendix=normalized(fs.readFileSync(path.join(source,'完整源码附录-SystemVerilog设计.md'),'utf8'));
for(const lab of labs){
  for(const f of ['design.sv','tb.sv'])assert.ok(fs.existsSync(path.join(source,'示例代码',lab,f)));
  assert.ok(appendix.includes(normalized(fs.readFileSync(path.join(source,'示例代码',lab,'design.sv'),'utf8')).trim()),'Appendix drift: '+lab);
}
const report=JSON.parse(fs.readFileSync(path.join(root,'reports/digital-logic-simulation.json'),'utf8'));
assert.equal(report.passedExamples,15);assert.equal(report.detectedMutations,3);
assert.equal(report.results.filter(r=>!r.expectedFailure&&r.exitCode===0).length,15);
assert.equal(report.results.filter(r=>r.expectedFailure&&r.exitCode!==0).length,3);
console.log(JSON.stringify({course:'digital-logic',chapters:chapters.length,examples:labs.length,checkedSourceLinks:links,simulationEvidence:true}));
