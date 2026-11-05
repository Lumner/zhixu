const { feedback } = require('../utils/feedback');
const copy = value => JSON.parse(JSON.stringify(value));
function createReadController({ load, emit, timeoutMs = 2000, setTimer = setTimeout, clearTimer = clearTimeout }) {
  let alive = true, epoch = 0, pending = null;
  let state = { status: 'idle', items: [], key: '', feedback: null, stale: false };
  const update = patch => { state = { ...state, ...patch }; if (alive) emit(copy(state)); };
  function cancel() { epoch += 1; if (pending) { const old = pending; pending = null; old.cancel(); } }
  return {
    request(key, keep = false) {
      if (!alive) return Promise.resolve(copy(state));
      if (pending && pending.key === key) return pending.promise;
      cancel(); const token = ++epoch, retained = keep && state.key === key && state.items.length > 0;
      update({ key, status: retained ? 'refreshing' : 'loading', items: retained ? state.items : [], feedback: null, stale: retained });
      let stop; const op = { key };
      const waiting = new Promise((resolve, reject) => {
        let settled = false;
        const finish = (fn, value) => { if (!settled) { settled = true; clearTimer(timer); fn(value); } };
        const timer = setTimer(() => finish(reject, Object.assign(new Error('读取超时'), { code: 'READ_TIMEOUT' })), timeoutMs);
        stop = () => finish(reject, Object.assign(new Error('读取失效'), { code: 'CANCELLED' }));
        Promise.resolve().then(() => { if (settled) throw Object.assign(new Error('读取尚未启动就已失效'), { code: 'CANCELLED' }); return load(key); }).then(value => finish(resolve, value), error => finish(reject, error));
      });
      op.cancel = stop;
      op.promise = waiting.then(items => {
        if (!alive || token !== epoch) return copy(state);
        if (!Array.isArray(items) || !items.every(item => item && typeof item.id === 'string' && typeof item.title === 'string')) throw Object.assign(new Error('列表协议错误'), { code: 'PROTOCOL' });
        update({ items, status: items.length ? 'ready' : 'empty', stale: false, feedback: null }); return copy(state);
      }).catch(error => {
        if (alive && token === epoch && error.code !== 'CANCELLED') update({ status: retained ? 'ready' : 'error', stale: retained, feedback: feedback(error) });
        return copy(state);
      }).finally(() => { if (pending === op) pending = null; });
      pending = op; return op.promise;
    }, cancel, dispose() { alive = false; cancel(); }, snapshot: () => copy(state)
  };
}
module.exports = { createReadController };
