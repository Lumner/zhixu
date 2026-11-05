const api = require('./platform-api');
const config = require('../config/platform');
function origin() {
  if (!config.ENABLE_LOCAL_FILE_LAB) throw api.error('NOT_CONFIGURED', '请先启动本地文件服务并启用课程配置');
  // 此匿名实验只连接本机/私有 IPv4 地址；上线服务必须重新设计 HTTPS、鉴权和文件归属。
  const value = config.FILE_LAB_ORIGIN;
  if (typeof value !== 'string' || !/^http:\/\/(?:localhost|127\.0\.0\.1|10(?:\.\d{1,3}){3}|192\.168(?:\.\d{1,3}){2}|172\.(?:1[6-9]|2\d|3[01])(?:\.\d{1,3}){2}):\d{2,5}$/.test(value)) throw api.error('CONFIG', '实验地址必须是配置中的本机或私有 IPv4 HTTP 源');
  return value;
}
function transfer(name, options, progress) {
  let task, settled = false;
  const promise = new Promise((resolve, reject) => {
    if (!api.available(name)) { reject(api.error('UNSUPPORTED', '当前环境不支持文件传输')); return; }
    const done = (fn, value) => { if (!settled) { settled = true; fn(value); } };
    try {
      task = wx[name]({ ...options, timeout: 15000,
        success(response) {
          if (response.statusCode !== 200) { done(reject, api.error('HTTP', '文件服务返回 HTTP ' + response.statusCode)); return; }
          done(resolve, response);
        },
        fail(failure) { done(reject, api.error(/abort|cancel/i.test(failure.errMsg || '') ? 'CANCELLED' : 'TRANSFER', '传输未确认，请检查网络；不会自动重试上传')); }
      });
      if (task && typeof task.onProgressUpdate === 'function') task.onProgressUpdate(value => {
        if (!settled && progress && Number.isFinite(value.progress)) progress(Math.max(0, Math.min(100, Math.floor(value.progress))));
      });
    } catch (_) { done(reject, api.error('TRANSFER', '启动文件传输失败')); }
  });
  return { promise, abort() { if (!settled && task && typeof task.abort === 'function') task.abort(); } };
}
function upload(filePath, progress) {
  const result = transfer('uploadFile', { url: origin() + '/upload', filePath, name: 'file' }, progress);
  return { abort: result.abort, promise: result.promise.then(response => {
    let body; try { body = JSON.parse(response.data); } catch (_) { throw api.error('PROTOCOL', '上传响应不是 JSON 文本'); }
    if (!body || body.ok !== true || !/^[a-f0-9]{32}$/.test(body.id)) throw api.error('PROTOCOL', '上传响应编号不合法');
    return { id: body.id };
  }) };
}
function download(id, progress) {
  if (typeof id !== 'string' || !/^[a-f0-9]{32}$/.test(id)) throw api.error('INVALID_INPUT', '下载编号不合法');
  const result = transfer('downloadFile', { url: origin() + '/files/' + id }, progress);
  return { abort: result.abort, promise: result.promise.then(response => {
    if (typeof response.tempFilePath !== 'string' || !response.tempFilePath) throw api.error('PROTOCOL', '下载缺少临时路径');
    return response.tempFilePath;
  }) };
}
module.exports = { origin, transfer, upload, download };
