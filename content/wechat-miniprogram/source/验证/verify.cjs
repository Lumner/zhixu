// 维护者验证：Node.js 中模拟少量 wx/Page 能力，只验证逻辑，不代替微信编译和真机。
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const appRoot = path.join(root, '示例代码', '02-study-board');
const logic = require(path.join(appRoot, 'utils', 'task.js'));
const storage = require(path.join(appRoot, 'services', 'storage.js'));
const clone = value => JSON.parse(JSON.stringify(value));
const memory = new Map();
let failRead = false;
let failWrite = false;
let pendingModal;
let toast;
const mockWx = {
  getStorageSync(key) {
    if (failRead) throw new Error('simulated read failure');
    return memory.has(key) ? clone(memory.get(key)) : '';
  },
  setStorageSync(key, value) {
    if (failWrite) throw new Error('simulated write failure');
    memory.set(key, clone(value));
  },
  showToast(options) { toast = options; },
  showModal(options) { pendingModal = options; },
  pageScrollTo() {}
};
global.wx = mockWx;

function loadPage(file) {
  let definition;
  const { createRequire } = require('node:module');
  vm.runInNewContext(fs.readFileSync(file, 'utf8'), {
    require: createRequire(file),
    Page(value) { definition = value; },
    wx: mockWx,
    console: { log() {}, error() {} }
  }, { filename: file });
  const page = { data: clone(definition.data) };
  page.setData = patch => Object.assign(page.data, clone(patch));
  for (const [key, value] of Object.entries(definition)) {
    if (typeof value === 'function') page[key] = value.bind(page);
  }
  if (page.onLoad) page.onLoad();
  return page;
}

const pageFile = path.join(appRoot, 'pages', 'index', 'index.js');
const input = value => ({ detail: { value } });
const byId = id => ({ currentTarget: { dataset: { id } } });
const byFilter = filter => ({ currentTarget: { dataset: { filter } } });
let count = 0;
function check(name, fn) {
  fn();
  count += 1;
  console.log('PASS ' + String(count).padStart(2, '0') + ' ' + name);
}

check('counter increments and resets', () => {
  const counter = loadPage(path.join(root, '示例代码', '01-hello-counter', 'pages', 'index', 'index.js'));
  counter.onIncrease();
  counter.onIncrease();
  assert.equal(counter.data.count, 2);
  counter.onReset();
  assert.equal(counter.data.count, 0);
});

