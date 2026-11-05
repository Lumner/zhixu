// 纯 JavaScript 校验。服务端保留完全相同副本，由整理脚本核对一致性。
const KEYS = ['kind', 'title', 'content', 'tags', 'url', 'favorite', 'assetIds', 'taskId'];
const validId = value => typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value);
function invalid(message) { throw Object.assign(new Error(message), { code: 'INVALID_INPUT', publicCode: 'INVALID_INPUT' }); }
function normalizeTag(value) {
  if (typeof value !== 'string') invalid('标签必须是文字');
  const tag = value.trim().toLowerCase();
  if (!/^[a-z0-9_\-\u3400-\u9fff]{1,12}$/.test(tag)) invalid('每个标签限 1—12 个汉字、字母、数字、下划线或短横线');
  return tag;
}
function cleanFields(value, normalizeUrl = url => url) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !KEYS.includes(key))) invalid('笔记字段不合法');
  if (!['note', 'link'].includes(value.kind)) invalid('内容类型不合法');
  if (typeof value.title !== 'string' || !value.title.trim() || value.title.trim().length > 60) invalid('标题限 1—60 个代码单元');
  if (typeof value.content !== 'string' || value.content.length > 8000) invalid('正文最多 8000 个代码单元');
  const content = value.content.replace(/\r\n?/g, '\n').trim();
  if (value.kind === 'note' && !content) invalid('学习笔记需要正文');
  if (!Array.isArray(value.tags) || value.tags.length > 10) invalid('标签输入过多');
  const tags = [...new Set(value.tags.map(normalizeTag))].sort();
  if (tags.length > 5) invalid('最多保留 5 个不同标签');
  if (typeof value.url !== 'string' || value.url.length > 800) invalid('资源网址最多 800 个代码单元');
  let url = value.url.trim();
  if (value.kind === 'link' && !url) invalid('资源收藏需要 HTTPS 网址');
  if (url && (!/^https:\/\/[^\s\\]+$/i.test(url) || /[\u0000-\u001f\u007f]/.test(url))) invalid('请输入完整 HTTPS 网址，不含空白或反斜杠');
  if (url) url = normalizeUrl(url); // 服务端再用 Node URL 做权威解析。
  if (typeof value.favorite !== 'boolean') invalid('收藏状态必须是布尔值');
  if (!Array.isArray(value.assetIds) || value.assetIds.length > 3 || !value.assetIds.every(validId)
    || new Set(value.assetIds).size !== value.assetIds.length) invalid('最多选择 3 张不同的图片');
  if (value.taskId !== '' && !validId(value.taskId)) invalid('关联任务不合法');
  return { kind: value.kind, title: value.title.trim(), content, tags, url, favorite: value.favorite,
    assetIds: [...value.assetIds].sort(), taskId: value.taskId };
}
const pickFields = note => Object.fromEntries(KEYS.map(key => [key, note[key]]));
function validNote(note) {
  try { cleanFields(pickFields(note)); } catch (_) { return false; }
  return validId(note.id) && Number.isSafeInteger(note.version) && note.version > 0
    && Number.isFinite(note.createdAt) && Number.isFinite(note.updatedAt);
}
module.exports = { KEYS, validId, normalizeTag, cleanFields, pickFields, validNote, invalid };
