const repository = require('../../services/task-repository');
const navigation = require('../../services/navigation');
const { CATEGORIES } = require('../../constants/index');
const { buildList } = require('../../utils/task');
const categoryOptions = [{ id: 'all', label: '全部分类' }, ...CATEGORIES];
Page({
  data: {
    keyword: '', filter: 'all', categoryIndex: 0, categoryOptions,
    tasks: [], visibleTasks: [], total: 0, completed: 0, remaining: 0,
    status: 'loading', errorMessage: ''
  },
  onShow() { this.refresh(); },
  refresh() {
    try {
      const tasks = repository.listTasks();
      this.setData({ tasks, status: 'ready', errorMessage: '',
        ...buildList(tasks, this.data.keyword, this.data.filter, categoryOptions[this.data.categoryIndex].id) });
    } catch (error) {
      console.error('读取列表失败', error);
      this.setData({ status: 'error', errorMessage: error.message, tasks: [], visibleTasks: [],
        total: 0, completed: 0, remaining: 0 });
    }
  },
  recompute(extra = {}) {
    const state = { ...this.data, ...extra };
    this.setData({ ...extra,
      ...buildList(state.tasks, state.keyword, state.filter, categoryOptions[state.categoryIndex].id) });
  },
  onKeywordInput(event) { this.recompute({ keyword: event.detail.value }); },
  onFilter(event) {
    const filter = event.currentTarget.dataset.filter;
    if (['all', 'pending', 'done'].includes(filter)) this.recompute({ filter });
  },
  onCategory(event) {
    const index = Number(event.detail.value);
    if (Number.isInteger(index) && index >= 0 && index < categoryOptions.length) {
      this.recompute({ categoryIndex: index });
    }
  },
  onCreate() { navigation.openEditor(); },
  onOpenTask(event) { navigation.openDetail(event.detail.id); },
  onToggleTask(event) {
    try {
      repository.toggleTask(event.detail.id);
      this.refresh();
    } catch (error) {
      wx.showToast({ title: error.message, icon: 'none' });
    }
  }
});
