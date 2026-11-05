const fail=(code,message)=>Object.assign(new Error(message),{code});
const reviewedConfig=config=>config&&config.DISCLOSURE_REVIEWED===true&&['POLICY_VERSION','OPERATOR_NAME','CONTACT'].every(key=>typeof config[key]==='string'&&config[key].trim().length>0&&config[key].length<=200);
const SENSITIVE=new Set(['chooseMedia','getClipboardData','chooseMessageFile']);
function createPrivacyAccess({api,config,setTimer=setTimeout,clearTimer=clearTimeout,timeoutMs=5000}){
 function invoke(name){return new Promise((resolve,reject)=>{
  if(typeof api[name]!=='function'){reject(fail('PRIVACY_UNSUPPORTED','当前环境不支持隐私指引能力，请使用支持的微信环境。'));return;}
  let settled=false;const finish=(fn,value)=>{if(!settled){settled=true;clearTimer(timer);fn(value);}};
  const timer=setTimer(()=>finish(reject,fail('PRIVACY_TIMEOUT','隐私状态未确认，请稍后主动重试。')),timeoutMs);
  try{api[name]({success:value=>finish(resolve,value),fail:()=>finish(reject,fail('PRIVACY_PLATFORM','隐私接口未完成，请核对后台声明和当前能力。'))});}
  catch(_){finish(reject,fail('PRIVACY_PLATFORM','隐私接口启动失败。'));}
 });}
 async function inspect(){const value=await invoke('getPrivacySetting');if(!value||typeof value.needAuthorization!=='boolean')throw fail('PRIVACY_PROTOCOL','隐私状态响应不合法。');
  return {needAuthorization:value.needAuthorization,contractName:typeof value.privacyContractName==='string'?value.privacyContractName.slice(0,200):'',
   note:'false仅表示平台当前不要求补授权，也可能是后台未声明；不证明声明完整或系统权限已授予。'};
 }
 async function ensure(name,isActive=()=>true){
  if(!SENSITIVE.has(name))throw fail('PRIVACY_ACTION','未知的课程隐私入口。');
  if(typeof isActive!=='function'||!isActive())throw fail('CANCELLED','页面已离开，本次操作不再启动。');
  if(!reviewedConfig(config))throw fail('PRIVACY_SETUP','教学隐私声明尚未核对，请先查看数据与隐私说明。');
  const current=await inspect();if(!current.contractName.trim())throw fail('PRIVACY_SETUP','平台未返回有效指引名称，请核对后台隐私声明。');if(typeof isActive!=='function'||!isActive())throw fail('CANCELLED','页面已离开，本次操作不再启动。');
  if(current.needAuthorization)throw fail('PRIVACY_REQUIRED','请先在数据与隐私页阅读平台指引并明确选择，再返回主动重试此操作。');
  return current;
 }
 return {inspect,ensure,openContract:()=>invoke('openPrivacyContract')};
}
module.exports={createPrivacyAccess,SENSITIVE,reviewedConfig};
