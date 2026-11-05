const { ENV_ID } = require('./config/cloud');
const { ENABLE_DEV_METRICS } = require('./config/performance');
const { createEntryCollector } = require('./services/performance-entries');
const environment = require('./services/environment');
const diagnostics = require('./services/diagnostics');
App({
  globalData: { cloudReady: false, bootError: '' },
  onLaunch() {
    this.performanceEntries = createEntryCollector({ api: wx, enabled: ENABLE_DEV_METRICS });
    this.performanceEntries.start();
    const target = environment.inspect();
    if (!target.ok) { this.globalData.bootError = '环境核对未通过：' + target.problems.join('、') + '；请核对runtime/cloud配置与平台版本。'; return; }
    if (!ENV_ID) { this.globalData.bootError = '请先填写 config/cloud.js 的 ENV_ID'; return; }
    if (!wx.cloud) { this.globalData.bootError = '当前环境不支持 wx.cloud，请检查基础库和工具'; return; }
    try {
      wx.cloud.init({ env: ENV_ID });
      this.globalData.cloudReady = true; // 只表示本地初始化完成，不代表部署/身份已经验收。
    } catch (error) { this.globalData.bootError = error.message || '云能力初始化失败'; }
  },
  onError() { diagnostics.record('runtime-error', { code: 'UNCAUGHT' }); },
  onUnhandledRejection() { diagnostics.record('unhandled', { code: 'UNHANDLED' }); }
});
