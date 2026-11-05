const { addTask,checkedTasks,summary,fontSize } = require('../../../utils/accessibility');
const seed=()=>[{id:'demo_1',title:'朗读标题并核对输入提示',done:false},{id:'demo_2',title:'把字号调大后检查换行和按钮',done:false},{id:'demo_3',title:'在真实设备开启读屏逐项操作',done:false}];
Page({
  data: { items:[],title:'',error:'',result:'',summary:'',theme:'light',fontMode:'normal',fontPx:18,titleFocus:false },
  onLoad() { this._alive=true;this._serial=0;this.reset(); },
  onShow() { this._visible=true; }, onHide() { this._visible=false; }, onUnload() { this._alive=false;this._visible=false; },
  reset() { const items=seed();this.setData({items,title:'',error:'',result:'固定本地演示已重置，不写云或缓存。',summary:summary(items),titleFocus:false}); },
  onTitle(event) { const title=event.detail.value; if(typeof title==='string')this.setData({title,error:'',titleFocus:false}); },
  onBlur() { this.setData({titleFocus:false}); },
  onSubmit() {
    const added=addTask(this.data.items,this.data.title,'local_'+(this._serial+1));
    if(!added.ok){this.setData({error:added.error,result:'未添加，请修改标题。',titleFocus:false},()=>{if(this._alive&&this._visible)this.setData({titleFocus:true});});return;}
    this._serial++;this.setData({items:added.items,title:'',error:'',result:'已添加本地演示项；离开后不保证保留。',summary:summary(added.items),titleFocus:false});
  },
  onChecked(event) { const items=checkedTasks(this.data.items,event.detail.value);if(!items)return;this.setData({items,summary:summary(items),result:'完成状态已更新；可查看下方文字汇总。'}); },
  onFont(event) { const mode=event.currentTarget.dataset.mode;if(!['normal','large','largest'].includes(mode))return;this.setData({fontMode:mode,fontPx:fontSize(mode)}); },
  onTheme(event) { const theme=event.currentTarget.dataset.theme;if(['light','dark'].includes(theme))this.setData({theme}); },
  onReset() { this.reset(); }
});
