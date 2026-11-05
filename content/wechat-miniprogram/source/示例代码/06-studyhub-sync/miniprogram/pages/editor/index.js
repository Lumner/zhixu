const repository = require('../../services/cloud-repository');
const navigation = require('../../services/navigation');
const { CATEGORIES, PRIORITIES } = require('../../constants/index');
const { validateFields } = require('../../utils/task');
Page({
  data: { title: '', description: '', done: false, dueDate: '', categoryIndex: 0, priorityIndex: 1,
    categories: CATEGORIES, priorities: PRIORITIES, editing: false, loading: true,
    saving: false, saved: false, blocked: false, uncertain: false, errorMessage: '' },
  async onLoad(options) {
    this._alive = true;
    try {
      this._id = navigation.readId(options, false);
      if (this._id) {
        const task = await repository.get(this._id);
        if (!this._alive) return;
        this._version = task.version;
        this.setData({ editing: true, title: task.title, description: task.description, done: task.done,
          dueDate: task.dueDate, categoryIndex: CATEGORIES.findIndex(item => item.id === task.category),
          priorityIndex: PRIORITIES.findIndex(item => item.id === task.priority) });
      }
    } catch (error) { if (this._alive) this.setData({ blocked: true, errorMessage: error.message }); }
    finally { if (this._alive) this.setData({ loading: false }); }
  },
  onUnload() { this._alive = false; },
  onText(event) {
    const key = event.currentTarget.dataset.field;
    if (key === 'title' || key === 'description') this.setData({ [key]: event.detail.value });
  },
  onCategory(event) {
    const index = Number(event.detail.value);
    if (Number.isInteger(index) && index >= 0 && index < CATEGORIES.length) this.setData({ categoryIndex: index });
  },
  onPriority(event) {
    const index = Number(event.detail.value);
    if (Number.isInteger(index) && index >= 0 && index < PRIORITIES.length) this.setData({ priorityIndex: index });
  },
  onDate(event) { this.setData({ dueDate: event.detail.value }); },
  onClearDate() { this.setData({ dueDate: '' }); },
  onDone(event) { this.setData({ done: event.detail.value }); },
  async onSubmit(event) {
    if (this.data.loading || this.data.saving || this.data.saved || this.data.blocked || this.data.uncertain) return;
    const values = event.detail.value;
    const fields = { title: values.title, description: values.description, done: values.done,
      category: CATEGORIES[this.data.categoryIndex].id, priority: PRIORITIES[this.data.priorityIndex].id, dueDate: this.data.dueDate };
    const errorMessage = validateFields(fields);
    if (errorMessage) { this.setData({ errorMessage }); return; }
    this.setData({ saving: true, errorMessage: '' });
    try {
      if (this._id) await repository.update(this._id, this._version, fields);
      else await repository.create(fields);
      if (!this._alive) return;
      this.setData({ saved: true });
      wx.showToast({ title: '云端已保存', icon: 'success' });
      navigation.backOrList();
    } catch (error) {
      if (this._alive) this.setData({ errorMessage: error.message,
        uncertain: error.queued === true });
    } finally { if (this._alive) this.setData({ saving: false }); }
  },
  onBack() { navigation.backOrList(); },
  onPending() { wx.navigateTo({ url: '/pages/pending/index' }); }
});
