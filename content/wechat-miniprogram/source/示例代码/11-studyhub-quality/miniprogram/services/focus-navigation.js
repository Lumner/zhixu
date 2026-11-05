const { validId } = require('../shared/focus-contract');
function forTask(task) {
  if (!task || !validId(task.id)) throw new Error('任务编号不合法');
  const app = getApp(), intent = { taskId: task.id, taskTitle: task.title };
  app.globalData.focusTaskIntent = intent;
  wx.switchTab({ url: '/pages/focus/index', fail() {
    if (app.globalData.focusTaskIntent === intent) delete app.globalData.focusTaskIntent;
    wx.showToast({ title: '未能打开专注页', icon: 'none' });
  } });
}
module.exports = { forTask };
