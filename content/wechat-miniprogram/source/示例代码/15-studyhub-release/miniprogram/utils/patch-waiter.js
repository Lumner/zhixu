function createPatchWaiter({ send, now = Date.now, setTimer = setTimeout, clearTimer = clearTimeout, timeoutMs = 2000 }) {
  let pending = null, alive = true;
  return {
    apply(patch) {
      if (!alive || pending) return Promise.reject(Object.assign(new Error('测量已失效或正在等待'), { code: 'MEASURE_STATE' }));
      const begin = now();
      return new Promise((resolve, reject) => {
        let settled = false;
        const finish = (fn, value) => { if (!settled) { settled = true; clearTimer(timer); pending = null; fn(value); } };
        const timer = setTimer(() => finish(reject, Object.assign(new Error('更新回调未在测量期限内返回'), { code: 'MEASURE_TIMEOUT' })), timeoutMs);
        pending = { cancel: () => finish(reject, Object.assign(new Error('测量取消'), { code: 'CANCELLED' })) };
        try { send(patch, () => { if (settled) return; const duration = now() - begin;
          if (!Number.isFinite(duration) || duration < 0 || duration > 60000) finish(reject, Object.assign(new Error('时钟变化，样本作废'), { code: 'MEASURE_CLOCK' }));
          else finish(resolve, duration);
        }); } catch (error) { finish(reject, error); }
      });
    },
    cancel() { if (pending) pending.cancel(); }, dispose() { alive = false; if (pending) pending.cancel(); }
  };
}
module.exports = { createPatchWaiter };
