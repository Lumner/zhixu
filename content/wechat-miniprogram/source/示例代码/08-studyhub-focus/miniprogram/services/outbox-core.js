const clone = value => JSON.parse(JSON.stringify(value));
const fail = (code, message) => Object.assign(new Error(message), { code });
function createOutbox({ getIdentity, envId, read, write, send, newId }) {
  async function scope() {
    const user = await getIdentity(); // 每次重新确认当前身份，离线时不猜测归属。
    return envId + ':' + user.appId + ':' + user.userTag;
  }
  const keyFor = owner => 'studyhub.outbox.v1:' + owner;
  function load(owner) {
    const value = read(keyFor(owner));
    if (value === '' || value === undefined) return [];
    if (!value || value.schemaVersion !== 1 || !Array.isArray(value.items) || value.items.length > 8
      || value.items.some(row => !row || row.owner !== owner || !/^[A-Za-z0-9_-]{16,100}$/.test(row.opId)
        || !['pending', 'blocked'].includes(row.state) || typeof row.action !== 'string'
        || !row.payload || typeof row.payload !== 'object' || Array.isArray(row.payload))) {
      throw fail('LOCAL_DATA', '待处理记录损坏，请先导出缓存排查');
    }
    return clone(value.items);
  }
  function save(owner, items) {
    try { write(keyFor(owner), { schemaVersion: 1, items: clone(items) }); }
    catch (_) { throw fail('LOCAL_STORAGE', '本地记录保存失败，保留原记录后检查缓存空间'); }
  }
  const uncertain = code => !['INVALID_INPUT', 'INVALID_IMAGE', 'CONFLICT', 'NOT_FOUND', 'UNAUTHENTICATED',
    'IDEMPOTENCY_MISMATCH', 'MIGRATION_SOURCE_CHANGED', 'ATTACHMENT_UNAVAILABLE', 'RELATED_TASK_UNAVAILABLE', 'ASSET_IN_USE',
    'FOCUS_ACTIVE', 'FOCUS_CHANGED'].includes(code);
  async function deliver(owner, opId) {
    if (await scope() !== owner) throw fail('IDENTITY_CHANGED', '当前账号或环境已经变化');
    const row = load(owner).find(item => item.opId === opId);
    if (!row || row.state !== 'pending') throw Object.assign(fail('LOCAL_STATE', '该操作不能直接重试，请到待处理页核对'), { queued: Boolean(row) });
    let result;
    try { result = await send(row.action, { ...clone(row.payload), opId: row.opId }); }
    catch (error) {
      // 本地状态始终重新读取，避免不同异步请求互相覆盖队列。
      const items = load(owner).map(item => item.opId === opId
        ? { ...item, state: uncertain(error.code) ? 'pending' : 'blocked', errorCode: error.code || 'UNKNOWN', errorMessage: error.message } : item);
      save(owner, items); error.queued = true; throw error;
    }
    try { save(owner, load(owner).filter(item => item.opId !== opId)); }
    catch (error) { error.queued = true; throw error; }
    return result;
  }
  return {
    identity: scope,
    async list() { const owner = await scope(); return load(owner); },
    async submit(action, payload, expectedOwner) {
      const owner = await scope(), items = load(owner), text = JSON.stringify(payload);
      if (expectedOwner && owner !== expectedOwner) throw fail('IDENTITY_CHANGED', '预览后账号或环境发生变化，请重新核对');
      const same = items.find(item => item.action === action && JSON.stringify(item.payload) === text);
      if (same) return deliver(owner, same.opId);
      if (items.length >= 8) throw fail('OUTBOX_FULL', '请先处理待确认或冲突操作');
      const row = { owner, opId: newId(), action, payload: clone(payload), state: 'pending', createdAt: Date.now() };
      save(owner, [...items, row]); // 必须先落盘，随后才发出云端写入。
      return deliver(owner, row.opId);
    },
    async retry(opId) { return deliver(await scope(), opId); },
    async discard(opId) {
      const owner = await scope(), items = load(owner), row = items.find(item => item.opId === opId);
      if (!row || row.state !== 'blocked') throw fail('LOCAL_STATE', '结果未确认的操作不可丢弃后重新提交');
      save(owner, items.filter(item => item.opId !== opId));
    },
    async rebase(opId, latestVersion) {
      const owner = await scope(), items = load(owner), row = items.find(item => item.opId === opId);
      if (!row || !['update', 'noteUpdate'].includes(row.action) || row.state !== 'blocked' || row.errorCode !== 'CONFLICT'
        || !Number.isSafeInteger(latestVersion) || latestVersion < 1) throw fail('LOCAL_STATE', '不是可处理的编辑冲突');
      const replacement = { ...row, opId: newId(), state: 'pending', errorCode: '', errorMessage: '',
        payload: { ...row.payload, version: latestVersion }, createdAt: Date.now() };
      save(owner, items.map(item => item.opId === opId ? replacement : item));
      return deliver(owner, replacement.opId);
    }
  };
}
module.exports = { createOutbox };
