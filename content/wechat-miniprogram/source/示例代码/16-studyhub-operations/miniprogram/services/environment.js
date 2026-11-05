const { checkEnvironment } = require('./environment-core');
const runtime = require('../config/runtime');
const cloud = require('../config/cloud');
function inspect() {
  let account;
  try { if (typeof wx.getAccountInfoSync === 'function') account = wx.getAccountInfoSync(); } catch (_) {}
  return checkEnvironment({ runtime, cloud, account });
}
module.exports = { inspect };
