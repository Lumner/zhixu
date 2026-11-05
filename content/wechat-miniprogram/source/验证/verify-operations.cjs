const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), os = require('node:os');
const assert = require('node:assert/strict'), { spawnSync } = require('node:child_process');
const PROJECT = '16-studyhub-operations', ROOT = path.resolve(__dirname, '../示例代码/' + PROJECT);
const from = name => require(path.join(ROOT, name)), read = name => JSON.parse(fs.readFileSync(path.join(ROOT, name), 'utf8'));
const { createJournal, bucket, summarize } = from('miniprogram/services/diagnostics-core');
const { createObservedCall } = from('miniprogram/services/observed-call');
const { checkEnvironment } = from('miniprogram/services/environment-core');
const { fingerprint, validManifest } = from('tools/source-manifest-core.cjs');
const { collect } = from('tools/build-manifest.cjs'), { evaluateRecovery } = from('tools/recovery-core.cjs'), { reviewRuntime } = from('tools/runtime-review.cjs');
const cases = []; async function test(name, fn) { await fn(); cases.push(name); }
const copy = value => JSON.parse(JSON.stringify(value));
function load(name, mocks = {}, globals = {}) {
  const file = path.join(ROOT, name), module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(file, 'utf8'), { module, exports: module.exports, require: key => Object.hasOwn(mocks, key) ? mocks[key] : require(key.startsWith('.') ? path.resolve(path.dirname(file), key) : key), setTimeout, clearTimeout, ...globals }, { filename: file });
  return module.exports;
}
const runtime = stage => ({ STAGE: stage || 'development', RELEASE_VERSION: '1.1.0', EXPECTED_APP_ID: 'wx-fixture', EXPECTED_ENV_ID: 'env-fixture', ENABLE_LOCAL_DIAGNOSTICS: false });
const account = envVersion => ({ miniProgram: { appId: 'wx-fixture', envVersion: envVersion || 'develop' } });
const env = (r = runtime(), a = account(), cloud = { ENV_ID: 'env-fixture' }) => checkEnvironment({ runtime: r, account: a, cloud });
function page() {
  let definition; const live = createJournal({ enabled: true });
  load('miniprogram/packageLab/pages/operations/index.js', { '../../../services/diagnostics': live, '../../../services/environment': { inspect: () => env() } }, { Page: value => { definition = value; } });
  const p = { ...definition, data: copy(definition.data), setData(patch) { Object.assign(this.data, patch); } }; p.onLoad(); return { p, live };
}
function app(ok = true) {
  let definition, init = 0; const journal = createJournal({ enabled: true });
  load('miniprogram/app.js', { './config/cloud': { ENV_ID: 'env-fixture' }, './config/performance': { ENABLE_DEV_METRICS: false },
    './services/performance-entries': { createEntryCollector: () => ({ start() {} }) }, './services/environment': { inspect: () => ok ? env() : env(runtime(), undefined, { ENV_ID: 'wrong' }) }, './services/diagnostics': journal },
  { App: value => { definition = value; }, wx: { cloud: { init() { init++; } } } });
  return { a: definition, journal, count: () => init };
}
function manifest(char, version = '1.1.0') {
  const components = Object.fromEntries(['client', 'cloud', 'controls'].map(key => [key, { sha256: char.repeat(64), files: 1, bytes: 1 }]));
  return { kind: 'course-source-artifacts', compiled: false, deployed: false, releaseVersion: version, stage: 'production', components, fingerprint: fingerprint(components) };
}
function recovery() {
  const current = manifest('a'), target = manifest('b', '1.0.0');
  return { current, target, envId: 'env-fixture', plan: { mode: 'manual-review', owner: '固定测试负责人', stage: 'production', expectedEnvId: 'env-fixture',
    expectedCurrentFingerprint: current.fingerprint, expectedTargetFingerprint: target.fingerprint, cloudCompatibility: 'verified', dataCompatibility: 'verified',
    evidence: Object.fromEntries(['backup', 'restoreDrill', 'stopWrites', 'review'].map(key => [key, { status: 'verified', checkedAt: '2026-11-03', reference: '固定测试材料，非真实审批' }])) } };
}
function cli(name) {
  const child = spawnSync(process.execPath, [path.join(ROOT, 'tools', name)], { cwd: ROOT, encoding: 'utf8', timeout: 10000, windowsHide: true });
  assert.equal(child.error, undefined); return child;
}
async function main() {
  await test('默认诊断关闭，不保留任何事件', () => { const j = createJournal(); assert.equal(j.record('rpc-ok'), false); assert.equal(j.snapshot().events.length, 0); });
  await test('只有布尔true启用，字符串true不启用', () => { const j = createJournal({ enabled: 'true' }); j.record('rpc-fail'); assert.equal(j.snapshot().enabled, false); });
  await test('未知事件被拒绝，不占用内存队列', () => { const j = createJournal({ enabled: true }); assert.equal(j.record('私人标题'), false); assert.equal(j.snapshot().accepted, 0); });
  await test('从零构造允许字段，不复制正文ID链接堆栈或额外对象', () => {
    const j = createJournal({ enabled: true }); j.record('rpc-fail', { action: 'list', code: 'TRANSPORT', elapsedMs: 12, payload: 'PRIVATE', openid: 'PRIVATE', stack: 'PRIVATE', url: 'PRIVATE' });
    const row = j.snapshot().events[0]; assert.deepEqual(Object.keys(row).sort(), ['action', 'code', 'elapsed', 'event', 'seq']); assert.ok(!JSON.stringify(row).includes('PRIVATE'));
  });
  await test('任意动作名映射other，避免私密字符串借动作进入日志', () => { const j = createJournal({ enabled: true }); j.record('rpc-ok', { action: 'PRIVATE' }); assert.equal(j.snapshot().events[0].action, 'other'); });
  await test('未知错误码映射OTHER，不输出原始错误内容', () => { const j = createJournal({ enabled: true }); j.record('rpc-fail', { code: 'PRIVATE' }); assert.equal(j.snapshot().events[0].code, 'OTHER'); });
  await test('返回快照是复制，调用者不能改内部事件', () => { const j = createJournal({ enabled: true }); j.record('rpc-ok', { code: 'OK' }); j.snapshot().events[0].code = 'PRIVATE'; assert.equal(j.snapshot().events[0].code, 'OK'); });
  await test('容量只接受1到200整数', () => { for (const n of [0, 201, -1, 1.5, NaN]) assert.throws(() => createJournal({ capacity: n }), /INVALID_CAPACITY/); });
  await test('容量满时挤出最旧样本，保留新序号并记录挤出数', () => { const j = createJournal({ enabled: true, capacity: 2 }); for (let i = 0; i < 3; i++) j.record('rpc-ok'); const s = j.snapshot(); assert.equal(s.events.length, 2); assert.equal(s.events[0].seq, 2); assert.equal(s.dropped, 1); assert.equal(s.accepted, 3); });
  await test('清空只复位本记录器的队列与计数', () => { const j = createJournal({ enabled: true }); j.record('rpc-ok'); j.clear(); assert.equal(j.snapshot().accepted, 0); assert.equal(j.snapshot().events.length, 0); j.record('rpc-ok'); assert.equal(j.snapshot().events[0].seq, 1); });
  await test('空字段对象或null不导致诊断异常', () => { const j = createJournal({ enabled: true }); j.record('rpc-ok', null); assert.equal(j.snapshot().events[0].elapsed, 'unknown'); });
  await test('耗时分桶的每个边界精确归属', () => { assert.deepEqual([0,249,250,999,1000,2999,3000,11999,12000].map(bucket), ['<250ms','<250ms','250-999ms','250-999ms','1000-2999ms','1000-2999ms','3000-11999ms','3000-11999ms','>=12000ms']); });
  await test('负数非有限耗时保留unknown，不伪造零耗时', () => { for (const n of [-1, NaN, Infinity, undefined]) assert.equal(bucket(n), 'unknown'); });
  await test('空样本没有失败比例，结论为样本不足', () => { const s = summarize([]); assert.equal(s.ratio, null); assert.equal(s.signal, 'insufficient'); });
  await test('不足20条即使全失败也不套比例阈值', () => { assert.equal(summarize(Array(19).fill({ event: 'rpc-fail' })).signal, 'insufficient'); });
  await test('20条中4条失败触发线索，3条失败未达到20百分比', () => { const make = n => Array.from({ length: 20 }, (_, i) => ({ event: i < n ? 'rpc-fail' : 'rpc-ok' })); assert.equal(summarize(make(4)).signal, 'investigate'); assert.equal(summarize(make(3)).signal, 'no-threshold-hit'); });
  await test('超时仅按失败中的允许码统计', () => { const s = summarize([{ event: 'rpc-fail', code: 'CLOUD_TIMEOUT' }, { event: 'rpc-ok', code: 'CLOUD_TIMEOUT' }]); assert.equal(s.timeouts, 1); assert.equal(s.attempts, 2); });
  await test('运行时事件不混入RPC分母且保留统计范围说明', () => { const s = summarize([{ event: 'runtime-error' }, null]); assert.equal(s.attempts, 0); assert.ok(s.scope.includes('非线上可用率')); });
  await test('观察包装成功返回同一个业务对象', async () => { const result = { private: true }, f = createObservedCall({ invoke: async () => result, record() {} }); assert.equal(await f('studyhub', { action: 'list' }), result); });
  await test('观察包装失败抛出原错误对象，不篡改恢复语义', async () => { const error = Object.assign(Error('PRIVATE'), { code: 'CLOUD_TIMEOUT' }); const f = createObservedCall({ invoke: async () => { throw error; }, record() {} }); await assert.rejects(f('studyhub', {}), e => e === error); });
  await test('底层同步抛错也只执行一次并保留原错误', async () => { let n = 0; const error = Error('x'), f = createObservedCall({ invoke() { n++; throw error; }, record() {} }); await assert.rejects(f('x', {}), e => e === error); assert.equal(n, 1); });
  await test('成功路径日志记录器抛错不会把业务变失败', async () => { const f = createObservedCall({ invoke: async () => 7, record() { throw Error('logger'); } }); assert.equal(await f('x', {}), 7); });
  await test('失败路径日志器抛错不会覆盖原业务错误', async () => { const e = Error('business'), f = createObservedCall({ invoke: async () => { throw e; }, record() { throw Error('logger'); } }); await assert.rejects(f('x', {}), x => x === e); });
  await test('时钟抛错时业务仍成功，耗时记录unknown', async () => { const j = createJournal({ enabled: true }), f = createObservedCall({ invoke: async () => 1, record: j.record, clock() { throw Error('clock'); } }); assert.equal(await f('x', {}), 1); assert.equal(j.snapshot().events[0].elapsed, 'unknown'); });
  await test('墙钟倒退不会产生负耗时或虚假提速', async () => { let n = 100; const j = createJournal({ enabled: true }), f = createObservedCall({ invoke: async () => 1, record: j.record, clock: () => n-- }); await f('x', {}); assert.equal(j.snapshot().events[0].elapsed, 'unknown'); });
  await test('动作属性getter异常只影响诊断分类，不阻止底层调用', async () => { const input = { get action() { throw Error('getter'); } }, f = createObservedCall({ invoke: async (_, data) => data, record() {} }); assert.equal(await f('studyhub', input), input); });
  await test('包装器不复制改写载荷、不增加重试与请求字段', async () => { const data = { action: 'create', opId: 'fixed', fields: { title: 'PRIVATE' } }; let n = 0; const f = createObservedCall({ invoke: async (name, payload) => { n++; assert.equal(name, 'studyhub'); assert.equal(payload, data); return data; }, record() {} }); await f('studyhub', data); assert.equal(n, 1); assert.equal(data.opId, 'fixed'); });
  await test('空运行配置和未知平台不被当作已核对', () => { const s = checkEnvironment(); assert.equal(s.ok, false); assert.ok(s.problems.includes('PLATFORM_UNKNOWN')); });
  await test('显式development目标与develop平台一致可通过本地核对', () => { const s = env(); assert.equal(s.ok, true); assert.equal(Object.hasOwn(s, 'appId'), false); assert.ok(s.note.includes('不证明')); });
  await test('实际平台AppID与预期不同会阻止云初始化条件', () => { const a = account(); a.miniProgram.appId = 'other'; assert.ok(env(runtime(), a).problems.includes('APP_MISMATCH')); });
  await test('云环境与预期不同即使AppID相同也不放行', () => { assert.ok(env(runtime(), account(), { ENV_ID: 'wrong' }).problems.includes('ENV_MISMATCH')); });
  await test('元数据能力抛错后保持平台未知且不返回原始值', () => { const service = load('miniprogram/services/environment.js', { '../config/runtime': runtime(), '../config/cloud': { ENV_ID: 'env-fixture' } }, { wx: { getAccountInfoSync() { throw Error('PRIVATE'); } } }); const s = service.inspect(); assert.equal(s.ok, false); assert.ok(s.problems.includes('PLATFORM_UNKNOWN')); assert.ok(!JSON.stringify(s).includes('PRIVATE')); });
  await test('production允许体验版验收，不把trial等同测试云', () => { assert.equal(env(runtime('production'), account('trial')).ok, true); assert.equal(env(runtime('production'), account('release')).ok, true); });
  await test('production默认拒绝开发发行类型，未知阶段也拒绝', () => { assert.equal(env(runtime('production'), account('develop')).ok, false); assert.equal(env(runtime('unknown')).ok, false); });
  await test('staging支持develop和trial但拒绝release', () => { for (const type of ['develop','trial']) assert.equal(env(runtime('staging'), account(type)).ok, true); assert.equal(env(runtime('staging'), account('release')).ok, false); });
  await test('无效版本不作为可展示的候选版本', () => { const s = env({ ...runtime(), RELEASE_VERSION: 'PRIVATE' }); assert.equal(s.version, 'unknown'); assert.equal(s.ok, false); });
  await test('维护页进入仅读取本地快照，不制造RPC样本', () => { const f = page(); assert.equal(f.p.data.sampleSummary.attempts, 0); assert.equal(f.live.snapshot().events.length, 0); f.p.onUnload(); });
  await test('固定故障按钮生成20条5失败，真实诊断队列保持空', () => { const f = page(); f.p.onDrill(); assert.equal(f.p.data.sampleSummary.attempts, 20); assert.equal(f.p.data.sampleSummary.failures, 5); assert.equal(f.p.data.sampleSummary.signal, 'investigate'); assert.equal(f.live.snapshot().events.length, 0); f.p.onUnload(); });
  await test('清空按钮只清本地两个队列，不清云数据', () => { const f = page(); f.live.record('rpc-ok'); f.p.onDrill(); f.p.onClear(); assert.equal(f.p.data.live.events.length, 0); assert.equal(f.p.data.sample.events.length, 0); f.p.onUnload(); });
  await test('维护页销毁清除练习样本，不模拟持久化', () => { const f = page(); f.p.onDrill(); f.p.onUnload(); assert.equal(f.p._practice.snapshot().events.length, 0); });
  await test('实际App启动目标不匹配时不执行wx.cloud.init', () => { const f = app(false); f.a.onLaunch(); assert.equal(f.count(), 0); assert.equal(f.a.globalData.cloudReady, false); });
  await test('实际App核对通过时只初始化指定云一次', () => { const f = app(true); f.a.onLaunch(); assert.equal(f.count(), 1); assert.equal(f.a.globalData.cloudReady, true); });
  await test('App脚本错误钩子不复制原始堆栈正文', () => { const f = app(); f.a.onError('PRIVATE_STACK'); const s = f.journal.snapshot(); assert.equal(s.events[0].code, 'UNCAUGHT'); assert.ok(!JSON.stringify(s).includes('PRIVATE')); });
  await test('App未处理拒绝钩子只登记分类，不存reason或Promise', () => { const f = app(); f.a.onUnhandledRejection({ reason: 'PRIVATE' }); const s = f.journal.snapshot(); assert.equal(s.events[0].code, 'UNHANDLED'); assert.ok(!JSON.stringify(s).includes('PRIVATE')); });
  await test('实际cloud-client接入观察仍保留云请求与业务结果', async () => {
    const j = createJournal({ enabled: true }); let n = 0;
    const service = load('miniprogram/services/cloud-client.js', { '../config/cloud': { ENV_ID: 'env-fixture', FUNCTION_NAME: 'studyhub' }, './diagnostics': j },
      { getApp: () => ({ globalData: { cloudReady: true } }), wx: { cloud: { callFunction(o) { n++; assert.equal(o.config.env, 'env-fixture'); assert.equal(o.data.action, 'list'); assert.equal(o.data.title, 'PRIVATE'); o.success({ result: { ok: true, data: { count: 3 } } }); } } } });
    assert.equal((await service.call('list', { title: 'PRIVATE' })).count, 3); assert.equal(n, 1); assert.equal(j.snapshot().events[0].action, 'list'); assert.ok(!JSON.stringify(j.snapshot()).includes('PRIVATE'));
  });
  await test('源码清单可重复，规则变动只改变controls指纹', () => {
    const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'studyhub-ops-'));
    try {
      for (const dir of ['miniprogram/config','cloudfunctions','database','security']) fs.mkdirSync(path.join(folder, dir), { recursive: true });
      fs.writeFileSync(path.join(folder,'miniprogram/config/runtime.js'),"module.exports={STAGE:'development',RELEASE_VERSION:'1.0.0'};");
      fs.writeFileSync(path.join(folder,'cloudfunctions/index.js'),'fixed'); fs.writeFileSync(path.join(folder,'database/rules.json'),'{}');
      const a = collect(folder), b = collect(folder); assert.deepEqual(a, b); assert.equal(validManifest(a), true);
      fs.writeFileSync(path.join(folder,'database/rules.json'),'{"changed":true}'); const c = collect(folder);
      assert.equal(a.components.client.sha256, c.components.client.sha256); assert.equal(a.components.cloud.sha256, c.components.cloud.sha256); assert.notEqual(a.components.controls.sha256, c.components.controls.sha256); assert.notEqual(a.fingerprint,c.fingerprint);
    } finally {
      // 只清理本测试在系统临时目录创建且已核对父路径/前缀的目录。
      assert.equal(path.dirname(path.resolve(folder)),path.resolve(os.tmpdir())); assert.ok(path.basename(folder).startsWith('studyhub-ops-')); fs.rmSync(folder,{recursive:true,force:true});
    }
  });
  await test('清单组件被改但组合摘要未重算会被拒绝', () => { const m = manifest('a'); m.components.cloud.sha256 = 'b'.repeat(64); assert.equal(validManifest(m), false); });
  await test('回退材料全齐也仅人工审查，缺证据与兼容性未知均阻止', () => {
    const run = s => evaluateRecovery(s,'2026-11-03'), base = recovery(), good = run(base);
    assert.equal(good.decision,'manual-review-only'); assert.equal(good.canExecute,false); assert.equal(good.remoteVerified,false); assert.equal(good.dataRestored,false);
    for (const change of [s=>s.envId='',s=>s.plan.expectedCurrentFingerprint='',s=>s.plan.owner='',s=>s.plan.cloudCompatibility='unknown',s=>s.plan.dataCompatibility='unknown',s=>s.plan.stage='staging',s=>s.plan.evidence.backup.status='pending',s=>s.plan.evidence.restoreDrill.checkedAt='2026-11-04',s=>s.target.releaseVersion=s.current.releaseVersion]) {
      const s=copy(base);change(s);assert.equal(run(s).decision,'blocked');assert.equal(run(s).canExecute,false);
    }
  });
  await test('运行发布配置逐项核对，默认实际发布检查仍受阻', () => {
    const s = { runtime:runtime('production'), plan:{targetVersion:'1.1.0'}, projectConfig:{appid:'wx-fixture'}, cloud:{ENV_ID:'env-fixture'} }; assert.equal(reviewRuntime(s).length,0);
    for(const [field,value,code] of [['STAGE','development','RUNTIME_STAGE'],['RELEASE_VERSION','1.0.0','RUNTIME_VERSION'],['EXPECTED_APP_ID','','RUNTIME_APP'],['EXPECTED_ENV_ID','','RUNTIME_ENV'],['ENABLE_LOCAL_DIAGNOSTICS',true,'LOCAL_DIAGNOSTICS_ENABLED']]){
      const f=copy(s);f.runtime[field]=value;assert.ok(reviewRuntime(f).some(x=>x.code===code));
    }
    assert.equal(cli('release-audit.cjs').status,2); const report=read('release/reports/readiness.json');assert.equal(report.readyForPublicRelease,false);assert.ok(report.errors.some(x=>x.code==='RUNTIME_STAGE'));
  });
  await test('实际清单CLI成功而默认回退CLI退出2，均没有部署或恢复', () => {
    assert.equal(cli('build-manifest.cjs').status,0);const m=read('operations/reports/artifacts.json');assert.equal(validManifest(m),true);assert.equal(m.compiled,false);assert.equal(m.deployed,false);
    assert.equal(cli('recovery-check.cjs').status,2);const r=read('operations/reports/recovery.json');assert.equal(r.decision,'blocked');assert.equal(r.canExecute,false);assert.equal(r.dataRestored,false);
  });
  assert.equal(cases.length,50);
  const inherited=JSON.parse(fs.readFileSync(path.join(__dirname,'第十五阶段隐私继承测试结果.json'),'utf8'));
  assert.equal(inherited.project,PROJECT);assert.equal(inherited.totalPassed,550);
  const current=from('tests/support/digest.cjs').digest(),standard=read('tests/reports/latest.json');assert.equal(standard.sourceDigest,current);
  const manifestResult=read('operations/reports/artifacts.json'),recoveryResult=read('operations/reports/recovery.json'),audit=read('release/reports/readiness.json');
  const report={date:'2026-11-03',project:PROJECT,passed:50,inheritedPassed:550,totalPassed:600,realCloud:false,realWechat:false,realAlert:false,realBackup:false,realRollback:false,dataRestored:false,sourceDigest:current,sourceFingerprint:manifestResult.fingerprint,releaseBlockers:audit.errors.length,recoveryDecision:recoveryResult.decision,scenarios:cases};
  fs.writeFileSync(path.join(__dirname,'第十五阶段测试结果.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({passed:50,inheritedPassed:550,totalPassed:600,releaseBlockers:audit.errors.length,recoveryDecision:recoveryResult.decision,realRollback:false}));
}
main().catch(error=>{console.error(error);process.exitCode=1;});
