const repository = require('../../services/task-repository');
const navigation = require('../../services/navigation');
const { CATEGORIES, PRIORITIES } = require('../../constants/index');
Page({
  data: {
    editing: false, title: '', description: '', dueDate: '', done: false,
    categories: CATEGORIES, priorities: PRIORITIES, categoryIndex: 0, priorityIndex: 1,
    saving: false, saved: false, blocked: false, formError: ''
  },
  onLoad(options) {
    try {
      this._id = navigation.readId(options, false);
      if (this._id) {
        const task = repository.getTask(this._id);
        if (!task) throw new Error('任务已不存在，无法编辑');
        this.setData({ editing: true, title: task.title, description: task.description,
          dueDate: task.dueDate, done: task.done,
          categoryIndex: CATEGORIES.findIndex(item => item.id === task.category),
          priorityIndex: PRIORITIES.findIndex(item => item.id === task.priority) });
      } else {
        repository.listTasks(); // 新建前也检查缓存/迁移，失败时不允许覆盖。
      }
    } catch (error) {
      this.setData({ blocked: true, formError: error.message });
    }
  },
  onTextInput(event) {
    const field = event.currentTarget.dataset.field;
    if (field === 'title' || field === 'description') {
      this.setData({ [field]: event.detail.value, formError: '' });
    }
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
  onSubmit(event) {
    if (this.data.saving || this.data.saved || this.data.blocked) return;
    this.setData({ saving: true, formError: '' });
    try {
      const values = event.detail.value;
      repository.saveTask(this._id, {
        title: values.title, description: values.description, done: values.done,
        category: CATEGORIES[this.data.categoryIndex].id,
        priority: PRIORITIES[this.data.priorityIndex].id, dueDate: this.data.dueDate
      });
      this.setData({ saving: false, saved: true });
      wx.showToast({ title: '已保存', icon: 'success' });
      navigation.backOrList();
    } catch (error) {
      this.setData({ saving: false, formError: error.message });
    }
  },
  onBack() { navigation.backOrList(); }
});
