const { ENV_ID, FUNCTION_NAME } = require('../config/cloud');
function error(code, message) { return Object.assign(new Error(message), { code }); }
function invoke(name, data) {
  return new Promise((resolve, reject) => {
    const app = getApp();
    if (!app.globalData.cloudReady) { reject(error('NOT_CONFIGURED', app.globalData.bootError || '云能力尚未初始化')); return; }
    wx.cloud.callFunction({
      name, data, config: { env: ENV_ID },
      success(response) {
        const body = response.result;
        if (!body || typeof body.ok !== 'boolean') { reject(error('PROTOCOL', '云函数响应格式不合法')); return; }
        if (!body.ok) { reject(error(body.error && body.error.code || 'BUSINESS', body.error && body.error.message || '云端操作失败')); return; }
        resolve(body.data);
      },
      fail(failure) {
        console.error('云函数传输失败', { errMsg: failure.errMsg });
        reject(error('TRANSPORT', '调用结果未确认，请核对环境、部署与网络，并检查任务是否已保存'));
      }
    });
  });
}
function call(action, data = {}) { return invoke(FUNCTION_NAME, { ...data, action }); }
module.exports = { call, ping: () => invoke('helloCloud', {}) };
