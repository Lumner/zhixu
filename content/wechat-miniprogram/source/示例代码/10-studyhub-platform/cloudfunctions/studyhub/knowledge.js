const { URL } = require('node:url');
const schema = require('./knowledge-schema');
const { reject, assertKeys, checkId, checkVersion } = require('./domain-base');
function normalizeUrl(value) {
  let url;
  try { url = new URL(value); } catch (_) { schema.invalid('资源网址无法解析'); }
  if (url.protocol !== 'https:' || !url.hostname || url.username || url.password || (url.port && url.port !== '443')) {
    schema.invalid('资源仅支持没有用户名密码的 HTTPS 默认端口网址');
  }
  if (url.href.length > 800) schema.invalid('规范化后的资源网址过长');
  return url.href; // 只保存网址，不请求网页、解析标题或打开 web-view。
}
const fieldsOf = row => schema.cleanFields(schema.pickFields(row), normalizeUrl);
const detail = row => ({ id: row._id, ...fieldsOf(row), version: row.version, createdAt: row.createdAt, updatedAt: row.updatedAt });
const summary = row => { const note = detail(row); const { content, assetIds, ...rest } = note;
  return { ...rest, excerpt: content.slice(0, 140), assetCount: assetIds.length }; };
function parseQuery(event) {
  assertKeys(event, ['action', 'q', 'tag', 'kind', 'favoriteOnly', 'cursor']);
  const q = event.q === undefined ? '' : event.q;
  if (typeof q !== 'string' || q.length > 40) schema.invalid('关键词最多 40 个代码单元');
  const tag = event.tag === undefined || event.tag === '' ? '' : schema.normalizeTag(event.tag);
  const kind = event.kind === undefined ? 'all' : event.kind;
  if (!['all', 'note', 'link'].includes(kind)) schema.invalid('类型筛选不合法');
  const favoriteOnly = event.favoriteOnly === undefined ? false : event.favoriteOnly;
  if (typeof favoriteOnly !== 'boolean') schema.invalid('收藏筛选不合法');
  const cursor = event.cursor === undefined || event.cursor === null ? null : event.cursor;
  if (cursor !== null) checkId(cursor);
  return { q: q.trim().toLowerCase(), tag, kind, favoriteOnly, cursor };
}
function matches(row, query) {
  if (query.kind !== 'all' && row.kind !== query.kind) return false;
  if (query.favoriteOnly && !row.favorite) return false;
  if (query.tag && !row.tags.includes(query.tag)) return false;
  return !query.q || [row.title, row.content, row.url, ...row.tags].join('\n').toLowerCase().includes(query.q);
}
function createKnowledgeService({ store, now, hash, owned, receiptId, checkReceipt }) {
  return {
    async read(actor, event) {
      if (event.action === 'noteGet') {
        assertKeys(event, ['action', 'id']); checkId(event.id);
        const row = await store.transaction(tx => tx.get('studyhub_notes', event.id));
        if (!owned(row, actor)) reject('NOT_FOUND', '内容不存在或不可访问');
        return detail(row);
      }
      const query = parseQuery(event);
      const rows = await store.listKnowledge(actor, query.cursor, 41);
      const items = []; let scanned = 0;
      // 有界遍历：最多检查 40 条，最多返回 10 个命中；游标指向最后实际检查的记录。
      while (scanned < Math.min(rows.length, 40) && items.length < 10) {
        const row = rows[scanned++];
        if (matches(row, query)) items.push(summary(row));
      }
      const hasMore = rows.length > scanned;
      return { items, scanned, nextCursor: hasMore ? rows[scanned - 1]._id : null };
    },
    async write(actor, event) {
      const action = event.action;
      assertKeys(event, action === 'noteCreate' ? ['action', 'opId', 'fields']
        : action === 'noteUpdate' ? ['action', 'opId', 'id', 'version', 'fields'] : ['action', 'opId', 'id', 'version']);
      const payload = { action };
      if (action !== 'noteCreate') { checkId(event.id); checkVersion(event.version); Object.assign(payload, { id: event.id, version: event.version }); }
      if (action !== 'noteRemove') payload.fields = schema.cleanFields(event.fields, normalizeUrl);
      const rid = receiptId(actor, event.opId), fingerprint = hash(JSON.stringify(payload)), timestamp = now();
      return store.transaction(async tx => {
        const receipt = checkReceipt(await tx.get('studyhub_ops', rid), fingerprint);
        if (receipt) return receipt.result;
        let old = null;
        if (action !== 'noteCreate') {
          old = await tx.get('studyhub_notes', payload.id);
          if (!owned(old, actor)) reject('NOT_FOUND', '内容不存在或不可访问');
          if (old.version !== payload.version) reject('CONFLICT', '内容已变化，请保留草稿并比较最新版本');
        }
        const before = old ? old.assetIds : [], after = payload.fields ? payload.fields.assetIds : [];
        if (payload.fields && payload.fields.taskId) {
          const task = await tx.get('studyhub_tasks', payload.fields.taskId);
          if (!owned(task, actor)) reject('RELATED_TASK_UNAVAILABLE', '关联任务已删除或不可访问，请解除关联后再保存');
        }
        const assets = [];
        for (const id of [...new Set([...before, ...after])].sort()) {
          const asset = await tx.get('studyhub_assets', id);
          if (after.includes(id) && (!owned(asset, actor) || asset.state !== 'active')) {
            reject('ATTACHMENT_UNAVAILABLE', '图片已删除或不可访问，请移除失效附件后再保存');
          }
          const delta = Number(after.includes(id)) - Number(before.includes(id));
          if (delta && owned(asset, actor)) {
            const count = asset.noteRefs === undefined ? 0 : asset.noteRefs;
            if (!Number.isSafeInteger(count) || count < 0 || !Number.isSafeInteger(count + delta) || count + delta < 0) throw new Error('Asset reference count needs repair');
            assets.push({ ...asset, noteRefs: count + delta });
          }
        }
        // 读完相关文档后，再写引用计数、笔记与操作回执。
        for (const asset of assets) await tx.set('studyhub_assets', asset._id, asset);
        let result;
        if (action === 'noteRemove') {
          await tx.remove('studyhub_notes', old._id); result = { id: old._id, removed: true };
        } else {
          const id = old ? old._id : hash('note:' + rid);
          const row = { _id: id, ...actor, ...payload.fields, version: old ? old.version + 1 : 1,
            createdAt: old ? old.createdAt : timestamp, updatedAt: old ? Math.max(timestamp, old.updatedAt) : timestamp };
          await tx.set('studyhub_notes', id, row);
          result = action === 'noteCreate' ? detail(row) : { id, version: row.version };
        }
        await tx.set('studyhub_ops', rid, { ...actor, fingerprint, result, createdAt: timestamp });
        return result;
      });
    }
  };
}
module.exports = { createKnowledgeService, normalizeUrl, parseQuery, matches };
