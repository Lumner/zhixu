const api = require('./platform-api');
const format = require('../utils/report-file');
function manager() {
  if (!api.available('getFileSystemManager') || !wx.env || !wx.env.USER_DATA_PATH) throw api.error('UNSUPPORTED', '当前环境没有用户文件目录');
  return wx.getFileSystemManager();
}
function pathFor(slot) {
  if (!['demo', 'cloud', 'download'].includes(slot)) throw api.error('FILE_PATH', '未知的课程文件槽');
  return wx.env.USER_DATA_PATH + '/studyhub-week-' + slot + '.json';
}
async function save(report, source, slot = source) {
  const fs = manager(), text = format.pack(report, source), filePath = pathFor(slot);
  await api.call('writeFile', { filePath, data: text, encoding: 'utf8' }, fs);
  return { filePath, fileName: 'studyhub-week-' + slot + '.json', bytes: format.utf8Bytes(text) };
}
async function read(filePath) {
  const fs = manager();
  const stat = await api.call('stat', { path: filePath }, fs);
  if (!stat.stats || stat.stats.isDirectory() || !Number.isSafeInteger(stat.stats.size) || stat.stats.size < 0 || stat.stats.size > format.MAX_BYTES) throw api.error('FILE_SIZE', '请选择不超过 32 KiB 的报告文件');
  const result = await api.call('readFile', { filePath, encoding: 'utf8' }, fs);
  return format.unpack(result.data);
}
async function choose() {
  const result = await api.call('chooseMessageFile', { count: 1, type: 'file', extension: ['json'] });
  const chosen = result.tempFiles && result.tempFiles[0];
  if (!chosen || typeof chosen.path !== 'string') throw api.error('FILE_FORMAT', '没有可读文件');
  return read(chosen.path);
}
async function remove(slot) {
  const fs = manager();
  try { await api.call('unlink', { filePath: pathFor(slot) }, fs); }
  catch (error) { throw api.error('FILE_CLEANUP', '清理未确认，请核对文件是否存在及路径权限：' + error.message); }
}
module.exports = { save, read, choose, remove, pathFor };
