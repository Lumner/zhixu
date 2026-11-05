const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process'),{randomUUID}=require('node:crypto');
const {digest}=require('./support/digest.cjs');
const {completePass}=require('./support/verdict.cjs');
const {pathToFileURL}=require('node:url');
const ROOT=path.resolve(__dirname,'..'),output=path.join(__dirname,'reports/latest.json');
const files=['unit.test.cjs','async.test.cjs','component.test.cjs','flow.test.cjs'];
const report={courseDate:'2026-11-03',executedAt:new Date().toISOString(),project:'14-studyhub-testing',runId:randomUUID(),node:process.version,status:'failed',sourceDigest:digest(),realCloud:false,realWechat:false,componentRendering:'notRun',devtoolsAutomation:'notRun',coverage:null};
try{
 const [major,minor]=process.versions.node.split('.').map(Number);if(major<24||major===24&&minor<15)throw Error('本教学入口要求Node >=24.15；当前仅实测24.15.0。');
 if(process.argv.slice(2).some(x=>x!=='--coverage'))throw Error('只接受--coverage，按名筛选请使用直接node --test命令。');
 const coverage=process.argv.includes('--coverage');
 const args=['--test','--test-concurrency=1','--test-timeout=10000','--test-reporter='+pathToFileURL(path.join(__dirname,'reporter.cjs')).href];
 if(coverage)args.push('--experimental-test-coverage','--test-coverage-include=**/miniprogram/**/*.js');
 args.push(...files.map(name=>path.join(__dirname,name)));
 const child=spawnSync(process.execPath,args,{cwd:ROOT,encoding:'utf8',timeout:45000,maxBuffer:8*1024*1024,windowsHide:true});
 if(child.stderr)process.stderr.write(child.stderr);
 if(child.error)throw child.error;
 const result=JSON.parse(child.stdout);Object.assign(report,result);
 if(result.format!=='studyhub-node-test-v1'||!result.summary)throw Error('未取得完整结构化汇总');
 const counts=result.summary.counts;
 if(!completePass(result,child.status,50))throw Error('本套件要求完整50项通过，无失败、取消、跳过或TODO。');
 if(result.scenarios.length!==50||result.scenarios.some(x=>x.status!=='passed'))throw Error('场景记录与全量汇总不一致');
 if(report.sourceDigest!==digest())throw Error('测试期间源文件发生变化，请重新运行');
 report.status='passed';
}catch(error){report.error=error.message;process.exitCode=1;}
fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({status:report.status,passed:report.summary?.counts?.passed||0,error:report.error,coverageFiles:report.coverage?.files?.length||0,coverageLinePercent:report.coverage?.totals?.coveredLinePercent??null,realWechat:false}));
