const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {ROOT,load,copy}=require('./support/core.cjs'),{flow}=require('./support/flow.cjs'),{digest}=require('./support/digest.cjs');
const rows=[];
async function check(name,file,before,after,probe){
 const source=fs.readFileSync(path.join(ROOT,file),'utf8');assert.ok(source.includes(before),'变体锚点已变化，请先检查实验');
 await probe(load(file));
 const mutant=load(file,{source:source.replace(before,after)});let detected=false;
 try{await probe(mutant);}catch(error){if(error.name!=='AssertionError')throw error;detected=true;}
 assert.ok(detected,'断言没有发现该故障变体');assert.equal(fs.readFileSync(path.join(ROOT,file),'utf8'),source);
 rows.push({name,baselinePassed:true,assertionDetected:true,originalFileUnchanged:true});
}
async function main(){
 await check('数字版本误用字符串字典序','miniprogram/utils/compatibility.js','if (!a || !b) return null;','if (!a || !b) return null; return left===right?0:left>right?1:-1;',mod=>assert.equal(mod.compareVersion('2.10.0','2.9.9'),1));
 await check('追加丢失ID去重','miniprogram/utils/task-view.js','if (!seen.has(row.id))','if (true)',mod=>{const result=mod.appendRows([{id:'a'}],[{id:'a'},{id:'b'},{id:'b'}]);assert.deepEqual(copy(result.added.map(x=>x.id)),['b']);});
 await check('恢复时另换操作编号','miniprogram/services/task-session.js','outbox.resume(copy(record.attempt), owner)','outbox.resume({ ...copy(record.attempt), opId: outbox.newOperationId() }, owner)',async mod=>{const f=flow(mod.createTaskSession);try{const s=f.create().session;await s.open();s.change({title:'故障实验'});f.flags.loseResponse=true;await s.submit();const original=s.snapshot().opId;await s.replay();assert.equal(s.snapshot().confirmed,true);assert.deepEqual(f.requests.map(x=>x.opId),[original,original]);}finally{f.dispose();}});
 const report={date:'2026-11-03',sourceDigest:digest(),fixedMutants:3,detected:rows.length,scenarios:rows,mutationScoreForWholeProject:null,realCloud:false};
 fs.mkdirSync(path.join(__dirname,'reports'),{recursive:true});fs.writeFileSync(path.join(__dirname,'reports/mutations.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({fixedMutants:3,detected:rows.length,businessFilesUnchanged:true}));
}
main().catch(error=>{console.error(error);process.exitCode=1;});
