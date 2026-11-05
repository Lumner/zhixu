const { createOutbox } = require('./outbox-core');
const { call } = require('./cloud-client');
const { ENV_ID } = require('../config/cloud');
const { validTask } = require('../utils/task');
const { validNote } = require('../shared/knowledge-schema');
const { validAck } = require('../shared/focus-contract');
// 编号仅用于减少意外碰撞，不能作为授权凭证；服务端仍从微信上下文鉴权。
const newId = () => 'op_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 13) + '_' + Math.random().toString(36).slice(2, 13);
const getIdentity = async () => {
  const identity = await call('whoami');
  if (!identity || identity.authenticated !== true || typeof identity.appId !== 'string' || !/^[a-f0-9]{12}$/.test(identity.userTag)) {
    throw Object.assign(new Error('身份响应不合法'), { code: 'PROTOCOL' });
  }
  return identity;
};
async function send(action, payload) {
  const result = await call(action, payload);
  let valid = false;
  if (action === 'create' || action === 'importTask') valid = validTask(result);
  if (action === 'update') valid = result && result.id === payload.id && result.version === payload.version + 1;
  if (action === 'remove') valid = result && result.id === payload.id && result.removed === true;
  if (action === 'noteCreate') valid = validNote(result);
  if (action === 'noteUpdate') valid = result && result.id === payload.id && result.version === payload.version + 1;
  if (action === 'noteRemove') valid = result && result.id === payload.id && result.removed === true;
  if (action === 'imageUpload') valid = result && typeof result.id === 'string' && result.state === 'active';
  if (action === 'imageRemove') valid = result && result.id === payload.id && result.removed === true && typeof result.cleanupPending === 'boolean';
  if (action === 'focusStart') valid = validAck(result) && result.version === 1 && result.state === 'running';
  if (['focusPause', 'focusResume', 'focusStop'].includes(action)) valid = validAck(result) && result.sessionId === payload.id
    && result.version >= payload.version && result.version <= payload.version + 1;
  if (!valid) throw Object.assign(new Error('写入响应不合法，保留原操作编号'), { code: 'PROTOCOL' });
  return result; // 确认结构后，outbox-core 才能移除待处理记录。
}
module.exports = createOutbox({ getIdentity, envId: ENV_ID, read: key => wx.getStorageSync(key),
  write: (key, value) => wx.setStorageSync(key, value), send, newId });
