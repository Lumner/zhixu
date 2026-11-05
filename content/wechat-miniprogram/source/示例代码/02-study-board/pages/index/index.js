const { MAX_TASKS, getTitleError, createTask, buildView } = require('../../utils/task');
const { loadTasks, saveTasks } = require('../../services/storage');

Page({
  data: {
    draft: '',
    editingId: '',
    keyword: '',
    filter: 'all',
    tasks: [],
    visibleTasks: [],
    total: 0,
    completed: 0,
    remaining: 0,
    storageError: false
  },

  onLoad() {
    this.onReload();
  },

  onReload() {
    try {
      const tasks = loadTasks();
      this.setData({
        tasks,
        ...buildView(tasks, this.data.keyword, this.data.filter),
        storageError: false,
        draft: '',
        editingId: ''
      });
    } catch (error) {
      console.error('读取任务失败', error);
      this.setData({ storageError: true });
      wx.showToast({ title: '读取失败，暂时禁止修改', icon: 'none' });
    }
  },

  canWrite() {
    if (!this.data.storageError) return true;
    wx.showToast({ title: '请先解决缓存读取问题', icon: 'none' });
    return false;
  },

  // 小规模同步缓存：保存成功后才更新界面。
  commitTasks(tasks, extraData = {}) {
    if (!this.canWrite()) return false;
    try {
      saveTasks(tasks);
    } catch (error) {
      console.error('保存任务失败', error);
      wx.showToast({ title: '保存失败，请重试', icon: 'none' });
      return false;
    }
    this.setData({
      tasks,
      ...buildView(tasks, this.data.keyword, this.data.filter),
      ...extraData
    });
    return true;
  },

  onDraftInput(event) {
    this.setData({ draft: event.detail.value });
  },

  onSave() {
    if (!this.canWrite()) return;
    const error = getTitleError(this.data.draft);
    if (error) {
      wx.showToast({ title: error, icon: 'none' });
      return;
    }
    const title = this.data.draft.trim();
    const editingId = this.data.editingId;
    let nextTasks;
    if (editingId) {
      const exists = this.data.tasks.some(task => task.id === editingId);
      if (!exists) {
        wx.showToast({ title: '任务已不存在，请取消编辑', icon: 'none' });
        return;
      }
      nextTasks = this.data.tasks.map(task =>
        task.id === editingId ? { ...task, title } : task
      );
    } else {
      if (this.data.tasks.length >= MAX_TASKS) {
        wx.showToast({ title: '本地教学版最多保存 200 项', icon: 'none' });
        return;
      }
      nextTasks = [createTask(title, this.data.tasks), ...this.data.tasks];
    }
    const saved = this.commitTasks(nextTasks, { draft: '', editingId: '' });
    if (saved) {
      wx.showToast({ title: editingId ? '已保存修改' : '已添加', icon: 'success' });
    }
  },

  onEdit(event) {
    if (!this.canWrite()) return;
    const id = event.currentTarget.dataset.id;
    const task = this.data.tasks.find(item => item.id === id);
    if (!task) return;
    this.setData({ editingId: id, draft: task.title });
    wx.pageScrollTo({ scrollTop: 0, duration: 200 });
  },

  onCancelEdit() {
    this.setData({ editingId: '', draft: '' });
  },

  onToggle(event) {
    if (!this.canWrite()) return;
    const id = event.currentTarget.dataset.id;
    if (!this.data.tasks.some(task => task.id === id)) return;
    const nextTasks = this.data.tasks.map(task =>
      task.id === id ? { ...task, done: !task.done } : task
    );
    this.commitTasks(nextTasks);
  },

  onRemove(event) {
    if (!this.canWrite()) return;
    const id = event.currentTarget.dataset.id;
    const task = this.data.tasks.find(item => item.id === id);
    if (!task) return;
    wx.showModal({
      title: '删除任务',
      content: '确认删除“' + task.title + '”吗？',
      success: (result) => {
        if (!result.confirm) return;
        const nextTasks = this.data.tasks.filter(item => item.id !== id);
        const extraData = this.data.editingId === id ? { editingId: '', draft: '' } : {};
        this.commitTasks(nextTasks, extraData);
      },
      fail: (error) => {
        console.error('弹窗失败', error);
        wx.showToast({ title: '未能确认，请重试', icon: 'none' });
      }
    });
  },

  onKeywordInput(event) {
    const keyword = event.detail.value;
    this.setData({
      keyword,
      ...buildView(this.data.tasks, keyword, this.data.filter)
    });
  },

  onFilterChange(event) {
    const filter = event.currentTarget.dataset.filter;
    if (!['all', 'pending', 'done'].includes(filter)) return;
    this.setData({
      filter,
      ...buildView(this.data.tasks, this.data.keyword, filter)
    });
  }
});
