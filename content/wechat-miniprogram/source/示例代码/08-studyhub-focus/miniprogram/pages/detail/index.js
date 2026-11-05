const repository = require('../../services/cloud-repository');
const navigation = require('../../services/navigation');
const { taskMeta, pickFields } = require('../../utils/task');
Page({
  data: { task: null, meta: '', status: 'loading', errorMessage: '', busy: false },
  onLoad(options) {
    this._alive = true; this._epoch = 0;
    try { this._id = navigation.readId(options, true); }
    catch (error) { this.setData({ status: 'error', errorMessage: error.message }); }
  },
  onShow() { this._visible = true; if (this._id) this.refresh(); },
  onHide() { this._visible = false; this._epoch += 1; },
  onUnload() { this._alive = false; this._epoch += 1; },
  async refresh() {
    const epoch = ++this._epoch;
    this.setData({ status: 'loading', errorMessage: '' });
    try {
      const task = await repository.get(this._id);
      if (this._alive && epoch === this._epoch) this.setData({ task, meta: taskMeta(task), status: 'ready' });
    } catch (error) {
      if (this._alive && epoch === this._epoch) this.setData({ status: 'error', task: null, errorMessage: error.message });
    }
  },
  onEdit() { if (this.data.task && !this.data.busy) navigation.openEditor(this._id); },
  async onToggle() {
    if (!this.data.task || this.data.busy) return;
    const task = this.data.task;
    this.setData({ busy: true });
    try {
      await repository.update(task.id, task.version, { ...pickFields(task), done: !task.done });
      if (this._alive && this._visible) await this.refresh();
    } catch (error) { if (this._alive && this._visible) wx.showToast({ title: error.message, icon: 'none' }); }
    finally { if (this._alive) this.setData({ busy: false }); }
  },
  onRemove() {
    if (!this.data.task || this.data.busy) return;
    const task = this.data.task;
    wx.showModal({ title: '删除云端任务', content: '确认删除“' + task.title + '”吗？',
      success: async result => {
        if (!result.confirm || !this._alive || !this._visible || this.data.busy) return;
        this.setData({ busy: true });
        try {
          await repository.remove(task.id, task.version);
          if (this._alive && this._visible) navigation.backOrList();
        } catch (error) { if (this._alive && this._visible) wx.showToast({ title: error.message, icon: 'none' }); }
        finally { if (this._alive) this.setData({ busy: false }); }
      }, fail: () => wx.showToast({ title: '未能确认，请重试', icon: 'none' }) });
  },
  onBack() { navigation.backOrList(); },
  onNote() { if (this.data.task && !this.data.busy) require('../../services/knowledge-navigation').editor({ taskId: this._id }); },
  onFocus() { if (this.data.task && !this.data.busy) require('../../services/focus-navigation').forTask(this.data.task); }
});
