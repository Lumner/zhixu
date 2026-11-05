const { CATEGORIES, PRIORITIES } = require('../constants/index');
function isValidId(id) { return typeof id === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(id); }
function validDate(value) {
  if (value === '') return true;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return year >= 2000 && year <= 2099 && date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}
function validateFields(value) {
  if (!value || typeof value.title !== 'string' || !value.title.trim() || value.title.trim().length > 40) return '标题长度须为 1—40';
  if (typeof value.description !== 'string' || value.description.length > 1000) return '备注最多 1000 个代码单元';
  if (!CATEGORIES.some(item => item.id === value.category) || !PRIORITIES.some(item => item.id === value.priority)) return '分类或优先级不合法';
  if (!validDate(value.dueDate) || typeof value.done !== 'boolean') return '日期或完成状态不合法';
  return '';
}
function pickFields(task) {
  return { title: task.title, description: task.description, category: task.category,
    priority: task.priority, dueDate: task.dueDate, done: task.done };
}
function validTask(task) {
  return task && isValidId(task.id) && !validateFields(task) && Number.isFinite(task.createdAt)
    && Number.isFinite(task.updatedAt) && Number.isSafeInteger(task.version) && task.version >= 1;
}
function taskMeta(task) {
  const category = CATEGORIES.find(item => item.id === task.category);
  const priority = PRIORITIES.find(item => item.id === task.priority);
  return (category ? category.label : '未知分类') + ' · ' + (priority ? priority.label : '未知') + '优先级 · ' + (task.dueDate || '无截止日期');
}
module.exports = { isValidId, validateFields, pickFields, validTask, taskMeta };
