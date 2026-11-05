const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {evaluate}=require('./release-audit-core.cjs');
function snapshot(root){
 const files=[];function walk(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){if(['node_modules','.git','reports','__pycache__'].includes(entry.name))continue;const file=path.join(dir,entry.name);if(entry.isDirectory())walk(file);else files.push(path.relative(root,file).split(path.sep).join('/'));}}walk(root);
 const code=files.filter(name=>name.startsWith('miniprogram/')||name.startsWith('cloudfunctions/')).sort(),hash=crypto.createHash('sha256');
 for(const name of code){if(/\.(?:pem|key|p12|pfx)$/i.test(name))continue;hash.update(name+'\0').update(fs.readFileSync(path.join(root,name)));}
 const json=name=>JSON.parse(fs.readFileSync(path.join(root,name),'utf8'));
 // 只加载本教程可信的纯配置模块，不运行云函数或外部发布工具。
 const config=name=>require(path.join(root,name));
 let tests={matchesSources:false};try{const report=json('tests/reports/latest.json'),current=config('tests/support/digest.cjs').digest();tests={matchesSources:report.sourceDigest===current,status:report.status,passed:report.summary?.counts?.passed||0};}catch(_){}
 return{projectConfig:json('project.config.json'),cloud:config('miniprogram/config/cloud.js'),privacy:config('miniprogram/config/privacy.js'),platform:config('miniprogram/config/platform.js'),performance:config('miniprogram/config/performance.js'),plan:json('release/release-plan.json'),inventory:json('release/data-inventory.json'),files,
 sourceFiles:code.filter(name=>/\.(?:js|json|wxml)$/.test(name)).map(name=>({path:name,text:fs.readFileSync(path.join(root,name),'utf8')})),fingerprint:hash.digest('hex'),tests};
}
// 本课程的运营材料日期按固定UTC+08:00；避免北京时间凌晨把当天材料误判为未来。
if(require.main===module){const root=path.resolve(__dirname,'..'),today=new Date(Date.now()+8*60*60*1000).toISOString().slice(0,10);let result;
 try{result=evaluate(snapshot(root),today);}catch(_){result={kind:'local-release-readiness',localChecksPass:false,readyForPublicRelease:false,externalVerification:'notPerformed',errors:[{code:'AUDIT_INPUT_ERROR',message:'本地审查输入无法读取或解析，请核对配置文件；不沿用旧通过结论。'}],checkedAt:today};}
 const file=path.join(root,'release/reports/readiness.json');fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({localChecksPass:result.localChecksPass,readyForPublicRelease:false,blockers:result.errors.length,codes:result.errors.map(x=>x.code)}));process.exitCode=result.localChecksPass?0:2;}

module.exports={snapshot};
