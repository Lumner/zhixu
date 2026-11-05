const { call } = require('./cloud-client');
const { validTask } = require('../utils/task');
const outbox = require('./outbox');
function protocol() { return Object.assign(new Error('云端任务结构不合法'), { code: 'PROTOCOL' }); }
async function list({ cursor = null, filter = 'all' } = {}) {
  const data = await call('list', { cursor, filter, limit: 10 });
  if (!data || !Array.isArray(data.items) || !data.items.every(validTask)
    || !(data.nextCursor === null || typeof data.nextCursor === 'string')) throw protocol();
  return data;
}
async function get(id) { const task = await call('get', { id }); if (!validTask(task)) throw protocol(); return task; }
async function create(fields) { const task = await outbox.submit('create', { fields }); if (!validTask(task)) throw protocol(); return task; }
async function update(id, version, fields) {
  const result = await outbox.submit('update', { id, version, fields });
  if (!result || result.id !== id || result.version !== version + 1) throw protocol();
  return result;
}
async function remove(id, version) {
  const result = await outbox.submit('remove', { id, version });
  if (!result || result.id !== id || result.removed !== true) throw protocol();
  return result;
}
async function whoami() {
  const result = await call('whoami');
  if (!result || result.authenticated !== true || typeof result.appId !== 'string'
    || typeof result.userTag !== 'string' || !/^[a-f0-9]{12}$/.test(result.userTag)) throw protocol();
  return result;
}
module.exports = { list, get, create, update, remove, whoami };
