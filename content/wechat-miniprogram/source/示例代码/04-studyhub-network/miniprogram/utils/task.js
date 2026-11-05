const { MAX_TASKS, CATEGORIES, PRIORITIES } = require('../constants/index');

function isValidDate(value) {
  if (value === '') return true;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  if (year < 2000 || year > 2099) return false;
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

function validateFields(value) {
  if (!value || typeof value !== 'object') return '表单数据不完整';
  if (typeof value.title !== 'string' || !value.title.trim()) return '请输入任务标题';
  if (value.title.trim().length > 40) return '标题不能超过 40 个代码单元';
  if (typeof value.description !== 'string' || value.description.length > 1000) return '备注最多 1000 个代码单元';
  if (!CATEGORIES.some(item => item.id === value.category)) return '分类不合法';
  if (!PRIORITIES.some(item => item.id === value.priority)) return '优先级不合法';
  if (!isValidDate(value.dueDate)) return '日期须为 2000—2099 年内的有效日期';
  if (typeof value.done !== 'boolean') return '完成状态不合法';
  return '';
}

function isValidId(value) {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{1,160}$/.test(value);
}

function validateTasks(tasks) {
  if (!Array.isArray(tasks) || tasks.length > MAX_TASKS) return false;
  const ids = new Set();
  return tasks.every(task => {
    if (!task || !isValidId(task.id) || ids.has(task.id) || validateFields(task)) return false;
    if (!Number.isFinite(task.createdAt) || task.createdAt < 0) return false;
    if (!Number.isFinite(task.updatedAt) || task.updatedAt < task.createdAt) return false;
    ids.add(task.id);
    return true;
  });
}

function migrateV1(tasks) {
  if (!Array.isArray(tasks) || tasks.length > MAX_TASKS) throw new Error('旧版缓存不是合法任务数组');
  const migrated = tasks.map(task => {
    if (!task || !isValidId(task.id) || typeof task.title !== 'string'
      || typeof task.done !== 'boolean' || !Number.isFinite(task.createdAt)) {
      throw new Error('旧版任务字段不合法，原数据已保留');
    }
    return {
      id: task.id, title: task.title.trim(), done: task.done, createdAt: task.createdAt,
      updatedAt: task.createdAt, description: '', category: 'general', priority: 'normal', dueDate: ''
    };
  });
  if (!validateTasks(migrated)) throw new Error('旧版数据无法安全迁移，原数据已保留');
  return migrated;
}

function createId(tasks) {
  const ids = new Set(tasks.map(task => task.id));
  const base = 'task_' + Date.now() + '_' + Math.random().toString(36).slice(2, 10);
  let id = base;
  let suffix = 1;
  while (ids.has(id)) { id = base + '_' + suffix; suffix += 1; }
  return id;
}

function summarize(tasks) {
  const completed = tasks.filter(task => task.done).length;
  return { total: tasks.length, completed, remaining: tasks.length - completed };
}

function buildList(tasks, keyword, filter, category) {
  const normalized = keyword.trim().toLowerCase();
  return {
    ...summarize(tasks),
    visibleTasks: tasks.filter(task => {
      const matchesText = task.title.toLowerCase().includes(normalized);
      const matchesStatus = filter === 'all' || (filter === 'done' && task.done)
        || (filter === 'pending' && !task.done);
      return matchesText && matchesStatus && (category === 'all' || task.category === category);
    })
  };
}

function taskMeta(task) {
  const category = CATEGORIES.find(item => item.id === task.category);
  const priority = PRIORITIES.find(item => item.id === task.priority);
  return (category ? category.label : '未知分类') + ' · ' + (priority ? priority.label : '未知')
    + '优先级 · ' + (task.dueDate || '无截止日期');
}

function formatSeconds(seconds) {
  const safe = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
  return String(Math.floor(safe / 60)).padStart(2, '0') + ':' + String(safe % 60).padStart(2, '0');
}

module.exports = { isValidDate, validateFields, isValidId, validateTasks, migrateV1,
  createId, summarize, buildList, taskMeta, formatSeconds };
