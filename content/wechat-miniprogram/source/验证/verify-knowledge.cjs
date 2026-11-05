// 第 26 章新增业务测试：内存事务与 API 桩，不加载真实 SDK、不访问云环境。
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const project = process.argv[2] || '07-studyhub-knowledge';
const SUITE_PROJECT = project === '16-studyhub-operations' ? '15-studyhub-release' : project;
if (!['07-studyhub-knowledge', '08-studyhub-focus', '09-studyhub-stats', '10-studyhub-platform', '11-studyhub-quality', '12-studyhub-performance', '13-studyhub-accessibility', '14-studyhub-testing', '15-studyhub-release'].includes(SUITE_PROJECT)) throw new Error('Unknown test project');
const ROOT = path.resolve(__dirname, '../示例代码', project);
const FN = path.join(ROOT, 'cloudfunctions/studyhub');
const { createHandler } = require(path.join(FN, 'sync-domain'));
const { createTransactionStore } = require(path.join(FN, 'transaction-store'));
const schema = require(path.join(FN, 'knowledge-schema'));
const { toNodes } = require(path.join(ROOT, 'miniprogram/utils/note-nodes'));
const copy = value => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
const A = { APPID: 'wx-local', OPENID: 'A' }, B = { APPID: 'wx-local', OPENID: 'B' };
const actor = context => ({ ownerAppId: context.APPID, ownerId: context.OPENID });
const op = n => 'knowledge_operation_' + String(n).padStart(5, '0');
const fields = extra => ({ kind: 'note', title: '异步学习', content: '# Promise\n- 等待结果\n- 处理异常', tags: ['JavaScript'],
  url: '', favorite: false, assetIds: [], taskId: '', ...extra });
