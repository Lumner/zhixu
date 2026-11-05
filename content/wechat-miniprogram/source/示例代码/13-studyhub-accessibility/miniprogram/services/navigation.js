const { isValidId } = require('../utils/task');
const LIST_PATH = '/pages/tasks/index';

function showFailure(error) {
  console.error('页面跳转失败', error);
  wx.showToast({ title: '页面跳转失败，请重试', icon: 'none' });
}

function openDetail(id) {
  if (!isValidId(id)) throw new Error('任务标识不合法');
  wx.navigateTo({ url: '/pages/detail/index?id=' + encodeURIComponent(id), fail: showFailure });
}

function openEditor(id = '') {
  if (id && !isValidId(id)) throw new Error('任务标识不合法');
  const suffix = id ? '?id=' + encodeURIComponent(id) : '';
  wx.navigateTo({ url: '/pages/task-compose/index' + suffix, fail: showFailure });
}

function readId(options, required) {
  const id = options && options.id;
  if (id === undefined && !required) return '';
  if (!isValidId(id)) throw new Error('缺少或不合法的任务 ID');
  // 课程 ID 仅用字母、数字、下划线和短横线，不需要再次解码。
  return id;
}

function goToList() {
  wx.switchTab({ url: LIST_PATH, fail: showFailure });
}

function backOrList() {
  if (getCurrentPages().length > 1) {
    wx.navigateBack({ delta: 1, fail: goToList });
  } else {
    goToList();
  }
}

module.exports = { openDetail, openEditor, readId, goToList, backOrList };
