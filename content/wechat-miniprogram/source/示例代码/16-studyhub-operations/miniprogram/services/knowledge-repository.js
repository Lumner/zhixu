const { call } = require('./cloud-client');
const outbox = require('./outbox');
const { validNote, validId, normalizeTag } = require('../shared/knowledge-schema');
const protocol = () => Object.assign(new Error('知识库响应格式不合法'), { code: 'PROTOCOL' });
function validSummary(item) {
  return item && validId(item.id) && ['note', 'link'].includes(item.kind) && typeof item.title === 'string'
    && typeof item.excerpt === 'string' && item.excerpt.length <= 140 && typeof item.favorite === 'boolean'
    && typeof item.url === 'string' && Array.isArray(item.tags) && item.tags.length <= 5
    && item.tags.every(tag => { try { return normalizeTag(tag) === tag; } catch (_) { return false; } })
    && Number.isSafeInteger(item.assetCount) && item.assetCount >= 0 && item.assetCount <= 3
    && Number.isSafeInteger(item.version) && item.version > 0 && Number.isFinite(item.createdAt) && Number.isFinite(item.updatedAt);
}
async function list(query, cursor = null) {
  const page = await call('noteList', { ...query, cursor });
  if (!page || !Array.isArray(page.items) || page.items.length > 10 || !page.items.every(validSummary)
    || !Number.isInteger(page.scanned) || page.scanned < 0 || page.scanned > 40
    || !(page.nextCursor === null || validId(page.nextCursor))) throw protocol();
  if (page.nextCursor !== null && (page.nextCursor === cursor || page.scanned === 0)) throw protocol();
  return page;
}
async function get(id) { const note = await call('noteGet', { id }); if (!validNote(note)) throw protocol(); return note; }
module.exports = { list, get, validSummary,
  create: fields => outbox.submit('noteCreate', { fields }),
  update: (id, version, fields) => outbox.submit('noteUpdate', { id, version, fields }),
  remove: (id, version) => outbox.submit('noteRemove', { id, version }) };
