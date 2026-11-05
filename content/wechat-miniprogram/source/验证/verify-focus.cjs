// 可控服务器时钟、串行内存事务、API 与页面桩。不等待真实分钟，不连接真实云。
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const project = process.argv[2] || '08-studyhub-focus';
const SUITE_PROJECT = project === '16-studyhub-operations' ? '15-studyhub-release' : project;
if (!['08-studyhub-focus', '09-studyhub-stats', '10-studyhub-platform', '11-studyhub-quality', '12-studyhub-performance', '13-studyhub-accessibility', '14-studyhub-testing', '15-studyhub-release'].includes(SUITE_PROJECT)) throw new Error('Unknown test project');
const ROOT = path.resolve(__dirname, '../示例代码', project);
const FN = path.join(ROOT, 'cloudfunctions/studyhub');
const { createHandler } = require(path.join(FN, 'sync-domain'));
const { createTransactionStore } = require(path.join(FN, 'transaction-store'));
const contract = require(path.join(FN, 'focus-contract'));
const { view, createServerClock, formatSeconds } = require(path.join(ROOT, 'miniprogram/utils/focus-view'));
const copy = value => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
const A = { APPID: 'wx-focus-test', OPENID: 'A' }, B = { APPID: 'wx-focus-test', OPENID: 'B' };
const BASE = 1800000000000;
const op = n => 'focus_test_operation_' + String(n).padStart(5, '0');
const records = [];
async function test(name, work) { await work(); records.push(name); }
function memoryStore() {
  let database = {}, tail = Promise.resolve();
  const store = { failBefore: null, failAfter: null, rows: name => Object.values(database[name] || {}).map(copy),
    async transaction(work) {
      const prior = tail; let release; tail = new Promise(resolve => { release = resolve; }); await prior;
      const draft = copy(database), names = [];
      const tx = { async get(name, id) { return copy(draft[name] && draft[name][id]) || null; },
        async set(name, id, value) { draft[name] ||= {}; draft[name][id] = { ...copy(value), _id: id }; names.push(name); },
        async remove(name, id) { if (draft[name]) delete draft[name][id]; names.push(name); } };
      try { const result = await work(tx);
        if (store.failBefore && store.failBefore(names)) { store.failBefore = null; throw new Error('before commit'); }
        database = draft;
        if (store.failAfter && store.failAfter(names)) { store.failAfter = null; throw new Error('response lost'); }
        return copy(result);
      } finally { release(); }
    },
    async listFocus(actor, cursor, limit) { return store.rows('studyhub_focus_sessions').filter(row => row.ownerAppId === actor.ownerAppId
      && row.ownerId === actor.ownerId && (!cursor || row._id > cursor)).sort((a, b) => a._id.localeCompare(b._id)).slice(0, limit); }
  }; return store;
}
function fixture() {
  const store = memoryStore(); let timestamp = BASE, context = A;
  const handler = createHandler({ store, storage: {}, getContext: () => context, expectedAppId: A.APPID, now: () => timestamp, logger: { error() {} } });
  const f = { store, handler, user: value => { context = value; }, advance: ms => { timestamp += ms; }, at: ms => { timestamp = BASE + ms; },
    start: (n = 1, fields = { plannedSeconds: 10, taskId: '' }) => handler({ action: 'focusStart', opId: op(n), fields }),
    current: () => handler({ action: 'focusCurrent' }),
    get: id => handler({ action: 'focusGet', id }),
    async command(action, n, row) { return handler({ action, opId: op(n), id: row.id, version: row.version }); },
    async task(id = 'task_1', owner = A) { await store.transaction(tx => tx.set('studyhub_tasks', id,
      { ownerId: owner.OPENID, ownerAppId: owner.APPID, title: '学习状态机', version: 1 })); return id; }
  }; return f;
}
async function current(f) { const response = await f.current(); assert.equal(response.ok, true); return response.data.session; }
async function start(f, n = 1, fields) { const response = await f.start(n, fields); assert.equal(response.ok, true); return current(f); }
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
function moduleAt(relative, mocks = {}, globals = {}) {
  if (['12-studyhub-performance', '13-studyhub-accessibility', '14-studyhub-testing', '15-studyhub-release'].includes(SUITE_PROJECT)) {
    relative = relative.replace(/^miniprogram\/pages\/(editor-lab|clock-lab|stats-lab|platform|quality-lab)\//, 'miniprogram/packageLab/pages/$1/');
    const aliases = {}; for (const [key, value] of Object.entries(mocks)) if (key.startsWith('../../')) aliases['../' + key] = value;
    mocks = { ...aliases, ...mocks };
  }
  const file = path.join(ROOT, relative), module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(file, 'utf8'), { module, exports: module.exports,
    require: name => name in mocks ? mocks[name] : require(name.startsWith('.') ? path.resolve(path.dirname(file), name) : name),
    console, wx: {}, ...globals }, { filename: file }); return module.exports;
}
function pageFixture(options = {}) {
  let definition, localNow = BASE, intervalId = 0; const timers = new Map(), screen = [], calls = [];
  const app = { globalData: {} };
  const session = options.session || null;
  const repository = { current: async () => ({ session: copy(session), serverNow: localNow, sentAt: localNow, receivedAt: localNow }),
    start: async fields => { calls.push(['start', fields]); }, pause: async (...args) => { calls.push(['pause', ...args]); },
    resume: async (...args) => { calls.push(['resume', ...args]); }, stop: async (...args) => { calls.push(['stop', ...args]); }, ...options.repository };
  const wxMock = { setKeepScreenOn(value) { screen.push(value.keepScreenOn); if (options.screenFail && value.keepScreenOn && value.fail) value.fail(); },
    showModal(value) { value.success({ confirm: true }); }, navigateTo() {}, showToast() {}, ...options.wx };
  moduleAt('miniprogram/pages/focus/index.js', { '../../services/focus-repository': repository,
    '../../services/outbox': { list: async () => options.pending || [] } }, {
    Page: value => { definition = value; }, getApp: () => app, Date: { now: () => localNow }, wx: wxMock,
    setInterval(fn) { const id = ++intervalId; timers.set(id, fn); return id; }, clearInterval(id) { timers.delete(id); }
  });
  const page = { ...definition, data: copy(definition.data), setData(value) { Object.assign(this.data, copy(value)); } };
  page.onLoad(); page._visible = true;
  return { page, timers, screen, calls, app, repository, advance: ms => { localNow += ms; }, setNow: value => { localNow = value; },
    async flush() { for (let i = 0; i < 15; i++) await Promise.resolve(); } };
}
async function sample() { const f = fixture(); return start(f); }
async function main() {
  await test('客户端与云端会话协议副本完全一致', async () => assert.equal(fs.readFileSync(path.join(FN, 'focus-contract.js'), 'utf8'), fs.readFileSync(path.join(ROOT, 'miniprogram/shared/focus-contract.js'), 'utf8')));
  await test('无可信身份不能读取或开始专注', async () => { const f = fixture(); f.user({}); assert.equal((await f.current()).error.code, 'UNAUTHENTICATED'); assert.equal((await f.start()).error.code, 'UNAUTHENTICATED'); });
  await test('其他 AppID 的上下文被拒绝', async () => { const f = fixture(); f.user({ ...A, APPID: 'wx-other' }); assert.equal((await f.current()).error.code, 'UNAUTHENTICATED'); });
  await test('客户端不能提交 owner、开始时间或已累计秒数', async () => { const f = fixture(); for (const extra of [{ ownerId: 'B' }, { startedAt: 1 }, { accumulatedMs: 9000 }, { isDemo: false }]) assert.equal((await f.start(1, { plannedSeconds: 10, taskId: '', ...extra })).error.code, 'INVALID_INPUT'); });
  await test('不支持时长、字符串和小数均被拒绝', async () => { const f = fixture(); let n = 0; for (const plannedSeconds of [0, -1, 10.5, 60, '10', 999999]) assert.equal((await f.start(++n, { plannedSeconds, taskId: '' })).error.code, 'INVALID_INPUT'); });
  await test('开始时间、结束期限和实验标记来自服务端', async () => { const f = fixture(); const s = await start(f); assert.equal(s.startedAt, BASE); assert.equal(s.deadlineAt, BASE + 10000); assert.equal(s.isDemo, true); assert.equal(s.effectiveSeconds, null); assert.equal(s.ownerId, undefined); });
  await test('普通时长不带实验标记', async () => { const f = fixture(); const s = await start(f, 1, { plannedSeconds: 1500, taskId: '' }); assert.equal(s.isDemo, false); assert.equal(s.deadlineAt, BASE + 1500000); });
  await test('空账号首次核对返回空会话', async () => { const f = fixture(); const r = await f.current(); assert.equal(r.data.session, null); assert.equal(r.data.serverNow, BASE); });
  await test('开始请求同编号重放不创建第二轮', async () => { const f = fixture(); const a = await f.start(); f.advance(2000); const b = await f.start(); assert.deepEqual(a, b); assert.equal(f.store.rows('studyhub_focus_sessions').length, 1); });
  await test('同编号改变时长被拒绝', async () => { const f = fixture(); await f.start(); assert.equal((await f.start(1, { plannedSeconds: 300, taskId: '' })).error.code, 'IDEMPOTENCY_MISMATCH'); });
  await test('同一用户两个并发开始仅一轮成功', async () => { const f = fixture(); const r = await Promise.all([f.start(1), f.start(2)]); assert.equal(r.filter(x => x.ok).length, 1); assert.equal(r.find(x => !x.ok).error.code, 'FOCUS_ACTIVE'); assert.equal(f.store.rows('studyhub_focus_slots').length, 1); });
  await test('不同用户相同编号各有自己的会话槽', async () => { const f = fixture(); const a = await start(f); f.user(B); const b = await start(f); assert.notEqual(a.id, b.id); assert.equal(f.store.rows('studyhub_focus_slots').length, 2); });
  await test('自己的任务可关联并保存标题快照', async () => { const f = fixture(); const taskId = await f.task(); const s = await start(f, 1, { plannedSeconds: 10, taskId }); assert.equal(s.taskTitle, '学习状态机'); });
  await test('不能关联别人的或不存在的任务', async () => { const f = fixture(); await f.task('other', B); for (const taskId of ['other', 'missing']) assert.equal((await f.start(1, { plannedSeconds: 10, taskId })).error.code, 'RELATED_TASK_UNAVAILABLE'); assert.equal(f.store.rows('studyhub_focus_sessions').length, 0); });
  await test('关联任务后来删除仍能结束专注并保留快照', async () => { const f = fixture(); const taskId = await f.task(); const s = await start(f, 1, { plannedSeconds: 10, taskId }); await f.store.transaction(tx => tx.remove('studyhub_tasks', taskId)); f.advance(1200); await f.command('focusStop', 2, s); const result = await current(f); assert.equal(result.taskTitle, '学习状态机'); assert.equal(result.effectiveSeconds, 1); });
  await test('暂停保留毫秒余量，不按段向下取整', async () => { const f = fixture(); const s = await start(f); f.advance(600); await f.command('focusPause', 2, s); const paused = await current(f); assert.equal(paused.accumulatedMs, 600); assert.equal(paused.deadlineAt, null); assert.equal(paused.state, 'paused'); });
  await test('两个六百毫秒段最终合为一秒有效计时', async () => { const f = fixture(); let s = await start(f); f.advance(600); await f.command('focusPause', 2, s); s = await current(f); f.advance(5000); await f.command('focusResume', 3, s); s = await current(f); f.advance(600); await f.command('focusStop', 4, s); s = await current(f); assert.equal(s.accumulatedMs, 1200); assert.equal(s.effectiveSeconds, 1); });
  await test('暂停一小时不消耗剩余时间', async () => { const f = fixture(); let s = await start(f); f.advance(1000); await f.command('focusPause', 2, s); f.advance(3600000); s = await current(f); assert.equal(s.state, 'paused'); assert.equal(s.accumulatedMs, 1000); assert.equal(s.effectiveSeconds, null); });
  await test('继续时以剩余毫秒重建期限', async () => { const f = fixture(); let s = await start(f); f.advance(2500); await f.command('focusPause', 2, s); s = await current(f); f.advance(20000); await f.command('focusResume', 3, s); s = await current(f); assert.equal(s.segmentStartedAt, BASE + 22500); assert.equal(s.deadlineAt, BASE + 30000); });
  await test('运行中提前结束累计到服务端操作时间', async () => { const f = fixture(); const s = await start(f); f.advance(3456); await f.command('focusStop', 2, s); const stopped = await current(f); assert.equal(stopped.state, 'stopped'); assert.equal(stopped.accumulatedMs, 3456); assert.equal(stopped.effectiveSeconds, 3); });
  await test('暂停后提前结束不累计暂停区间', async () => { const f = fixture(); let s = await start(f); f.advance(2500); await f.command('focusPause', 2, s); s = await current(f); f.advance(99999); await f.command('focusStop', 3, s); const stopped = await current(f); assert.equal(stopped.accumulatedMs, 2500); assert.equal(stopped.effectiveSeconds, 2); });
  await test('刚好到期限核对会完成且结束时间为期限', async () => { const f = fixture(); await start(f); f.advance(10000); const s = await current(f); assert.equal(s.state, 'completed'); assert.equal(s.endedAt, BASE + 10000); assert.equal(s.effectiveSeconds, 10); });
  await test('数小时后返回只记计划时长，不把延迟算入专注', async () => { const f = fixture(); await start(f); f.advance(8 * 3600000); const s = await current(f); assert.equal(s.accumulatedMs, 10000); assert.equal(s.endedAt, BASE + 10000); assert.equal(s.updatedAt, BASE + 8 * 3600000); });
  await test('迟到暂停在期限后收敛为完成', async () => { const f = fixture(); const s = await start(f); f.advance(10001); const r = await f.command('focusPause', 2, s); assert.equal(r.data.state, 'completed'); assert.equal((await current(f)).effectiveSeconds, 10); });
  await test('期限已到时提前结束也记为完成', async () => { const f = fixture(); const s = await start(f); f.advance(10000); assert.equal((await f.command('focusStop', 2, s)).data.state, 'completed'); });
  await test('重复核对不会重复增加完成版本', async () => { const f = fixture(); await start(f); f.advance(10000); const a = await current(f), b = await current(f); assert.equal(a.version, 2); assert.deepEqual(a, b); });
  await test('并发核对到时终态只提交一次状态转换', async () => { const f = fixture(); await start(f); f.advance(10000); const r = await Promise.all([f.current(), f.current(), f.current()]); assert.ok(r.every(x => x.data.session.version === 2)); assert.equal(f.store.rows('studyhub_focus_sessions').length, 1); });
  await test('暂停状态不能再次用新指令暂停', async () => { const f = fixture(); let s = await start(f); await f.command('focusPause', 2, s); s = await current(f); assert.equal((await f.command('focusPause', 3, s)).error.code, 'FOCUS_CHANGED'); });
  await test('旧版本状态操作明确拒绝', async () => { const f = fixture(); const s = await start(f); await f.command('focusPause', 2, s); assert.equal((await f.command('focusStop', 3, s)).error.code, 'FOCUS_CHANGED'); assert.equal((await current(f)).state, 'paused'); });
  await test('跨用户读暂停继续结束均不可访问', async () => { const f = fixture(); const s = await start(f); f.user(B); assert.equal((await f.get(s.id)).error.code, 'NOT_FOUND'); for (const action of ['focusPause', 'focusResume', 'focusStop']) assert.equal((await f.command(action, 2, s)).error.code, 'NOT_FOUND'); });
  await test('暂停提交后响应丢失重放不再累加', async () => { const f = fixture(); const s = await start(f); f.advance(700); f.store.failAfter = names => names.includes('studyhub_ops'); assert.equal((await f.command('focusPause', 2, s)).ok, false); f.advance(5000); assert.equal((await f.command('focusPause', 2, s)).ok, true); assert.equal((await current(f)).accumulatedMs, 700); });
  await test('继续提交后响应丢失重放不延长期限', async () => { const f = fixture(); let s = await start(f); await f.command('focusPause', 2, s); s = await current(f); f.advance(2000); f.store.failAfter = names => names.includes('studyhub_ops'); await f.command('focusResume', 3, s); const deadline = f.store.rows('studyhub_focus_sessions')[0].deadlineAt; f.advance(2000); await f.command('focusResume', 3, s); assert.equal(f.store.rows('studyhub_focus_sessions')[0].deadlineAt, deadline); });
  await test('结束提交后响应丢失重放只保留同一终态记录', async () => { const f = fixture(); const s = await start(f); f.advance(1234); f.store.failAfter = names => names.includes('studyhub_ops'); await f.command('focusStop', 2, s); f.advance(90000); await f.command('focusStop', 2, s); const stored = await current(f); assert.equal(stored.accumulatedMs, 1234); assert.equal(f.store.rows('studyhub_focus_sessions').length, 1); });
  await test('开始提交前失败会话槽、会话和回执一起回滚', async () => { const f = fixture(); f.store.failBefore = names => names.includes('studyhub_ops'); assert.equal((await f.start()).ok, false); for (const name of ['studyhub_focus_sessions', 'studyhub_focus_slots', 'studyhub_ops']) assert.equal(f.store.rows(name).length, 0); assert.equal((await f.start()).ok, true); });
  await test('开始提交后响应丢失同编号恢复原会话', async () => { const f = fixture(); f.store.failAfter = names => names.includes('studyhub_ops'); assert.equal((await f.start()).ok, false); assert.equal((await f.start()).ok, true); assert.equal(f.store.rows('studyhub_focus_sessions').length, 1); });
  await test('暂停提交前失败保持原运行状态', async () => { const f = fixture(); const s = await start(f); f.advance(1000); f.store.failBefore = names => names.includes('studyhub_ops'); assert.equal((await f.command('focusPause', 2, s)).ok, false); assert.equal((await current(f)).state, 'running'); });
  await test('上一轮结束后可以新开，历史会话保留', async () => { const f = fixture(); const first = await start(f); f.advance(10000); await current(f); const second = await start(f, 2); assert.notEqual(first.id, second.id); assert.equal(f.store.rows('studyhub_focus_sessions').length, 2); assert.equal(f.store.rows('studyhub_focus_slots').length, 1); });
  await test('新开始请求能先核对到时旧轮再原子替换会话槽', async () => { const f = fixture(); const first = await start(f); f.advance(20000); const second = await start(f, 2); const old = (await f.get(first.id)).data.session; assert.equal(old.state, 'completed'); assert.equal(old.endedAt, BASE + 10000); assert.equal(second.state, 'running'); });
  await test('重试旧开始不会把槽指回旧轮或复活旧轮', async () => { const f = fixture(); const first = await start(f); f.advance(10000); const second = await start(f, 2); const oldAck = await f.start(1); assert.equal(oldAck.data.sessionId, first.id); assert.equal(oldAck.data.state, 'running'); assert.equal((await current(f)).id, second.id); assert.equal((await f.get(first.id)).data.session.state, 'completed'); });
  await test('再次确认旧终态结束不会结束新轮', async () => { const f = fixture(); await start(f); f.advance(10000); const old = await current(f); const next = await start(f, 2); await f.command('focusStop', 3, old); assert.equal((await current(f)).id, next.id); assert.equal((await current(f)).state, 'running'); });
  await test('服务器时钟回退不产生负时长', async () => { const f = fixture(); const s = await start(f); f.at(-5000); await f.command('focusPause', 2, s); const paused = await current(f); assert.equal(paused.accumulatedMs, 0); assert.equal(paused.updatedAt, BASE); });
  await test('损坏会话槽不被当作空槽另开一轮', async () => { const f = fixture(); await start(f); const slot = f.store.rows('studyhub_focus_slots')[0]; await f.store.transaction(tx => tx.set('studyhub_focus_slots', slot._id, { ...slot, sessionId: 'missing' })); assert.equal((await f.current()).error.code, 'INTERNAL'); assert.equal((await f.start(2)).error.code, 'INTERNAL'); });
  await test('损坏累计时长不会变成可统计记录', async () => { const f = fixture(); const s = await start(f); await f.store.transaction(async tx => { const row = await tx.get('studyhub_focus_sessions', s.id); await tx.set('studyhub_focus_sessions', s.id, { ...row, accumulatedMs: -1 }); }); assert.equal((await f.current()).error.code, 'INTERNAL'); });
  await test('历史按所有者分页且不同轮次不重复', async () => { const f = fixture(); for (let i = 1; i <= 13; i++) { await f.start(i); f.advance(10000); } await current(f); f.user(B); await f.start(99); f.user(A); const ids = []; let cursor = null; do { const page = (await f.handler({ action: 'focusList', cursor })).data; ids.push(...page.items.map(r => r.id)); cursor = page.nextCursor; } while (cursor); assert.equal(ids.length, 13); assert.equal(new Set(ids).size, 13); });
  await test('历史单条读取是快照，current 负责到时核对', async () => { const f = fixture(); const s = await start(f); f.advance(10000); assert.equal((await f.get(s.id)).data.session.state, 'running'); assert.equal((await current(f)).state, 'completed'); });
  await test('数据库适配器带所有者、ID 游标和有界 limit', async () => { const calls = []; const query = { where(condition) { calls.push(condition); return this; }, orderBy(field, order) { assert.equal(field, '_id'); assert.equal(order, 'asc'); return this; }, limit(n) { assert.equal(n, 11); return this; }, async get() { return { data: [] }; } }; const store = createTransactionStore({ collection: () => query, command: { gt: value => ({ gt: value }) } }); await store.listFocus({ ownerId: 'A', ownerAppId: A.APPID }, 'cursor', 11); assert.deepEqual(calls[0], { ownerId: 'A', ownerAppId: A.APPID, _id: { gt: 'cursor' } }); });
  await test('显示不足一秒仍显示一秒，到零不修改服务器状态', async () => { const s = await sample(); const before = copy(s); assert.equal(view(s, s.deadlineAt - 1).countdown, '00:01'); assert.equal(view(s, s.deadlineAt).awaiting, true); assert.equal(view(s, s.deadlineAt).countdown, '00:00'); assert.deepEqual(s, before); });
  await test('一次迟到刷新按时间差推进而非只减一', async () => { const s = await sample(); assert.equal(view(s, BASE + 4500).countdown, '00:06'); assert.equal(view(s, BASE + 4500).elapsed, '00:04'); });
  await test('暂停视图不随墙上时间变化', async () => { const f = fixture(); const s = await start(f); f.advance(1500); await f.command('focusPause', 2, s); const paused = await current(f); assert.deepEqual(view(paused, BASE + 1000), view(paused, BASE + 9999999)); });
  await test('显示估算不倒退已确认的累计段', async () => { const f = fixture(); let s = await start(f); f.advance(2000); await f.command('focusPause', 2, s); s = await current(f); f.advance(5000); await f.command('focusResume', 3, s); s = await current(f); assert.equal(view(s, BASE).elapsed, '00:02'); assert.equal(view(s, BASE).countdown, '00:08'); });
  await test('云端时间锚点消除设备绝对时间偏差', async () => { const clock = createServerClock(BASE, BASE + 86400000, BASE + 86400100); assert.equal(clock.read(BASE + 86400600).now, BASE + 500); });
  await test('设备时钟回退要求重新同步并冻结估算', async () => { const clock = createServerClock(BASE, BASE, BASE); clock.read(BASE + 1000); const r = clock.read(BASE + 500); assert.equal(r.needsSync, true); assert.equal(r.now, BASE + 1000); });
  await test('前台出现明显大跳跃要求同步而不是直接完成', async () => { const clock = createServerClock(BASE, BASE, BASE); assert.equal(clock.read(BASE + 6000).needsSync, true); });
  await test('慢响应或往返期间回拨时钟不能建立可靠显示锚点', async () => { assert.throws(() => createServerClock(BASE, BASE, BASE + 10001), { code: 'CLOCK_SYNC' }); assert.throws(() => createServerClock(BASE, BASE + 1, BASE), { code: 'CLOCK_SYNC' }); });
  await test('连续短间隔刷新累计正确且格式不出现负秒', async () => { const clock = createServerClock(BASE, BASE, BASE); let result; for (let i = 1; i <= 20; i++) result = clock.read(BASE + i * 500); assert.equal(result.now, BASE + 10000); assert.equal(result.needsSync, false); assert.equal(formatSeconds(2700), '45:00'); assert.equal(formatSeconds(-1), '00:00'); });
  await test('页面核对后建立单个刷新器，隐藏时清除且不发送暂停', async () => { const s = await sample(), p = pageFixture({ session: s }); await p.page.sync(); assert.equal(p.timers.size, 1); p.page.onHide(); assert.equal(p.timers.size, 0); assert.equal(p.calls.length, 0); });
  await test('返回前台读取云端终态，不依赖保存的倒计时数字', async () => { const f = fixture(); await start(f); f.advance(10000); const completed = await current(f); const p = pageFixture({ session: completed }); p.page.onShow(); await p.flush(); assert.equal(p.page.data.session.state, 'completed'); assert.equal(p.page.data.label, '已完成'); assert.equal(p.timers.size, 0); });
  await test('旧核对响应在页面隐藏后不能回写', async () => { const gate = deferred(); const p = pageFixture({ repository: { current: () => gate.promise } }); const request = p.page.sync(); await p.flush(); p.page.onHide(); gate.resolve({ session: await sample(), serverNow: BASE, sentAt: BASE, receivedAt: BASE }); await request; assert.equal(p.page.data.session, null); assert.equal(p.timers.size, 0); });
  await test('多次核对迟到响应不会覆盖新会话', async () => { const a = deferred(), b = deferred(); let calls = 0; const p = pageFixture({ repository: { current: () => (++calls === 1 ? a : b).promise } }); const first = p.page.sync(); await p.flush(); const second = p.page.sync(); await p.flush(); b.resolve({ session: null, serverNow: BASE, sentAt: BASE, receivedAt: BASE }); await second; a.resolve({ session: await sample(), serverNow: BASE, sentAt: BASE, receivedAt: BASE }); await first; assert.equal(p.page.data.session, null); assert.equal(p.timers.size, 0); });
  await test('显示到零只发核对请求，不另发完成或结束写入', async () => { const s = await sample(); let count = 0; const p = pageFixture({ repository: { current: async () => { count++; return { session: s, serverNow: BASE, sentAt: BASE, receivedAt: BASE }; } } }); await p.page.sync(); for (let i = 0; i < 10; i++) { p.advance(1000); p.page.render(); await p.flush(); } assert.ok(count >= 2); assert.equal(p.calls.length, 0); assert.equal(s.state, 'running'); });
  await test('自动核对有次数预算，不超额发起请求', async () => { const p = pageFixture(); p.page._autoCount = 3; p.page.setData({ loading: false }); p.page.autoSync(); assert.equal(p.page._epoch, 0); assert.equal(p.page.data.loading, false); });
  await test('专注 pending 或 blocked 存在时不发新状态指令', async () => { const p = pageFixture({ session: await sample(), pending: [{ action: 'focusPause', state: 'pending' }] }); await p.page.sync(); assert.equal(p.page.data.pendingCount, 1); assert.equal(p.page.data.canWrite, false); p.page.onPause(); await p.flush(); assert.equal(p.calls.length, 0); });
  await test('其他模块的队列记录不阻止专注核对后的操作', async () => { const p = pageFixture({ session: await sample(), pending: [{ action: 'noteCreate', state: 'pending' }] }); await p.page.sync(); assert.equal(p.page.data.canWrite, true); });
  await test('暂停结果未确认不把界面乐观改为暂停', async () => { const p = pageFixture({ session: await sample(), repository: { pause: async () => { throw Object.assign(new Error('lost'), { queued: true }); } } }); await p.page.sync(); await p.page.write('pause', p.page._session); assert.equal(p.page.data.session.state, 'running'); assert.equal(p.page.data.canWrite, false); assert.match(p.page.data.errorMessage, /原操作/); });
  await test('写入回执不直接替换当前会话，成功后再读取', async () => { let read = 0; const s = await sample(); const p = pageFixture({ repository: { current: async () => ({ session: ++read === 1 ? null : s, serverNow: BASE, sentAt: BASE, receivedAt: BASE }), start: async () => ({ sessionId: 'old', state: 'running', version: 1 }) } }); await p.page.sync(); await p.page.write('start'); assert.equal(p.page.data.session.id, s.id); });
  await test('常亮失败不结束计时，隐藏时申请恢复关闭', async () => { const p = pageFixture({ session: await sample(), screenFail: true }); await p.page.sync(); p.page.onScreen({ detail: { value: true } }); assert.match(p.page.data.screenMessage, /未能开启/); assert.equal(p.page.data.session.state, 'running'); p.page.onHide(); assert.equal(p.screen[p.screen.length - 1], false); });
  await test('任务进入 tab 页通过一次性意图，不把 query 拼到 switchTab', async () => { const app = { globalData: {} }; let url; const navigation = moduleAt('miniprogram/services/focus-navigation.js', {}, { getApp: () => app, wx: { switchTab(options) { url = options.url; }, showToast() {} } }); navigation.forTask({ id: 'task_1', title: '学习' }); assert.equal(url, '/pages/focus/index'); assert.equal(app.globalData.focusTaskIntent.taskId, 'task_1'); const p = pageFixture(); p.app.globalData.focusTaskIntent = app.globalData.focusTaskIntent; p.page.onShow(); await p.flush(); assert.equal(p.page.data.taskId, 'task_1'); assert.equal(p.app.globalData.focusTaskIntent, undefined); });
  await test('开始响应协议错误时实际 outbox 保留原编号重试', async () => { const cache = new Map(); let broken = true; const ids = []; const box = moduleAt('miniprogram/services/outbox.js', { './cloud-client': { call: async (action, payload) => { if (action === 'whoami') return { authenticated: true, appId: 'wx', userTag: 'aaaaaa111111' }; ids.push(payload.opId); return broken ? {} : { sessionId: 'session', state: 'running', version: 1 }; } }, '../config/cloud': { ENV_ID: 'env' } }, { wx: { getStorageSync: key => cache.get(key), setStorageSync: (key, value) => cache.set(key, copy(value)) } }); await assert.rejects(box.submit('focusStart', { fields: { plannedSeconds: 10, taskId: '' } }), { code: 'PROTOCOL' }); const row = (await box.list())[0]; assert.equal(row.state, 'pending'); broken = false; await box.retry(row.opId); assert.equal(ids[0], ids[1]); });
  await test('专注状态业务拒绝为 blocked，禁止按任务字段自动合并', async () => { const cache = new Map(); const box = moduleAt('miniprogram/services/outbox.js', { './cloud-client': { call: async action => { if (action === 'whoami') return { authenticated: true, appId: 'wx', userTag: 'aaaaaa111111' }; throw Object.assign(new Error('changed'), { code: 'FOCUS_CHANGED' }); } }, '../config/cloud': { ENV_ID: 'env' } }, { wx: { getStorageSync: key => cache.get(key), setStorageSync: (key, value) => cache.set(key, copy(value)) } }); await assert.rejects(box.submit('focusPause', { id: 'session', version: 1 })); const row = (await box.list())[0]; assert.equal(row.state, 'blocked'); await assert.rejects(box.rebase(row.opId, 2), { code: 'LOCAL_STATE' }); });
  await test('客户端仓储拒绝畸形会话与停滞历史游标', async () => { const repo = moduleAt('miniprogram/services/focus-repository.js', { './cloud-client': { call: async action => action === 'focusCurrent' ? { session: { state: 'running' }, serverNow: BASE } : { items: [], nextCursor: 'same' } }, './outbox': {} }); await assert.rejects(repo.current(), { code: 'PROTOCOL' }); await assert.rejects(repo.list('same'), { code: 'PROTOCOL' }); });
  await test('八集合与会话分页索引在计划中且客户端权限关闭', async () => { const plan = JSON.parse(fs.readFileSync(path.join(ROOT, 'database/collections-plan.json'))); assert.equal(plan.collections.length, 8); assert.ok(plan.collections.includes('studyhub_focus_slots')); assert.ok(plan.additionalIndexes.some(row => row.collection === 'studyhub_focus_sessions')); assert.equal(plan.clientPermissions.read, false); assert.equal(plan.clientPermissions.write, false); });
  const inherited = JSON.parse(fs.readFileSync(path.join(__dirname, SUITE_PROJECT=== '08-studyhub-focus' ? '第七阶段知识库继承测试结果.json' : SUITE_PROJECT=== '09-studyhub-stats' ? '第八阶段知识库继承测试结果.json' : SUITE_PROJECT=== '10-studyhub-platform' ? '第九阶段知识库继承测试结果.json' : SUITE_PROJECT=== '11-studyhub-quality' ? '第十阶段知识库继承测试结果.json' : (['13-studyhub-accessibility','14-studyhub-testing', '15-studyhub-release'].includes(SUITE_PROJECT) ? (['14-studyhub-testing','15-studyhub-release'].includes(SUITE_PROJECT) ? (SUITE_PROJECT=== '15-studyhub-release' ? (project==='16-studyhub-operations'?'第十五阶段知识库继承测试结果.json':'第十四阶段知识库继承测试结果.json') : '第十三阶段知识库继承测试结果.json') : '第十二阶段知识库继承测试结果.json') : '第十一阶段知识库继承测试结果.json'))));
  assert.equal(inherited.project, project); assert.equal(inherited.totalPassed, 108);
  const result = { date: '2026-11-02', project, passed: records.length, inheritedPassed: 108,
    totalPassed: records.length + 108, realCloud: false, scenarios: records };
  fs.writeFileSync(path.join(__dirname, SUITE_PROJECT=== '08-studyhub-focus' ? '第七阶段测试结果.json' : SUITE_PROJECT=== '09-studyhub-stats' ? '第八阶段计时继承测试结果.json' : SUITE_PROJECT=== '10-studyhub-platform' ? '第九阶段计时继承测试结果.json' : SUITE_PROJECT=== '11-studyhub-quality' ? '第十阶段计时继承测试结果.json' : (['13-studyhub-accessibility','14-studyhub-testing', '15-studyhub-release'].includes(SUITE_PROJECT) ? (['14-studyhub-testing','15-studyhub-release'].includes(SUITE_PROJECT) ? (SUITE_PROJECT=== '15-studyhub-release' ? (project==='16-studyhub-operations'?'第十五阶段计时继承测试结果.json':'第十四阶段计时继承测试结果.json') : '第十三阶段计时继承测试结果.json') : '第十二阶段计时继承测试结果.json') : '第十一阶段计时继承测试结果.json')), JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify({ passed: records.length, inheritedPassed: 108, totalPassed: result.totalPassed, realCloud: false }));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
