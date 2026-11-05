const { STORAGE_KEY, LEGACY_KEY, MAX_TASKS } = require('../constants/index');
const { validateTasks, validateFields, migrateV1, createId } = require('../utils/task');
const copy = value => JSON.parse(JSON.stringify(value));

function write(tasks) {
  if (!validateTasks(tasks)) throw new Error('拒绝保存非法任务数据');
  wx.setStorageSync(STORAGE_KEY, { schemaVersion: 2, tasks });
}

function listTasks() {
  const stored = wx.getStorageSync(STORAGE_KEY);
  if (stored !== '' && stored !== undefined) {
    if (!stored || stored.schemaVersion !== 2 || !validateTasks(stored.tasks)) {
      throw new Error('v0.2 缓存格式错误，请先备份排查');
    }
    return copy(stored.tasks);
  }
  const legacy = wx.getStorageSync(LEGACY_KEY);
  if (legacy === '' || legacy === undefined) return [];
  const migrated = migrateV1(legacy);
  write(migrated); // 成功后才采用迁移结果；旧键始终保留。
  return copy(migrated);
}

function getTask(id) {
  return listTasks().find(task => task.id === id) || null;
}

function saveTask(id, fields) {
  const error = validateFields(fields);
  if (error) throw new Error(error);
  const tasks = listTasks();
  const now = Date.now();
  const clean = { title: fields.title.trim(), description: fields.description.trim(),
    category: fields.category, priority: fields.priority, dueDate: fields.dueDate, done: fields.done };
  let saved;
  let nextTasks;
  if (id) {
    const current = tasks.find(task => task.id === id);
    if (!current) throw new Error('任务已不存在，不能覆盖或重新创建');
    saved = { ...current, ...clean, updatedAt: Math.max(now, current.updatedAt) };
    nextTasks = tasks.map(task => task.id === id ? saved : task);
  } else {
    if (tasks.length >= MAX_TASKS) throw new Error('本地教学版最多 200 条任务');
    saved = { ...clean, id: createId(tasks), createdAt: now, updatedAt: now };
    nextTasks = [saved, ...tasks];
  }
  write(nextTasks);
  return copy(saved);
}

function toggleTask(id) {
  const tasks = listTasks();
  if (!tasks.some(task => task.id === id)) throw new Error('任务已不存在');
  const next = tasks.map(task => task.id === id
    ? { ...task, done: !task.done, updatedAt: Math.max(Date.now(), task.updatedAt) } : task);
  write(next);
}

function removeTask(id) {
  const tasks = listTasks();
  if (!tasks.some(task => task.id === id)) throw new Error('任务已不存在');
  write(tasks.filter(task => task.id !== id));
}

module.exports = { listTasks, getTask, saveTask, toggleTask, removeTask };