const taskFields = { title: '学习云开发', description: '', category: 'general', priority: 'normal', dueDate: '', done: false };
const results = [];
async function test(name, work) { await work(); results.push(name); }
function memoryStore() {
  let db = {}, tail = Promise.resolve();
  const store = { failBefore: null, failAfter: null, rows: name => Object.values(db[name] || {}).map(copy),
    async transaction(work) {
      const previous = tail; let release; tail = new Promise(resolve => { release = resolve; }); await previous;
      const draft = copy(db), changes = [];
      const tx = {
        async get(name, id) { return copy(draft[name] && draft[name][id]) || null; },
        async set(name, id, value) { draft[name] ||= {}; draft[name][id] = { ...copy(value), _id: id }; changes.push(name); },
        async remove(name, id) { if (draft[name]) delete draft[name][id]; changes.push(name); }
      };
      try { const value = await work(tx);
        if (store.failBefore && store.failBefore(changes)) { store.failBefore = null; throw new Error('before commit'); }
        db = draft;
        if (store.failAfter && store.failAfter(changes)) { store.failAfter = null; throw new Error('lost response'); }
        return copy(value);
      } finally { release(); }
    },
    async listKnowledge(owner, cursor, limit) { return store.rows('studyhub_notes').filter(row => row.ownerId === owner.ownerId
      && row.ownerAppId === owner.ownerAppId && (!cursor || row._id > cursor)).sort((a, b) => a._id.localeCompare(b._id)).slice(0, limit); },
    async listImages(owner, cursor, limit) { return store.rows('studyhub_assets').filter(row => row.ownerId === owner.ownerId
      && row.ownerAppId === owner.ownerAppId && (!cursor || row._id > cursor)).sort((a, b) => a._id.localeCompare(b._id)).slice(0, limit); },
    async get(owner, id) { return store.rows('studyhub_tasks').find(row => row._id === id && row.ownerId === owner.ownerId && row.ownerAppId === owner.ownerAppId) || null; },
    async list(owner, query) { return store.rows('studyhub_tasks').filter(row => row.ownerId === owner.ownerId && row.ownerAppId === owner.ownerAppId).slice(0, query.limit); }
  }; return store;
}
function fixture() {
  const store = memoryStore(), files = new Map(); let context = A, sequence = 0;
  const storage = { async upload(key, bytes) { const id = 'cloud://' + key; files.set(id, bytes); return id; },
    async download(id) { return files.get(id); }, async remove(id) { files.delete(id); } };
  const handle = createHandler({ store, storage, getContext: () => context, expectedAppId: A.APPID,
    now: () => 1800000000000, randomId: () => 'asset_' + (++sequence), logger: { error() {} } });
  return { store, files, handle, user: value => { context = value; },
    create: (n = 1, extra) => handle({ action: 'noteCreate', opId: op(n), fields: fields(extra) }),
    upload: n => handle({ action: 'imageUpload', opId: op(n), caption: '白板', base64: Buffer.from([255, 216, 255, 0, 255, 217]).toString('base64') }) };
}
async function seedNotes(f, count, make = () => ({})) {
  await f.store.transaction(async tx => {
    for (let i = 1; i <= count; i++) { const id = 'note_' + String(i).padStart(4, '0');
      await tx.set('studyhub_notes', id, { _id: id, ...actor(A), ...schema.cleanFields(fields(make(i))), version: 1, createdAt: i, updatedAt: i }); }
  });
}
function moduleAt(relative, mocks = {}, globals = {}) {
  if (['12-studyhub-performance', '13-studyhub-accessibility', '14-studyhub-testing', '15-studyhub-release'].includes(SUITE_PROJECT)) {
    relative = relative.replace(/^miniprogram\/pages\/(editor-lab|clock-lab|stats-lab|platform|quality-lab)\//, 'miniprogram/packageLab/pages/$1/');
    const aliases = {}; for (const [key, value] of Object.entries(mocks)) if (key.startsWith('../../')) aliases['../' + key] = value;
    mocks = { ...aliases, ...mocks };
  }
  const file = path.join(ROOT, relative), module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(file, 'utf8'), { module, exports: module.exports,
    require: name => name in mocks ? mocks[name] : require(name.startsWith('.') ? path.resolve(path.dirname(file), name) : name),
    wx: {}, console, ...globals }, { filename: file });
  return module.exports;
}
function pageAt(name, mocks, globals = {}) {
  let definition; const timers = new Map(); let next = 0;
  moduleAt('miniprogram/pages/' + name + '/index.js', mocks, {
    Page: value => { definition = value; }, setTimeout: fn => { const id = ++next; timers.set(id, fn); return id; }, clearTimeout: id => timers.delete(id), ...globals
  });
  const instance = { ...definition, data: copy(definition.data), setData(value) { Object.assign(this.data, copy(value)); } };
  return { page: instance, timers };
}
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
async function main() {
  await test('客户端与服务端字段协议副本完全一致', async () => assert.equal(fs.readFileSync(path.join(FN, 'knowledge-schema.js'), 'utf8'), fs.readFileSync(path.join(ROOT, 'miniprogram/shared/knowledge-schema.js'), 'utf8')));
  await test('标签去空白、小写、去重、排序且不修改输入', async () => { const source = fields({ tags: [' JS ', 'js', '布局'] }); const cleaned = schema.cleanFields(source); assert.deepEqual(cleaned.tags, ['js', '布局']); assert.equal(source.tags[0], ' JS '); });
  await test('标签数量和不支持字符明确拒绝', async () => { for (const tags of [['a', 'b', 'c', 'd', 'e', 'f'], ['🙂'], ['a b']]) assert.throws(() => schema.cleanFields(fields({ tags })), { code: 'INVALID_INPUT' }); });
  await test('正文换行规范化，标题及正文首尾按协议裁剪', async () => { const f = schema.cleanFields(fields({ title: '  标题  ', content: '  第一行\r\n第二行\r第三行  ' })); assert.equal(f.title, '标题'); assert.equal(f.content, '第一行\n第二行\n第三行'); });
  await test('笔记需要正文，资源收藏允许空摘要但必须有网址', async () => { assert.throws(() => schema.cleanFields(fields({ content: '  ' }))); assert.throws(() => schema.cleanFields(fields({ kind: 'link', content: '' }))); assert.equal(schema.cleanFields(fields({ kind: 'link', content: '', url: 'https://example.com' })).kind, 'link'); });
  await test('字段允许列表拒绝 owner 与任意 HTML 节点字段', async () => { for (const extra of [{ ownerId: 'B' }, { html: '<b>x</b>' }, { nodes: [] }]) assert.throws(() => schema.cleanFields(fields(extra))); });
  await test('正文与标题按代码单元长度限制', async () => { assert.throws(() => schema.cleanFields(fields({ content: 'x'.repeat(8001) }))); assert.throws(() => schema.cleanFields(fields({ title: '🙂'.repeat(31) }))); });
  await test('重复附件与四张附件被拒绝', async () => { assert.throws(() => schema.cleanFields(fields({ assetIds: ['a', 'a'] }))); assert.throws(() => schema.cleanFields(fields({ assetIds: ['a', 'b', 'c', 'd'] }))); });
  await test('URL 服务端规范化主机大小写与默认端口', async () => { const f = fixture(); const response = await f.create(1, { kind: 'link', content: '', url: 'https://EXAMPLE.com:443/docs?q=1#part' }); assert.equal(response.data.url, 'https://example.com/docs?q=1#part'); });
  await test('危险协议、凭据、异常端口与反斜杠网址被拒绝', async () => { const f = fixture(); let n = 0; for (const url of ['javascript:alert(1)', 'data:text/html,x', 'http://example.com', 'https://name:pass@example.com', 'https://example.com:8080', 'https://example.com\\@other.com', 'https://']) assert.equal((await f.create(++n, { kind: 'link', content: '', url })).error.code, 'INVALID_INPUT'); });
  await test('缺少可信身份不能访问知识库', async () => { const f = fixture(); f.user({}); assert.equal((await f.handle({ action: 'noteList' })).error.code, 'UNAUTHENTICATED'); });
  await test('创建返回私人业务 DTO 且没有 owner 或 fileID', async () => { const f = fixture(); const note = (await f.create()).data; assert.equal(note.version, 1); assert.equal(note.ownerId, undefined); assert.equal(note.fileID, undefined); assert.equal(schema.validNote(note), true); });
  await test('同编号创建重试只产生一篇笔记', async () => { const f = fixture(); const a = await f.create(), b = await f.create(); assert.deepEqual(a, b); assert.equal(f.store.rows('studyhub_notes').length, 1); });
  await test('同编号改内容拒绝复用', async () => { const f = fixture(); await f.create(); assert.equal((await f.create(1, { content: '换了一份正文' })).error.code, 'IDEMPOTENCY_MISMATCH'); });
  await test('笔记与任务动作共享编号时不会误用回执', async () => { const f = fixture(); await f.create(); assert.equal((await f.handle({ action: 'create', opId: op(1), fields: taskFields })).error.code, 'IDEMPOTENCY_MISMATCH'); });
  await test('跨用户列表和单条详情隔离', async () => { const f = fixture(); const note = (await f.create()).data; f.user(B); assert.equal((await f.handle({ action: 'noteList' })).data.items.length, 0); assert.equal((await f.handle({ action: 'noteGet', id: note.id })).error.code, 'NOT_FOUND'); });
  await test('跨用户更新与删除不能探测版本', async () => { const f = fixture(); const note = (await f.create()).data; f.user(B); for (const action of ['noteUpdate', 'noteRemove']) { const event = { action, id: note.id, version: 999, opId: op(2) }; if (action === 'noteUpdate') event.fields = fields(); assert.equal((await f.handle(event)).error.code, 'NOT_FOUND'); } });
  await test('同版本并发编辑只有一个成功且另一份冲突', async () => { const f = fixture(); const note = (await f.create()).data; const responses = await Promise.all([2, 3].map(n => f.handle({ action: 'noteUpdate', opId: op(n), id: note.id, version: 1, fields: fields({ title: '草稿' + n }) }))); assert.equal(responses.filter(r => r.ok).length, 1); assert.equal(responses.find(r => !r.ok).error.code, 'CONFLICT'); });
  await test('星标是显式布尔值，重复提交不会反向切换', async () => { const f = fixture(); const note = (await f.create()).data; const event = { action: 'noteUpdate', opId: op(2), id: note.id, version: 1, fields: fields({ favorite: true }) }; await f.handle(event); await f.handle(event); const current = (await f.handle({ action: 'noteGet', id: note.id })).data; assert.equal(current.favorite, true); assert.equal(current.version, 2); });
  await test('提交后响应丢失通过回执恢复，不再增加版本', async () => { const f = fixture(); const note = (await f.create()).data; f.store.failAfter = names => names.includes('studyhub_notes'); const event = { action: 'noteUpdate', opId: op(2), id: note.id, version: 1, fields: fields({ title: '最新' }) }; assert.equal((await f.handle(event)).error.code, 'INTERNAL'); assert.equal((await f.handle(event)).data.version, 2); });
  await test('附图创建在同一事务中增加一次引用', async () => { const f = fixture(); const image = (await f.upload(10)).data; await f.create(1, { assetIds: [image.id] }); await f.create(1, { assetIds: [image.id] }); assert.equal(f.store.rows('studyhub_assets')[0].noteRefs, 1); });
  await test('附图登记事务失败时笔记、引用和回执一起回滚', async () => { const f = fixture(); const image = (await f.upload(10)).data; f.store.failBefore = names => names.includes('studyhub_notes'); assert.equal((await f.create(1, { assetIds: [image.id] })).ok, false); assert.equal(f.store.rows('studyhub_notes').length, 0); assert.equal(f.store.rows('studyhub_assets')[0].noteRefs, 0); assert.equal(f.store.rows('studyhub_ops').length, 1); });
  await test('多篇笔记引用同图，删除一篇不会解除另一篇引用', async () => { const f = fixture(); const image = (await f.upload(10)).data; const a = (await f.create(1, { assetIds: [image.id] })).data; await f.create(2, { assetIds: [image.id] }); await f.handle({ action: 'noteRemove', opId: op(3), id: a.id, version: 1 }); assert.equal(f.store.rows('studyhub_assets')[0].noteRefs, 1); assert.equal((await f.handle({ action: 'imageRemove', opId: op(4), id: image.id })).error.code, 'ASSET_IN_USE'); });
  await test('被引用图片不能物理删除且仍可预览', async () => { const f = fixture(); const image = (await f.upload(10)).data; await f.create(1, { assetIds: [image.id] }); assert.equal((await f.handle({ action: 'imageRemove', opId: op(2), id: image.id })).error.code, 'ASSET_IN_USE'); assert.equal(f.files.size, 1); assert.equal((await f.handle({ action: 'imageRead', id: image.id })).ok, true); });
  await test('更新只改正文不会重复增加附件引用', async () => { const f = fixture(); const image = (await f.upload(10)).data; const note = (await f.create(1, { assetIds: [image.id] })).data; await f.handle({ action: 'noteUpdate', opId: op(2), id: note.id, version: 1, fields: fields({ assetIds: [image.id], content: '改正文' }) }); assert.equal(f.store.rows('studyhub_assets')[0].noteRefs, 1); });
  await test('替换附件将旧引用减一、新引用加一', async () => { const f = fixture(); const a = (await f.upload(10)).data, b = (await f.upload(11)).data; const note = (await f.create(1, { assetIds: [a.id] })).data; await f.handle({ action: 'noteUpdate', opId: op(2), id: note.id, version: 1, fields: fields({ assetIds: [b.id] }) }); const rows = f.store.rows('studyhub_assets'); assert.equal(rows.find(r => r._id === a.id).noteRefs, 0); assert.equal(rows.find(r => r._id === b.id).noteRefs, 1); });
  await test('笔记删除重放不会重复减少引用，图片保留', async () => { const f = fixture(); const image = (await f.upload(10)).data; const note = (await f.create(1, { assetIds: [image.id] })).data; const event = { action: 'noteRemove', opId: op(2), id: note.id, version: 1 }; await f.handle(event); await f.handle(event); assert.equal(f.store.rows('studyhub_assets')[0].noteRefs, 0); assert.equal(f.files.size, 1); });
  await test('解除全部引用后可单独删除图片', async () => { const f = fixture(); const image = (await f.upload(10)).data; const note = (await f.create(1, { assetIds: [image.id] })).data; await f.handle({ action: 'noteRemove', opId: op(2), id: note.id, version: 1 }); assert.equal((await f.handle({ action: 'imageRemove', opId: op(3), id: image.id })).ok, true); assert.equal(f.files.size, 0); });
  await test('其他用户的附件与不存在附件统一拒绝', async () => { const f = fixture(); const image = (await f.upload(10)).data; f.user(B); for (const id of [image.id, 'missing']) assert.equal((await f.create(1, { assetIds: [id] })).error.code, 'ATTACHMENT_UNAVAILABLE'); assert.equal(f.store.rows('studyhub_assets')[0].noteRefs, 0); });
  await test('正在清理的附件不可重新关联', async () => { const f = fixture(); const image = (await f.upload(10)).data; await f.store.transaction(async tx => { const row = await tx.get('studyhub_assets', image.id); await tx.set('studyhub_assets', image.id, { ...row, state: 'deleting' }); }); assert.equal((await f.create(1, { assetIds: [image.id] })).error.code, 'ATTACHMENT_UNAVAILABLE'); });
  await test('附图与删图竞态不能同时成功产生悬空引用', async () => { const f = fixture(); const image = (await f.upload(10)).data; const [note, removed] = await Promise.all([f.create(1, { assetIds: [image.id] }), f.handle({ action: 'imageRemove', opId: op(2), id: image.id })]); assert.equal(Number(note.ok) + Number(removed.ok), 1); });
  await test('引用计数损坏时停止删除而不是猜测归零', async () => { const f = fixture(); const image = (await f.upload(10)).data; await f.store.transaction(async tx => { const row = await tx.get('studyhub_assets', image.id); await tx.set('studyhub_assets', image.id, { ...row, noteRefs: -1 }); }); assert.equal((await f.handle({ action: 'imageRemove', opId: op(2), id: image.id })).error.code, 'INTERNAL'); assert.equal(f.files.size, 1); });
  await test('关联任务必须属于本次调用者', async () => { const f = fixture(); const task = (await f.handle({ action: 'create', opId: op(20), fields: taskFields })).data; assert.equal((await f.create(1, { taskId: task.id })).ok, true); f.user(B); assert.equal((await f.create(2, { taskId: task.id })).error.code, 'RELATED_TASK_UNAVAILABLE'); });
  await test('删除关联任务保留笔记，解除失效关联后可以继续编辑', async () => { const f = fixture(); const task = (await f.handle({ action: 'create', opId: op(20), fields: taskFields })).data; const note = (await f.create(1, { taskId: task.id })).data; await f.handle({ action: 'remove', opId: op(21), id: task.id, version: 1 }); assert.equal((await f.handle({ action: 'noteGet', id: note.id })).ok, true); assert.equal((await f.handle({ action: 'noteUpdate', opId: op(2), id: note.id, version: 1, fields: fields({ taskId: task.id }) })).error.code, 'RELATED_TASK_UNAVAILABLE'); assert.equal((await f.handle({ action: 'noteUpdate', opId: op(3), id: note.id, version: 1, fields: fields() })).ok, true); });
  await test('关键词按字面子串处理，点号不会变正则通配符', async () => { const f = fixture(); await seedNotes(f, 2, i => ({ title: i === 1 ? 'Promise.all' : 'PromiseXall', content: '正文' })); const r = await f.handle({ action: 'noteList', q: 'promise.all' }); assert.equal(r.data.items.length, 1); assert.equal(r.data.items[0].title, 'Promise.all'); });
  await test('搜索正文、标签和网址，拉丁字母忽略大小写', async () => { const f = fixture(); await seedNotes(f, 1, () => ({ content: '练习 ASYNC', tags: ['Study'], url: 'https://example.com/doc' })); for (const q of ['async', 'STUDY', 'example.com']) assert.equal((await f.handle({ action: 'noteList', q })).data.items.length, 1); });
  await test('完整标签、类型与星标组合筛选', async () => { const f = fixture(); await seedNotes(f, 4, i => ({ kind: i === 1 ? 'link' : 'note', url: i === 1 ? 'https://example.com' : '', tags: [i === 4 ? 'js-extra' : 'js'], favorite: i !== 2 })); const r = await f.handle({ action: 'noteList', tag: 'JS', kind: 'note', favoriteOnly: true }); assert.equal(r.data.items.length, 1); assert.equal(r.data.items[0].id, 'note_0003'); });
  await test('无命中的中间批次仍给出推进游标，后面的命中可找到', async () => { const f = fixture(); await seedNotes(f, 45, i => ({ title: i === 45 ? '目标' : '其他', content: '正文' })); const first = (await f.handle({ action: 'noteList', q: '目标' })).data; assert.equal(first.items.length, 0); assert.equal(first.scanned, 40); assert.equal(first.nextCursor, 'note_0040'); const second = (await f.handle({ action: 'noteList', q: '目标', cursor: first.nextCursor })).data; assert.equal(second.items[0].id, 'note_0045'); assert.equal(second.nextCursor, null); });
  await test('结果多于一页时按最后实际检查项继续，不漏不重复', async () => { const f = fixture(); await seedNotes(f, 27); const ids = []; let cursor = null, rounds = 0; do { const page = (await f.handle({ action: 'noteList', cursor })).data; ids.push(...page.items.map(r => r.id)); cursor = page.nextCursor; assert.ok(++rounds < 10); } while (cursor); assert.equal(ids.length, 27); assert.equal(new Set(ids).size, 27); });
  await test('搜索返回摘要与附件数量，不传整篇正文或所有者', async () => { const f = fixture(); await seedNotes(f, 1, () => ({ content: 'x'.repeat(8000) })); const row = (await f.handle({ action: 'noteList' })).data.items[0]; assert.equal(row.excerpt.length, 140); assert.equal(row.content, undefined); assert.equal(row.assetIds, undefined); assert.equal(row.ownerId, undefined); });
  await test('非法查询类型、超长关键词、未知字段被拒绝', async () => { const f = fixture(); for (const query of [{ q: {} }, { q: 'x'.repeat(41) }, { favoriteOnly: 'true' }, { kind: 'unknown' }, { tag: [] }, { ownerId: 'A' }]) assert.equal((await f.handle({ action: 'noteList', ...query })).error.code, 'INVALID_INPUT'); });
  await test('数据库适配器先按所有者和游标查询，再有限读取', async () => { const calls = []; const query = { where(value) { calls.push(['where', value]); return this; }, orderBy(...value) { calls.push(['orderBy', ...value]); return this; }, limit(value) { calls.push(['limit', value]); return this; }, async get() { return { data: [] }; } }; const store = createTransactionStore({ collection(name) { calls.push(['collection', name]); return query; }, command: { gt: value => ({ gt: value }) } }); await store.listKnowledge(actor(A), 'note_10', 41); assert.deepEqual(calls.find(r => r[0] === 'where')[1], { ...actor(A), _id: { gt: 'note_10' } }); assert.deepEqual(calls.find(r => r[0] === 'limit'), ['limit', 41]); });
  await test('受控排版只产生允许标签，用户 HTML 保留为文字', async () => { const nodes = toNodes('# 标题\n- 一\n- 二\n\n<script>x</script><img src=x>'); assert.deepEqual(nodes.map(n => n.name), ['h2', 'ul', 'p']); assert.equal(nodes[1].children.length, 2); assert.equal(nodes[2].children[0].type, 'text'); assert.equal(nodes[2].children[0].text, '<script>x</script><img src=x>'); });
  await test('资源网址不会被排版器转换成自动加载或跳转节点', async () => { const nodes = toNodes('https://example.com\n![图](https://example.com/x.png)'); assert.ok(nodes.every(n => n.name === 'p')); assert.ok(nodes.every(n => !n.attrs)); });
  await test('知识库列表拒绝停滞游标以阻止无限重复翻页', async () => { const repo = moduleAt('miniprogram/services/knowledge-repository.js', { './cloud-client': { call: async () => ({ items: [], scanned: 40, nextCursor: 'same' }) }, './outbox': {} }); await assert.rejects(repo.list({}, 'same'), { code: 'PROTOCOL' }); });
  await test('列表旧搜索响应不能覆盖新关键词结果', async () => { const first = deferred(), second = deferred(); let count = 0; const { page } = pageAt('knowledge', { '../../services/knowledge-repository': { list: () => (++count === 1 ? first : second).promise }, '../../services/knowledge-navigation': {} }); page.onLoad(); page._visible = true; const a = page.refresh(); page.setData({ q: '新' }); const b = page.refresh(); second.resolve({ items: [{ id: 'new' }], scanned: 1, nextCursor: null }); await b; first.resolve({ items: [{ id: 'old' }], scanned: 1, nextCursor: null }); await a; assert.equal(page.data.items[0].id, 'new'); });
  await test('输入立即使旧响应失效，并在隐藏页面时清除防抖计时器', async () => { const old = deferred(); const { page, timers } = pageAt('knowledge', { '../../services/knowledge-repository': { list: () => old.promise }, '../../services/knowledge-navigation': {} }); page.onLoad(); page._visible = true; const request = page.refresh(); page.onInput({ currentTarget: { dataset: { field: 'q' } }, detail: { value: '新搜索' } }); assert.equal(timers.size, 1); old.resolve({ items: [{ id: 'old' }], scanned: 1, nextCursor: null }); await request; assert.equal(page.data.items.length, 0); page.onHide(); assert.equal(timers.size, 0); });
  await test('空中间批次显示继续查找，耗尽后才显示没有结果', async () => { const { page } = pageAt('knowledge', { '../../services/knowledge-repository': {}, '../../services/knowledge-navigation': {} }); page.apply({ items: [], scanned: 40, nextCursor: 'next' }, false); assert.equal(page.data.status, 'searching'); page.apply({ items: [], scanned: 3, nextCursor: null }, true); assert.equal(page.data.status, 'empty'); });
  await test('编辑器本地校验失败不调用云端保存', async () => { let saved = 0; const { page } = pageAt('knowledge-editor', { '../../services/knowledge-repository': { create: async () => { saved++; } }, '../../services/cloud-repository': {}, '../../services/images': { list: async () => ({ items: [], nextCursor: null }) }, '../../services/knowledge-navigation': {} }); await page.onLoad({ kind: 'link' }); page.setData({ title: '资源' }); await page.onSubmit(); assert.equal(saved, 0); assert.match(page.data.errorMessage, /HTTPS/); });
  await test('编辑器保存结果不明时锁住原草稿并指向待处理', async () => { const { page } = pageAt('knowledge-editor', { '../../services/knowledge-repository': { create: async () => { throw Object.assign(new Error('lost'), { queued: true }); } }, '../../services/cloud-repository': {}, '../../services/images': { list: async () => ({ items: [], nextCursor: null }) }, '../../services/knowledge-navigation': {} }); await page.onLoad(); page.setData({ title: '草稿', content: '保留我' }); await page.onSubmit(); assert.equal(page.data.recoveryRequired, true); assert.equal(page.data.content, '保留我'); assert.equal(page.data.saving, false); });
  await test('编辑器附件只能选可见图库项，最多三张且可解除选择', async () => { const { page } = pageAt('knowledge-editor', { '../../services/knowledge-repository': {}, '../../services/cloud-repository': {}, '../../services/images': { list: async () => ({ items: ['a', 'b', 'c', 'd'].map(id => ({ id, caption: id, state: 'active' })), nextCursor: null }) }, '../../services/knowledge-navigation': {} }); await page.onLoad(); const tap = id => page.onAsset({ currentTarget: { dataset: { id } } }); tap('outside'); assert.equal(page.data.assetIds.length, 0); ['a', 'b', 'c', 'd'].forEach(tap); assert.equal(page.data.assetIds.length, 3); tap('a'); assert.deepEqual(copy(page.data.assetIds), ['b', 'c']); });
  await test('笔记创建响应不合法时实际 outbox 层保留原指令', async () => { const cache = new Map(); const box = moduleAt('miniprogram/services/outbox.js', { './cloud-client': { call: async action => action === 'whoami' ? { authenticated: true, appId: 'wx', userTag: 'aaaaaa111111' } : { bad: true } }, '../config/cloud': { ENV_ID: 'env' } }, { wx: { getStorageSync: key => cache.get(key), setStorageSync: (key, value) => cache.set(key, copy(value)) } }); await assert.rejects(box.submit('noteCreate', { fields: fields() }), { code: 'PROTOCOL' }); assert.equal((await box.list())[0].state, 'pending'); });
  await test('笔记冲突重新提交使用新编号和新版本，保留完整八字段', async () => { const cache = new Map(); let conflict = true, captured; const box = moduleAt('miniprogram/services/outbox.js', { './cloud-client': { call: async (action, payload) => { if (action === 'whoami') return { authenticated: true, appId: 'wx', userTag: 'aaaaaa111111' }; if (conflict) throw Object.assign(new Error('conflict'), { code: 'CONFLICT' }); captured = payload; return { id: payload.id, version: payload.version + 1 }; } }, '../config/cloud': { ENV_ID: 'env' } }, { wx: { getStorageSync: key => cache.get(key), setStorageSync: (key, value) => cache.set(key, copy(value)) } }); await assert.rejects(box.submit('noteUpdate', { id: 'note', version: 1, fields: fields() })); const row = (await box.list())[0]; conflict = false; await box.rebase(row.opId, 4); assert.notEqual(captured.opId, row.opId); assert.equal(captured.version, 4); assert.equal(Object.keys(captured.fields).length, 8); });
  await test('关联被使用的删除拒绝保留为 blocked，不盲目反复发送', async () => { const cache = new Map(); const box = moduleAt('miniprogram/services/outbox.js', { './cloud-client': { call: async action => { if (action === 'whoami') return { authenticated: true, appId: 'wx', userTag: 'aaaaaa111111' }; throw Object.assign(new Error('in use'), { code: 'ASSET_IN_USE' }); } }, '../config/cloud': { ENV_ID: 'env' } }, { wx: { getStorageSync: key => cache.get(key), setStorageSync: (key, value) => cache.set(key, copy(value)) } }); await assert.rejects(box.submit('imageRemove', { id: 'asset' })); assert.equal((await box.list())[0].state, 'blocked'); });
  await test('原生编辑器取得上下文与初始化，迟到回调不更新已销毁页面', async () => { let callback; const editor = { getContents(options) { callback = options.success; }, setContents(options) { assert.ok(options.delta.ops[0].insert.endsWith('\n')); options.success(); } }; const query = { select(id) { assert.equal(id, '#editor'); return this; }, context(fn) { fn({ context: editor }); return this; }, exec() {} }; const { page } = pageAt('editor-lab', {}, { wx: { createSelectorQuery: () => query } }); page.onLoad(); page.onEditorReady(); assert.equal(page.data.ready, true); page.onSeed(); assert.ok(page.data.count > 0); page.onRead(); page.onUnload(); callback({ text: 'late', html: '<p>late</p>', delta: {} }); assert.equal(page.data.text, ''); });
  await test('集合计划与知识库索引存在，客户端直连仍关闭', async () => { const plan = JSON.parse(fs.readFileSync(path.join(ROOT, 'database/collections-plan.json'))); assert.equal(plan.collections.length, SUITE_PROJECT=== '07-studyhub-knowledge' ? 6 : 8); assert.ok(plan.collections.includes('studyhub_notes')); assert.equal(plan.clientPermissions.read, false); assert.equal(plan.clientPermissions.write, false); assert.ok(plan.additionalIndexes.some(row => row.collection === 'studyhub_notes')); });
  const inherited = JSON.parse(fs.readFileSync(path.join(__dirname, SUITE_PROJECT=== '07-studyhub-knowledge' ? '第六阶段继承测试结果.json'
    : SUITE_PROJECT=== '08-studyhub-focus' ? '第七阶段基础继承测试结果.json' : SUITE_PROJECT=== '09-studyhub-stats' ? '第八阶段基础继承测试结果.json' : SUITE_PROJECT=== '10-studyhub-platform' ? '第九阶段基础继承测试结果.json' : SUITE_PROJECT=== '11-studyhub-quality' ? '第十阶段基础继承测试结果.json' : (['13-studyhub-accessibility','14-studyhub-testing', '15-studyhub-release'].includes(SUITE_PROJECT) ? (['14-studyhub-testing','15-studyhub-release'].includes(SUITE_PROJECT) ? (SUITE_PROJECT=== '15-studyhub-release' ? (project==='16-studyhub-operations'?'第十五阶段基础继承测试结果.json':'第十四阶段基础继承测试结果.json') : '第十三阶段基础继承测试结果.json') : '第十二阶段基础继承测试结果.json') : '第十一阶段基础继承测试结果.json'))));
  assert.equal(inherited.project, project); assert.equal(inherited.passed, 52);
  const report = { date: '2026-11-02', project, passed: results.length, inheritedPassed: inherited.passed,
    totalPassed: results.length + inherited.passed, realCloud: false, scenarios: results };
  fs.writeFileSync(path.join(__dirname, SUITE_PROJECT=== '07-studyhub-knowledge' ? '第六阶段测试结果.json'
    : SUITE_PROJECT=== '08-studyhub-focus' ? '第七阶段知识库继承测试结果.json' : SUITE_PROJECT=== '09-studyhub-stats' ? '第八阶段知识库继承测试结果.json' : SUITE_PROJECT=== '10-studyhub-platform' ? '第九阶段知识库继承测试结果.json' : SUITE_PROJECT=== '11-studyhub-quality' ? '第十阶段知识库继承测试结果.json' : (['13-studyhub-accessibility','14-studyhub-testing', '15-studyhub-release'].includes(SUITE_PROJECT) ? (['14-studyhub-testing','15-studyhub-release'].includes(SUITE_PROJECT) ? (SUITE_PROJECT=== '15-studyhub-release' ? (project==='16-studyhub-operations'?'第十五阶段知识库继承测试结果.json':'第十四阶段知识库继承测试结果.json') : '第十三阶段知识库继承测试结果.json') : '第十二阶段知识库继承测试结果.json') : '第十一阶段知识库继承测试结果.json')), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ passed: report.passed, inheritedPassed: report.inheritedPassed, totalPassed: report.totalPassed, realCloud: false }));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
