function createObservedCall({ invoke, record, clock = Date.now }) {
  const now = () => { try { return clock(); } catch (_) { return NaN; } };
  const emit = (event, fields) => { try { record(event, fields); } catch (_) { /* 观测不能改变业务结果。 */ } };
  return async function observed(name, data) {
    const started = now();
    let action = 'other';
    try { action = name === 'helloCloud' ? 'ping' : name === 'studyhub' && data ? data.action : 'other'; } catch (_) {}
    try {
      const result = await invoke(name, data);
      emit('rpc-ok', { action, code: 'OK', elapsedMs: now() - started });
      return result;
    } catch (error) {
      // 只提取code供允许名单映射；既不记录整个错误，也不改变抛出的原对象。
      let code; try { code = error && error.code; } catch (_) {}
      emit('rpc-fail', { action, code, elapsedMs: now() - started });
      throw error;
    }
  };
}
module.exports = { createObservedCall };
