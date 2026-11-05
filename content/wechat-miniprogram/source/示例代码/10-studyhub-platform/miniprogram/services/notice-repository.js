const { ENV_ID } = require('../config/cloud');
const api = require('./platform-api');
function valid(value) {
  return value && (value.enabled === false || (value.enabled === true && /^[a-f0-9]{64}$/.test(value.id)
    && typeof value.templateId === 'string' && value.templateId.length >= 10 && /^\d{4}-\d{2}-\d{2}$/.test(value.day)
    && ['ready', 'sending', 'sent', 'failed', 'unknown'].includes(value.state)));
}
async function invoke(action, id) {
  if (!getApp().globalData.cloudReady) throw api.error('NOT_CONFIGURED', '请先配置云环境');
  const response = await api.call('callFunction', { name: 'studyhubNotice', config: { env: ENV_ID },
    data: action === 'prepare' ? { action } : { action, id } }, wx.cloud);
  const body = response.result;
  if (!body || typeof body.ok !== 'boolean') throw api.error('PROTOCOL', '消息函数响应不合法');
  if (!body.ok) throw api.error(body.error && body.error.code || 'BUSINESS', body.error && body.error.message || '消息状态未确认');
  if (!valid(body.data)) throw api.error('PROTOCOL', '消息状态协议不合法');
  return body.data;
}
const stateText = value => !value.enabled ? value.message || '消息未启用' : ({ ready: '可申请一次练习回执', sending: '尝试已占位，结果待核对；不自动重发',
  sent: '平台接口已接受；实际展示和送达需手机核对', failed: '平台明确拒绝，本日不再次尝试', unknown: '结果未确认，请人工核对，本日不重新发送' }[value.state]);
module.exports = { prepare: () => invoke('prepare'), send: id => invoke('send', id), valid, stateText };
