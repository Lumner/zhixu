// 实际回环 HTTP + 可控延迟的模型测试。原生微信传输/生命周期另需验证。
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ROOT = path.resolve(__dirname, '../示例代码/04-studyhub-network');
const MINI = path.join(ROOT, 'miniprogram');
const { createServer } = require(path.join(ROOT, 'server/server.cjs'));
const { createRequester } = require(path.join(MINI, 'services/request.js'));
const { validatePage } = require(path.join(MINI, 'services/resource-api.js'));
const { createPager, unique } = require(path.join(MINI, 'models/resource-pager.js'));
const wait = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
const records = [];

function transport(options) {
  const url = new URL(options.url);
  if (options.method === 'GET') for (const [key, value] of Object.entries(options.data || {})) url.searchParams.set(key, String(value));
  const req = http.request(url, { method: options.method, headers: options.header }, res => {
    const chunks = [];
    res.on('data', chunk => chunks.push(chunk));
    res.on('end', () => {
      const text = Buffer.concat(chunks).toString('utf8');
      let data;
      try { data = JSON.parse(text); } catch { data = text; }
      options.success({ statusCode: res.statusCode, data, header: res.headers });
    });
  });
  req.on('error', error => options.fail({ errMsg: 'request:fail ' + error.message }));
  req.setTimeout(options.timeout, () => req.destroy(new Error('timeout')));
  if (options.method !== 'GET') req.end(JSON.stringify(options.data)); else req.end();
  return { abort() { req.destroy(new Error('abort')); } };
}
async function check(name, fn) {
  await fn(); records.push(name); console.log('PASS ' + String(records.length).padStart(2, '0') + ' ' + name);
}
function deferredPager(ignoreCancel = false) {
  const calls = [];
  const updates = [];
  const firstPages = [];
  const pager = createPager({
    fetchPage(params) {
      let resolve, reject;
      const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
      const call = { params, resolve, reject, cancelled: false };
      calls.push(call);
      return { promise, cancel() { call.cancelled = true; if (!ignoreCancel) reject(Object.assign(new Error('cancel'), { kind: 'cancelled' })); } };
    },
    publish(state) { updates.push(JSON.parse(JSON.stringify(state))); },
    onFirstPage(query, items) { firstPages.push({ query, items }); }
  });
  return { pager, calls, updates, firstPages };
}
const query = keyword => ({ keyword, category: 'all', mode: 'normal' });
const page = (ids, nextCursor = null) => ({ items: ids.map(id => ({ id })), nextCursor, total: 45 });

