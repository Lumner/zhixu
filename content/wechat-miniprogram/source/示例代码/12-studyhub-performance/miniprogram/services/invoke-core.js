const fail = (code, message) => Object.assign(new Error(message), { code });
function createInvoker({ ready, callFunction, envId, setTimer = setTimeout, clearTimer = clearTimeout, timeoutMs = 12000 }) {
  return function invoke(name, data) {
    return new Promise((resolve, reject) => {
      const state = ready();
      if (!state.ready) { reject(fail('NOT_CONFIGURED', state.message || '云能力尚未配置')); return; }
      let settled = false;
      const finish = (fn, value) => { if (!settled) { settled = true; clearTimer(timer); fn(value); } };
      const timer = setTimer(() => finish(reject, fail('CLOUD_TIMEOUT', '等待已超时，服务端结果可能仍在处理中')), timeoutMs);
      try {
        callFunction({ name, data, config: { env: envId },
          success(response) {
            if (settled) return;
            const body = response && response.result;
            if (!body || typeof body.ok !== 'boolean') { finish(reject, fail('PROTOCOL', '云函数响应格式不合法')); return; }
            if (!body.ok) { finish(reject, fail(body.error && body.error.code || 'BUSINESS', body.error && body.error.message || '云端操作失败')); return; }
            finish(resolve, body.data);
          },
          fail() { finish(reject, fail('TRANSPORT', '网络调用未确认，请核对原操作与环境')); }
        });
      } catch (_) { finish(reject, fail('TRANSPORT', '云调用启动失败，请核对能力与环境')); }
    });
  };
}
module.exports = { createInvoker };
