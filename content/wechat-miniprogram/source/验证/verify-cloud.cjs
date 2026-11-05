// 仅本地业务与数据库调用条件验证，不连接真实云、不加载真实 wx-server-sdk。
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ROOT = path.resolve(__dirname, '../示例代码/05-studyhub-cloud');
const FUNCTION = path.join(ROOT, 'cloudfunctions/studyhub');
const { createHandler } = require(path.join(FUNCTION, 'domain.js'));
const { createDatabaseStore } = require(path.join(FUNCTION, 'database-store.js'));
const copy = value => JSON.parse(JSON.stringify(value));
const APP_ID = 'wx-unit-test';
const ACTOR_A = { APPID: APP_ID, OPENID: 'openid-A' };
const ACTOR_B = { APPID: APP_ID, OPENID: 'openid-B' };
const fields = (title = '学习云开发', extra = {}) => ({ title, description: '', category: 'general', priority: 'normal', dueDate: '', done: false, ...extra });
const records = [];

function memoryDatabase() {
  const documents = new Map();
  const calls = [];
  let sequence = 0;
  const db = { documents, calls, fail: false,
    command: { gt: value => ({ operator: 'gt', value }), inc: value => ({ operator: 'inc', value }) },
    collection(name) {
      assert.equal(name, 'studyhub_tasks');
      const check = () => { if (db.fail) throw Object.assign(new Error('private-db-detail'), { code: 'DB_FAIL' }); };
      function query(condition) {
        let limit = Infinity; let ascending = true;
        const matches = doc => Object.entries(condition).every(([key, value]) =>
          value && value.operator === 'gt' ? doc[key] > value.value : doc[key] === value);
        const selection = () => [...documents.values()].filter(matches);
        return {
          orderBy(field, order) { assert.equal(field, '_id'); ascending = order === 'asc'; return this; },
          limit(value) { limit = value; return this; },
          async get() { check(); calls.push({ type: 'get', condition: copy(condition) });
            const rows = selection().sort((a, b) => a._id.localeCompare(b._id) * (ascending ? 1 : -1)).slice(0, limit);
            return { data: copy(rows) };
          },
          async update({ data }) { check(); calls.push({ type: 'update', condition: copy(condition) });
            const rows = selection();
            for (const row of rows) for (const [key, value] of Object.entries(data)) {
              row[key] = value && value.operator === 'inc' ? row[key] + value.value : value;
            }
            return { stats: { updated: rows.length } };
          },
          async remove() { check(); calls.push({ type: 'remove', condition: copy(condition) });
            const rows = selection(); for (const row of rows) documents.delete(row._id);
            return { stats: { removed: rows.length } };
          }
        };
      }
      return { where: query,
        async add({ data }) { check(); const id = 'task_' + String(++sequence).padStart(6, '0');
          documents.set(id, { ...copy(data), _id: id }); return { _id: id }; }
      };
    }
  };
  return db;
}
function environment() {
  const db = memoryDatabase();
  const logs = [];
  const store = createDatabaseStore(db);
  const handler = (context, app = APP_ID) => createHandler({ store, getContext: () => context,
    expectedAppId: app, now: () => 1800000000000, logger: { error: value => logs.push(value) } });
  return { db, store, logs, handler, A: handler(ACTOR_A), B: handler(ACTOR_B) };
}
async function check(name, fn) { await fn(); records.push(name); console.log('PASS ' + String(records.length).padStart(2, '0') + ' ' + name); }
async function create(actor, value = fields()) { const result = await actor({ action: 'create', fields: value }); assert.equal(result.ok, true); return result.data; }
function editorWith(repository) {
  let definition; let navigations = 0;
  const dependencies = {
    '../../services/cloud-repository': repository,
    '../../services/navigation': { readId: options => options.id || '', backOrList: () => { navigations += 1; } },
    '../../constants/index': require(path.join(ROOT, 'miniprogram/constants/index.js')),
    '../../utils/task': require(path.join(ROOT, 'miniprogram/utils/task.js'))
  };
  vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'miniprogram/pages/editor/index.js'), 'utf8'), {
    require: name => dependencies[name], Page: value => { definition = value; }, wx: { showToast() {} }
  });
  const page = { data: copy(definition.data), setData(patch) { Object.assign(this.data, copy(patch)); } };
  for (const [key, value] of Object.entries(definition)) if (typeof value === 'function') page[key] = value.bind(page);
  return { page, navigationCount: () => navigations };
}
function cloudClient({ ready = true, respond }) {
  const module = { exports: {} }; let calls = 0;
  vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'miniprogram/services/cloud-client.js'), 'utf8'), {
    module, exports: module.exports, require: () => ({ ENV_ID: 'test-env', FUNCTION_NAME: 'studyhub' }),
    getApp: () => ({ globalData: { cloudReady: ready, bootError: '配置未完成' } }),
    wx: { cloud: { callFunction(options) { calls += 1; respond(options); } } }, console: { error() {} }
  });
  return { client: module.exports, callCount: () => calls };
}

