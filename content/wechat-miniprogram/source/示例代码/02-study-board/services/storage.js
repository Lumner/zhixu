const { isValidTasks } = require('../utils/task');
const STORAGE_KEY = 'studyhub.tasks.v1';

function loadTasks() {
  const value = wx.getStorageSync(STORAGE_KEY);
  // getStorageSync 未读到值时通常返回空字符串。
  if (value === '' || value === undefined) return [];
  if (!isValidTasks(value)) throw new Error('缓存格式不符合当前版本');
  return value;
}

function saveTasks(tasks) {
  if (!isValidTasks(tasks)) throw new Error('拒绝保存不合法的任务数据');
  wx.setStorageSync(STORAGE_KEY, tasks);
}

module.exports = { STORAGE_KEY, loadTasks, saveTasks };
