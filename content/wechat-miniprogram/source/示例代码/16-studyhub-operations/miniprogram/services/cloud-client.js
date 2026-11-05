const { ENV_ID, FUNCTION_NAME } = require('../config/cloud');
const { createInvoker } = require('./invoke-core');
const { createObservedCall } = require('./observed-call');
const diagnostics = require('./diagnostics');
const rawInvoke = createInvoker({ envId: ENV_ID,
  ready: () => ({ ready: getApp().globalData.cloudReady, message: getApp().globalData.bootError }),
  callFunction: options => wx.cloud.callFunction(options) });
const invoke = createObservedCall({ invoke: rawInvoke, record: diagnostics.record });
function call(action, data = {}) { return invoke(FUNCTION_NAME, { ...data, action }); }
module.exports = { call, ping: () => invoke('helloCloud', {}) };
