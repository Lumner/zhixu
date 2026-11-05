// 本地故障注入；不安装 SDK、不访问真实云账号。
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const project = process.argv[2] || '06-studyhub-sync';
const SUITE_PROJECT = project === '16-studyhub-operations' ? '15-studyhub-release' : project;
if (!['06-studyhub-sync', '07-studyhub-knowledge', '08-studyhub-focus', '09-studyhub-stats', '10-studyhub-platform', '11-studyhub-quality', '12-studyhub-performance', '13-studyhub-accessibility', '14-studyhub-testing', '15-studyhub-release'].includes(SUITE_PROJECT)) throw new Error('Unknown test project');
const ROOT = path.resolve(__dirname, '../示例代码', project);
const FN = path.join(ROOT, 'cloudfunctions/studyhub');
const { createHandler } = require(path.join(FN, 'sync-domain'));
const { createTransactionStore } = require(path.join(FN, 'transaction-store'));
const { createOutbox } = require(path.join(ROOT, 'miniprogram/services/outbox-core'));
const copy = value => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
const fields = (title = '学习事务') => ({ title, description: '', category: 'general', priority: 'normal', dueDate: '', done: false });
const A = { APPID: 'wx-local', OPENID: 'A' }, B = { APPID: 'wx-local', OPENID: 'B' };
const op = index => 'operation_local_' + String(index).padStart(5, '0');
const records = [];
async function test(name, run) { await run(); records.push(name); }
function memoryStore() {
  let database = {}, tail = Promise.resolve();
  const store = { failBefore: null, failAfter: null,
    rows: name => Object.values(database[name] || {}).map(copy),
    async transaction(work) {
      const previous = tail; let release; tail = new Promise(resolve => { release = resolve; }); await previous;
      const draft = copy(database); const changes = [];
      const tx = {
        async get(name, id) { return copy(draft[name] && draft[name][id]) || null; },
        async set(name, id, row) { draft[name] ||= {}; draft[name][id] = { ...copy(row), _id: id }; changes.push(name); },
        async remove(name, id) { if (draft[name]) delete draft[name][id]; changes.push(name); }
      };
      try {
        const result = await work(tx);
        if (store.failBefore && store.failBefore(changes)) { store.failBefore = null; throw new Error('before commit'); }
        database = draft;
        if (store.failAfter && store.failAfter(changes)) { store.failAfter = null; throw new Error('commit response lost'); }
        return copy(result);
      } finally { release(); }
    },
    async get(actor, id) { return store.rows('studyhub_tasks').find(row => row._id === id && row.ownerId === actor.ownerId && row.ownerAppId === actor.ownerAppId) || null; },
    async list(actor, options) {
      return store.rows('studyhub_tasks').filter(row => row.ownerId === actor.ownerId && row.ownerAppId === actor.ownerAppId
        && (!options.cursor || row._id > options.cursor) && (options.filter === 'all' || row.done === (options.filter === 'done')))
        .sort((a, b) => a._id.localeCompare(b._id)).slice(0, options.limit);
    },
    async listImages(actor, cursor, limit) {
      return store.rows('studyhub_assets').filter(row => row.ownerId === actor.ownerId && row.ownerAppId === actor.ownerAppId
        && (!cursor || row._id > cursor)).sort((a, b) => a._id.localeCompare(b._id)).slice(0, limit);
    }
  };
  return store;
}
function fixture() {
  const store = memoryStore(); let context = A, sequence = 0;
  const files = new Map();
  const storage = { uploads: 0, removeFailure: false, uploadHook: null,
    async upload(cloudPath, buffer) { this.uploads += 1; if (this.uploadHook) await this.uploadHook();
      const id = 'cloud://local/' + cloudPath; files.set(id, Buffer.from(buffer)); return id; },
    async download(id) { return files.get(id); },
    async remove(id) { if (this.removeFailure) throw new Error('storage unavailable'); files.delete(id); }
  };
  const handler = createHandler({ store, storage, getContext: () => context, expectedAppId: A.APPID,
    now: () => 1800000000000, randomId: () => 'asset_' + (++sequence), logger: { error() {} } });
  return { store, storage, files, handler, actor: value => { context = value; } };
}
const create = (f, index = 1) => f.handler({ action: 'create', opId: op(index), fields: fields() });
const jpeg = Buffer.from([255, 216, 255, 0, 255, 217]).toString('base64'); // 特征夹具，不是可显示的真实 JPEG。
const upload = (f, index = 1) => f.handler({ action: 'imageUpload', opId: op(index), caption: '课堂白板', base64: jpeg });
function outboxFixture() {
  const map = new Map(); let user = 'aaaaaa111111', sequence = 0, sends = 0;
  const options = { envId: 'env-local', getIdentity: async () => ({ appId: 'wx-local', userTag: user }),
    read: key => copy(map.get(key)), write: (key, value) => map.set(key, copy(value)),
    send: async () => { sends += 1; return { accepted: true }; }, newId: () => op(++sequence) };
  return { map, options, make: () => createOutbox({ ...options, send: (...args) => options.send(...args) }), user: value => { user = value; }, sends: () => sends };
}
function loadModule(file, mocks, globals = {}) {
  // 继承图片压缩测试显式允许前置隐私；真实门控在第34章新套件验证。
  if (SUITE_PROJECT=== '15-studyhub-release' && file.endsWith('images.js')) mocks = { './privacy': { ensure: async () => ({}) }, ...mocks };
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(file, 'utf8'), { module, exports: module.exports,
    require: name => name in mocks ? mocks[name] : require(path.resolve(path.dirname(file), name)), wx: {}, process: { env: {} }, ...globals }, { filename: file });
  return module.exports;
}
async function main() {
  await test('无微信上下文拒绝调用', async () => { const f = fixture(); f.actor({}); assert.equal((await create(f)).error.code, 'UNAUTHENTICATED'); });
  await test('伪造所有者字段被拒绝', async () => { const f = fixture(); assert.equal((await f.handler({ action: 'create', opId: op(1), fields: { ...fields(), ownerId: 'B' } })).error.code, 'INVALID_INPUT'); });
  await test('旧版无操作编号的写入入口被关闭', async () => { const f = fixture(); assert.equal((await f.handler({ action: 'create', fields: fields() })).error.code, 'INVALID_INPUT'); });
  await test('同编号同内容创建两次只有一条任务', async () => { const f = fixture(); const a = await create(f), b = await create(f); assert.deepEqual(a, b); assert.equal(f.store.rows('studyhub_tasks').length, 1); });
  await test('同编号不同内容拒绝复用', async () => { const f = fixture(); await create(f); assert.equal((await f.handler({ action: 'create', opId: op(1), fields: fields('其他内容') })).error.code, 'IDEMPOTENCY_MISMATCH'); });
  await test('同编号跨用户相互隔离', async () => { const f = fixture(); const a = await create(f); f.actor(B); const b = await create(f); assert.notEqual(a.data.id, b.data.id); });
  await test('业务修改与回执在提交前失败时一起回滚', async () => { const f = fixture(); f.store.failBefore = names => names.includes('studyhub_ops'); assert.equal((await create(f)).error.code, 'INTERNAL'); assert.equal(f.store.rows('studyhub_tasks').length, 0); assert.equal(f.store.rows('studyhub_ops').length, 0); assert.equal((await create(f)).ok, true); });
  await test('提交成功但响应丢失后重试不重复创建', async () => { const f = fixture(); f.store.failAfter = names => names.includes('studyhub_ops'); assert.equal((await create(f)).ok, false); assert.equal((await create(f)).ok, true); assert.equal(f.store.rows('studyhub_tasks').length, 1); });
  await test('两个同编号并发调用返回同一任务', async () => { const f = fixture(); const [a, b] = await Promise.all([create(f), create(f)]); assert.deepEqual(a, b); assert.equal(f.store.rows('studyhub_tasks').length, 1); });
  await test('跨账号读改删不能访问任务', async () => { const f = fixture(); const { id } = (await create(f)).data; f.actor(B);
    for (const action of ['get', 'update', 'remove']) { const event = { action, id }; if (action !== 'get') Object.assign(event, { opId: op(2), version: 1 }); if (action === 'update') event.fields = fields(); assert.equal((await f.handler(event)).error.code, 'NOT_FOUND'); } });
  await test('同版本两个编辑仅一个成功且另一份明确冲突', async () => { const f = fixture(); const { id } = (await create(f)).data;
    const result = await Promise.all([2, 3].map(n => f.handler({ action: 'update', opId: op(n), id, version: 1, fields: fields('草稿' + n) })));
    assert.equal(result.filter(r => r.ok).length, 1); assert.equal(result.find(r => !r.ok).error.code, 'CONFLICT'); });
  await test('更新响应丢失重试不再增加版本', async () => { const f = fixture(); const { id } = (await create(f)).data; const event = { action: 'update', opId: op(2), id, version: 1, fields: fields('已更新') };
    f.store.failAfter = names => names.includes('studyhub_ops'); await f.handler(event); assert.equal((await f.handler(event)).data.version, 2); assert.equal((await f.handler({ action: 'get', id })).data.version, 2); });
  await test('删除回执可重放且旧创建重试不会复活任务', async () => { const f = fixture(); const { id } = (await create(f)).data; const event = { action: 'remove', opId: op(2), id, version: 1 }; assert.equal((await f.handler(event)).ok, true); assert.equal((await f.handler(event)).ok, true); await create(f); assert.equal(f.store.rows('studyhub_tasks').length, 0); });
  await test('迁移更换操作编号仍由来源映射去重', async () => { const f = fixture(); const event = { action: 'importTask', sourceKey: 'studyhub.tasks.v2', localId: 'local_1', fields: fields() };
    const a = await f.handler({ ...event, opId: op(1) }), b = await f.handler({ ...event, opId: op(2) }); assert.deepEqual(a.data, b.data); assert.equal(f.store.rows('studyhub_tasks').length, 1); });
  await test('同来源同本地 ID 内容改变时不覆盖云任务', async () => { const f = fixture(); const event = { action: 'importTask', sourceKey: 'studyhub.tasks.v2', localId: 'local_1', fields: fields() };
    await f.handler({ ...event, opId: op(1) }); assert.equal((await f.handler({ ...event, fields: fields('被改变'), opId: op(2) })).error.code, 'MIGRATION_SOURCE_CHANGED'); });
  await test('未知迁移来源被拒绝', async () => { const f = fixture(); assert.equal((await f.handler({ action: 'importTask', sourceKey: 'arbitrary', localId: 'x', fields: fields(), opId: op(1) })).error.code, 'INVALID_INPUT'); });
  await test('图片扩展名由服务端文件特征判断', async () => { const f = fixture(); const r = await upload(f); assert.equal(r.data.extension, 'jpg'); assert.equal(r.data.size, 6); assert.equal('fileID' in r.data, false); });
  await test('非法 Base64 与伪装文本被拒绝', async () => { const f = fixture(); for (const base64 of ['@@@', Buffer.from('hello').toString('base64')]) assert.equal((await f.handler({ action: 'imageUpload', opId: op(1), caption: 'x', base64 })).error.code, 'INVALID_IMAGE'); });
  await test('超过 64 KiB 的图片被拒绝', async () => { const f = fixture(); assert.equal((await f.handler({ action: 'imageUpload', opId: op(1), caption: 'x', base64: Buffer.alloc(65537).toString('base64') })).error.code, 'INVALID_IMAGE'); });
  await test('客户端不能指定任意 fileID 或云路径', async () => { const f = fixture(); assert.equal((await f.handler({ action: 'imageUpload', opId: op(1), caption: 'x', base64: jpeg, fileID: 'victim' })).error.code, 'INVALID_INPUT'); });
  await test('跨账号图片列表与下载隔离', async () => { const f = fixture(); const { id } = (await upload(f)).data; f.actor(B); assert.equal((await f.handler({ action: 'imageList' })).data.items.length, 0); assert.equal((await f.handler({ action: 'imageRead', id })).error.code, 'NOT_FOUND'); });
  await test('跨账号不能删除图片', async () => { const f = fixture(); const { id } = (await upload(f)).data; f.actor(B); assert.equal((await f.handler({ action: 'imageRemove', opId: op(2), id })).error.code, 'NOT_FOUND'); assert.equal(f.files.size, 1); });
  await test('同操作上传重试命中回执且不会再传文件', async () => { const f = fixture(); const a = await upload(f), b = await upload(f); assert.deepEqual(a, b); assert.equal(f.storage.uploads, 1); });
  await test('图片登记提交响应丢失后不能误删已引用文件', async () => { const f = fixture(); f.store.failAfter = names => names.includes('studyhub_assets'); assert.equal((await upload(f)).ok, false); assert.equal(f.files.size, 1); assert.equal((await upload(f)).ok, true); assert.equal(f.storage.uploads, 1); });
  await test('并发上传使用不同物理路径且只留下一个引用赢家', async () => { const f = fixture(); let count = 0, release; const gate = new Promise(resolve => { release = resolve; });
    f.storage.uploadHook = async () => { if (++count === 2) release(); await gate; };
    const [a, b] = await Promise.all([upload(f), upload(f)]); assert.deepEqual(a.data, b.data); assert.equal(f.storage.uploads, 2); assert.equal(f.files.size, 1); assert.equal(f.store.rows('studyhub_assets').length, 1); });
  await test('上传后登记失败保留日志和孤立文件供人工核对', async () => { const f = fixture(); f.store.failBefore = names => names.includes('studyhub_assets'); assert.equal((await upload(f)).ok, false); assert.equal(f.files.size, 1); assert.equal(f.store.rows('studyhub_uploads')[0].state, 'uploaded'); assert.equal(f.store.rows('studyhub_assets').length, 0); });
  await test('物理删除失败时已禁止新的云端预览', async () => { const f = fixture(); const { id } = (await upload(f)).data; f.storage.removeFailure = true;
    assert.equal((await f.handler({ action: 'imageRemove', opId: op(2), id })).data.cleanupPending, true); assert.equal((await f.handler({ action: 'imageRead', id })).error.code, 'NOT_FOUND'); assert.equal(f.files.size, 1); });
  await test('物理删除失败后重试可完成清理', async () => { const f = fixture(); const { id } = (await upload(f)).data; const event = { action: 'imageRemove', opId: op(2), id }; f.storage.removeFailure = true; await f.handler(event); f.storage.removeFailure = false;
    assert.equal((await f.handler(event)).data.cleanupPending, false); assert.equal(f.files.size, 0); assert.equal(f.store.rows('studyhub_assets')[0].state, 'deleted'); });
  await test('删除后旧上传操作重试不会重建文件', async () => { const f = fixture(); const { id } = (await upload(f)).data; await f.handler({ action: 'imageRemove', opId: op(2), id }); await upload(f); assert.equal(f.files.size, 0); assert.equal(f.storage.uploads, 1); });
  await test('先保存 outbox 后发请求，成功后移除记录', async () => { const f = outboxFixture(); f.options.send = async () => { assert.equal([...f.map.values()][0].items.length, 1); return 'ok'; }; const box = f.make(); assert.equal(await box.submit('create', { fields: fields() }), 'ok'); assert.equal((await box.list()).length, 0); });
  await test('落盘失败时禁止发出写请求', async () => { const f = outboxFixture(); f.options.write = () => { throw new Error('quota'); }; await assert.rejects(f.make().submit('create', {}), { code: 'LOCAL_STORAGE' }); assert.equal(f.sends(), 0); });
  await test('网络失败保留原编号，重建客户端后仍可重试', async () => { const f = outboxFixture(); let captured; f.options.send = async (action, payload) => { captured = payload.opId; throw Object.assign(new Error('lost'), { code: 'TRANSPORT' }); };
    let box = f.make(); await assert.rejects(box.submit('create', { fields: fields() }), { queued: true }); const row = (await box.list())[0]; assert.equal(row.state, 'pending');
    f.options.send = async (action, payload) => { assert.equal(payload.opId, captured); return 'ok'; }; box = f.make(); await box.retry(row.opId); assert.equal((await box.list()).length, 0); });
  await test('协议异常保留待确认记录', async () => { const f = outboxFixture(); f.options.send = async () => { throw Object.assign(new Error('bad response'), { code: 'PROTOCOL' }); }; const box = f.make(); await assert.rejects(box.submit('create', {})); assert.equal((await box.list())[0].state, 'pending'); });
  await test('确认前身份失败不假装已经入队', async () => { const f = outboxFixture(); f.options.getIdentity = async () => { throw Object.assign(new Error('offline'), { code: 'TRANSPORT' }); }; await assert.rejects(f.make().submit('create', {}), e => !e.queued); assert.equal(f.map.size, 0); });
  await test('账号切换后不能读取另一账号 outbox', async () => { const f = outboxFixture(); f.options.send = async () => { throw new Error('lost'); }; const box = f.make(); await assert.rejects(box.submit('create', {})); f.user('bbbbbb222222'); assert.equal((await box.list()).length, 0); });
  await test('迁移预览绑定身份，变化后禁止发送', async () => { const f = outboxFixture(); const box = f.make(), owner = await box.identity(); f.user('bbbbbb222222'); await assert.rejects(box.submit('importTask', {}, owner), { code: 'IDENTITY_CHANGED' }); assert.equal(f.sends(), 0); });
  await test('冲突保留草稿并禁止直接重试旧版本', async () => { const f = outboxFixture(); f.options.send = async () => { throw Object.assign(new Error('conflict'), { code: 'CONFLICT' }); }; const box = f.make(); await assert.rejects(box.submit('update', { id: 'task', version: 1, fields: fields('我的草稿') })); const row = (await box.list())[0]; assert.equal(row.state, 'blocked'); assert.equal(row.payload.fields.title, '我的草稿'); await assert.rejects(box.retry(row.opId), { code: 'LOCAL_STATE' }); });
  await test('用户重新提交冲突草稿时生成新编号并使用新版本', async () => { const f = outboxFixture(); f.options.send = async () => { throw Object.assign(new Error('conflict'), { code: 'CONFLICT' }); }; const box = f.make(); await assert.rejects(box.submit('update', { id: 'task', version: 1, fields: fields() })); const row = (await box.list())[0]; f.options.send = async (action, payload) => { assert.notEqual(payload.opId, row.opId); assert.equal(payload.version, 3); return 'ok'; }; await box.rebase(row.opId, 3); });
  await test('结果未确认的操作禁止随意丢弃', async () => { const f = outboxFixture(); f.options.send = async () => { throw new Error('lost'); }; const box = f.make(); await assert.rejects(box.submit('create', {})); await assert.rejects(box.discard((await box.list())[0].opId), { code: 'LOCAL_STATE' }); });
  await test('损坏 outbox 不能悄悄替换成空数组', async () => { const f = outboxFixture(); const box = f.make(); f.map.set('studyhub.outbox.v1:' + await box.identity(), { schemaVersion: 1, items: [{ unexpected: true }] }); await assert.rejects(box.list(), { code: 'LOCAL_DATA' }); });
  const migration = loadModule(path.join(ROOT, 'miniprogram/services/migration.js'), { './outbox': { submit: async () => {} } });
  await test('迁移优先 v2 且快照不受之后缓存变化影响', async () => { const stored = { schemaVersion: 2, tasks: [{ id: 'local_1', ...fields() }] }; const plan = migration.snapshot(key => key.endsWith('v2') ? stored : []); stored.tasks[0].title = 'changed'; assert.equal(plan.items[0].fields.title, '学习事务'); assert.equal(plan.backup.raw.tasks[0].title, '学习事务'); });
  await test('损坏 v2 不回退 v1', async () => { assert.throws(() => migration.snapshot(key => key.endsWith('v2') ? { schemaVersion: 3, tasks: [] } : [])); });
  await test('重复本地 ID 阻止整个预览', async () => { assert.throws(() => migration.snapshot(() => ({ schemaVersion: 2, tasks: [{ id: 'x', ...fields() }, { id: 'x', ...fields() }] }))); });
  await test('v1 迁移补充默认字段并保留原始备份', async () => { const raw = [{ id: 'old_1', title: '旧任务', done: false, createdAt: 123 }]; const plan = migration.snapshot(key => key.endsWith('v2') ? '' : raw); assert.equal(plan.items[0].fields.category, 'general'); assert.equal(plan.backup.raw[0].createdAt, 123); });
  await test('迁移中途失败停止后续条目并报告已确认进度', async () => { let count = 0; const progress = []; const m = loadModule(path.join(ROOT, 'miniprogram/services/migration.js'), { './outbox': { submit: async () => { if (++count === 2) throw new Error('lost'); } } });
    await assert.rejects(m.run({ sourceKey: 'studyhub.tasks.v2', items: [1, 2, 3].map(n => ({ localId: String(n), fields: fields() })) }, n => progress.push(n), 'owner')); assert.equal(count, 2); assert.deepEqual(progress, [1]); });
  await test('真实适配器按 SDK data 形状读取，去除 _id 并提交', async () => { const calls = []; const tx = { collection: name => ({ doc: id => ({ get: async () => ({ data: null }), set: async arg => calls.push(['set', name, id, arg.data]), remove: async () => {} }) }), commit: async () => calls.push(['commit']), rollback: async () => calls.push(['rollback']) };
    const db = { collection: () => ({}), startTransaction: async () => tx }; const store = createTransactionStore(db);
    const result = await store.transaction(async adapter => { assert.equal(await adapter.get('studyhub_ops', 'missing'), null); await adapter.set('studyhub_ops', 'op', { _id: 'op', result: { ok: true } }); return 'ok'; }); assert.equal(result, 'ok'); assert.equal('_id' in calls[0][3], false); assert.equal(calls[1][0], 'commit'); });
  await test('适配器提交异常会尝试回滚且不吞掉原异常', async () => { let rolled = false; const store = createTransactionStore({ collection: () => ({}), startTransaction: async () => ({ commit: async () => { throw new Error('lost commit'); }, rollback: async () => { rolled = true; throw new Error('rollback failed'); } }) }); await assert.rejects(store.transaction(async () => 'ok'), /lost commit/); assert.equal(rolled, true); });
  await test('云入口固定配置缺失文档返回 null 且检查逐文件删除状态', async () => {
    let captured, options;
    loadModule(path.join(FN, 'index.js'), { 'wx-server-sdk': { DYNAMIC_CURRENT_ENV: 'DYNAMIC', init() {}, database(value) { options = value; return {}; }, getWXContext: () => A, deleteFile: async () => ({ fileList: [{ fileID: 'cloud://x', status: 9 }] }) },
      './sync-domain': { createHandler(value) { captured = value; return () => {}; } }, './transaction-store': { createTransactionStore: () => ({}) } });
    assert.equal(options.throwOnNotFound, false); await assert.rejects(captured.storage.remove('cloud://x'));
  });
  await test('数据库与存储直连拒绝模板保持关闭', async () => { for (const relative of ['security/storage-rules.json', 'database/permissions.json']) { const rule = JSON.parse(fs.readFileSync(path.join(ROOT, relative))); assert.equal(rule.read, false); assert.equal(rule.write, false); } });
  await test('实际 outbox 包装层在写响应格式错误时保留原编号', async () => {
    const map = new Map(); let broken = true; const ids = [];
    const box = loadModule(path.join(ROOT, 'miniprogram/services/outbox.js'), {
      './cloud-client': { call: async (action, payload) => {
        if (action === 'whoami') return { authenticated: true, appId: 'wx-local', userTag: 'aaaaaa111111' };
        ids.push(payload.opId); return broken ? { bad: true } : { id: 'task_1', ...fields(), createdAt: 1, updatedAt: 1, version: 1 };
      } }, '../config/cloud': { ENV_ID: 'test' }
    }, { wx: { getStorageSync: key => map.get(key), setStorageSync: (key, value) => map.set(key, copy(value)) } });
    await assert.rejects(box.submit('create', { fields: fields() }), { code: 'PROTOCOL' });
    broken = false; await box.retry((await box.list())[0].opId); assert.equal(ids[0], ids[1]); assert.equal((await box.list()).length, 0);
  });
  await test('图片客户端读取临时文件并按实际字节大小限制', async () => {
    let compressed;
    const images = loadModule(path.join(ROOT, 'miniprogram/services/images.js'), { './cloud-client': {}, './outbox': {} }, { wx: {
      canIUse: () => true, chooseMedia: options => options.success({ tempFiles: [{ tempFilePath: '/temp/original.jpg' }] }),
      compressImage: options => { compressed = options; options.success({ tempFilePath: '/temp/small.jpg' }); },
      getFileSystemManager: () => ({ readFile: options => options.success({ data: jpeg }) })
    } });
    const result = await images.choose(); assert.equal(result.bytes, 6); assert.equal(compressed.compressedWidth, 320); assert.equal(compressed.src, '/temp/original.jpg');
  });
  await test('预览回调成功时不提前删除仍可能显示的文件', async () => {
    let unlinked = 0, written = '';
    const images = loadModule(path.join(ROOT, 'miniprogram/services/images.js'), { './cloud-client': { call: async () => ({ id: 'asset_1', extension: 'jpg', base64: jpeg }) }, './outbox': {} }, { wx: {
      env: { USER_DATA_PATH: '/private' }, previewImage: options => options.success({}),
      getFileSystemManager: () => ({ writeFile: options => { written = options.filePath; options.success({}); }, unlink: options => { unlinked += 1; options.success({}); } })
    } });
    await images.preview('asset_1'); assert.equal(unlinked, 0); assert.equal(written, '/private/studyhub-preview.jpg'); await images.clearPreview(); assert.equal(unlinked, 2);
  });
  const result = { date: '2026-11-02', project, passed: records.length, realCloud: false, scenarios: records };
  fs.writeFileSync(path.join(__dirname, SUITE_PROJECT=== '06-studyhub-sync' ? '第五阶段测试结果.json'
    : SUITE_PROJECT=== '07-studyhub-knowledge' ? '第六阶段继承测试结果.json'
      : SUITE_PROJECT=== '08-studyhub-focus' ? '第七阶段基础继承测试结果.json' : SUITE_PROJECT=== '09-studyhub-stats' ? '第八阶段基础继承测试结果.json' : SUITE_PROJECT=== '10-studyhub-platform' ? '第九阶段基础继承测试结果.json' : SUITE_PROJECT=== '11-studyhub-quality' ? '第十阶段基础继承测试结果.json' : (['13-studyhub-accessibility','14-studyhub-testing', '15-studyhub-release'].includes(SUITE_PROJECT) ? (['14-studyhub-testing','15-studyhub-release'].includes(SUITE_PROJECT) ? (SUITE_PROJECT=== '15-studyhub-release' ? (project==='16-studyhub-operations'?'第十五阶段基础继承测试结果.json':'第十四阶段基础继承测试结果.json') : '第十三阶段基础继承测试结果.json') : '第十二阶段基础继承测试结果.json') : '第十一阶段基础继承测试结果.json')), JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify({ passed: records.length, realCloud: false }));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
