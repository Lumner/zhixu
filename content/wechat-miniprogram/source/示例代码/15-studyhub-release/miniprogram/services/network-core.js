function createNetworkMonitor({ api, now = Date.now }) {
  const listeners = new Set(); let registered = false, active = false, epoch = 0;
  let state = { kind: 'unknown', networkType: 'unknown', changedAt: 0 };
  function publish(kind, networkType) {
    state = { kind, networkType, changedAt: now() };
    for (const listener of listeners) listener({ ...state });
  }
  const onChange = event => {
    if (!active) return;
    epoch += 1;
    if (!event || typeof event.isConnected !== 'boolean') publish('unknown', 'unknown');
    else publish(event.isConnected ? 'online' : 'offline', event.networkType || 'unknown');
  };
  function refresh() {
    const token = ++epoch;
    if (!active || typeof api.getNetworkType !== 'function') return;
    try { api.getNetworkType({
      success(result) { if (active && token === epoch) { const type = result && ['wifi', '2g', '3g', '4g', '5g', 'none'].includes(result.networkType) ? result.networkType : 'unknown'; publish(type === 'none' ? 'offline' : type === 'unknown' ? 'unknown' : 'online', type); } },
      fail() { if (active && token === epoch) publish('unknown', 'unknown'); }
    }); } catch (_) { if (active && token === epoch) publish('unknown', 'unknown'); }
  }
  return {
    subscribe(listener) {
      listeners.add(listener);
      if (!active) {
        active = true;
        state = { kind: 'unknown', networkType: 'unknown', changedAt: now() };
        // 有配套解绑能力时才注册全局事件，避免旧基础库反复进入产生泄漏。
        if (!registered && typeof api.onNetworkStatusChange === 'function' && typeof api.offNetworkStatusChange === 'function') {
          try { api.onNetworkStatusChange(onChange); registered = true; } catch (_) { registered = false; }
        }
        refresh();
      }
      listener({ ...state }); let closed = false;
      return () => {
        if (closed) return; closed = true; listeners.delete(listener);
        if (!listeners.size) {
          active = false; epoch += 1;
          if (registered) { try { api.offNetworkStatusChange(onChange); registered = false; } catch (_) { /* 不调用无参数解绑；再次订阅时复用原监听，避免重复注册。 */ } }
        }
      };
    }, refresh, snapshot: () => ({ ...state })
  };
}
module.exports = { createNetworkMonitor };
