// 只缓存第一页；会话内短缓存，既不代替服务端，也不保存分页游标。
const entries = new Map();
const TTL_MS = 30000;
const MAX_ENTRIES = 10;
const copy = value => JSON.parse(JSON.stringify(value));
function key(query) { return JSON.stringify([query.keyword.trim(), query.category, query.mode]); }
function get(query) {
  if (query.mode !== 'normal') return null;
  const item = entries.get(key(query));
  if (!item || Date.now() - item.savedAt > TTL_MS) { entries.delete(key(query)); return null; }
  return copy(item);
}
function put(query, items) {
  if (query.mode !== 'normal') return;
  const id = key(query);
  entries.delete(id);
  entries.set(id, { items: copy(items), savedAt: Date.now() });
  while (entries.size > MAX_ENTRIES) entries.delete(entries.keys().next().value);
}
module.exports = { get, put, TTL_MS };
