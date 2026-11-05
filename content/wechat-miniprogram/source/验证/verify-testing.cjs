const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{spawnSync}=require('node:child_process');
const project=process.argv[2]||'14-studyhub-testing';
if(!['14-studyhub-testing','15-studyhub-release','16-studyhub-operations'].includes(project))throw Error('Unknown test project');
const root=path.resolve(__dirname,'../示例代码/'+project),previous=path.resolve(__dirname,'../示例代码/'+(project==='16-studyhub-operations'?'15-studyhub-release':project==='15-studyhub-release'?'14-studyhub-testing':'13-studyhub-accessibility'));
const {digest}=require(path.join(root,'tests/support/digest.cjs'));
function read(file){return JSON.parse(fs.readFileSync(file,'utf8'));}
for(const file of ['run.cjs','check-failure-path.cjs','mutations.cjs']){const args=[path.join(root,'tests',file)];if(file==='run.cjs')args.push('--coverage');const child=spawnSync(process.execPath,args,{cwd:root,encoding:'utf8',timeout:60000,maxBuffer:8*1024*1024,windowsHide:true});assert.equal(child.error,undefined,child.error?.message);assert.equal(child.status,0,child.stdout+'\n'+child.stderr);console.log(child.stdout.trim());}
const current=digest(),main=read(path.join(root,'tests/reports/latest.json')),negative=read(path.join(root,'tests/reports/failure-path.json')),mutations=read(path.join(root,'tests/reports/mutations.json'));
assert.equal(main.status,'passed');assert.equal(main.summary.counts.passed,50);assert.equal(main.summary.counts.tests,50);assert.ok(main.coverage.files.length>0);
for(const result of [main,negative,mutations])assert.equal(result.sourceDigest,current);
assert.equal(negative.checked.length,3);assert.ok(negative.checked.every(x=>!x.acceptedAsPass));assert.equal(mutations.detected,3);
function filesUnder(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(x=>x.isDirectory()?filesUnder(path.join(dir,x.name)):[path.join(dir,x.name)]);}
let unchanged=0,changedBusinessFiles=[];
for(const sub of ['miniprogram','cloudfunctions','renderer-probe']){
 const before=filesUnder(path.join(previous,sub)).map(x=>path.relative(previous,x)).sort(),after=filesUnder(path.join(root,sub)).map(x=>path.relative(root,x)).sort();
 if(project==='14-studyhub-testing')assert.deepEqual(before,after);
 for(const file of after){const existed=fs.existsSync(path.join(previous,file));if(existed&&fs.readFileSync(path.join(previous,file)).compare(fs.readFileSync(path.join(root,file)))===0)unchanged++;else changedBusinessFiles.push(file.split(path.sep).join('/'));}
 for(const file of before)assert.ok(after.includes(file),'Existing business file removed');
}
if(project==='14-studyhub-testing')assert.equal(changedBusinessFiles.length,0);
else {
 const allowed=project==='16-studyhub-operations'?["miniprogram/app.js", "miniprogram/app.json", "miniprogram/config/runtime.js", "miniprogram/content/data-notice.js", "miniprogram/packageLab/pages/operations/index.js", "miniprogram/packageLab/pages/operations/index.json", "miniprogram/packageLab/pages/operations/index.wxml", "miniprogram/packageLab/pages/operations/index.wxss", "miniprogram/pages/account/index.js", "miniprogram/pages/account/index.wxml", "miniprogram/services/cloud-client.js", "miniprogram/services/diagnostics-core.js", "miniprogram/services/diagnostics.js", "miniprogram/services/environment-core.js", "miniprogram/services/environment.js", "miniprogram/services/observed-call.js"]:['miniprogram/app.json','miniprogram/pages/account/index.js','miniprogram/pages/account/index.wxml','miniprogram/services/images.js','miniprogram/pages/gallery/index.js','miniprogram/pages/gallery/index.wxml','miniprogram/services/platform-api.js','miniprogram/services/report-files.js','miniprogram/packageLab/pages/platform/index.js','miniprogram/packageLab/pages/platform/index.wxml','miniprogram/config/privacy.js','miniprogram/services/privacy-core.js','miniprogram/services/privacy.js','miniprogram/content/data-notice.js',...['js','json','wxml','wxss'].map(ext=>'miniprogram/packageLab/pages/privacy/index.'+ext)];
 assert.deepEqual(changedBusinessFiles.sort(),allowed.sort());
}

const inherited=read(path.join(__dirname,(project==='16-studyhub-operations'?'第十五阶段兼容继承测试结果.json':project==='15-studyhub-release'?'第十四阶段兼容继承测试结果.json':'第十三阶段兼容继承测试结果.json')));assert.equal(inherited.project,project);assert.equal(inherited.totalPassed,450);
const result={date:'2026-11-03',project,passed:50,inheritedPassed:450,totalPassed:500,realCloud:false,realWechat:false,node:process.version,sourceDigest:current,businessFilesByteIdentical:unchanged,changedBusinessFiles,
 expectedNegativePaths:3,fixedMutantsDetected:3,extraChecksIncludedIn500:false,componentRenderingExecuted:false,devtoolsAutomationExecuted:false,ciExecuted:false,coverage:main.coverage,scenarios:main.scenarios.map(x=>x.name)};
fs.writeFileSync(path.join(__dirname,(project==='16-studyhub-operations'?'第十五阶段测试体系继承结果.json':project==='15-studyhub-release'?'第十四阶段测试体系继承结果.json':'第十三阶段测试结果.json')),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({passed:50,inheritedPassed:450,totalPassed:500,expectedNegativePaths:3,fixedMutantsDetected:3,componentRenderingExecuted:false}));