let page = loadPage(pageFile);
check('first run has an empty writable board', () => {
  assert.equal(page.data.total, 0);
  assert.equal(page.data.storageError, false);
});
check('blank title is rejected without clearing draft', () => {
  page.onDraftInput(input('   '));
  page.onSave();
  assert.equal(page.data.total, 0);
  assert.equal(page.data.draft, '   ');
  assert.equal(memory.has(storage.STORAGE_KEY), false);
});
check('add trims titles, gives distinct ids, and persists', () => {
  for (const title of [' Learn WXML ', '学习 WXSS', '复习 JavaScript']) {
    page.onDraftInput(input(title));
    page.onSave();
  }
  assert.equal(page.data.total, 3);
  assert.equal(page.data.remaining, 3);
  assert.equal(page.data.tasks[2].title, 'Learn WXML');
  assert.equal(new Set(page.data.tasks.map(task => task.id)).size, 3);
  assert.equal(memory.get(storage.STORAGE_KEY).length, 3);
  assert.equal(page.data.draft, '');
});
const wxmlId = page.data.tasks[2].id;
check('case-insensitive search keeps full-dataset counts', () => {
  page.onKeywordInput(input(' wXmL '));
  assert.equal(page.data.visibleTasks.length, 1);
  assert.equal(page.data.visibleTasks[0].id, wxmlId);
  assert.equal(page.data.total, 3);
});
check('toggle uses stable id under search and updates counts', () => {
  page.onToggle(byId(wxmlId));
  assert.equal(page.data.completed, 1);
  assert.equal(page.data.remaining, 2);
  assert.equal(page.data.tasks.find(task => task.id === wxmlId).done, true);
});
check('filter and search are combined without deleting source records', () => {
  page.onFilterChange(byFilter('pending'));
  assert.equal(page.data.visibleTasks.length, 0);
  assert.equal(page.data.total, 3);
  page.onFilterChange(byFilter('done'));
  assert.equal(page.data.visibleTasks.length, 1);
});
check('editing preserves id, creation time, and completion state', () => {
  const before = clone(page.data.tasks.find(task => task.id === wxmlId));
  page.onEdit(byId(wxmlId));
  assert.equal(page.data.draft, 'Learn WXML');
  page.onDraftInput(input('复习 WXML'));
  page.onSave();
  const after = page.data.tasks.find(task => task.id === wxmlId);
  assert.equal(after.id, before.id);
  assert.equal(after.createdAt, before.createdAt);
  assert.equal(after.done, true);
  assert.equal(after.title, '复习 WXML');
  assert.equal(page.data.editingId, '');
});
check('cancel edit leaves stored task unchanged', () => {
  page.onEdit(byId(wxmlId));
  page.onDraftInput(input('放弃这次修改'));
  page.onCancelEdit();
  assert.equal(page.data.draft, '');
  assert.equal(page.data.tasks.find(task => task.id === wxmlId).title, '复习 WXML');
});
check('cancel deletion does not mutate data', () => {
  page.onRemove(byId(wxmlId));
  pendingModal.success({ confirm: false, cancel: true });
  assert.equal(page.data.total, 3);
});
check('confirmed deletion clears matching edit state', () => {
  page.onEdit(byId(wxmlId));
  page.onRemove(byId(wxmlId));
  pendingModal.success({ confirm: true });
  assert.equal(page.data.total, 2);
  assert.equal(page.data.completed, 0);
  assert.equal(page.data.editingId, '');
  assert.equal(page.data.draft, '');
});
check('reopening restores tasks and resets transient UI', () => {
  page = loadPage(pageFile);
  assert.equal(page.data.total, 2);
  assert.equal(page.data.keyword, '');
  assert.equal(page.data.filter, 'all');
});
check('failed save preserves source, draft, and stored data', () => {
  const before = JSON.stringify(page.data.tasks);
  page.onDraftInput(input('保存失败的草稿'));
  failWrite = true;
  page.onSave();
  assert.equal(JSON.stringify(page.data.tasks), before);
  assert.equal(page.data.draft, '保存失败的草稿');
  assert.equal(JSON.stringify(memory.get(storage.STORAGE_KEY)), before);
  assert.equal(toast.title, '保存失败，请重试');
  failWrite = false;
});
check('failed edit save retains editing target and changed draft', () => {
  const id = page.data.tasks[0].id;
  const oldTitle = page.data.tasks[0].title;
  page.onEdit(byId(id));
  page.onDraftInput(input('重试前的标题'));
  failWrite = true;
  page.onSave();
  assert.equal(page.data.editingId, id);
  assert.equal(page.data.draft, '重试前的标题');
  assert.equal(page.data.tasks[0].title, oldTitle);
  failWrite = false;
  page.onCancelEdit();
});
check('read failure blocks writes and can be retried', () => {
  const before = JSON.stringify(memory.get(storage.STORAGE_KEY));
  failRead = true;
  const blocked = loadPage(pageFile);
  assert.equal(blocked.data.storageError, true);
  blocked.onDraftInput(input('不能覆盖缓存'));
  blocked.onSave();
  assert.equal(JSON.stringify(memory.get(storage.STORAGE_KEY)), before);
  failRead = false;
  blocked.onReload();
  assert.equal(blocked.data.storageError, false);
  assert.equal(blocked.data.total, 2);
});
check('malformed cache is preserved and never silently overwritten', () => {
  const backup = clone(memory.get(storage.STORAGE_KEY));
  memory.set(storage.STORAGE_KEY, { invalid: true });
  const blocked = loadPage(pageFile);
  assert.equal(blocked.data.storageError, true);
  blocked.onSave();
  assert.deepEqual(memory.get(storage.STORAGE_KEY), { invalid: true });
  memory.set(storage.STORAGE_KEY, backup);
});
check('business task limit rejects add while permitting edits', () => {
  const tasks = Array.from({ length: 200 }, (_, index) => ({
    id: 'limit_' + index, title: '任务 ' + index, done: false, createdAt: index
  }));
  memory.set(storage.STORAGE_KEY, tasks);
  const limited = loadPage(pageFile);
  limited.onDraftInput(input('第 201 项'));
  limited.onSave();
  assert.equal(limited.data.total, 200);
  assert.equal(limited.data.draft, '第 201 项');
  limited.onEdit(byId('limit_0'));
  limited.onDraftInput(input('上限内仍可编辑'));
  limited.onSave();
  assert.equal(limited.data.tasks[0].title, '上限内仍可编辑');
});
check('schema rejects duplicate ids, invalid booleans, and invalid timestamps', () => {
  const valid = { id: 'a', title: '任务', done: false, createdAt: 1 };
  assert.equal(logic.isValidTasks([valid]), true);
  assert.equal(logic.isValidTasks([valid, { ...valid }]), false);
  assert.equal(logic.isValidTasks([{ ...valid, done: 'false' }]), false);
  assert.equal(logic.isValidTasks([{ ...valid, createdAt: NaN }]), false);
  assert.equal(logic.isValidTasks([{ ...valid, title: null }]), false);
  assert.equal(logic.isValidTasks(null), false);
});
check('empty and oversized titles are rejected at the business boundary', () => {
  assert.notEqual(logic.getTitleError(' '), '');
  assert.notEqual(logic.getTitleError('a'.repeat(41)), '');
  assert.equal(logic.getTitleError('a'.repeat(40)), '');
  assert.throws(() => logic.createTask('', []));
});
check('id collision fallback still produces a unique id', () => {
  const originalNow = Date.now;
  const originalRandom = Math.random;
  try {
    Date.now = () => 100;
    Math.random = () => 0.5;
    const one = logic.createTask('一', []);
    const two = logic.createTask('二', [one]);
    assert.notEqual(one.id, two.id);
  } finally {
    Date.now = originalNow;
    Math.random = originalRandom;
  }
});
check('deletion confirmation operates on current tasks, preserving intervening additions', () => {
  memory.clear();
  const current = loadPage(pageFile);
  current.onDraftInput(input('先有的任务'));
  current.onSave();
  const id = current.data.tasks[0].id;
  current.onRemove(byId(id));
  const confirm = pendingModal.success;
  current.onDraftInput(input('弹窗之后新增'));
  current.onSave();
  confirm({ confirm: true });
  assert.equal(current.data.total, 1);
  assert.equal(current.data.tasks[0].title, '弹窗之后新增');
});
check('unknown filter values do not corrupt page state', () => {
  const current = loadPage(pageFile);
  current.onFilterChange(byFilter('invalid'));
  assert.equal(current.data.filter, 'all');
});

console.log('\nAll ' + count + ' logic scenarios passed. WeChat compilation and real-device QA are separate.');
