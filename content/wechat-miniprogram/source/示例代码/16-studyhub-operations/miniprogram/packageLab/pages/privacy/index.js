const {reviewedConfig}=require('../../../services/privacy-core');
const privacy=require('../../../services/privacy');
const config=require('../../../config/privacy');
const notice=require('../../../content/data-notice');
Page({
 data:{notice,reviewed:false,configured:false,busy:false,needAuthorization:null,contractName:'',statusText:'尚未查询平台状态。',message:''},
 onLoad(){this._alive=true;this._visible=false;this._epoch=0;this._working=false;
  this.setData({reviewed:config.DISCLOSURE_REVIEWED===true,configured:reviewedConfig(config)});},
 onShow(){this._visible=true;},
 onHide(){this._visible=false;this._epoch++;this._working=false;this.setData({busy:false});},
 onUnload(){this._alive=false;this._visible=false;this._epoch++;},
 async run(work){if(this._working||!this._visible)return;this._working=true;const token=++this._epoch;this.setData({busy:true,message:''});
  try{const patch=await work();if(this._alive&&this._visible&&token===this._epoch&&patch)this.setData(patch);}
  catch(error){if(this._alive&&this._visible&&token===this._epoch)this.setData({message:error.message});}
  finally{if(token===this._epoch){this._working=false;if(this._alive&&this._visible)this.setData({busy:false});}}
 },
 onInspect(){return this.run(async()=>{const value=await privacy.inspect();return{needAuthorization:value.needAuthorization,contractName:value.contractName,statusText:value.needAuthorization?'平台当前提示需要隐私授权。':'平台当前不要求补授权；不能由此证明后台声明完整。'};});},
 onOpenContract(){return this.run(async()=>{await privacy.openContract();return{message:'打开指引接口已返回；阅读本身不是同意，也不是声明审核通过。'};});},
 onAgree(){// 只响应原生agreePrivacyAuthorization事件；不写本地同意位，也不自动发起原业务。
  return this.onInspect();
 },
 onDecline(){this._epoch++;this._working=false;this.setData({busy:false,message:'本次不继续授权；不读取图片、文件或剪贴板。可返回使用其他功能。'});},
 onAccount(){wx.switchTab({url:'/pages/account/index'});}
});
