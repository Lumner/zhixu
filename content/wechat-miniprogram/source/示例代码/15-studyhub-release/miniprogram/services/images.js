const privacy = require('./privacy');
const { call } = require('./cloud-client');
const outbox = require('./outbox');
const fs = () => wx.getFileSystemManager();
const api = (name, options) => new Promise((resolve, reject) => wx[name]({ ...options, success: resolve, fail: reject }));
function file(method, options) { return new Promise((resolve, reject) => fs()[method]({ ...options, success: resolve, fail: reject })); }
async function choose(context = {}) {
  await privacy.ensure('chooseMedia', context.isActive);
  if (!wx.canIUse('chooseMedia') || !wx.canIUse('compressImage')) throw new Error('当前基础库不支持图片实验，请升级后再试');
  const result = await api('chooseMedia', { count: 1, mediaType: ['image'], sourceType: ['album', 'camera'] });
  if (!result.tempFiles || !result.tempFiles[0]) throw new Error('没有选择图片');
  const compressed = await api('compressImage', { src: result.tempFiles[0].tempFilePath, quality: 35, compressedWidth: 320 });
  const image = await file('readFile', { filePath: compressed.tempFilePath, encoding: 'base64' });
  const base64 = image.data;
  const bytes = base64.length / 4 * 3 - (base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0);
  if (bytes > 64 * 1024) throw new Error('压缩后仍超过 64 KiB，请选择更小的 PNG/JPEG 图片');
  return { base64, localPath: compressed.tempFilePath, bytes };
}
function validAsset(item) {
  return item && typeof item.id === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(item.id)
    && typeof item.caption === 'string' && ['png', 'jpg'].includes(item.extension)
    && ['active', 'deleting', 'deleted'].includes(item.state);
}
async function list(cursor = null) {
  const result = await call('imageList', { cursor });
  if (!result || !Array.isArray(result.items) || !result.items.every(validAsset)
    || !(result.nextCursor === null || typeof result.nextCursor === 'string')) throw new Error('图片列表响应不合法');
  return result;
}
async function preview(id) {
  const result = await call('imageRead', { id });
  if (!result || result.id !== id || !/^[A-Za-z0-9_-]{1,128}$/.test(id)
    || !['png', 'jpg'].includes(result.extension) || typeof result.base64 !== 'string'
    || result.base64.length > 87384 || !/^[A-Za-z0-9+/]+={0,2}$/.test(result.base64)) throw new Error('图片响应不合法');
  const path = wx.env.USER_DATA_PATH + '/studyhub-preview.' + result.extension;
  await file('writeFile', { filePath: path, data: result.base64, encoding: 'base64' });
  await api('previewImage', { current: path, urls: [path] });
  // success 只表示成功调用预览，不表示用户已关闭；此处不能立即删文件。
}
async function clearPreview() {
  for (const extension of ['png', 'jpg']) {
    try { await file('unlink', { filePath: wx.env.USER_DATA_PATH + '/studyhub-preview.' + extension }); }
    catch (_) { /* 文件可能不存在。 */ }
  }
}
module.exports = { choose, list, preview, clearPreview,
  upload: (caption, base64) => outbox.submit('imageUpload', { caption, base64 }),
  remove: id => outbox.submit('imageRemove', { id }) };
