const { ENV_ID, FUNCTION_NAME } = require('../config/cloud');
const { createInvoker } = require('./invoke-core');
const invoke = createInvoker({ envId: ENV_ID,
  ready: () => ({ ready: getApp().globalData.cloudReady, message: getApp().globalData.bootError }),
  callFunction: options => wx.cloud.callFunction(options) });
function call(action, data = {}) { return invoke(FUNCTION_NAME, { ...data, action }); }
module.exports = { call, ping: () => invoke('helloCloud', {}) };
