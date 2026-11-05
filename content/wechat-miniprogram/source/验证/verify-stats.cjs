// 第 28 章：纯函数、内存事务/分页、API 与 Canvas 桩；不调用真实云或微信绘图。
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { spawnSync } = require('node:child_process');
const project = process.argv[2] || '09-studyhub-stats';
const SUITE_PROJECT = project === '16-studyhub-operations' ? '15-studyhub-release' : project;
if (!['09-studyhub-stats', '10-studyhub-platform', '11-studyhub-quality', '12-studyhub-performance', '13-studyhub-accessibility', '14-studyhub-testing', '15-studyhub-release'].includes(SUITE_PROJECT)) throw new Error('Unknown test project');
const ROOT = path.resolve(__dirname, '../示例代码', project);
const FN = path.join(ROOT, 'cloudfunctions/studyhub');
const core = require(path.join(FN, 'stats-core'));
const { createHandler } = require(path.join(FN, 'sync-domain'));
const { createTransactionStore } = require(path.join(FN, 'transaction-store'));
const chart = require(path.join(ROOT, 'miniprogram/utils/stats-chart'));
const { display } = require(path.join(ROOT, 'miniprogram/utils/stats-display'));
const lab = require(path.join(ROOT, 'miniprogram/utils/stats-lab-data'));
const copy = value => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
const A = { APPID: 'wx-stats-test', OPENID: 'A' }, B = { APPID: 'wx-stats-test', OPENID: 'B' };
const ASOF = lab.asOf, END = '2026-11-02';
const time = (year, month, day, hour = 0, minute = 0, second = 0) => Date.UTC(year, month - 1, day, hour - 8, minute, second);
const record = (id, endAt = time(2026, 11, 2, 11), ms = 300000, state = 'completed', planned = 300) => lab.record(id, endAt, ms, state, planned);
const op = n => 'stats_test_operation_' + String(n).padStart(5, '0');
const tests = [];
async function test(name, work) { await work(); tests.push(name); }
function memoryStore() {
  let db = {}, tail = Promise.resolve();
  const store = { calls: [], statsHook: null, rows: name => Object.values(db[name] || {}).map(copy),
    async transaction(work) {
      const previous = tail; let release; tail = new Promise(resolve => { release = resolve; }); await previous;
      const draft = copy(db);
      const tx = { async get(name, id) { return copy(draft[name] && draft[name][id]) || null; },
        async set(name, id, value) { draft[name] ||= {}; draft[name][id] = { ...copy(value), _id: id }; },
        async remove(name, id) { if (draft[name]) delete draft[name][id]; } };
      try { const result = await work(tx); db = draft; return copy(result); } finally { release(); }
    },
    async statsBatch(actor, query) {
      store.calls.push({ actor: copy(actor), ...query });
      const rows = store.rows('studyhub_focus_sessions').filter(row => row.ownerId === actor.ownerId && row.ownerAppId === actor.ownerAppId
        && row.isDemo === false && ['completed', 'stopped'].includes(row.state) && row.endedAt >= query.startAt && row.endedAt < query.cutoffExclusive
        && (query.cursor === null || row._id > query.cursor)).sort((a, b) => a._id < b._id ? -1 : a._id > b._id ? 1 : 0).slice(0, query.limit);
      return store.statsHook ? store.statsHook(rows, query) : rows;
    }
  }; return store;
}
function fixture() {
  const store = memoryStore(); let timestamp = ASOF, context = A;
  const handle = createHandler({ store, storage: {}, getContext: () => context, expectedAppId: A.APPID, now: () => timestamp, logger: { error() {} } });
  return { store, handle, user: value => { context = value; }, at: value => { timestamp = value; },
    week: (endDate = END) => handle({ action: 'statsWeek', endDate }),
    async seed(rows, owner = A) {
      await store.transaction(async tx => {
        for (const dto of rows) { const raw = { ...dto, ownerId: owner.OPENID, ownerAppId: owner.APPID }; delete raw.id; delete raw.effectiveSeconds;
          await tx.set('studyhub_focus_sessions', dto.id, raw); }
      });
    }
  };
}
function moduleAt(relative, mocks = {}, globals = {}) {
  if (['12-studyhub-performance', '13-studyhub-accessibility', '14-studyhub-testing', '15-studyhub-release'].includes(SUITE_PROJECT)) {
    relative = relative.replace(/^miniprogram\/pages\/(editor-lab|clock-lab|stats-lab|platform|quality-lab)\//, 'miniprogram/packageLab/pages/$1/');
    const aliases = {}; for (const [key, value] of Object.entries(mocks)) if (key.startsWith('../../')) aliases['../' + key] = value;
    mocks = { ...aliases, ...mocks };
  }
  const file = path.join(ROOT, relative), module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(file, 'utf8'), { module, exports: module.exports,
    require: name => name in mocks ? mocks[name] : require(name.startsWith('.') ? path.resolve(path.dirname(file), name) : name), console, wx: {}, ...globals }, { filename: file });
  return module.exports;
}
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
function pageFixture(repo) {
  let definition;
  moduleAt('miniprogram/pages/stats/index.js', { '../../services/stats-repository': repo }, { Page: value => { definition = value; } });
  const page = { ...definition, data: copy(definition.data), setData(value) { Object.assign(this.data, copy(value)); } };
  page.onLoad(); page._visible = true; return page;
}
function componentFixture(options = {}) {
  let definition, sequence = 0; const timers = new Map(), queries = [], frames = [];
  const makeContext = () => ({ scale(...args) { frames.push(['scale', ...args]); }, clearRect(...args) { frames.push(['clear', ...args]); },
    fillRect(...args) { frames.push(['rect', ...args]); }, fillText(...args) { frames.push(['text', ...args]); }, beginPath() {}, moveTo() {}, lineTo() {}, stroke() {} });
  const canvases = [];
  const wxMock = { createSelectorQuery() { return { in(value) { assert.ok(value); return this; }, select(id) { assert.equal(id, '#chart'); return this; },
    fields(value) { assert.equal(value.node, true); assert.equal(value.size, true); return this; }, exec(callback) { queries.push(callback); } }; },
    getWindowInfo() { return { pixelRatio: options.dpr || 2 }; } };
  moduleAt('miniprogram/components/stats-chart/index.js', {}, { Component: value => { definition = value; }, wx: wxMock,
    setTimeout(fn) { const id = ++sequence; timers.set(id, fn); return id; }, clearTimeout(id) { timers.delete(id); } });
  const instance = { ...definition.methods, data: copy(definition.data), properties: { days: lab.report().days }, setData(value) { Object.assign(this.data, copy(value)); } };
  definition.lifetimes.attached.call(instance); definition.lifetimes.ready.call(instance);
  return { instance, definition, queries, timers, frames, canvases,
    flush() { const pending = [...timers.values()]; timers.clear(); pending.forEach(fn => fn()); },
    answer(index = 0, supported = true) { const canvas = supported ? { getContext: () => makeContext() } : null;
      if (canvas) canvases.push(canvas); queries[index]([{ node: canvas, width: 343, height: 230 }]); }
  };
}
async function main() {
  await test('共享统计协议副本完全一致', async () => assert.equal(fs.readFileSync(path.join(FN, 'stats-core.js'), 'utf8'), fs.readFileSync(path.join(ROOT, 'miniprogram/shared/stats-core.js'), 'utf8')));
  await test('固定 UTC+08 午夜边界与 UTC 日期区分', async () => { assert.equal(core.dayKey(Date.UTC(2026, 9, 31, 15, 59, 59, 999)), '2026-10-31'); assert.equal(core.dayKey(Date.UTC(2026, 9, 31, 16)), '2026-11-01'); });
  await test('七天窗口包含截止日和前六日，跨月连续', async () => { const w = core.weekWindow(END, ASOF); assert.equal(w.dateFrom, '2026-10-27'); assert.equal(w.startAt, time(2026, 10, 27)); assert.equal(w.endExclusive, time(2026, 11, 3)); assert.equal(w.cutoffExclusive, ASOF + 1); });
  await test('跨年窗口日期不靠手工减日号', async () => { const w = core.weekWindow('2026-01-02', time(2026, 1, 2, 12)); assert.equal(w.dateFrom, '2025-12-27'); });
  await test('闰年二月合法，非闰年二月与日期自动滚动被拒绝', async () => { assert.ok(Number.isInteger(core.parseDay('2024-02-29'))); for (const value of ['2026-02-29', '2026-04-31', '2026-13-01', '2026-1-01', '1999-12-31', '2100-01-01']) assert.throws(() => core.parseDay(value)); });
  await test('未来日期被拒绝，默认日期来自服务器时间', async () => { assert.throws(() => core.weekWindow('2026-11-03', ASOF)); assert.equal(core.weekWindow(undefined, ASOF).dateTo, END); });
  await test('固定偏移结果不随 Node 进程本地时区改变', async () => { const file = path.join(FN, 'stats-core.js'); const script = 'const c=require(process.argv[1]);process.stdout.write(c.dayKey(Date.UTC(2026,9,31,16)))';
    for (const zone of ['UTC', 'Pacific/Honolulu']) { const result = spawnSync(process.execPath, ['-e', script, file], { env: { ...process.env, TZ: zone }, encoding: 'utf8' }); assert.equal(result.status, 0); assert.equal(result.stdout, '2026-11-01'); } });
  await test('窗口左边界包含，左边界前一毫秒排除', async () => { const start = time(2026, 10, 27); const r = core.aggregate([record('in', start), record('out', start - 1)], END, ASOF); assert.equal(r.sessionCount, 1); assert.equal(r.days[0].totalSeconds, 300); });
  await test('历史窗口右边界排除，午夜记录只属于下一日', async () => { const end = time(2026, 11, 2); const r = core.aggregate([record('before', end - 1), record('midnight', end)], '2026-11-01', ASOF); assert.equal(r.sessionCount, 1); assert.equal(r.days[6].totalSeconds, 300); });
  await test('当前核对时刻包含，该时刻后记录不提前计入', async () => { const r = core.aggregate([record('now', ASOF), record('future', ASOF + 1)], END, ASOF); assert.equal(r.sessionCount, 1); });
  await test('无记录也返回连续七个零值桶与空完成率', async () => { const r = core.aggregate([], END, ASOF); assert.equal(r.days.length, 7); assert.ok(r.days.every(day => day.totalSeconds === 0)); assert.equal(r.totals.longestActiveDays, 0); assert.equal(display(r).completedRate, '—'); assert.equal(core.validReport(r), true); });
  await test('实验完成不计入普通统计', async () => { const r = core.aggregate([record('demo', time(2026, 11, 2), 10000, 'completed', 10)], END, ASOF); assert.equal(r.sessionCount, 0); });
  await test('运行与暂停记录均不计最终时长', async () => { const start = time(2026, 11, 2, 11); const running = { ...record('run'), state: 'running', accumulatedMs: 0, startedAt: start, segmentStartedAt: start, deadlineAt: start + 300000, endedAt: null, updatedAt: start, effectiveSeconds: null }; const paused = { ...running, id: 'pause', state: 'paused', accumulatedMs: 1500, segmentStartedAt: null, deadlineAt: null }; const r = core.aggregate([running, paused], END, ASOF); assert.equal(r.sessionCount, 0); });
  await test('提前结束贡献有效秒数但不贡献计划完成轮次', async () => { const r = core.aggregate([record('stopped', time(2026, 11, 2, 11), 90599, 'stopped')], END, ASOF); assert.equal(r.totals.totalSeconds, 90); assert.equal(r.totals.completedSessions, 0); assert.equal(r.totals.stoppedSessions, 1); });
  await test('每轮先取完整秒再相加，不对总毫秒一次取整', async () => { const rows = [record('a', time(2026, 11, 2), 600, 'stopped'), record('b', time(2026, 11, 2), 600, 'stopped')]; const r = core.aggregate(rows, END, ASOF); assert.equal(r.totals.totalSeconds, 0); assert.equal(r.totals.finishedSessions, 2); assert.equal(r.totals.activeDays, 0); });
  await test('跨日整轮归入结束日，开始日不拆分', async () => { const row = record('cross', time(2026, 11, 1, 0, 2)); const r = core.aggregate([row], END, ASOF); assert.equal(r.days.find(day => day.date === '2026-10-31').totalSeconds, 0); assert.equal(r.days.find(day => day.date === '2026-11-01').totalSeconds, 300); });
  await test('核对写入日期不替代业务结束日期', async () => { const row = record('late', time(2026, 10, 30, 23)); row.updatedAt = ASOF; const r = core.aggregate([row], END, ASOF); assert.equal(r.days[3].totalSeconds, 300); assert.equal(r.days[6].totalSeconds, 0); });
  await test('完全相同重复 ID 只贡献一次', async () => { const row = record('same'); const r = core.aggregate([row, copy(row)], END, ASOF); assert.equal(r.sessionCount, 1); });
  await test('同 ID 冲突版本拒绝汇总而不是双计或任意选取', async () => { const row = record('same'); assert.throws(() => core.aggregate([row, { ...row, version: 3 }], END, ASOF)); });
  await test('非法会话时长拒绝汇总而不是当作零', async () => { assert.throws(() => core.aggregate([{ ...record('bad'), accumulatedMs: -1 }], END, ASOF)); });
  await test('补零日期打断连续活跃，最长值限于七日窗口', async () => { const rows = [27, 28, 30, 31].map(day => record('d' + day, time(2026, 10, day))); rows.push(record('n1', time(2026, 11, 1))); const r = core.aggregate(rows, END, ASOF); assert.equal(r.totals.activeDays, 5); assert.equal(r.totals.longestActiveDays, 3); });
  await test('固定教学数据可以人工复算到 2310 秒与 60% 完成率', async () => { const r = lab.report(); assert.equal(r.totals.totalSeconds, 2310); assert.equal(r.totals.completedSessions, 3); assert.equal(r.totals.stoppedSessions, 2); assert.equal(r.totals.activeDays, 4); assert.equal(r.totals.longestActiveDays, 2); assert.equal(display(r).completedRate, '60.0%'); assert.equal(display(r).averageMinutes, '5.5'); });
  await test('展示层只格式化分钟，精确总秒数保持不变', async () => { const r = core.aggregate([record('one', time(2026, 11, 2), 1000, 'stopped')], END, ASOF); assert.equal(display(r).totalMinutes, '0.0'); assert.equal(r.totals.totalSeconds, 1); });
  await test('协议拒绝旧口径、不完整标记与错误时区', async () => { const r = lab.report(); for (const extra of [{ policyVersion: 'old' }, { complete: false }, { timezone: 'local' }, { consistency: 'snapshot' }]) assert.equal(core.validReport({ ...r, ...extra }), false); });
  await test('协议核对七日连续性、总分合计和轮次一致', async () => { const r = lab.report(); const a = copy(r); a.days[0].date = a.days[1].date; assert.equal(core.validReport(a), false); const b = copy(r); b.totals.totalSeconds++; assert.equal(core.validReport(b), false); const c = copy(r); c.days[0].completedSessions = 1; assert.equal(core.validReport(c), false); });
  await test('同一有效数据重算不依赖输入顺序或污染输入', async () => { const rows = lab.dataset(), before = copy(rows); assert.deepEqual(core.aggregate(rows, END, ASOF), core.aggregate([...rows].reverse(), END, ASOF)); assert.deepEqual(rows, before); });
  await test('匿名与错误 AppID 不能查询统计', async () => { const f = fixture(); for (const user of [{}, { ...A, APPID: 'wx-other' }]) { f.user(user); assert.equal((await f.week()).error.code, 'UNAUTHENTICATED'); } });
  await test('统计请求不接受伪造 owner、时区和部分结果参数', async () => { const f = fixture(); for (const extra of [{ ownerId: 'B' }, { timezone: 'UTC' }, { limit: 1 }, { cursor: 'x' }]) assert.equal((await f.handle({ action: 'statsWeek', ...extra })).error.code, 'INVALID_INPUT'); });
  await test('无效日期在读取统计批次前被拒绝', async () => { const f = fixture(); for (const value of ['2026-02-31', '2026-11-03', null, {}]) assert.equal((await f.week(value)).error.code, 'INVALID_INPUT'); assert.equal(f.store.calls.length, 0); });
  await test('真实处理链先核对到时的普通会话再汇总', async () => { const f = fixture(); f.at(ASOF - 300000); await f.handle({ action: 'focusStart', opId: op(1), fields: { plannedSeconds: 300, taskId: '' } }); f.at(ASOF); const r = await f.week(); assert.equal(r.ok, true); assert.equal(r.data.totals.totalSeconds, 300); assert.equal(f.store.rows('studyhub_focus_sessions')[0].state, 'completed'); });
  await test('核对实验到时可以落库，但统计仍排除实验', async () => { const f = fixture(); f.at(ASOF - 10000); await f.handle({ action: 'focusStart', opId: op(1), fields: { plannedSeconds: 10, taskId: '' } }); f.at(ASOF); assert.equal((await f.week()).data.sessionCount, 0); assert.equal(f.store.rows('studyhub_focus_sessions')[0].state, 'completed'); });
  await test('两用户的相同周日期完全隔离', async () => { const f = fixture(); await f.seed([record('a')]); await f.seed([record('b', time(2026, 11, 2), 60000, 'stopped')], B); assert.equal((await f.week()).data.totals.totalSeconds, 300); f.user(B); assert.equal((await f.week()).data.totals.totalSeconds, 60); });
  await test('零记录服务器返回完整七天而非网络错误', async () => { const f = fixture(); const r = await f.week(); assert.equal(r.ok, true); assert.equal(r.data.days.length, 7); assert.equal(r.data.complete, true); });
  await test('超过单页的记录都被汇总，同一结束时刻也不漏页', async () => { const f = fixture(); await f.seed(Array.from({ length: 123 }, (_, i) => record('s_' + String(i).padStart(4, '0')))); const r = await f.week(); assert.equal(r.data.sessionCount, 123); assert.equal(r.data.totals.totalSeconds, 36900); assert.equal(f.store.calls.length, 3); assert.deepEqual(f.store.calls.map(c => c.limit), [51, 51, 51]); });
  await test('恰好 500 条可完整汇总，最多十批', async () => { const f = fixture(); await f.seed(Array.from({ length: 500 }, (_, i) => record('s_' + String(i).padStart(4, '0')))); const r = await f.week(); assert.equal(r.ok, true); assert.equal(r.data.sessionCount, 500); assert.equal(f.store.calls.length, 10); });
  await test('第 501 条触发明确错误，绝不返回前 500 条完整合计', async () => { const f = fixture(); await f.seed(Array.from({ length: 501 }, (_, i) => record('s_' + String(i).padStart(4, '0')))); const r = await f.week(); assert.equal(r.ok, false); assert.equal(r.error.code, 'STATS_TOO_LARGE'); assert.equal(r.data, undefined); assert.equal(f.store.calls.length, 10); });
  await test('中途数据库失败不返回部分合计', async () => { const f = fixture(); await f.seed(Array.from({ length: 60 }, (_, i) => record('s_' + String(i).padStart(4, '0')))); let count = 0; f.store.statsHook = rows => { if (++count === 2) throw new Error('database unavailable'); return rows; }; const r = await f.week(); assert.equal(r.ok, false); assert.equal(r.error.code, 'INTERNAL'); });
  await test('数据适配器返回别人记录时失败关闭而不泄露合计', async () => { const f = fixture(); await f.seed([record('a')]); f.store.statsHook = rows => rows.map(row => ({ ...row, ownerId: 'B' })); assert.equal((await f.week()).error.code, 'INTERNAL'); });
  await test('批次重复或游标不推进时拒绝汇总', async () => { const f = fixture(); await f.seed([record('a')]); f.store.statsHook = rows => [rows[0], rows[0]]; assert.equal((await f.week()).error.code, 'INTERNAL'); });
  await test('错误过滤结果和损坏时长不会被静默跳过', async () => { for (const extra of [{ isDemo: true }, { endedAt: ASOF + 1 }, { accumulatedMs: -1 }]) { const f = fixture(); await f.seed([record('a')]); f.store.statsHook = rows => rows.map(row => ({ ...row, ...extra })); assert.equal((await f.week()).error.code, 'INTERNAL'); } });
  await test('数据库适配器带身份、终态、实验、日期范围与 ID 游标', async () => { const calls = []; const make = (name, value) => ({ name, value, and(other) { return { and: [this, other] }; } });
    const query = { where(value) { calls.push(value); return this; }, orderBy(field, order) { assert.equal(field, '_id'); assert.equal(order, 'asc'); return this; }, limit(n) { assert.equal(n, 51); return this; }, async get() { return { data: [] }; } };
    const store = createTransactionStore({ collection: () => query, command: { in: value => make('in', value), gte: value => make('gte', value), lt: value => make('lt', value), gt: value => make('gt', value) } });
    await store.statsBatch({ ownerId: 'A', ownerAppId: A.APPID }, { startAt: 10, cutoffExclusive: 20, cursor: 'cursor', limit: 51 });
    assert.equal(calls[0].ownerId, 'A'); assert.equal(calls[0].isDemo, false); assert.deepEqual(calls[0].state.value, ['completed', 'stopped']); assert.equal(calls[0].endedAt.and[0].value, 10); assert.equal(calls[0].endedAt.and[1].value, 20); assert.equal(calls[0]._id.value, 'cursor'); });
  await test('仓储拒绝口径错误与不完整报告', async () => { const repo = moduleAt('miniprogram/services/stats-repository.js', { './cloud-client': { call: async () => ({ ...lab.report(), complete: false }) } }); await assert.rejects(repo.week(), { code: 'PROTOCOL' }); });
  await test('旧截止日响应不能覆盖新截止日选择', async () => { const a = deferred(), b = deferred(); let count = 0; const page = pageFixture({ week: () => (++count === 1 ? a : b).promise }); const first = page.refresh(); page.setData({ endDate: '2026-11-01' }); const second = page.refresh(); const newest = core.aggregate([], '2026-11-01', ASOF); b.resolve(newest); await second; a.resolve(lab.report()); await first; assert.equal(page.data.report.dateTo, '2026-11-01'); });
  await test('页面隐藏后迟到响应不显示旧报告', async () => { const gate = deferred(); const page = pageFixture({ week: () => gate.promise }); const request = page.refresh(); page.onHide(); gate.resolve(lab.report()); await request; assert.equal(page.data.report, null); });
  await test('查询失败时清掉旧报告，不把旧值装成新日期结果', async () => { const page = pageFixture({ week: async () => { throw new Error('failed'); } }); page.setData({ report: lab.report(), status: 'ready' }); await page.refresh(); assert.equal(page.data.report, null); assert.equal(page.data.status, 'error'); });
  await test('首次请求不传手机日期，日期上限来自服务端报告', async () => { let asked; const page = pageFixture({ week: async value => { asked = value; return lab.report(); } }); await page.refresh(); assert.equal(asked, undefined); assert.equal(page.data.today, END); });
  await test('零图表使用非零纵轴，不生成假柱或 NaN', async () => { const plan = chart.layout(343, 230, lab.report('empty').days); assert.equal(plan.axisMax, 60); assert.ok(plan.bars.every(bar => bar.height === 0 && Number.isFinite(bar.y))); });
  await test('柱高与有效秒数线性对应，底边一致', async () => { const plan = chart.layout(343, 230, lab.report().days); const a = plan.bars.find(b => b.value === 300), b = plan.bars.find(b => b.value === 60); assert.equal(a.height / b.height, 5); assert.ok(plan.bars.every(bar => Math.abs(bar.y + bar.height - (plan.top + plan.plotHeight)) < 1e-8)); });
  await test('窄宽度短日期标签与大刻度留白在画布内', async () => { const days = lab.report().days.map(day => ({ ...day, totalSeconds: 1350000 })); const narrow = chart.layout(220, 230, days); assert.ok(narrow.bars.every(bar => bar.label.length === 2)); assert.ok(narrow.left >= 56); assert.ok(narrow.bars.every(bar => bar.x >= narrow.left && bar.x + bar.width <= narrow.width)); });
  await test('非法图表尺寸、负数与错误天数被拒绝', async () => { assert.throws(() => chart.layout(100, 230, lab.report().days)); assert.throws(() => chart.layout(343, 230, [])); const days = copy(lab.report().days); days[0].totalSeconds = -1; assert.throws(() => chart.layout(343, 230, days)); });
  await test('像素比有界且无效值回退为一', async () => { assert.equal(chart.pixelRatio(8), 3); assert.equal(chart.pixelRatio(0), 1); assert.equal(chart.pixelRatio(NaN), 1); assert.equal(chart.pixelRatio(2), 2); });
  await test('绘图函数输出网格、日期和非零柱，不含持续动画', async () => { const calls = []; const ctx = { clearRect: (...a) => calls.push(['clear', ...a]), fillRect: (...a) => calls.push(['rect', ...a]), fillText: (...a) => calls.push(['text', ...a]), beginPath() {}, moveTo() {}, lineTo() {}, stroke() {} }; chart.draw(ctx, chart.layout(343, 230, lab.report().days)); assert.equal(calls.filter(c => c[0] === 'rect').length, 5); assert.equal(calls.filter(c => c[0] === 'text').length, 11); });
  await test('Canvas 生命周期就绪后查询组件内节点并按 DPR 设置位图', async () => { const c = componentFixture(); c.flush(); assert.equal(c.queries.length, 1); c.answer(); assert.equal(c.canvases[0].width, 686); assert.equal(c.canvases[0].height, 460); assert.deepEqual(c.frames.find(frame => frame[0] === 'scale'), ['scale', 2, 2]); });
  await test('重复重绘会重置位图后重新缩放，不累积 DPR', async () => { const c = componentFixture({ dpr: 3 }); c.flush(); c.answer(); c.instance.schedule(); c.flush(); c.answer(1); assert.equal(c.canvases[1].width, 1029); assert.equal(c.frames.filter(frame => frame[0] === 'scale').length, 2); });
  await test('隐藏与卸载使迟到 Canvas 查询失效', async () => { const c = componentFixture(); c.flush(); c.definition.pageLifetimes.hide.call(c.instance); c.answer(); assert.equal(c.frames.length, 0); c.definition.pageLifetimes.show.call(c.instance); c.flush(); c.definition.lifetimes.detached.call(c.instance); c.answer(1); assert.equal(c.frames.length, 0); });
  await test('数据变化后旧绘图回调不能覆盖新图', async () => { const c = componentFixture(); c.flush(); c.instance.properties.days = lab.report('empty').days; c.instance.schedule(); c.flush(); c.answer(0); assert.equal(c.frames.length, 0); c.answer(1); assert.equal(c.frames.filter(frame => frame[0] === 'rect').length, 1); });
  await test('不支持 Canvas 时显示回退提示，不伪造零数据', async () => { const c = componentFixture(); c.flush(); c.answer(0, false); assert.equal(c.instance.data.unavailable, true); assert.equal(c.instance.properties.days[1].totalSeconds, 300); });
  await test('报告组件先核对总分一致性才允许渲染', async () => { let definition; moduleAt('miniprogram/components/week-report/index.js', {}, { Component: value => { definition = value; } }); const instance = { data: {}, setData(value) { Object.assign(this.data, copy(value)); } }; definition.observers.report.call(instance, lab.report()); assert.equal(instance.data.ready, true); definition.observers.report.call(instance, { ...lab.report(), complete: false }); assert.equal(instance.data.ready, false); });
  await test('本地练习显式使用固定数据且不调用云', async () => { let definition; moduleAt('miniprogram/pages/stats-lab/index.js', {}, { Page: value => { definition = value; } }); const instance = { data: {}, setData(value) { Object.assign(this.data, copy(value)); } }; definition.onLoad.call(instance); assert.equal(instance.data.report.totals.totalSeconds, 2310); definition.onEmpty.call(instance); assert.equal(instance.data.report.sessionCount, 0); });
  await test('统计仍使用八集合，新增索引核对计划与受控读取上限', async () => { const plan = JSON.parse(fs.readFileSync(path.join(ROOT, 'database/collections-plan.json'))); const stats = JSON.parse(fs.readFileSync(path.join(ROOT, 'database/stats-index-plan.json'))); assert.equal(plan.collections.length, 8); assert.equal(plan.clientPermissions.read, false); assert.equal(stats.businessLimit.maxSessions, 500); });
  const inherited = JSON.parse(fs.readFileSync(path.join(__dirname, SUITE_PROJECT=== '09-studyhub-stats' ? '第八阶段计时继承测试结果.json' : SUITE_PROJECT=== '10-studyhub-platform' ? '第九阶段计时继承测试结果.json' : SUITE_PROJECT=== '11-studyhub-quality' ? '第十阶段计时继承测试结果.json' : (['13-studyhub-accessibility','14-studyhub-testing', '15-studyhub-release'].includes(SUITE_PROJECT) ? (['14-studyhub-testing','15-studyhub-release'].includes(SUITE_PROJECT) ? (SUITE_PROJECT=== '15-studyhub-release' ? (project==='16-studyhub-operations'?'第十五阶段计时继承测试结果.json':'第十四阶段计时继承测试结果.json') : '第十三阶段计时继承测试结果.json') : '第十二阶段计时继承测试结果.json') : '第十一阶段计时继承测试结果.json')))); assert.equal(inherited.project, project); assert.equal(inherited.totalPassed, 179);
  const result = { date: '2026-11-02', project, passed: tests.length, inheritedPassed: 179,
    totalPassed: tests.length + 179, realCloud: false, scenarios: tests };
  fs.writeFileSync(path.join(__dirname, SUITE_PROJECT=== '09-studyhub-stats' ? '第八阶段测试结果.json' : SUITE_PROJECT=== '10-studyhub-platform' ? '第九阶段统计继承测试结果.json' : SUITE_PROJECT=== '11-studyhub-quality' ? '第十阶段统计继承测试结果.json' : (['13-studyhub-accessibility','14-studyhub-testing', '15-studyhub-release'].includes(SUITE_PROJECT) ? (['14-studyhub-testing','15-studyhub-release'].includes(SUITE_PROJECT) ? (SUITE_PROJECT=== '15-studyhub-release' ? (project==='16-studyhub-operations'?'第十五阶段统计继承测试结果.json':'第十四阶段统计继承测试结果.json') : '第十三阶段统计继承测试结果.json') : '第十二阶段统计继承测试结果.json') : '第十一阶段统计继承测试结果.json')), JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify({ passed: result.passed, inheritedPassed: 179, totalPassed: result.totalPassed, realCloud: false }));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
