// 纯数据逻辑：这里不调用 wx，不依赖任何页面。
const MAX_TITLE_LENGTH = 40;
const MAX_TASKS = 200;

function getTitleError(rawTitle) {
  if (typeof rawTitle !== 'string') return '标题必须是文字';
  const title = rawTitle.trim();
  if (title.length === 0) return '请先输入任务标题';
  if (title.length > MAX_TITLE_LENGTH) return '标题不能超过 40 个代码单元';
  return '';
}

function isValidTasks(value) {
  if (!Array.isArray(value) || value.length > MAX_TASKS) return false;
  const ids = new Set();
  for (const task of value) {
    if (!task || typeof task !== 'object') return false;
    if (typeof task.id !== 'string' || task.id.length === 0) return false;
    if (ids.has(task.id)) return false;
    if (getTitleError(task.title)) return false;
    if (typeof task.done !== 'boolean') return false;
    if (!Number.isFinite(task.createdAt) || task.createdAt < 0) return false;
    ids.add(task.id);
  }
  return true;
}

function createTask(rawTitle, existingTasks) {
  const error = getTitleError(rawTitle);
  if (error) throw new Error(error);
  const ids = new Set(existingTasks.map(task => task.id));
  const now = Date.now();
  const baseId = 'task_' + now + '_' + Math.random().toString(36).slice(2, 10);
  let id = baseId;
  let suffix = 1;
  while (ids.has(id)) {
    id = baseId + '_' + suffix;
    suffix += 1;
  }
  return { id, title: rawTitle.trim(), done: false, createdAt: now };
}

function buildView(tasks, keyword, filter) {
  const normalizedKeyword = keyword.trim().toLowerCase();
  const completed = tasks.filter(task => task.done).length;
  const visibleTasks = tasks.filter(task => {
    const matchesKeyword = task.title.toLowerCase().includes(normalizedKeyword);
    const matchesFilter = filter === 'all'
      || (filter === 'pending' && !task.done)
      || (filter === 'done' && task.done);
    return matchesKeyword && matchesFilter;
  });
  return {
    total: tasks.length,
    completed,
    remaining: tasks.length - completed,
    visibleTasks
  };
}

module.exports = {
  MAX_TITLE_LENGTH,
  MAX_TASKS,
  getTitleError,
  isValidTasks,
  createTask,
  buildView
};
