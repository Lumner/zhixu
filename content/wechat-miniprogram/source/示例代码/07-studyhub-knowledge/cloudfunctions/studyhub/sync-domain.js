const crypto = require('node:crypto');
const base = require('./domain-base');
const { createImageService } = require('./images');
const { createKnowledgeService } = require('./knowledge');
const { reject, assertKeys, checkId, checkVersion, cleanFields, publicTask, principal } = base;
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const canonical = value => JSON.stringify(value); // 调用处先构造固定顺序、无未知字段的对象。
const owned = (row, actor) => row && row.ownerId === actor.ownerId && row.ownerAppId === actor.ownerAppId;
function operationId(id) {
  if (typeof id !== 'string' || !/^[A-Za-z0-9_-]{16,100}$/.test(id)) reject('INVALID_INPUT', '操作编号不合法');
}
function receiptId(actor, opId) { return hash(canonical([actor.ownerAppId, actor.ownerId, opId])); }
function checkReceipt(row, fingerprint) {
  if (row && row.fingerprint !== fingerprint) reject('IDEMPOTENCY_MISMATCH', '同一操作编号不能提交不同内容');
  return row;
}
function createHandler({ store, storage, getContext, expectedAppId, now = Date.now, logger = console,
  randomId = () => crypto.randomBytes(16).toString('hex') }) {
  const reader = base.createHandler({ store, getContext, expectedAppId, now, logger });
  const images = createImageService({ store, storage, now, randomId, hash, owned, receiptId, checkReceipt });
  const knowledge = createKnowledgeService({ store, now, hash, owned, receiptId, checkReceipt });
  return async function handle(input) {
    try {
      const actor = principal(getContext(), expectedAppId);
      assertKeys(input, ['action', 'userInfo', 'opId', 'id', 'version', 'fields', 'sourceKey', 'localId',
        'cursor', 'limit', 'filter', 'caption', 'base64', 'q', 'tag', 'kind', 'favoriteOnly']);
      const event = { ...input }; delete event.userInfo;
      const action = event.action;
      if (['whoami', 'list', 'get'].includes(action)) return reader(event);
      if (['imageList', 'imageRead'].includes(action)) return { ok: true, data: await images.read(actor, event) };
      if (['noteList', 'noteGet'].includes(action)) return { ok: true, data: await knowledge.read(actor, event) };
      operationId(event.opId);
      if (['noteCreate', 'noteUpdate', 'noteRemove'].includes(action)) return { ok: true, data: await knowledge.write(actor, event) };
      if (['imageUpload', 'imageRemove'].includes(action)) return { ok: true, data: await images.write(actor, event) };
      let payload;
      if (action === 'create') {
        assertKeys(event, ['action', 'opId', 'fields']); payload = { action, fields: cleanFields(event.fields) };
      } else if (action === 'update' || action === 'remove') {
        assertKeys(event, action === 'update' ? ['action', 'opId', 'id', 'version', 'fields'] : ['action', 'opId', 'id', 'version']);
        checkId(event.id); checkVersion(event.version);
        payload = { action, id: event.id, version: event.version };
        if (action === 'update') payload.fields = cleanFields(event.fields);
      } else if (action === 'importTask') {
        assertKeys(event, ['action', 'opId', 'sourceKey', 'localId', 'fields']); checkId(event.localId);
        if (!['studyhub.tasks.v1', 'studyhub.tasks.v2'].includes(event.sourceKey)) reject('INVALID_INPUT', '迁移来源不支持');
        payload = { action, sourceKey: event.sourceKey, localId: event.localId, fields: cleanFields(event.fields) };
      } else reject('INVALID_INPUT', '不支持的操作');
      const rid = receiptId(actor, event.opId), fingerprint = hash(canonical(payload)), timestamp = now();
      const data = await store.transaction(async tx => {
        const old = checkReceipt(await tx.get('studyhub_ops', rid), fingerprint);
        if (old) return old.result;
        let result;
        if (action === 'create' || action === 'importTask') {
          let mappingId;
          if (action === 'importTask') {
            mappingId = hash(canonical([actor.ownerAppId, actor.ownerId, payload.sourceKey, payload.localId]));
            const mapping = await tx.get('studyhub_migrations', mappingId);
            if (mapping) {
              if (mapping.fingerprint !== fingerprint) reject('MIGRATION_SOURCE_CHANGED', '该本地记录已导入且内容发生变化，请手动核对');
              result = mapping.result; // 后来删除了云任务，也不自动复活。
            }
          }
          if (!result) {
            const id = hash('task:' + (mappingId || rid));
            const task = { _id: id, ...actor, ...payload.fields, version: 1, createdAt: timestamp, updatedAt: timestamp };
            await tx.set('studyhub_tasks', id, task); result = publicTask(task);
            if (mappingId) await tx.set('studyhub_migrations', mappingId, { ...actor, fingerprint, result, createdAt: timestamp });
          }
        } else {
          const task = await tx.get('studyhub_tasks', payload.id);
          if (!owned(task, actor)) reject('NOT_FOUND', '任务不存在或不可访问');
          if (task.version !== payload.version) reject('CONFLICT', '任务已经变化，保留草稿并读取最新内容');
          if (action === 'update') {
            const next = { ...task, ...payload.fields, version: task.version + 1, updatedAt: Math.max(timestamp, task.updatedAt) };
            await tx.set('studyhub_tasks', task._id, next); result = { id: task._id, version: next.version };
          } else { await tx.remove('studyhub_tasks', task._id); result = { id: task._id, removed: true }; }
        }
        await tx.set('studyhub_ops', rid, { ...actor, fingerprint, result, createdAt: timestamp });
        return result;
      });
      return { ok: true, data };
    } catch (error) {
      if (error.publicCode) return { ok: false, error: { code: error.publicCode, message: error.message } };
      logger.error({ type: 'studyhub-sync-error', code: error.code || error.name || 'UNKNOWN' });
      return { ok: false, error: { code: 'INTERNAL', message: '结果尚未确认，请保留操作编号后重试' } };
    }
  };
}
module.exports = { createHandler };
