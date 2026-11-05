const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{spawnSync}=require('node:child_process'),{pathToFileURL}=require('node:url');
const {completePass}=require('./support/verdict.cjs'),{digest}=require('./support/digest.cjs');
const results=[];
for(const kind of ['failure','skipped','timeout']){
 const child=spawnSync(process.execPath,['--test','--test-timeout=5000','--test-reporter='+pathToFileURL(path.join(__dirname,'reporter.cjs')).href,path.join(__dirname,'fixtures/'+kind+'.fixture.cjs')],{encoding:'utf8',timeout:10000,windowsHide:true});
 if(child.error)throw child.error;const result=JSON.parse(child.stdout),c=result.summary.counts;
 assert.equal(completePass(result,child.status,1),false);
 if(kind==='failure')assert.equal(c.failed,1);if(kind==='skipped')assert.equal(c.skipped,1);if(kind==='timeout')assert.equal(c.cancelled,1);
 results.push({kind,exitCode:child.status,counts:c,acceptedAsPass:false});
}
const report={date:'2026-11-03',sourceDigest:digest(),expectedNegativePaths:3,checked:results,notBusinessTestCount:true};
fs.mkdirSync(path.join(__dirname,'reports'),{recursive:true});fs.writeFileSync(path.join(__dirname,'reports/failure-path.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({expectedNegativePaths:3,allRejectedAsPass:true}));
