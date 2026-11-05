const repository = require('../../services/task-repository');
const navigation = require('../../services/navigation');
const { taskMeta } = require('../../utils/task');
Page({
  data: { status: 'loading', task: null, meta: '', errorMessage: '' },
  onLoad(options) {
    try { this._id = navigation.readId(options, true); }
    catch (error) { this.setData({ status: 'error', errorMessage: error.message }); }
  },
  onShow() { if (this._id) this.refresh(); },
  refresh() {
    try {
      const task = repository.getTask(this._id);
      this.setData({ task, meta: task ? taskMeta(task) : '',
        status: task ? 'ready' : 'missing', errorMessage: '' });
    } catch (error) {
      this.setData({ status: 'error', task: null, errorMessage: error.message });
    }
  },
  onEdit() { if (this.data.task) navigation.openEditor(this._id); },
  onToggle() {
    try { repository.toggleTask(this._id); this.refresh(); }
    catch (error) { wx.showToast({ title: error.message, icon: 'none' }); }
  },
  onDelete() {
    if (!this.data.task) return;
    wx.showModal({
      title: '删除任务', content: '确认删除“' + this.data.task.title + '”吗？',
      success: (result) => {
        if (!result.confirm) return;
        try { repository.removeTask(this._id); navigation.backOrList(); }
        catch (error) { wx.showToast({ title: error.message, icon: 'none' }); }
      },
      fail: () => wx.showToast({ title: '未能确认，请重试', icon: 'none' })
    });
  },
  onBack() { navigation.backOrList(); },
  onGoList() { navigation.goToList(); }
});
