const REQUIREMENTS=['operator-account-category','filing-applicability','privacy-console','retention-and-rights','cloud-permissions-indexes','privacy-device-paths','review-materials','operations-and-rollback'];
const {reviewedConfig}=require('../miniprogram/services/privacy-core');
const filled=value=>typeof value==='string'&&value.trim().length>0&&!/待运营者|待填写|TODO|TBD|占位/i.test(value);
const saneDate=(value,today)=>{if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;const date=new Date(value+'T00:00:00Z');return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===value&&value<=today;};
function evaluate(snapshot,today){
 const errors=[],warnings=[];const add=(code,message)=>errors.push({code,message});
 const {projectConfig={},cloud={},privacy={},platform={},performance={},plan={},inventory={},files=[],sourceFiles=[],fingerprint='',tests={}}=snapshot;
 if(!filled(plan.targetVersion)||!/^\d+\.\d+\.\d+$/.test(plan.targetVersion))add('VERSION_MISSING','填写课程约定的数字三段版本；这不是平台所有场景的格式定义。');
 if(!filled(projectConfig.appid)||projectConfig.appid==='touristappid'||projectConfig.appid!==plan.expectedAppId)add('APPID_MISMATCH','项目AppID须填写并与本次目标逐字核对。');
 if(!filled(cloud.ENV_ID)||cloud.ENV_ID!==plan.expectedEnvId)add('ENV_MISMATCH','云环境须填写并与本次目标逐字核对。');
 if(projectConfig.setting?.urlCheck!==true)add('DOMAIN_CHECK_DISABLED','不能把关闭域名校验当作交付配置。');
 if(platform.ENABLE_LOCAL_FILE_LAB!==false)add('LOCAL_HTTP_LAB_ENABLED','固定本机HTTP实验开关须在本次交付核对中关闭。');
 if(performance.ENABLE_DEV_METRICS!==false)add('DEV_METRICS_ENABLED','本课程发布候选要求关闭开发采样；生产监测另行设计。');
 if(!reviewedConfig(privacy))add('PRIVACY_SETUP','运营者、联系方式、指引版本与人工核对标志未齐备。');
 if(plan.audience!=='production-candidate')add('TEACHING_AUDIENCE','当前计划仍为学习版本，未作为生产候选核对。');
 if(!/^[a-f0-9]{64}$/.test(plan.codeFingerprint||'')||plan.codeFingerprint!==fingerprint)add('FINGERPRINT_MISMATCH','计划中的客户端/云函数摘要与当前输入不一致或未填写。');
 for(const key of REQUIREMENTS){const evidence=plan.evidence?.[key];if(evidence?.status!=='verified'||!saneDate(evidence.checkedAt,today)||!filled(evidence.reference))add('EVIDENCE_PENDING:'+key,'人工证据未齐备：'+key);}
 const names=new Set(files);const items=inventory.items;
 if(!Array.isArray(items)||!items.length||items.some(x=>!x||typeof x!=='object'||!filled(x.id))||new Set(items.map(x=>x.id)).size!==items.length)add('INVENTORY_INVALID','数据清单缺失或编号重复。');
 else for(const item of items){if(!filled(item.purpose)||!Array.isArray(item.fields)||!item.fields.length)add('DATA_PURPOSE:'+item.id,'数据用途或字段尚未明确。');
  if(['recipientAndRegion','retention','rightsAndDeletion'].some(key=>!filled(item[key])))add('DATA_LIFECYCLE:'+item.id,'接收方/地域、期限与权利处理待确认：'+item.id);
  if(!Array.isArray(item.sourceRefs)||!item.sourceRefs.length||item.sourceRefs.some(ref=>typeof ref!=='string'||ref.startsWith('/')||ref.includes('..')||!names.has(ref)))add('DATA_SOURCE:'+item.id,'源码引用缺失或越出本项目：'+item.id);
 }
 for(const name of files){if(/\.(?:pem|key|p12|pfx)$/i.test(name))add('KEY_FILE:'+name,'项目中发现密钥类文件名，请移出交付源码并核对。');}
 const mapped={chooseMedia:['miniprogram/services/images.js'],chooseMessageFile:['miniprogram/services/report-files.js'],getClipboardData:['miniprogram/packageLab/pages/platform/index.js']};
 const findings=[];const pattern=/(?:\bwx\.|\bapi\.call\(\s*['"]|\bapi\(\s*['"])(chooseMedia|chooseMessageFile|getClipboardData|getLocation|startLocationUpdate|chooseAddress|getUserProfile|getRecorderManager)\b/g;
 for(const file of sourceFiles){
  if(/-----BEGIN (?:RSA |EC )?PRIVATE KEY-----|["']?(?:appsecret|privatekey)["']?\s*[:=]\s*["'][^"']+["']/i.test(file.text))add('SECRET_PATTERN:'+file.path,'发现密钥内容特征，仅报告路径，不输出内容。');
  if(!file.path.startsWith('miniprogram/'))continue;
  const text=file.text.replace(/\/\*[\s\S]*?\*\//g,'').replace(/^\s*\/\/.*$/gm,'');
  for(const match of text.matchAll(pattern)){findings.push({api:match[1],path:file.path});if(!mapped[match[1]]?.includes(file.path))add('UNMAPPED_API:'+match[1],'发现尚未纳入课程映射的接口调用：'+match[1]);}
 }
 const lookup=new Map(sourceFiles.map(x=>[x.path,x.text]));
 for(const name of ['miniprogram/services/images.js','miniprogram/services/platform-api.js'])if(!lookup.get(name)?.includes('privacy.ensure('))add('PRIVACY_GUARD_MISSING:'+name,'课程已接入读取入口的隐私前置检查缺失。');
 if(!tests.matchesSources||tests.status!=='passed'||tests.passed!==50)add('TESTS_STALE','本项目标准50项测试报告缺失、过期或未完整通过。');
 warnings.push({code:'LIMITED_SCAN',message:'有限字面调用/密钥特征与材料检查，不是完整数据流分析、后台检测或合规认证。'});
 warnings.push({code:'REMOTE_UNKNOWN',message:'未读取远端模板、规则、备案、类目、隐私声明和审核状态；人工reference仅为登记，不验证真实性。'});
 return{kind:'local-release-readiness',localChecksPass:errors.length===0,readyForPublicRelease:false,externalVerification:'notPerformed',errors,warnings,codeFingerprint:fingerprint,findings,checkedAt:today};
}
module.exports={evaluate,REQUIREMENTS,filled,saneDate};
