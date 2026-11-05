// 真实本机 HTTP + 文件/微信/云函数桩。不调用微信消息或真实云账号。
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const http = require('node:http');
const project = process.argv[2] || '10-studyhub-platform';
const SUITE_PROJECT = project === '16-studyhub-operations' ? '15-studyhub-release' : project;
if (!['10-studyhub-platform', '11-studyhub-quality', '12-studyhub-performance', '13-studyhub-accessibility', '14-studyhub-testing', '15-studyhub-release'].includes(SUITE_PROJECT)) throw new Error('Unknown test project');
const ROOT = path.resolve(__dirname, '../示例代码', project);
const format = require(path.join(ROOT, 'miniprogram/utils/report-file'));
const lab = require(path.join(ROOT, 'miniprogram/utils/stats-lab-data'));
const { createHandler, readConfig } = require(path.join(ROOT, 'cloudfunctions/studyhubNotice/domain'));
const serverModule = require(path.join(ROOT, 'server/file-lab.cjs'));
const records = [], copy = x => JSON.parse(JSON.stringify(x));
async function test(name, work) { await work(); records.push(name); }
const deferred = () => { let resolve; const promise = new Promise(yes => { resolve = yes; }); return { promise, resolve }; };
function load(relative, mocks = {}, globals = {}) {
  if (['12-studyhub-performance', '13-studyhub-accessibility', '14-studyhub-testing', '15-studyhub-release'].includes(SUITE_PROJECT)) {
    relative = relative.replace(/^miniprogram\/pages\/(editor-lab|clock-lab|stats-lab|platform|quality-lab)\//, 'miniprogram/packageLab/pages/$1/');
    const aliases = {}; for (const [key, value] of Object.entries(mocks)) if (key.startsWith('../../')) aliases['../' + key] = value;
    mocks = { ...aliases, ...mocks };
  }
  // 第34章入口在新套件验证；继承流程使用显式允许的privacy替身。
  if (SUITE_PROJECT=== '15-studyhub-release' && relative === 'miniprogram/services/platform-api.js') mocks = { './privacy': { ensure: async () => ({}) }, ...mocks };
  const file = path.join(ROOT, relative), module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(file, 'utf8'), { module, exports: module.exports,
    require: name => name in mocks ? mocks[name] : require(name.startsWith('.') ? path.resolve(path.dirname(file), name) : name),
    wx: {}, console, ...globals }, { filename: file });
  return module.exports;
}
function fsFixture(options = {}) {
  const disk = new Map(), calls = [];
  const manager = {
    writeFile(o) { calls.push(['write', o.filePath]); if (options.writeFail) return o.fail({ errMsg: 'disk full' }); disk.set(o.filePath, o.data); o.success({}); },
    stat(o) { calls.push(['stat', o.path]); o.success({ stats: { isDirectory: () => !!options.directory, size: options.size === undefined ? Buffer.byteLength(disk.get(o.path) || '') : options.size } }); },
    readFile(o) { calls.push(['read', o.filePath]); o.success({ data: disk.get(o.filePath) }); },
    unlink(o) { calls.push(['unlink', o.filePath]); if (!disk.delete(o.filePath)) return o.fail({ errMsg: 'missing' }); o.success({}); }
  };
  const wxMock = { env: { USER_DATA_PATH: '/sandbox' }, getFileSystemManager: () => manager,
    chooseMessageFile(o) { calls.push(['choose', o.count, o.type, Array.from(o.extension)]); o.success({ tempFiles: [{ path: '/chosen/report.json' }] }); } };
  const api = load('miniprogram/services/platform-api.js', {}, { wx: wxMock });
  const files = load('miniprogram/services/report-files.js', { './platform-api': api }, { wx: wxMock });
  return { disk, calls, files, wxMock };
}
function transferFixture(config = { ENABLE_LOCAL_FILE_LAB: true, FILE_LAB_ORIGIN: 'http://127.0.0.1:8877' }) {
  const pending = [], calls = []; let progress, aborted = 0;
  const wxMock = { uploadFile(o) { pending.push(o); calls.push(o); return { onProgressUpdate(fn) { progress = fn; }, abort() { aborted++; o.fail({ errMsg: 'abort' }); } }; },
    downloadFile(o) { return this.uploadFile(o); } };
  const api = load('miniprogram/services/platform-api.js', {}, { wx: wxMock });
  const service = load('miniprogram/services/file-transfer.js', { './platform-api': api, '../config/platform': config }, { wx: wxMock });
  return { service, pending, calls, emit: value => progress(value), aborted: () => aborted };
}
const ENV = { NOTICE_ENABLED: 'true', STUDYHUB_APP_ID: 'wx-platform', NOTICE_TEMPLATE_ID: 'template_id_for_testing', NOTICE_THING_KEY: 'thing1', NOTICE_TIME_KEY: 'time2' };
function noticeFixture() {
  const db = new Map(), sent = []; let time = lab.asOf, context = { APPID: ENV.STUDYHUB_APP_ID, OPENID: 'A' }, tail = Promise.resolve();
  const store = { failBefore: 0, failAfter: 0, calls: 0,
    async get(id) { return db.has(id) ? copy(db.get(id)) : null; },
    async transaction(work) {
      const previous = tail; let release; tail = new Promise(yes => { release = yes; }); await previous;
      const draft = new Map([...db].map(([k, v]) => [k, copy(v)])); const number = ++store.calls;
      const tx = { async get(id) { return draft.has(id) ? copy(draft.get(id)) : null; }, async set(id, value) { draft.set(id, copy(value)); } };
      try {
        const result = await work(tx);
        if (store.failBefore === number) throw new Error('commit not done');
        db.clear(); for (const [k, v] of draft) db.set(k, v);
        if (store.failAfter === number) throw new Error('commit reply lost');
        return result;
      } finally { release(); }
    }
  };
  const config = readConfig(ENV), fixture = { config, db, sent, store, behavior: async () => ({ errCode: 0 }),
    user: value => { context = value; }, at: value => { time = value; } };
  fixture.handle = createHandler({ config, store, getContext: () => context, now: () => time,
    send: async payload => { sent.push(copy(payload)); return fixture.behavior(); }, logger: { error() {} } });
  fixture.prepare = async () => (await fixture.handle({ action: 'prepare' })).data;
  fixture.send = id => fixture.handle({ action: 'send', id });
  return fixture;
}
function pageFixture({ answer = 'accept', noticeSend, files = {}, apiCalls = [], clipboard = '' } = {}) {
  let definition; const templateId = ENV.NOTICE_TEMPLATE_ID, prepared = { enabled: true, id: 'a'.repeat(64), day: '2026-11-02', templateId, state: 'ready' };
  let sent = 0, clipboardReads = 0;
  const wxMock = { requestSubscribeMessage(o) { apiCalls.push('request'); o.success({ [templateId]: answer }); },
    getClipboardData(o) { clipboardReads++; o.success({ data: clipboard }); }, setClipboardData(o) { apiCalls.push(o.data); o.success({}); } };
  const api = load('miniprogram/services/platform-api.js', {}, { wx: wxMock });
  load('miniprogram/pages/platform/index.js', {
    '../../services/platform-api': api, '../../services/report-files': files,
    '../../services/stats-repository': { week: async () => lab.report() }, '../../services/file-transfer': {},
    '../../services/notice-repository': { prepare: async () => prepared, send: async id => { sent++; apiCalls.push('send'); return noticeSend ? noticeSend(id) : { ...prepared, state: 'sent' }; }, stateText: v => v.state || 'disabled' }
  }, { wx: wxMock, Page: value => { definition = value; } });
  const page = { ...definition, data: copy(definition.data), setData(value) { Object.assign(this.data, copy(value)); } };
  page.onLoad(); page._visible = true; page._notice = prepared; page.data.noticeReady = true;
  return { page, sent: () => sent, clipboardReads: () => clipboardReads };
}
function request(port, method, url, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: '127.0.0.1', port, method, path: url, headers }, res => {
      const chunks = []; res.on('data', x => chunks.push(x)); res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(chunks) }));
    }); req.on('error', reject); req.end(body);
  });
}
function multipart(text = serverModule.FIXED_TEXT, name = 'file') {
  const boundary = 'CourseBoundary_123';
  const body = Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${name}"; filename="week.json"\r\nContent-Type: application/json\r\n\r\n${text}\r\n--${boundary}--\r\n`);
  return { body, headers: { 'Content-Type': 'multipart/form-data; boundary=' + boundary } };
}
async function main() {
  await test('UTF-8 字节计数区分中文、ASCII 与代理对字符', async () => assert.equal(format.utf8Bytes('A学😀'), Buffer.byteLength('A学😀')));
  await test('报告文件序列化往返保持完整统计', async () => assert.deepEqual(format.unpack(format.pack(lab.report(), 'demo')).report, lab.report()));
  await test('导出显式挑选字段，不携带额外身份和私密调试字段', async () => { const r = lab.report(); r.ownerId = 'secret'; r.days[0].fileID = 'secret'; const text = format.pack(r, 'cloud'); assert.ok(!text.includes('secret')); });
  await test('JSON 损坏、未知版本和根字段被拒绝', async () => { assert.throws(() => format.unpack('{')); const v = JSON.parse(format.pack(lab.report(), 'demo')); v.version = 2; assert.throws(() => format.unpack(JSON.stringify(v))); v.version = 1; v.ownerId = 'A'; assert.throws(() => format.unpack(JSON.stringify(v))); });
  await test('报告合计或口径损坏拒绝，不当成零数据', async () => { const r = lab.report(); r.totals.totalSeconds++; assert.throws(() => format.pack(r, 'demo')); });
  await test('文件来源只是标签，允许外部文件但不能据此证明云端真实性', async () => { const text = format.pack(lab.report(), 'cloud'); assert.equal(format.unpack(text).source, 'cloud'); });
  await test('可读 UTF-8 BOM 但仍执行内容校验', async () => assert.equal(format.unpack('\uFEFF' + format.pack(lab.report(), 'demo')).report.totals.totalSeconds, 2310));
  await test('超大文本在 JSON.parse 前拒绝', async () => assert.throws(() => format.unpack('学'.repeat(12000))));
  await test('摘要明确数据来源、日期、精确秒数与结束日口径', async () => { const s = format.summary(lab.report(), 'demo'); for (const part of ['固定练习', '2310', 'UTC+08:00', '结束日']) assert.ok(s.includes(part)); });
  await test('能力存在性检查不触发剪贴板或订阅调用', async () => { let count = 0; const api = load('miniprogram/services/platform-api.js', {}, { wx: { getClipboardData() { count++; } } }); assert.ok(api.capabilities().find(x => x.name === 'getClipboardData').supported); assert.equal(count, 0); });
  await test('API 封装在能力不存在时受控拒绝', async () => { const api = load('miniprogram/services/platform-api.js'); await assert.rejects(api.call('missing'), { code: 'UNSUPPORTED' }); });
  await test('用户取消与同步接口异常可区分处理', async () => { const api = load('miniprogram/services/platform-api.js', {}, { wx: { cancel(o) { o.fail({ errMsg: 'choose:fail cancel' }); }, bad() { throw new Error('bad'); } } }); await assert.rejects(api.call('cancel'), { code: 'CANCELLED' }); await assert.rejects(api.call('bad'), { code: 'PLATFORM' }); });
  await test('固定文件槽可往返读取，UTF-8 字节数正确', async () => { const f = fsFixture(); const saved = await f.files.save(lab.report(), 'demo'); assert.equal(saved.filePath, '/sandbox/studyhub-week-demo.json'); assert.equal(saved.bytes, Buffer.byteLength(f.disk.get(saved.filePath))); assert.equal((await f.files.read(saved.filePath)).report.totals.totalSeconds, 2310); });
  await test('导出固定槽防止任意路径和无限生成文件', async () => { const f = fsFixture(); assert.throws(() => f.files.pathFor('../escape')); await f.files.save(lab.report(), 'demo'); await f.files.save(lab.report(), 'demo'); assert.equal(f.disk.size, 1); });
  await test('超大文件在 readFile 前通过 stat 阻断', async () => { const f = fsFixture({ size: 32769 }); await assert.rejects(f.files.read('/large'), { code: 'FILE_SIZE' }); assert.ok(!f.calls.some(x => x[0] === 'read')); });
  await test('目录不能被当作报告文件读取', async () => { const f = fsFixture({ directory: true }); await assert.rejects(f.files.read('/directory'), { code: 'FILE_SIZE' }); });
  await test('选文件限定单个 JSON，仍校验真实内容', async () => { const f = fsFixture(); f.disk.set('/chosen/report.json', format.pack(lab.report(), 'demo')); assert.equal((await f.files.choose()).report.totals.totalSeconds, 2310); assert.deepEqual(copy(f.calls[0]), ['choose', 1, 'file', ['json']]); f.disk.set('/chosen/report.json', 'not json'); await assert.rejects(f.files.choose()); });
  await test('写入失败不报告保存成功，清理只作用于课程槽', async () => { const f = fsFixture({ writeFail: true }); await assert.rejects(f.files.save(lab.report(), 'demo')); const g = fsFixture(); await g.files.save(lab.report(), 'demo'); await g.files.remove('demo'); assert.equal(g.disk.size, 0); await assert.rejects(g.files.remove('demo'), { code: 'FILE_CLEANUP' }); });
  await test('本地网络实验默认关闭，公开网络源被拒绝', async () => { assert.throws(() => transferFixture({}).service.origin()); assert.throws(() => transferFixture({ ENABLE_LOCAL_FILE_LAB: true, FILE_LAB_ORIGIN: 'https://example.com' }).service.origin()); assert.equal(transferFixture({ ENABLE_LOCAL_FILE_LAB: true, FILE_LAB_ORIGIN: 'http://192.168.1.8:8877' }).service.origin(), 'http://192.168.1.8:8877'); });
  await test('上传传递 filePath 与表单字段名，解析字符串响应', async () => { const f = transferFixture(); const op = f.service.upload('/sandbox/week.json'); assert.equal(f.calls[0].name, 'file'); assert.equal(f.calls[0].filePath, '/sandbox/week.json'); f.pending[0].success({ statusCode: 200, data: JSON.stringify({ ok: true, id: 'a'.repeat(32) }) }); assert.equal((await op.promise).id, 'a'.repeat(32)); });
  await test('HTTP 错误即使触发 success 也拒绝上传', async () => { const f = transferFixture(); const op = f.service.upload('/x'); f.pending[0].success({ statusCode: 413, data: '{}' }); await assert.rejects(op.promise, { code: 'HTTP' }); });
  await test('上传响应非 JSON 或非法编号被拒绝', async () => { for (const data of ['html', '{"ok":true,"id":"../secret"}']) { const f = transferFixture(); const op = f.service.upload('/x'); f.pending[0].success({ statusCode: 200, data }); await assert.rejects(op.promise, { code: 'PROTOCOL' }); } });
  await test('传输进度有界且终态后不再更新', async () => { const f = transferFixture(), values = []; const op = f.service.upload('/x', x => values.push(x)); f.emit({ progress: 109.3 }); f.emit({ progress: -2 }); f.pending[0].success({ statusCode: 200, data: JSON.stringify({ ok: true, id: 'a'.repeat(32) }) }); await op.promise; f.emit({ progress: 60 }); assert.deepEqual(values, [100, 0]); });
  await test('中止转入取消状态，不自动重试上传', async () => { const f = transferFixture(); const op = f.service.upload('/x'); op.abort(); await assert.rejects(op.promise, { code: 'CANCELLED' }); assert.equal(f.aborted(), 1); assert.equal(f.calls.length, 1); });
  await test('下载只接收固定编号，检查 HTTP 与临时路径', async () => { const f = transferFixture(); assert.throws(() => f.service.download('../escape')); const op = f.service.download('b'.repeat(32)); assert.ok(f.calls[0].url.endsWith('/files/' + 'b'.repeat(32))); f.pending[0].success({ statusCode: 200, tempFilePath: '/temp/week.json' }); assert.equal(await op.promise, '/temp/week.json'); });
  let now = 1000; const server = serverModule.createServer({ now: () => now });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); const port = server.address().port;
  const upload = async (text, name) => { const m = multipart(text, name); return request(port, 'POST', '/upload', m.body, m.headers); };
  try {
    await test('真实回环 HTTP 上传并下载得到相同 UTF-8 文件', async () => { const result = await upload(); assert.equal(result.status, 200); const id = JSON.parse(result.body).id; const down = await request(port, 'GET', '/files/' + id); assert.equal(down.status, 200); assert.equal(down.body.toString('utf8'), serverModule.FIXED_TEXT); });
    await test('本地服务拒绝私人或修改内容，即使 JSON 合法', async () => { assert.equal((await upload(format.pack(lab.report(), 'cloud'))).status, 400); assert.equal((await upload(serverModule.FIXED_TEXT + ' ')).status, 400); });
    await test('multipart 字段名与完整边界必须符合约定', async () => { assert.equal((await upload(undefined, 'avatar')).status, 400); assert.equal((await request(port, 'POST', '/upload', 'bad', { 'Content-Type': 'application/json' })).status, 400); });
    await test('过大 HTTP 请求返回 413，不接受任意二进制上传', async () => assert.equal((await request(port, 'POST', '/upload', Buffer.alloc(65537), { 'Content-Type': 'application/octet-stream' })).status, 413));
    await test('不存在编号、路径穿越和未知路由返回 404', async () => { for (const url of ['/files/' + 'f'.repeat(32), '/files/../secret', '/unknown']) assert.equal((await request(port, 'GET', url)).status, 404); });
    await test('下载编号十分钟过期，重启不具备持久文件语义', async () => { const id = JSON.parse((await upload()).body).id; now += serverModule.TTL; assert.equal((await request(port, 'GET', '/files/' + id)).status, 404); });
    await test('本地匿名内存存储达到二十份后拒绝新上传', async () => { for (let i = 0; i < 20; i++) assert.equal((await upload()).status, 200); assert.equal((await upload()).status, 429); });
  } finally { await new Promise(resolve => server.close(resolve)); }
  await test('分享卡片固定公开路径和封面，不使用当前页私人截图', async () => { const share = require(path.join(ROOT, 'miniprogram/utils/public-share')); const card = share.card({ ownerId: 'SECRET' }); assert.equal(card.path, '/pages/public-lab/index?demo=normal'); assert.ok(!JSON.stringify(card).includes('SECRET')); assert.equal(card.imageUrl, '/assets/public-study-card.png'); const png = fs.readFileSync(path.join(ROOT, 'miniprogram', card.imageUrl)); assert.equal(png.subarray(1, 4).toString(), 'PNG'); assert.equal(png.readUInt32BE(16), 600); assert.equal(png.readUInt32BE(20), 480); });
  await test('公开页忽略分享 query，只展示固定教学数据', async () => { let def; load('miniprogram/pages/public-lab/index.js', {}, { Page: value => { def = value; } }); const p = { data: copy(def.data), setData(x) { Object.assign(this.data, x); } }; def.onLoad.call(p, { ownerId: 'B', report: 'fake' }); assert.equal(p.data.report.totals.totalSeconds, 2310); });
  await test('订阅配置默认关闭，不匹配的模板字段不能启用', async () => { assert.equal(readConfig({}).enabled, false); assert.equal(readConfig({ ...ENV, NOTICE_TIME_KEY: 'thing2' }).enabled, false); assert.equal(readConfig(ENV).enabled, true); });
  await test('匿名和错误 AppID 无法准备或发送消息', async () => { const f = noticeFixture(); f.user({}); assert.equal((await f.handle({ action: 'prepare' })).error.code, 'UNAUTHENTICATED'); f.user({ APPID: 'wrong', OPENID: 'A' }); assert.equal((await f.handle({ action: 'prepare' })).error.code, 'UNAUTHENTICATED'); });
  await test('消息请求不能指定接收人、模板、内容或伪造 consent', async () => { const f = noticeFixture(); for (const extra of [{ touser: 'B' }, { templateId: 'other' }, { data: {} }, { accept: true }]) assert.equal((await f.handle({ action: 'send', id: 'x', ...extra })).error.code, 'INVALID_INPUT'); });
  await test('准备状态只读取，不创建发送记录也不调用 OpenAPI', async () => { const f = noticeFixture(); const p = await f.prepare(); assert.equal(p.state, 'ready'); assert.equal(f.db.size, 0); assert.equal(f.sent.length, 0); });
  await test('配置关闭时返回可解释状态，不触发数据库和发送', async () => { const f = noticeFixture(); f.config.enabled = false; assert.equal((await f.prepare()).enabled, false); assert.equal(f.db.size, 0); assert.equal(f.sent.length, 0); });
  await test('发送目标来自可信上下文，模板内容和跳转由服务端生成', async () => { const f = noticeFixture(); const p = await f.prepare(); assert.equal((await f.send(p.id)).data.state, 'sent'); const s = f.sent[0]; assert.equal(s.touser, 'A'); assert.equal(s.templateId, ENV.NOTICE_TEMPLATE_ID); assert.equal(s.data.thing1.value, '平台能力练习已完成'); assert.equal(s.data.time2.value, '2026-11-02 12:00:00'); assert.equal(s.miniprogramState, 'developer'); });
  await test('同日重复发送返回已有状态，不再次调用平台', async () => { const f = noticeFixture(); const p = await f.prepare(); await f.send(p.id); await f.send(p.id); assert.equal(f.sent.length, 1); assert.equal((await f.prepare()).state, 'sent'); });
  await test('串行内存事务下并发调用只取得一次发送资格', async () => { const f = noticeFixture(); const p = await f.prepare(); await Promise.all([f.send(p.id), f.send(p.id)]); assert.equal(f.sent.length, 1); });
  await test('另一用户无法使用前一用户的发送编号', async () => { const f = noticeFixture(); const p = await f.prepare(); f.user({ APPID: ENV.STUDYHUB_APP_ID, OPENID: 'B' }); assert.equal((await f.send(p.id)).error.code, 'EXPIRED'); assert.equal(f.sent.length, 0); });
  await test('跨统计日编号过期，新日可取得新编号', async () => { const f = noticeFixture(); const p = await f.prepare(); f.at(lab.asOf + 86400000); assert.equal((await f.send(p.id)).error.code, 'EXPIRED'); assert.notEqual((await f.prepare()).id, p.id); });
  await test('平台明确非零错误进入 failed，本日不自动再尝试', async () => { const f = noticeFixture(); f.behavior = async () => ({ errCode: 43101 }); const p = await f.prepare(); assert.equal((await f.send(p.id)).data.state, 'failed'); await f.send(p.id); assert.equal(f.sent.length, 1); });
  await test('SDK 携带明确平台错误码的异常记录为 failed', async () => { const f = noticeFixture(); f.behavior = async () => { throw Object.assign(new Error('denied'), { errCode: 40003 }); }; const p = await f.prepare(); assert.equal((await f.send(p.id)).data.state, 'failed'); });
  await test('发送超时或无确认响应进入 unknown，不能按没发出去重试', async () => { for (const behavior of [async () => { throw new Error('timeout'); }, async () => ({})]) { const f = noticeFixture(); f.behavior = behavior; const p = await f.prepare(); assert.equal((await f.send(p.id)).data.state, 'unknown'); await f.send(p.id); assert.equal(f.sent.length, 1); } });
  await test('占位事务提交前失败时不调用平台', async () => { const f = noticeFixture(); f.store.failBefore = 1; const p = await f.prepare(); assert.equal((await f.send(p.id)).ok, false); assert.equal(f.sent.length, 0); });
  await test('占位提交响应丢失时保留 sending，重新核对不再发送', async () => { const f = noticeFixture(); f.store.failAfter = 1; const p = await f.prepare(); assert.equal((await f.send(p.id)).ok, false); assert.equal((await f.prepare()).state, 'sending'); await f.send(p.id); assert.equal(f.sent.length, 0); });
  await test('平台接受后状态写入失败返回未知，已有占位阻止第二次发送', async () => { const f = noticeFixture(); f.store.failBefore = 2; const p = await f.prepare(); assert.equal((await f.send(p.id)).data.state, 'unknown'); await f.send(p.id); assert.equal(f.sent.length, 1); });
  await test('同日修改模板不会绕过一次尝试边界', async () => { const f = noticeFixture(); const p = await f.prepare(); await f.send(p.id); f.config.templateId = 'another_template_test'; const next = await f.prepare(); assert.equal(next.id, p.id); assert.equal(next.state, 'sent'); });
  await test('授权请求在点击处理内同步发起，accept 后才调用发送', async () => { const events = [], f = pageFixture({ apiCalls: events }); const promise = f.page.onNotice(); assert.deepEqual(events, ['request']); await promise; assert.deepEqual(events, ['request', 'send']); });
  await test('reject、ban、filter 与未知授权结果均不发送', async () => { for (const answer of ['reject', 'ban', 'filter', 'unexpected']) { const f = pageFixture({ answer }); await f.page.onNotice(); assert.equal(f.sent(), 0); } });
  await test('重复点击授权按钮被忙碌锁拦截', async () => { const d = deferred(), f = pageFixture({ noticeSend: () => d.promise }); const a = f.page.onNotice(); await Promise.resolve(); const b = f.page.onNotice(); assert.equal(b, undefined); d.resolve({ state: 'sent' }); await a; assert.equal(f.sent(), 1); });
  await test('页面卸载后迟到发送结果不更新界面', async () => { const d = deferred(), f = pageFixture({ noticeSend: () => d.promise }); const pending = f.page.onNotice(); await Promise.resolve(); f.page.onUnload(); const before = JSON.stringify(f.page.data); d.resolve({ state: 'sent' }); await pending; assert.equal(JSON.stringify(f.page.data), before); });
  await test('页面初始化不读取剪贴板，用户点击才读取并限制预览', async () => { const f = pageFixture({ clipboard: '学'.repeat(300) }); assert.equal(f.clipboardReads(), 0); await f.page.onPaste(); assert.equal(f.clipboardReads(), 1); assert.equal(f.page.data.clipboardPreview.length, 200); });
  await test('复制使用明确摘要，取消选择文件保持原报告', async () => { const events = [], f = pageFixture({ apiCalls: events, files: { choose: async () => { throw Object.assign(new Error('cancel'), { code: 'CANCELLED' }); } } }); await f.page.onCopy(); assert.ok(events[0].includes('2310')); const before = JSON.stringify(f.page.data.report); await f.page.onChoose(); assert.equal(JSON.stringify(f.page.data.report), before); assert.ok(f.page.data.message.includes('已取消')); });
  await test('隐藏页面会中止传输，消息配置迟到响应失效', async () => { const f = pageFixture(); let aborted = 0; f.page._transfer = { abort() { aborted++; } }; const pending = f.page.refreshNotice(); f.page.onHide(); await pending; assert.equal(aborted, 1); assert.equal(f.page.data.noticeReady, false); });
  await test('新增消息集合单独列出且禁止客户端直连，OpenAPI 权限仅声明发送', async () => { const plan = JSON.parse(fs.readFileSync(path.join(ROOT, 'database/notice-plan.json'))); assert.deepEqual(plan.additionalCollections, ['studyhub_notice_attempts']); assert.equal(plan.clientPermissions.read, false); assert.equal(plan.clientPermissions.write, false); assert.deepEqual(JSON.parse(fs.readFileSync(path.join(ROOT, 'cloudfunctions/studyhubNotice/config.json'))).permissions.openapi, ['subscribeMessage.send']); });
  const inherited = JSON.parse(fs.readFileSync(path.join(__dirname, SUITE_PROJECT=== '10-studyhub-platform' ? '第九阶段统计继承测试结果.json' : SUITE_PROJECT=== '11-studyhub-quality' ? '第十阶段统计继承测试结果.json' : (['13-studyhub-accessibility','14-studyhub-testing', '15-studyhub-release'].includes(SUITE_PROJECT) ? (['14-studyhub-testing','15-studyhub-release'].includes(SUITE_PROJECT) ? (SUITE_PROJECT=== '15-studyhub-release' ? (project==='16-studyhub-operations'?'第十五阶段统计继承测试结果.json':'第十四阶段统计继承测试结果.json') : '第十三阶段统计继承测试结果.json') : '第十二阶段统计继承测试结果.json') : '第十一阶段统计继承测试结果.json'))));
  assert.equal(inherited.project, project); assert.equal(inherited.totalPassed, 239);
  const result = { date: '2026-11-02', project, passed: records.length, inheritedPassed: 239,
    totalPassed: records.length + 239, realCloud: false, realWechat: false, loopbackHttp: true, scenarios: records };
  fs.writeFileSync(path.join(__dirname, SUITE_PROJECT=== '10-studyhub-platform' ? '第九阶段测试结果.json' : SUITE_PROJECT=== '11-studyhub-quality' ? '第十阶段平台继承测试结果.json' : (['13-studyhub-accessibility','14-studyhub-testing', '15-studyhub-release'].includes(SUITE_PROJECT) ? (['14-studyhub-testing','15-studyhub-release'].includes(SUITE_PROJECT) ? (SUITE_PROJECT=== '15-studyhub-release' ? (project==='16-studyhub-operations'?'第十五阶段平台继承测试结果.json':'第十四阶段平台继承测试结果.json') : '第十三阶段平台继承测试结果.json') : '第十二阶段平台继承测试结果.json') : '第十一阶段平台继承测试结果.json')), JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify({ passed: result.passed, inheritedPassed: 239, totalPassed: result.totalPassed, realCloud: false, loopbackHttp: true }));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
