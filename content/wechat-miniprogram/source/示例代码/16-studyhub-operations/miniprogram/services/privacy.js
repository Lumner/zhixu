const {createPrivacyAccess}=require('./privacy-core');
const config=require('../config/privacy');
// 不注册全局onNeedPrivacyAuthorization，不缓存本地“同意”标志，也不在启动时请求授权。
const access=()=>createPrivacyAccess({api:wx,config});
module.exports={inspect:()=>access().inspect(),ensure:(name,isActive)=>access().ensure(name,isActive),openContract:()=>access().openContract()};
