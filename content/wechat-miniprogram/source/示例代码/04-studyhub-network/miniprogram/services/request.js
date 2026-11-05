const { BASE_URL, TIMEOUT_MS } = require('../config/network');

function makeError(kind, message, extra = {}) {
  const error = new Error(message);
  Object.assign(error, { kind }, extra);
  return error;
}

// transport 采用 wx.request 的回调约定，便于用独立适配器验证。
function createRequester({ baseURL, timeout = TIMEOUT_MS, transport }) {
  return function request({ path, method = 'GET', data = {}, retries = 1, timeoutMs = timeout }) {
    let task = null;
    let retryTimer = null;
    let settled = false;
    let attempts = 0;
    let rejectPromise;
    const verb = method.toUpperCase();
    const retryLimit = verb === 'GET' ? Math.max(0, Math.min(1, Math.floor(retries) || 0)) : 0;
    const promise = new Promise((resolve, reject) => {
      rejectPromise = reject;
      function finish(error, value) {
        if (settled) return;
        settled = true;
        clearTimeout(retryTimer);
        if (error) reject(error); else resolve(value);
      }
      function fail(error) {
        if (settled) return;
        const transient = ['network', 'timeout'].includes(error.kind)
          || (error.kind === 'http' && [502, 503, 504].includes(error.statusCode));
        if (transient && attempts <= retryLimit) {
          retryTimer = setTimeout(run, 200 * attempts);
        } else {
          finish(error);
        }
      }
      function run() {
        if (settled) return;
        attempts += 1;
        let ended = false;
        const once = callback => value => {
          if (ended || settled) return;
          ended = true;
          callback(value);
        };
        try {
          task = transport({
            url: baseURL.replace(/\/$/, '') + path,
            method: verb, data, timeout: timeoutMs,
            header: { 'content-type': 'application/json' }, dataType: 'json',
            success: once(response => {
              if (response.statusCode < 200 || response.statusCode >= 300) {
                fail(makeError('http', 'HTTP 请求失败：' + response.statusCode, { statusCode: response.statusCode }));
                return;
              }
              const body = response.data;
              if (!body || typeof body !== 'object' || typeof body.ok !== 'boolean') {
                finish(makeError('protocol', '响应不是约定的数据格式'));
              } else if (!body.ok) {
                finish(makeError('business', body.error && body.error.message || '业务处理失败'));
              } else {
                finish(null, body.data);
              }
            }),
            fail: once(error => {
              const message = String(error && error.errMsg || '网络连接失败');
              const kind = /abort/i.test(message) ? 'cancelled' : /timeout/i.test(message) ? 'timeout' : 'network';
              fail(makeError(kind, kind === 'timeout' ? '请求超时，请重试' : kind === 'cancelled' ? '请求已取消' : '无法连接教学服务，请检查地址和服务端'));
            })
          });
        } catch (error) {
          if (!ended) { ended = true; finish(makeError('network', error.message || '无法发起请求')); }
        }
      }
      run();
    });
    function cancel() {
      if (settled) return;
      settled = true; // 先失效，再中断；abort 的回调不能重新触发重试。
      clearTimeout(retryTimer);
      rejectPromise(makeError('cancelled', '请求已取消'));
      if (task && typeof task.abort === 'function') task.abort();
    }
    return { promise, cancel };
  };
}

const request = createRequester({ baseURL: BASE_URL, transport: options => wx.request(options) });
module.exports = { createRequester, request, makeError };
