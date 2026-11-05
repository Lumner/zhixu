const { call } = require('./cloud-client');
const outbox = require('./outbox');
const { validSession, validId } = require('../shared/focus-contract');
const protocol = () => Object.assign(new Error('专注记录响应格式不合法'), { code: 'PROTOCOL' });
async function snapshot(action, payload = {}) {
  const sentAt = Date.now(); const result = await call(action, payload); const receivedAt = Date.now();
  if (!result || !Number.isSafeInteger(result.serverNow) || result.serverNow < 0
    || !(result.session === null || validSession(result.session)) || (action === 'focusGet' && (!result.session || result.session.id !== payload.id))) throw protocol();
  return { ...result, sentAt, receivedAt };
}
async function list(cursor = null) {
  const page = await call('focusList', { cursor });
  if (!page || !Array.isArray(page.items) || page.items.length > 10 || !page.items.every(validSession)
    || !(page.nextCursor === null || validId(page.nextCursor)) || (page.nextCursor !== null && page.nextCursor === cursor)) throw protocol();
  return page;
}
module.exports = { current: () => snapshot('focusCurrent'), get: id => snapshot('focusGet', { id }), list,
  start: fields => outbox.submit('focusStart', { fields }),
  pause: (id, version) => outbox.submit('focusPause', { id, version }),
  resume: (id, version) => outbox.submit('focusResume', { id, version }),
  stop: (id, version) => outbox.submit('focusStop', { id, version }) };
