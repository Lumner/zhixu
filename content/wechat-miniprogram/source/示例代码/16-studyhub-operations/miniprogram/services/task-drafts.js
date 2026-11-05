const { createTaskDraftStore } = require('./task-draft-core');
module.exports = createTaskDraftStore({ read: key => wx.getStorageSync(key), write: (key, value) => wx.setStorageSync(key, value) });
