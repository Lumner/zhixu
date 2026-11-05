const privacy = require('./privacy');
const error = (code, message) => Object.assign(new Error(message), { code });
function available(name) { return typeof wx[name] === 'function'; }
async function call(name, options = {}, owner = wx, context = {}) {
  if (owner === wx && ['getClipboardData', 'chooseMessageFile'].includes(name)) await privacy.ensure(name, context.isActive);
  return new Promise((resolve, reject) => {
    if (typeof owner[name] !== 'function') { reject(error('UNSUPPORTED', '当前环境不支持 ' + name)); return; }
    try { owner[name]({ ...options, success: resolve, fail: failure => reject(error(/cancel/i.test(failure.errMsg || '') ? 'CANCELLED' : 'PLATFORM', '操作未完成：' + (failure.errMsg || name))) }); }
    catch (_) { reject(error('PLATFORM', '接口调用异常：' + name)); }
  });
}
function capabilities() {
  return ['getFileSystemManager', 'chooseMessageFile', 'shareFileMessage', 'setClipboardData', 'getClipboardData',
    'uploadFile', 'downloadFile', 'requestSubscribeMessage'].map(name => ({ name, supported: available(name) }));
}
module.exports = { error, available, call, capabilities };
