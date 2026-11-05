const { fetchPage } = require('../../services/resource-api');
const cache = require('../../services/resource-cache');
const { createPager } = require('../../models/resource-pager');
const repository = require('../../services/task-repository');
const categories = [{ id: 'all', label: '全部分类' }, { id: 'syntax', label: '语法' },
  { id: 'layout', label: '布局' }, { id: 'network', label: '网络' }];
const modes = [{ id: 'normal', label: '正常' }, { id: 'flaky', label: '首次失败后恢复' },
  { id: 'http503', label: 'HTTP 503' }, { id: 'business', label: '业务拒绝' },
  { id: 'malformed', label: '结构错误' }, { id: 'slow', label: '延迟 4 秒（超时）' }];
Page({
  data: { keyword: '', categories, categoryIndex: 0, modes, modeIndex: 0,
    items: [], status: 'idle', refreshing: false, loadingMore: false,
    error: '', moreError: '', hasMore: false, fromCache: false },
  onLoad() {
    this._alive = true;
    this._pager = createPager({ fetchPage,
      publish: state => { if (this._alive) this.setData(state); },
      onFirstPage: (query, items) => cache.put(query, items) });
  },
  onShow() { this._visible = true; this.reload({ useCache: true }); },
  onHide() { this._visible = false; clearTimeout(this._debounce); this._pager.pause(); },
  onUnload() { this._alive = false; clearTimeout(this._debounce); this._pager.dispose(); },
  getQuery() {
    return { keyword: this.data.keyword.trim(), category: categories[this.data.categoryIndex].id,
      mode: modes[this.data.modeIndex].id };
  },
  reload(options = {}) {
    if (!this._alive || !this._visible) return Promise.resolve();
    const query = this.getQuery();
    return this._pager.replace(query, { retain: Boolean(options.retain), seed: options.useCache ? cache.get(query) : null });
  },
  onKeyword(event) {
    this.setData({ keyword: event.detail.value });
    clearTimeout(this._debounce);
    this._pager.pause(true); // 输入一变，旧请求立即失效；不等防抖时间结束。
    this._debounce = setTimeout(() => this.reload(), 300);
  },
  onCategory(event) {
    const index = Number(event.detail.value);
    if (!Number.isInteger(index) || index < 0 || index >= categories.length) return;
    clearTimeout(this._debounce); this.setData({ categoryIndex: index }); this.reload();
  },
  onMode(event) {
    const index = Number(event.detail.value);
    if (!Number.isInteger(index) || index < 0 || index >= modes.length) return;
    clearTimeout(this._debounce); this.setData({ modeIndex: index }); this.reload();
  },
  async onPullDownRefresh() {
    clearTimeout(this._debounce);
    const version = (this._pullVersion || 0) + 1;
    this._pullVersion = version;
    try { await this.reload({ retain: true }); }
    finally {
      if (this._alive && this._visible && version === this._pullVersion) wx.stopPullDownRefresh();
    }
  },
  onReachBottom() { return this._pager.loadMore(); },
  onMore() { return this._pager.loadMore(); },
  onRetry() { return this.reload({ retain: true }); },
  onAddTask(event) {
    const id = event.currentTarget.dataset.id;
    const item = this.data.items.find(resource => resource.id === id);
    if (!item) return;
    try {
      repository.saveTask('', { title: ('学习：' + item.title).slice(0, 40), description: item.summary,
        category: item.category === 'network' ? 'project' : item.category,
        priority: 'normal', dueDate: '', done: false });
      wx.showToast({ title: '已加入本地任务', icon: 'success' });
    } catch (error) { wx.showToast({ title: error.message, icon: 'none' }); }
  }
});
