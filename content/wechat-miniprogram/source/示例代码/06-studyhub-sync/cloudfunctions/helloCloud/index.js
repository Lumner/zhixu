const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
exports.main = async () => {
  const context = cloud.getWXContext();
  return { ok: true, data: { message: '云函数已响应', serverTime: Date.now(),
    hasWechatIdentity: Boolean(context.OPENID && context.APPID) } };
};
