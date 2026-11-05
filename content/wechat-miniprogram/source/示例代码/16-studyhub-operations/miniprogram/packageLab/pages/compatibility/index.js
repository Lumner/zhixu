const { readEnvironment, compareVersion } = require('../../../utils/compatibility');
const { paletteReport } = require('../../../utils/accessibility');
const { createWindowWatch } = require('../../../services/window-watch');
Page({
  data: { environment:null, reportText:'', watchStatus:'尚未监听', palette:[], note:'', versionText:'' },
  onLoad() { this._alive=true;this._visible=false;this._watch=createWindowWatch({api:wx,onChange:()=>this.refresh()});this.setData({palette:paletteReport().map(x=>({...x,ratioText:x.ratio.toFixed(2)}))}); },
  onShow() { this._visible=true;this.setData({watchStatus:this._watch.start()});this.refresh(); },
  onHide() { this._visible=false;this._watch.stop(); },
  onUnload() { this._alive=false;this._visible=false;this._watch.stop(); },
  refresh() {
    if (!this._alive || !this._visible) return;
    const environment=readEnvironment(wx,this.renderer),comparison=compareVersion(environment.app.SDKVersion,'2.20.1');
    this.setData({environment,reportText:JSON.stringify(environment,null,2),versionText:comparison===null?'基础库版本未知，不能由版本判断能力。':comparison>=0?'版本不低于2.20.1；仍须检测具体能力并处理调用失败。':'版本低于2.20.1；本页缺失信息保留未知。'});
  },
  onRefresh() { this.refresh(); },
  onMissingDemo() { const report=readEnvironment({},undefined);this.setData({note:'固定缺失能力模拟，不是当前设备：'+JSON.stringify(report)}); },
  onAccessibility() { wx.navigateTo({url:'/packageLab/pages/accessibility/index'}); }
});
