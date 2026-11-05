// 模拟逻辑与生命周期，不能替代微信编译、原生事件派发和真机。
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ROOT = path.resolve(__dirname, '../示例代码/03-studyhub-v02');
const clone = value => JSON.parse(JSON.stringify(value));

function environment() {
  const memory = new Map();
  const cache = new Map();
  const timers = new Map();
  let time = 1800000000000;
  let sequence = 0;
  let definition;
  const env = { memory, timers, failRead: false, failWrite: false, stackSize: 2, routes: [], events: [] };
  class TestDate extends Date { static now() { return time; } }
  const context = vm.createContext({
    Date: TestDate,
    console: { log() {}, error() {} },
    setInterval(fn) { const id = ++sequence; timers.set(id, fn); return id; },
    clearInterval(id) { timers.delete(id); },
    Page(value) { definition = value; },
    Component(value) { definition = value; },
    Behavior(value) { return value; },
    getCurrentPages() { return Array.from({ length: env.stackSize }, () => ({})); },
    wx: {
      getStorageSync(key) {
        if (env.failRead) throw new Error('simulated read failure');
        return memory.has(key) ? clone(memory.get(key)) : '';
      },
      setStorageSync(key, value) {
        if (env.failWrite) throw new Error('simulated write failure');
        memory.set(key, clone(value));
      },
      showToast(options) { env.toast = options; },
      showModal(options) { env.modal = options; },
      navigateTo(options) { env.routes.push({ type: 'navigateTo', url: options.url }); },
      navigateBack(options) { env.routes.push({ type: 'navigateBack', delta: options.delta }); },
      switchTab(options) { env.routes.push({ type: 'switchTab', url: options.url }); }
    }
  });
  function load(relative, from = ROOT) {
    let file = path.resolve(from, relative);
    if (!path.extname(file)) file += '.js';
    assert.ok(file.startsWith(ROOT + path.sep));
    if (cache.has(file)) return cache.get(file).exports;
    const module = { exports: {} };
    cache.set(file, module);
    const script = new vm.Script('(function(require,module,exports){\n' + fs.readFileSync(file, 'utf8') + '\n})', { filename: file });
    script.runInContext(context)(name => load(name, path.dirname(file)), module, module.exports);
    return module.exports;
  }
  env.load = load;
  env.advance = (milliseconds, run = true) => {
    time += milliseconds;
    if (run) for (const fn of [...timers.values()]) fn();
  };
  env.instance = (relative, properties = {}) => {
    const file = path.resolve(ROOT, relative);
    cache.delete(file);
    load(relative);
    const def = definition;
    const behaviors = def.behaviors || [];
    const data = clone(def.data || {});
    for (const [key, value] of Object.entries(def.properties || {})) data[key] = clone(value.value);
    Object.assign(data, properties);
    const instance = { data, properties: data, events: [], definition: def };
    instance.setData = patch => Object.assign(data, clone(patch));
    instance.triggerEvent = (name, detail) => instance.events.push({ name, detail: clone(detail) });
    const methods = Object.assign({}, ...behaviors.map(item => item.methods || {}), def.methods || def);
    for (const [key, value] of Object.entries(methods)) if (typeof value === 'function') instance[key] = value.bind(instance);
    instance.hook = name => {
      for (const item of [...behaviors, def]) if (item.lifetimes && item.lifetimes[name]) item.lifetimes[name].call(instance);
    };
    instance.pageHook = name => { if (def.pageLifetimes && def.pageLifetimes[name]) def.pageLifetimes[name].call(instance); };
    return instance;
  };
  return env;
}

const fields = (title, extra = {}) => ({ title, description: '', category: 'general', priority: 'normal', dueDate: '', done: false, ...extra });
const legacy = [{ id: 'old_1', title: '旧任务', done: true, createdAt: 100 }];
const input = value => ({ detail: { value } });
const eventId = id => ({ detail: { id } });
const form = (title, description = '', done = false) => ({ detail: { value: { title, description, done } } });
let count = 0;
function check(name, fn) { fn(); count += 1; console.log('PASS ' + String(count).padStart(2, '0') + ' ' + name); }