async function main() {
  await check('missing trusted context cannot be replaced by event identity', async () => {
    const env = environment();
    const result = await env.handler({})({ action: 'whoami', userInfo: { openId: ACTOR_A.OPENID }, OPENID: ACTOR_A.OPENID });
    assert.equal(result.error.code, 'UNAUTHENTICATED');
  });
  await check('a mismatched AppID is rejected', async () => {
    const env = environment(); const result = await env.handler({ ...ACTOR_A, APPID: 'another-app' })({ action: 'whoami' });
    assert.equal(result.error.code, 'UNAUTHENTICATED');
  });
  await check('server allowlist must be configured', async () => {
    const result = await environment().handler(ACTOR_A, '')({ action: 'whoami' }); assert.equal(result.error.code, 'NOT_CONFIGURED');
  });
  await check('platform userInfo metadata is ignored instead of trusted', async () => {
    const env = environment();
    const real = await env.A({ action: 'whoami' });
    const spoofed = await env.A({ action: 'whoami', userInfo: { openId: ACTOR_B.OPENID } });
    assert.equal(real.data.userTag, spoofed.data.userTag);
    assert.notEqual(real.data.userTag, (await env.B({ action: 'whoami' })).data.userTag);
    assert.equal(JSON.stringify(real).includes(ACTOR_A.OPENID), false);
  });
  await check('create derives owner and timestamps on the server', async () => {
    const env = environment(); const task = await create(env.A, fields(' 任务 ', { description: ' 备注 ' }));
    const stored = env.db.documents.get(task.id);
    assert.equal(stored.ownerId, ACTOR_A.OPENID); assert.equal(stored.ownerAppId, APP_ID);
    assert.equal(task.title, '任务'); assert.equal(task.description, '备注'); assert.equal(task.version, 1);
    assert.equal(task.createdAt, 1800000000000); assert.equal('ownerId' in task, false);
  });
  await check('root owner injection is rejected', async () => {
    const result = await environment().A({ action: 'create', ownerId: ACTOR_B.OPENID, fields: fields() });
    assert.equal(result.error.code, 'INVALID_INPUT');
  });
  await check('owner and metadata injection inside editable fields is rejected', async () => {
    for (const extra of [{ ownerId: ACTOR_B.OPENID }, { ownerAppId: 'x' }, { createdAt: 0 }, { version: 999 }, { _id: 'chosen' }]) {
      const env = environment(); const result = await env.A({ action: 'create', fields: fields('task', extra) });
      assert.equal(result.error.code, 'INVALID_INPUT'); assert.equal(env.db.documents.size, 0);
    }
  });
  await check('object-shaped query operators cannot masquerade as a title', async () => {
    const result = await environment().A({ action: 'create', fields: fields({ $ne: null }) });
    assert.equal(result.error.code, 'INVALID_INPUT');
  });
  await check('blank, oversized, enum, boolean and calendar inputs fail', async () => {
    for (const value of [fields(' '), fields('a'.repeat(41)), fields('a', { description: 'x'.repeat(1001) }),
      fields('a', { category: 'admin' }), fields('a', { priority: 'urgent' }), fields('a', { done: 'false' }), fields('a', { dueDate: '2025-02-29' })]) {
      assert.equal((await environment().A({ action: 'create', fields: value })).error.code, 'INVALID_INPUT');
    }
  });
  await check('valid leap day and empty date are accepted', async () => {
    const env = environment(); await create(env.A, fields('闰日', { dueDate: '2024-02-29' })); await create(env.A, fields('无日期'));
  });
  await check('list returns only current owner records', async () => {
    const env = environment(); const a = await create(env.A); await create(env.B);
    const result = await env.A({ action: 'list' }); assert.deepEqual(result.data.items.map(item => item.id), [a.id]);
  });
  await check('cross-owner get and missing get have the same public outcome', async () => {
    const env = environment(); const a = await create(env.A);
    const other = await env.B({ action: 'get', id: a.id }); const missing = await env.B({ action: 'get', id: 'missing' });
    assert.deepEqual(other, missing); assert.equal(other.error.code, 'NOT_FOUND');
  });
  await check('cross-owner update is rejected without changing a record', async () => {
    const env = environment(); const a = await create(env.A);
    const result = await env.B({ action: 'update', id: a.id, version: 1, fields: fields('偷改') });
    assert.equal(result.error.code, 'NOT_FOUND_OR_CONFLICT'); assert.equal(env.db.documents.get(a.id).title, a.title);
  });
  await check('cross-owner delete is rejected without deleting a record', async () => {
    const env = environment(); const a = await create(env.A);
    const result = await env.B({ action: 'remove', id: a.id, version: 1 });
    assert.equal(result.error.code, 'NOT_FOUND_OR_CONFLICT'); assert.equal(env.db.documents.has(a.id), true);
  });
  await check('owned update increments version and preserves owner and creation time', async () => {
    const env = environment(); const a = await create(env.A);
    const result = await env.A({ action: 'update', id: a.id, version: 1, fields: fields('已修改', { done: true }) });
    assert.equal(result.data.version, 2); const stored = env.db.documents.get(a.id);
    assert.equal(stored.version, 2); assert.equal(stored.createdAt, a.createdAt); assert.equal(stored.ownerId, ACTOR_A.OPENID);
  });
  await check('stale versions cannot overwrite a newer update', async () => {
    const env = environment(); const a = await create(env.A);
    await env.A({ action: 'update', id: a.id, version: 1, fields: fields('新值') });
    const result = await env.A({ action: 'update', id: a.id, version: 1, fields: fields('旧值') });
    assert.equal(result.error.code, 'NOT_FOUND_OR_CONFLICT'); assert.equal(env.db.documents.get(a.id).title, '新值');
  });
  await check('two concurrent submissions with one version have one winner', async () => {
    const env = environment(); const a = await create(env.A);
    const results = await Promise.all(['甲', '乙'].map(title => env.A({ action: 'update', id: a.id, version: 1, fields: fields(title) })));
    assert.equal(results.filter(result => result.ok).length, 1); assert.equal(env.db.documents.get(a.id).version, 2);
  });
  await check('delete checks version before removing', async () => {
    const env = environment(); const a = await create(env.A);
    const stale = await env.A({ action: 'remove', id: a.id, version: 2 }); assert.equal(stale.ok, false);
    assert.equal((await env.A({ action: 'remove', id: a.id, version: 1 })).data.removed, true);
  });
  await check('updating deleted records never recreates them', async () => {
    const env = environment(); const a = await create(env.A); await env.A({ action: 'remove', id: a.id, version: 1 });
    assert.equal((await env.A({ action: 'update', id: a.id, version: 1, fields: fields('重建') })).ok, false);
    assert.equal(env.db.documents.size, 0);
  });
  await check('invalid IDs and versions are stopped before database writes', async () => {
    const env = environment();
    for (const id of [null, { $ne: '' }, '../path', '']) assert.equal((await env.A({ action: 'get', id })).error.code, 'INVALID_INPUT');
    for (const version of [0, -1, 1.5, '1']) assert.equal((await env.A({ action: 'remove', id: 'a', version })).error.code, 'INVALID_INPUT');
    assert.equal(env.db.calls.length, 0);
  });
  await check('list input limits and filters are validated', async () => {
    const env = environment();
    for (const value of [{ limit: 0 }, { limit: 21 }, { limit: '10' }, { filter: 'admin' }, { cursor: {} }]) {
      assert.equal((await env.A({ action: 'list', ...value })).error.code, 'INVALID_INPUT');
    }
  });
  await check('keyset pagination is complete without leaking another owner', async () => {
    const env = environment(); for (let i = 0; i < 25; i += 1) await create(env.A, fields('任务' + i)); await create(env.B);
    let cursor = null; const ids = [];
    do { const result = await env.A({ action: 'list', cursor, limit: 10 }); assert.equal(result.ok, true);
      ids.push(...result.data.items.map(item => item.id)); cursor = result.data.nextCursor;
    } while (cursor !== null);
    assert.equal(ids.length, 25); assert.equal(new Set(ids).size, 25);
  });
  await check('done and pending filters still enforce ownership', async () => {
    const env = environment(); await create(env.A, fields('done', { done: true })); await create(env.A); await create(env.B, fields('other', { done: true }));
    assert.equal((await env.A({ action: 'list', filter: 'done' })).data.items.length, 1);
    assert.equal((await env.A({ action: 'list', filter: 'pending' })).data.items.length, 1);
  });
  await check('database operations all contain ownerAppId and ownerId predicates', async () => {
    const env = environment(); const a = await create(env.A); await env.A({ action: 'list' }); await env.A({ action: 'get', id: a.id });
    await env.A({ action: 'update', id: a.id, version: 1, fields: fields('改') }); await env.A({ action: 'remove', id: a.id, version: 2 });
    for (const call of env.db.calls) { assert.equal(call.condition.ownerAppId, APP_ID); assert.equal(call.condition.ownerId, ACTOR_A.OPENID); }
    for (const call of env.db.calls.filter(item => ['update', 'remove'].includes(item.type))) assert.ok(call.condition.version);
  });
  await check('unexpected database failures do not expose internal error messages', async () => {
    const env = environment(); env.db.fail = true;
    const result = await env.A({ action: 'list' }); assert.equal(result.error.code, 'INTERNAL');
    assert.equal(JSON.stringify(result).includes('private-db-detail'), false); assert.equal(env.logs.length, 1);
  });
  await check('unsupported operations and non-object requests fail explicitly', async () => {
    const env = environment(); for (const value of [null, [], { action: 'admin' }]) assert.equal((await env.A(value)).error.code, 'INVALID_INPUT');
  });
  await check('real cloud entry is wired to SDK context rather than input', async () => {
    const env = environment(); const module = { exports: {} }; let initialized;
    const sdk = { DYNAMIC_CURRENT_ENV: 'runtime-env', init: value => { initialized = value; }, database: () => env.db, getWXContext: () => ACTOR_A };
    vm.runInNewContext(fs.readFileSync(path.join(FUNCTION, 'index.js'), 'utf8'), {
      module, exports: module.exports, process: { env: { STUDYHUB_APP_ID: APP_ID } }, console,
      require: name => name === 'wx-server-sdk' ? sdk : require(path.join(FUNCTION, name))
    });
    const result = await module.exports.main({ action: 'whoami', userInfo: { openId: ACTOR_B.OPENID } });
    assert.equal(result.data.userTag, (await env.A({ action: 'whoami' })).data.userTag); assert.equal(initialized.env, 'runtime-env');
  });
  await check('client does not call cloud before configuration', async () => {
    const env = cloudClient({ ready: false, respond() {} }); await assert.rejects(env.client.call('list'), error => error.code === 'NOT_CONFIGURED');
    assert.equal(env.callCount(), 0);
  });
  await check('client distinguishes transport failure from business rejection', async () => {
    const transport = cloudClient({ respond: options => options.fail({ errMsg: 'offline' }) });
    await assert.rejects(transport.client.call('create'), error => error.code === 'TRANSPORT');
    const business = cloudClient({ respond: options => options.success({ result: { ok: false, error: { code: 'INVALID_INPUT', message: 'bad' } } }) });
    await assert.rejects(business.client.call('create'), error => error.code === 'INVALID_INPUT');
  });
  await check('client rejects malformed cloud envelopes', async () => {
    const env = cloudClient({ respond: options => options.success({ result: 'wrong' }) });
    await assert.rejects(env.client.call('list'), error => error.code === 'PROTOCOL');
  });
  const formEvent = { detail: { value: { title: '草稿', description: '保留', done: false } } };
  await check('successful editor submission is not repeated', async () => {
    let saves = 0;
    const env = editorWith({ create: async () => { saves += 1; return {}; } }); await env.page.onLoad({});
    await env.page.onSubmit(formEvent); await env.page.onSubmit(formEvent);
    assert.equal(saves, 1); assert.equal(env.page.data.saved, true); assert.equal(env.navigationCount(), 1);
  });
  await check('uncertain write results retain draft and block blind resubmission', async () => {
    let saves = 0;
    const env = editorWith({ create: async () => { saves += 1; throw Object.assign(new Error('未确认'), { code: 'TRANSPORT' }); } });
    await env.page.onLoad({}); env.page.data.title = '保留草稿'; await env.page.onSubmit(formEvent); await env.page.onSubmit(formEvent);
    assert.equal(env.page.data.uncertain, true); assert.equal(env.page.data.title, '保留草稿'); assert.equal(saves, 1);
  });
  await check('a rejected stale edit preserves the draft without claiming saved', async () => {
    const task = { ...fields('初值'), id: 'task_a', version: 1, createdAt: 1, updatedAt: 1 };
    const env = editorWith({ get: async () => task, update: async () => { throw Object.assign(new Error('已变化'), { code: 'NOT_FOUND_OR_CONFLICT' }); } });
    await env.page.onLoad({ id: task.id }); env.page.data.title = '新草稿'; await env.page.onSubmit(formEvent);
    assert.equal(env.page.data.title, '新草稿'); assert.equal(env.page.data.saved, false); assert.equal(env.page.data.uncertain, false);
  });
  await check('an unloaded editor ignores late success but cannot undo the write', async () => {
    let resolve; const pending = new Promise(yes => { resolve = yes; });
    const env = editorWith({ create: () => pending }); await env.page.onLoad({});
    const saving = env.page.onSubmit(formEvent); env.page.onUnload(); resolve({}); await saving;
    assert.equal(env.page.data.saved, false); assert.equal(env.navigationCount(), 0);
  });
  await check('database template denies direct client reads and writes', async () => {
    const value = JSON.parse(fs.readFileSync(path.join(ROOT, 'database/permissions.json'), 'utf8'));
    assert.equal(value.read, false); assert.equal(value.write, false);
  });
  await check('SDK is pinned and the project keeps the cloud function directory separate', async () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(FUNCTION, 'package.json'), 'utf8'));
    const config = JSON.parse(fs.readFileSync(path.join(ROOT, 'project.config.json'), 'utf8'));
    assert.equal(pkg.dependencies['wx-server-sdk'], '4.0.2'); assert.equal(config.cloudfunctionRoot, 'cloudfunctions/');
    assert.equal(config.setting.urlCheck, true);
  });
  const result = { date: '2026-11-01', passed: records.length, realCloud: false, scenarios: records,
    limitations: 'In-memory database and SDK stubs only. Actual cloud deployment, SDK/database execution, security-rule enforcement, and two-account tests remain manual.' };
  fs.writeFileSync(path.join(__dirname, '第四阶段测试结果.json'), JSON.stringify(result, null, 2) + '\n', 'utf8');
  console.log('\nAll ' + records.length + ' cloud-lesson local scenarios passed. No cloud account was accessed.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
