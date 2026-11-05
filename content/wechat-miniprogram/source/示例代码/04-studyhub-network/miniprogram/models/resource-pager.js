// 与页面分离的异步状态逻辑；请求序号才是旧响应不能覆盖的最后一道检查。
function unique(items) {
  const seen = new Set();
  return items.filter(item => { if (seen.has(item.id)) return false; seen.add(item.id); return true; });
}
function createPager({ fetchPage, publish, onFirstPage = () => {} }) {
  let state = { items: [], status: 'idle', refreshing: false, loadingMore: false,
    error: '', moreError: '', cursor: null, hasMore: false, fromCache: false };
  let query = null;
  let generation = 0;
  let active = null;
  let disposed = false;
  const emit = patch => { state = { ...state, ...patch }; if (!disposed) publish(state); };
  function invalidate() {
    generation += 1;
    const previous = active;
    active = null;
    if (previous) previous.cancel();
  }
  function replace(nextQuery, options = {}) {
    if (disposed) return Promise.resolve();
    const sameQuery = query && JSON.stringify(query) === JSON.stringify(nextQuery);
    const previousItems = options.retain && sameQuery ? state.items : [];
    invalidate();
    const version = generation;
    query = { ...nextQuery };
    const seed = options.seed;
    const items = seed ? unique(seed.items) : previousItems;
    emit({ items, status: items.length ? 'ready' : 'loading', refreshing: items.length > 0,
      loadingMore: false, error: '', moreError: '', cursor: null, hasMore: false, fromCache: Boolean(seed) });
    let handle;
    try { handle = fetchPage({ ...query, cursor: null }); }
    catch (error) { emit({ status: items.length ? 'ready' : 'error', refreshing: false, error: error.message }); return Promise.resolve(); }
    active = handle;
    return handle.promise.then(data => {
      if (disposed || version !== generation) return;
      const fresh = unique(data.items);
      emit({ items: fresh, status: fresh.length ? 'ready' : 'empty', refreshing: false,
        cursor: data.nextCursor, hasMore: data.nextCursor !== null, fromCache: false });
      onFirstPage(query, fresh);
    }).catch(error => {
      if (disposed || version !== generation || error.kind === 'cancelled') return;
      emit({ status: state.items.length ? 'ready' : 'error', refreshing: false, error: error.message });
    }).finally(() => { if (version === generation) active = null; });
  }
  function loadMore() {
    if (disposed || active || !state.hasMore || !query) return Promise.resolve();
    const version = generation;
    const requestedCursor = state.cursor;
    emit({ loadingMore: true, moreError: '' });
    let handle;
    try { handle = fetchPage({ ...query, cursor: requestedCursor }); }
    catch (error) { emit({ loadingMore: false, moreError: error.message }); return Promise.resolve(); }
    active = handle;
    return handle.promise.then(data => {
      if (disposed || version !== generation) return;
      if (data.nextCursor !== null && data.nextCursor === requestedCursor) throw new Error('服务端游标没有推进，请先刷新');
      emit({ items: unique([...state.items, ...data.items]), cursor: data.nextCursor,
        hasMore: data.nextCursor !== null, loadingMore: false });
    }).catch(error => {
      if (disposed || version !== generation || error.kind === 'cancelled') return;
      emit({ loadingMore: false, moreError: error.message });
    }).finally(() => { if (version === generation) active = null; });
  }
  function pause(clear = false) {
    if (disposed) return;
    invalidate();
    emit({ ...(clear ? { items: [], cursor: null, hasMore: false, fromCache: false } : {}),
      status: !clear && state.items.length ? 'ready' : 'idle', refreshing: false, loadingMore: false, error: '', moreError: '' });
  }
  function dispose() { disposed = true; invalidate(); }
  return { replace, loadMore, pause, dispose, getState: () => state };
}
module.exports = { createPager, unique };