check('date validation checks real calendar dates and the documented range', () => {
  const utils = environment().load('utils/task.js');
  for (const value of ['', '2024-02-29', '2099-12-31']) assert.equal(utils.isValidDate(value), true);
  for (const value of ['2025-02-29', '2026-13-01', '1999-12-31', '2026-1-1', null]) assert.equal(utils.isValidDate(value), false);
});
check('form validation rejects invalid enums, types, and lengths', () => {
  const { validateFields } = environment().load('utils/task.js');
  assert.equal(validateFields(fields('合法')), '');
  for (const value of [fields(' '), fields('a'.repeat(41)), fields('a', { category: 'unknown' }),
    fields('a', { priority: 'urgent' }), fields('a', { done: 'false' }), fields('a', { description: 'x'.repeat(1001) })]) {
    assert.notEqual(validateFields(value), '');
  }
});
check('migration preserves old data and supplies new defaults', () => {
  const env = environment();
  const { STORAGE_KEY, LEGACY_KEY } = env.load('constants/index.js');
  env.memory.set(LEGACY_KEY, clone(legacy));
  const tasks = env.load('services/task-repository.js').listTasks();
  assert.deepEqual(clone(tasks[0]), { ...legacy[0], updatedAt: 100, description: '', category: 'general', priority: 'normal', dueDate: '' });
  assert.deepEqual(env.memory.get(LEGACY_KEY), legacy);
  assert.equal(env.memory.get(STORAGE_KEY).schemaVersion, 2);
});
check('failed migration write leaves the old key intact and no new result', () => {
  const env = environment();
  const keys = env.load('constants/index.js');
  env.memory.set(keys.LEGACY_KEY, clone(legacy));
  env.failWrite = true;
  assert.throws(() => env.load('services/task-repository.js').listTasks());
  assert.deepEqual(env.memory.get(keys.LEGACY_KEY), legacy);
  assert.equal(env.memory.has(keys.STORAGE_KEY), false);
});
check('invalid v2 data never silently falls back to the older copy', () => {
  const env = environment();
  const keys = env.load('constants/index.js');
  env.memory.set(keys.LEGACY_KEY, clone(legacy));
  env.memory.set(keys.STORAGE_KEY, { bad: true });
  assert.throws(() => env.load('services/task-repository.js').listTasks());
  assert.deepEqual(env.memory.get(keys.STORAGE_KEY), { bad: true });
});
check('duplicate legacy ids fail migration without overwriting the source', () => {
  const env = environment();
  const keys = env.load('constants/index.js');
  env.memory.set(keys.LEGACY_KEY, [legacy[0], legacy[0]]);
  assert.throws(() => env.load('services/task-repository.js').listTasks());
  assert.equal(env.memory.has(keys.STORAGE_KEY), false);
});
check('create and edit trim text and preserve identity and created time', () => {
  const env = environment();
  const repo = env.load('services/task-repository.js');
  const first = repo.saveTask('', fields(' 新任务 ', { description: ' 备注 ' }));
  env.advance(1000);
  const edited = repo.saveTask(first.id, fields('修改后', { done: true }));
  assert.equal(first.title, '新任务');
  assert.equal(first.description, '备注');
  assert.equal(edited.id, first.id);
  assert.equal(edited.createdAt, first.createdAt);
  assert.equal(edited.updatedAt, first.createdAt + 1000);
  assert.equal(edited.done, true);
});
check('repository returns copies, not mutable shared state', () => {
  const repo = environment().load('services/task-repository.js');
  const saved = repo.saveTask('', fields('原值'));
  saved.title = '外部篡改';
  const list = repo.listTasks();
  list[0].title = '又改一次';
  assert.equal(repo.listTasks()[0].title, '原值');
});
check('editing a deleted record fails instead of resurrecting it', () => {
  const repo = environment().load('services/task-repository.js');
  const saved = repo.saveTask('', fields('任务'));
  repo.removeTask(saved.id);
  assert.throws(() => repo.saveTask(saved.id, fields('不应重建')));
  assert.equal(repo.listTasks().length, 0);
});
check('mutation rereads latest data and retains other additions', () => {
  const repo = environment().load('services/task-repository.js');
  const one = repo.saveTask('', fields('一'));
  repo.saveTask('', fields('二'));
  repo.toggleTask(one.id);
  assert.equal(repo.listTasks().length, 2);
  assert.equal(repo.getTask(one.id).done, true);
});
check('write failures preserve the previous persisted state', () => {
  const env = environment();
  const repo = env.load('services/task-repository.js');
  const one = repo.saveTask('', fields('原值'));
  env.failWrite = true;
  assert.throws(() => repo.saveTask(one.id, fields('失败修改')));
  assert.throws(() => repo.toggleTask(one.id));
  assert.throws(() => repo.removeTask(one.id));
  assert.equal(repo.getTask(one.id).title, '原值');
  assert.equal(repo.getTask(one.id).done, false);
});
check('business task limit permits editing but rejects new records', () => {
  const env = environment();
  const key = env.load('constants/index.js').STORAGE_KEY;
  env.memory.set(key, { schemaVersion: 2, tasks: Array.from({ length: 200 }, (_, index) => ({
    ...fields('任务'), id: 'limit_' + index, createdAt: 1, updatedAt: 1
  })) });
  const repo = env.load('services/task-repository.js');
  assert.throws(() => repo.saveTask('', fields('第 201 条')));
  repo.saveTask('limit_0', fields('修改合法'));
  assert.equal(repo.listTasks().length, 200);
});
check('query parsing distinguishes new, invalid, and required identifiers', () => {
  const nav = environment().load('services/navigation.js');
  assert.equal(nav.readId({}, false), '');
  assert.equal(nav.readId({ id: 'task_1' }, true), 'task_1');
  assert.throws(() => nav.readId({}, true));
  assert.throws(() => nav.readId({ id: '' }, false));
  assert.throws(() => nav.readId({ id: '../bad' }, true));
});
check('routes use navigateTo for normal pages and switchTab for tab pages', () => {
  const env = environment();
  const nav = env.load('services/navigation.js');
  nav.openDetail('task_1'); nav.openEditor(); nav.goToList();
  assert.deepEqual(env.routes.map(item => item.type), ['navigateTo', 'navigateTo', 'switchTab']);
  assert.equal(env.routes[0].url, '/pages/detail/index?id=task_1');
});
check('return falls back to the list when directly launched', () => {
  const env = environment();
  const nav = env.load('services/navigation.js');
  env.stackSize = 1; nav.backOrList();
  env.stackSize = 2; nav.backOrList();
  assert.equal(env.routes[0].type, 'switchTab');
  assert.equal(env.routes[1].type, 'navigateBack');
});
check('list refreshes on show while preserving search and filters', () => {
  const env = environment();
  const repo = env.load('services/task-repository.js');
  const saved = repo.saveTask('', fields('学习 WXML', { category: 'syntax' }));
  const page = env.instance('pages/tasks/index.js'); page.onShow();
  page.onKeywordInput(input('wxml'));
  page.onCategory(input('2'));
  assert.equal(page.data.visibleTasks.length, 1);
  repo.saveTask(saved.id, fields('修改后', { category: 'syntax' }));
  page.onShow();
  assert.equal(page.data.keyword, 'wxml');
  assert.equal(page.data.visibleTasks.length, 0);
  assert.equal(page.data.total, 1);
});
check('list toggle uses custom event detail id', () => {
  const env = environment();
  const repo = env.load('services/task-repository.js');
  const saved = repo.saveTask('', fields('任务'));
  const page = env.instance('pages/tasks/index.js'); page.onShow();
  page.onToggleTask(eventId(saved.id));
  assert.equal(page.data.completed, 1);
});
check('read failure gives list error state and disables normal content', () => {
  const env = environment(); env.failRead = true;
  const page = env.instance('pages/tasks/index.js'); page.onShow();
  assert.equal(page.data.status, 'error');
  assert.equal(page.data.tasks.length, 0);
});
check('detail reloads edited record on returning to show', () => {
  const env = environment();
  const repo = env.load('services/task-repository.js');
  const saved = repo.saveTask('', fields('原题'));
  const page = env.instance('pages/detail/index.js'); page.onLoad({ id: saved.id }); page.onShow();
  repo.saveTask(saved.id, fields('新题'));
  page.onShow();
  assert.equal(page.data.task.title, '新题');
});
check('missing and invalid detail routes produce explicit states', () => {
  const env = environment();
  const missing = env.instance('pages/detail/index.js'); missing.onLoad({ id: 'no_such_task' }); missing.onShow();
  assert.equal(missing.data.status, 'missing');
  const invalid = env.instance('pages/detail/index.js'); invalid.onLoad({}); invalid.onShow();
  assert.equal(invalid.data.status, 'error');
});
check('editor pre-fills fields once and rejects nonexistent targets', () => {
  const env = environment();
  const saved = env.load('services/task-repository.js').saveTask('', fields('任务', { category: 'layout', priority: 'high' }));
  const editor = env.instance('pages/editor/index.js'); editor.onLoad({ id: saved.id });
  assert.equal(editor.data.categoryIndex, 2);
  assert.equal(editor.data.priorityIndex, 2);
  const missing = env.instance('pages/editor/index.js'); missing.onLoad({ id: 'missing' });
  assert.equal(missing.data.blocked, true);
});
check('successful form submission saves once and navigates back', () => {
  const env = environment();
  const editor = env.instance('pages/editor/index.js'); editor.onLoad({});
  editor.onSubmit(form('新任务', '备注', true));
  editor.onSubmit(form('重复事件'));
  const tasks = env.load('services/task-repository.js').listTasks();
  assert.equal(tasks.length, 1);
  assert.equal(tasks[0].done, true);
  assert.equal(editor.data.saved, true);
  assert.equal(env.routes[0].type, 'navigateBack');
});
check('failed form submission retains draft and releases submitting state', () => {
  const env = environment();
  const editor = env.instance('pages/editor/index.js'); editor.onLoad({});
  editor.onTextInput({ currentTarget: { dataset: { field: 'title' } }, detail: { value: '保留草稿' } });
  env.failWrite = true; editor.onSubmit(form('保留草稿'));
  assert.equal(editor.data.title, '保留草稿');
  assert.equal(editor.data.saving, false);
  assert.equal(editor.data.saved, false);
  assert.ok(editor.data.formError);
  assert.equal(env.routes.length, 0);
});
check('picker normalizes string index and ignores out-of-range input', () => {
  const env = environment();
  const editor = env.instance('pages/editor/index.js'); editor.onLoad({});
  editor.onPriority(input('2')); assert.equal(editor.data.priorityIndex, 2);
  editor.onPriority(input('999')); assert.equal(editor.data.priorityIndex, 2);
});
check('task card requests actions without changing parent-owned data', () => {
  const env = environment();
  const task = { ...fields('任务'), id: 'a', createdAt: 1, updatedAt: 1 };
  const card = env.instance('components/task-card/index.js', { task });
  card.onToggle(); card.onOpen();
  assert.deepEqual(card.events, [{ name: 'toggle', detail: { id: 'a' } }, { name: 'open', detail: { id: 'a' } }]);
  assert.equal(card.data.task.done, false);
  card.data.disabled = true; card.onToggle(); assert.equal(card.events.length, 2);
});
check('task observer computes metadata without a self-triggering dependency', () => {
  const env = environment();
  const card = env.instance('components/task-card/index.js');
  card.definition.observers.task.call(card, fields('任务', { category: 'layout', priority: 'high', dueDate: '2026-10-28' }));
  assert.ok(card.data.meta.includes('页面布局'));
  assert.ok(card.data.meta.includes('2026-10-28'));
});
check('timer start is idempotent and pause releases the interval', () => {
  const env = environment();
  const timer = env.instance('components/demo-countdown/index.js', { duration: 10 }); timer.hook('attached');
  timer.onStart(); timer.onStart(); assert.equal(env.timers.size, 1);
  env.advance(3000); assert.equal(timer.data.remaining, 7);
  timer.onPause(); assert.equal(env.timers.size, 0);
  env.advance(5000); assert.equal(timer.data.remaining, 7);
});
check('hidden timer stops polling and reconciles by deadline on show', () => {
  const env = environment();
  const timer = env.instance('components/demo-countdown/index.js'); timer.hook('attached'); timer.onStart();
  timer.pageHook('hide'); assert.equal(env.timers.size, 0);
  env.advance(4000); timer.pageHook('show');
  assert.equal(timer.data.remaining, 6); assert.equal(env.timers.size, 1);
});
check('expiry while hidden emits finish exactly once when shown', () => {
  const env = environment();
  const timer = env.instance('components/demo-countdown/index.js'); timer.hook('attached'); timer.onStart(); timer.pageHook('hide');
  env.advance(15000); timer.pageHook('show'); timer.pageHook('show');
  assert.equal(timer.data.remaining, 0); assert.equal(timer.events.length, 1); assert.equal(env.timers.size, 0);
});
check('detaching runs behavior cleanup and prevents later view updates', () => {
  const env = environment();
  const timer = env.instance('components/demo-countdown/index.js'); timer.hook('attached'); timer.onStart(); timer.hook('detached');
  assert.equal(env.timers.size, 0); assert.equal(timer._alive, false);
  const before = timer.data.remaining; env.advance(15000); timer.syncClock(); assert.equal(timer.data.remaining, before);
});
check('duration observer resets the component and clears old scheduling', () => {
  const env = environment();
  const timer = env.instance('components/demo-countdown/index.js'); timer.hook('attached'); timer.onStart();
  timer.data.duration = 20; timer.definition.observers.duration.call(timer, 20);
  assert.equal(timer.data.remaining, 20); assert.equal(timer.data.running, false); assert.equal(env.timers.size, 0);
});
check('multiple timer instances keep independent resources', () => {
  const env = environment();
  const first = env.instance('components/demo-countdown/index.js', { duration: 10 }); first.hook('attached'); first.onStart();
  const second = env.instance('components/demo-countdown/index.js', { duration: 20 }); second.hook('attached'); second.onStart();
  first.hook('detached'); assert.equal(env.timers.size, 1); env.advance(3000); assert.equal(second.data.remaining, 17);
});
check('overview summaries refresh on each page show', () => {
  const env = environment(); const repo = env.load('services/task-repository.js');
  const overview = env.instance('pages/overview/index.js'); overview.onShow(); assert.equal(overview.data.total, 0);
  repo.saveTask('', fields('完成项', { done: true })); overview.onShow(); assert.equal(overview.data.completed, 1);
});

console.log('\nAll ' + count + ' v0.2 logic scenarios passed. Native routing, WXML, and device lifecycle require WeChat verification.');