async function main() {
  const server = createServer();
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const baseURL = 'http://127.0.0.1:' + server.address().port;
  const request = createRequester({ baseURL, transport, timeout: 1000 });
  try {
    await check('local HTTP health endpoint responds', async () => {
      const result = await request({ path: '/health', retries: 0 }).promise;
      assert.equal(result.resourceCount, 45);
    });
    await check('first real HTTP page has 10 validated records and a cursor', async () => {
      const result = validatePage(await request({ path: '/api/resources', data: { limit: 10 } }).promise);
      assert.equal(result.items.length, 10); assert.equal(result.nextCursor, '10'); assert.equal(result.total, 45);
    });
    await check('real HTTP pagination reaches the end without duplicates', async () => {
      let cursor = null;
      const ids = [];
      do {
        const result = validatePage(await request({ path: '/api/resources', data: { limit: 10, ...(cursor === null ? {} : { cursor }) } }).promise);
        ids.push(...result.items.map(item => item.id)); cursor = result.nextCursor;
      } while (cursor !== null);
      assert.equal(ids.length, 45); assert.equal(new Set(ids).size, 45);
    });
    await check('query encoding and case-insensitive search work over HTTP', async () => {
      const result = await request({ path: '/api/resources', data: { q: ' wXmL ' } }).promise;
      assert.equal(result.items.length, 1); assert.ok(result.items[0].title.includes('WXML'));
      const special = await request({ path: '/api/resources', data: { q: 'a & b' } }).promise;
      assert.equal(special.items.length, 0);
    });
    await check('server combines category and keyword', async () => {
      const result = await request({ path: '/api/resources', data: { category: 'network', q: 'HTTP' } }).promise;
      assert.equal(result.items.length, 1); assert.equal(result.items[0].category, 'network');
    });
    await check('bad pagination parameters yield HTTP 400 without retry', async () => {
      let attempts = 0;
      const counted = createRequester({ baseURL, transport: options => { attempts += 1; return transport(options); } });
      await assert.rejects(counted({ path: '/api/resources', data: { limit: '-1' } }).promise, error => error.kind === 'http' && error.statusCode === 400);
      assert.equal(attempts, 1);
    });
    await check('POST JSON echo round-trips Chinese text', async () => {
      const result = await request({ path: '/api/echo', method: 'POST', data: { title: '学习网络', count: 2 } }).promise;
      assert.deepEqual(result.received, { title: '学习网络', count: 2 });
    });
    await check('a 200 response with ok:false is a business rejection', async () => {
      await assert.rejects(request({ path: '/api/resources', data: { mode: 'business' } }).promise, error => error.kind === 'business');
    });
    await check('malformed successful data is rejected by the domain validator', async () => {
      const data = await request({ path: '/api/resources', data: { mode: 'malformed' } }).promise;
      assert.throws(() => validatePage(data), error => error.kind === 'protocol');
    });
    await check('GET 503 is retried only once', async () => {
      let attempts = 0;
      const counted = createRequester({ baseURL, transport: options => { attempts += 1; return transport(options); } });
      await assert.rejects(counted({ path: '/api/resources', data: { mode: 'http503' } }).promise, error => error.kind === 'http');
      assert.equal(attempts, 2);
    });
    await check('transient first failure recovers on the permitted retry', async () => {
      let attempts = 0;
      const counted = createRequester({ baseURL, transport: options => { attempts += 1; return transport(options); } });
      const result = await counted({ path: '/api/resources', data: { mode: 'flaky', q: 'Promise' } }).promise;
      assert.equal(result.items.length, 1); assert.equal(attempts, 2);
    });
    await check('POST 503 is not automatically retried', async () => {
      let attempts = 0;
      const fake = createRequester({ baseURL, transport(options) {
        attempts += 1; queueMicrotask(() => options.success({ statusCode: 503, data: {} })); return { abort() {} };
      } });
      await assert.rejects(fake({ path: '/api/echo', method: 'POST', retries: 1 }).promise);
      assert.equal(attempts, 1);
    });
    await check('real transport timeout is classified', async () => {
      await assert.rejects(request({ path: '/api/resources', data: { delayMs: 300 }, timeoutMs: 40, retries: 0 }).promise, error => error.kind === 'timeout');
    });
    await check('real active request can be cancelled and settles promptly', async () => {
      const handle = request({ path: '/api/resources', data: { delayMs: 300 }, retries: 0 });
      const result = assert.rejects(handle.promise, error => error.kind === 'cancelled');
      handle.cancel(); await result;
    });
    await check('cancellation clears a scheduled retry', async () => {
      let attempts = 0;
      const fake = createRequester({ baseURL, transport(options) {
        attempts += 1; queueMicrotask(() => options.fail({ errMsg: 'network fail' })); return { abort() {} };
      } });
      const handle = fake({ path: '/x' });
      const rejected = assert.rejects(handle.promise, error => error.kind === 'cancelled');
      await wait(5); handle.cancel(); await rejected; await wait(220);
      assert.equal(attempts, 1);
    });
    await check('invalid envelope is a protocol error', async () => {
      const fake = createRequester({ baseURL, transport(options) {
        queueMicrotask(() => options.success({ statusCode: 200, data: '<html>error</html>' })); return { abort() {} };
      } });
      await assert.rejects(fake({ path: '/x' }).promise, error => error.kind === 'protocol');
    });
    await check('duplicate transport callbacks settle once', async () => {
      const fake = createRequester({ baseURL, transport(options) {
        queueMicrotask(() => { options.success({ statusCode: 200, data: { ok: true, data: 7 } }); options.fail({ errMsg: 'late fail' }); });
        return { abort() {} };
      } });
      assert.equal(await fake({ path: '/x' }).promise, 7);
    });
    await check('resource validator rejects bad item types and cursors', async () => {
      const item = { id: 'a', title: '题目', summary: '说明', category: 'syntax', minutes: 10 };
      assert.doesNotThrow(() => validatePage({ items: [item], nextCursor: null, total: 1 }));
      for (const value of [{ items: [{ ...item, minutes: '10' }], nextCursor: null, total: 1 },
        { items: [item], nextCursor: 3, total: 1 }, { items: [item], nextCursor: null, total: -1 }]) assert.throws(() => validatePage(value));
    });
    await check('new search ignores an older successful response even if abort fails to stop it', async () => {
      const env = deferredPager(true);
      const old = env.pager.replace(query('old')); const fresh = env.pager.replace(query('new'));
      env.calls[1].resolve(page(['new'])); await fresh;
      env.calls[0].resolve(page(['old'])); await old;
      assert.equal(env.pager.getState().items[0].id, 'new'); assert.equal(env.firstPages.length, 1);
    });
    await check('late failure from an old query cannot overwrite the current success', async () => {
      const env = deferredPager(true);
      const old = env.pager.replace(query('old')); const fresh = env.pager.replace(query('new'));
      env.calls[1].resolve(page(['new'])); await fresh; env.calls[0].reject(new Error('old failure')); await old;
      assert.equal(env.pager.getState().error, '');
    });
    await check('initial failure has an explicit error state', async () => {
      const env = deferredPager(); const pending = env.pager.replace(query(''));
      env.calls[0].reject(new Error('offline')); await pending;
      assert.equal(env.pager.getState().status, 'error'); assert.equal(env.pager.getState().error, 'offline');
    });
    await check('empty first page has an explicit empty state', async () => {
      const env = deferredPager(); const pending = env.pager.replace(query('nothing'));
      env.calls[0].resolve(page([])); await pending; assert.equal(env.pager.getState().status, 'empty');
    });
    await check('same-query refresh failure preserves existing items', async () => {
      const env = deferredPager(); let pending = env.pager.replace(query('same'));
      env.calls[0].resolve(page(['saved'], '10')); await pending;
      pending = env.pager.replace(query('same'), { retain: true }); env.calls[1].reject(new Error('refresh failed')); await pending;
      assert.equal(env.pager.getState().items[0].id, 'saved'); assert.equal(env.pager.getState().status, 'ready');
      assert.equal(env.pager.getState().refreshing, false);
    });
    await check('a new query never retains the old query results', async () => {
      const env = deferredPager(); let pending = env.pager.replace(query('old'));
      env.calls[0].resolve(page(['old'])); await pending;
      pending = env.pager.replace(query('new'), { retain: true });
      assert.equal(env.pager.getState().items.length, 0); env.calls[1].resolve(page(['new'])); await pending;
    });
    await check('load more is single-flight and uses the committed cursor', async () => {
      const env = deferredPager(); let pending = env.pager.replace(query(''));
      env.calls[0].resolve(page(['a'], '10')); await pending;
      pending = env.pager.loadMore(); env.pager.loadMore(); assert.equal(env.calls.length, 2);
      assert.equal(env.calls[1].params.cursor, '10'); env.calls[1].resolve(page(['b'], null)); await pending;
      assert.deepEqual(env.pager.getState().items.map(item => item.id), ['a', 'b']);
    });
    await check('failed next page preserves the cursor and can retry that page', async () => {
      const env = deferredPager(); let pending = env.pager.replace(query(''));
      env.calls[0].resolve(page(['a'], '10')); await pending;
      pending = env.pager.loadMore(); env.calls[1].reject(new Error('page failed')); await pending;
      assert.equal(env.pager.getState().cursor, '10'); assert.equal(env.pager.getState().items.length, 1);
      pending = env.pager.loadMore(); assert.equal(env.calls[2].params.cursor, '10'); env.calls[2].resolve(page(['b'])); await pending;
      assert.equal(env.pager.getState().moreError, '');
    });
    await check('overlapping page records are deduplicated by stable id', async () => {
      const env = deferredPager(); let pending = env.pager.replace(query(''));
      env.calls[0].resolve(page(['a', 'a', 'b'], '10')); await pending;
      pending = env.pager.loadMore(); env.calls[1].resolve(page(['b', 'c'])); await pending;
      assert.deepEqual(env.pager.getState().items.map(item => item.id), ['a', 'b', 'c']);
    });
    await check('non-advancing cursors do not loop automatically', async () => {
      const env = deferredPager(); let pending = env.pager.replace(query(''));
      env.calls[0].resolve(page(['a'], '10')); await pending;
      pending = env.pager.loadMore(); env.calls[1].resolve(page(['b'], '10')); await pending;
      assert.ok(env.pager.getState().moreError); assert.deepEqual(env.pager.getState().items.map(item => item.id), ['a']);
    });
    await check('end of list prevents further requests', async () => {
      const env = deferredPager(); const pending = env.pager.replace(query(''));
      env.calls[0].resolve(page(['a'])); await pending; await env.pager.loadMore(); assert.equal(env.calls.length, 1);
    });
    await check('a refresh invalidates a pending next page', async () => {
      const env = deferredPager(true); let pending = env.pager.replace(query(''));
      env.calls[0].resolve(page(['a'], '10')); await pending;
      const more = env.pager.loadMore(); const refresh = env.pager.replace(query(''), { retain: true });
      env.calls[2].resolve(page(['fresh'])); await refresh; env.calls[1].resolve(page(['stale'])); await more;
      assert.deepEqual(env.pager.getState().items.map(item => item.id), ['fresh']);
    });
    await check('hiding clears loading state and invalidates callbacks', async () => {
      const env = deferredPager(true); const pending = env.pager.replace(query(''));
      env.pager.pause(); env.calls[0].resolve(page(['late'])); await pending;
      assert.equal(env.pager.getState().status, 'idle'); assert.equal(env.pager.getState().items.length, 0);
    });
    await check('disposing prevents updates after the page is gone', async () => {
      const env = deferredPager(true); const pending = env.pager.replace(query(''));
      const count = env.updates.length; env.pager.dispose(); env.calls[0].resolve(page(['late'])); await pending;
      assert.equal(env.updates.length, count);
    });
    await check('seeded cache is visible until a successful refresh replaces it', async () => {
      const env = deferredPager(); const pending = env.pager.replace(query(''), { seed: { items: [{ id: 'cached' }] } });
      assert.equal(env.pager.getState().fromCache, true); assert.equal(env.pager.getState().refreshing, true);
      env.calls[0].resolve(page(['fresh'])); await pending; assert.equal(env.pager.getState().fromCache, false);
      assert.equal(env.pager.getState().items[0].id, 'fresh');
    });
    await check('failed cache refresh preserves visible cached content and reports the failure', async () => {
      const env = deferredPager(); const pending = env.pager.replace(query(''), { seed: { items: [{ id: 'cached' }] } });
      env.calls[0].reject(new Error('offline')); await pending; assert.equal(env.pager.getState().fromCache, true);
      assert.equal(env.pager.getState().items[0].id, 'cached'); assert.equal(env.pager.getState().error, 'offline');
    });
    await check('cache uses query-specific keys, copies values, and expires', async () => {
      const cache = require(path.join(MINI, 'services/resource-cache.js'));
      const originalNow = Date.now; let now = 100;
      try {
        Date.now = () => now; const q = query('cache-test'); cache.put(q, [{ id: 'a' }]);
        const cached = cache.get(q); cached.items[0].id = 'changed'; assert.equal(cache.get(q).items[0].id, 'a');
        assert.equal(cache.get(query('different')), null); now += 30001; assert.equal(cache.get(q), null);
      } finally { Date.now = originalNow; }
    });
    await check('fault demonstration modes do not poison the normal cache', async () => {
      const cache = require(path.join(MINI, 'services/resource-cache.js'));
      const fault = { ...query('fault'), mode: 'http503' }; cache.put(fault, [{ id: 'bad' }]); assert.equal(cache.get(fault), null);
    });
    await check('page debounce invalidates earlier work immediately and is cleared on hide', async () => {
      let def; let cancelled = 0; const timers = new Map(); let timerId = 0;
      const stubPager = { replace: () => Promise.resolve(), pause: () => { cancelled += 1; }, dispose() {} };
      const dependencies = {
        '../../services/resource-api': { fetchPage() {} }, '../../services/resource-cache': { get: () => null, put() {} },
        '../../models/resource-pager': { createPager: () => stubPager }, '../../services/task-repository': { saveTask() {} }
      };
      vm.runInNewContext(fs.readFileSync(path.join(MINI, 'pages/resources/index.js'), 'utf8'), {
        require: name => dependencies[name], Page: value => { def = value; },
        setTimeout(fn) { const id = ++timerId; timers.set(id, fn); return id; }, clearTimeout(id) { timers.delete(id); }, wx: {}, console
      });
      const instance = { data: JSON.parse(JSON.stringify(def.data)), setData(patch) { Object.assign(this.data, patch); } };
      for (const [key, value] of Object.entries(def)) if (typeof value === 'function') instance[key] = value.bind(instance);
      instance.onLoad(); instance.onShow(); instance.onKeyword({ detail: { value: 'a' } }); instance.onKeyword({ detail: { value: 'ab' } });
      assert.equal(cancelled, 2); assert.equal(timers.size, 1); instance.onHide(); assert.equal(timers.size, 0);
    });
    await check('old pull-refresh finally cannot stop the newer refresh indicator', async () => {
      let definition; let stops = 0; const pending = [];
      const dependencies = {
        '../../services/resource-api': { fetchPage() {} }, '../../services/resource-cache': { get: () => null, put() {} },
        '../../models/resource-pager': { createPager: () => ({
          replace() { return new Promise(resolve => pending.push(resolve)); }, pause() {}, dispose() {}
        }) }, '../../services/task-repository': { saveTask() {} }
      };
      vm.runInNewContext(fs.readFileSync(path.join(MINI, 'pages/resources/index.js'), 'utf8'), {
        require: name => dependencies[name], Page: value => { definition = value; }, clearTimeout, setTimeout,
        wx: { stopPullDownRefresh() { stops += 1; } }, console
      });
      const instance = { data: JSON.parse(JSON.stringify(definition.data)), setData(patch) { Object.assign(this.data, patch); } };
      for (const [key, value] of Object.entries(definition)) if (typeof value === 'function') instance[key] = value.bind(instance);
      instance.onLoad(); instance._visible = true;
      const first = instance.onPullDownRefresh(); const second = instance.onPullDownRefresh();
      pending[0](); await first; assert.equal(stops, 0);
      pending[1](); await second; assert.equal(stops, 1);
      const third = instance.onPullDownRefresh(); instance.onUnload(); pending[2](); await third; assert.equal(stops, 1);
    });
    assert.deepEqual(unique([{ id: 'a' }, { id: 'a' }]).map(item => item.id), ['a']);
  } finally {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
  const result = { date: '2026-10-31', passed: records.length, realLoopbackHttp: true, scenarios: records,
    limitations: 'No native WeChat compilation, wx.request transport, or real-device validation.' };
  fs.writeFileSync(path.join(__dirname, '第三阶段测试结果.json'), JSON.stringify(result, null, 2) + '\n', 'utf8');
  console.log('\nAll ' + records.length + ' network scenarios passed, including real local HTTP.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
