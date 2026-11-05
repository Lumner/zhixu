const { feedback } = require('../../utils/feedback');
const repository = require('../../services/cloud-repository');
const navigation = require('../../services/navigation');
const { pickFields } = require('../../utils/task');
Page({
  data: { items: [], filter: 'all', cursor: null, hasMore: false, status: 'loading', errorMessage: '', feedback: null, loadingMore: false, actionBusy: false },
  onLoad() { this._alive = true; this._epoch = 0; },
  onShow() { this._visible = true; this.refresh(); },
  onHide() { this._visible = false; this._epoch += 1; },
  onUnload() { this._alive = false; this._epoch += 1; },
  async refresh() {
    const epoch = ++this._epoch;
    this.setData({ status: 'loading', errorMessage: '', feedback: null, loadingMore: false, items: [], cursor: null, hasMore: false });
    try {
      const page = await repository.list({ filter: this.data.filter });
      if (!this._alive || epoch !== this._epoch) return;
      this.setData({ items: page.items, cursor: page.nextCursor, hasMore: page.nextCursor !== null, status: page.items.length ? 'ready' : 'empty' });
    } catch (error) {
      if (this._alive && epoch === this._epoch) this.setData({ status: 'error', errorMessage: error.message, feedback: feedback(error) });
    }
  },
  async onMore() {
    if (this.data.loadingMore || !this.data.hasMore || this.data.status !== 'ready') return;
    const epoch = this._epoch;
    this.setData({ loadingMore: true, errorMessage: '', feedback: null });
    try {
      const page = await repository.list({ filter: this.data.filter, cursor: this.data.cursor });
      if (!this._alive || epoch !== this._epoch) return;
      const seen = new Set(this.data.items.map(task => task.id));
      this.setData({ items: [...this.data.items, ...page.items.filter(task => !seen.has(task.id))],
        cursor: page.nextCursor, hasMore: page.nextCursor !== null });
    } catch (error) { if (this._alive && epoch === this._epoch) { const view = feedback(error); this.setData({ errorMessage: error.message, feedback: view && view.action === 'retry' ? { ...view, action: 'retryMore', actionText: '重试下一页' } : view }); } }
    finally { if (this._alive && epoch === this._epoch) this.setData({ loadingMore: false }); }
  },
  onFilter(event) {
    const filter = event.currentTarget.dataset.filter;
    if (!['all', 'pending', 'done'].includes(filter)) return;
    this.setData({ filter }); this.refresh();
  },
  onCreate() { navigation.openEditor(); },
  onOpen(event) { navigation.openDetail(event.detail.id); },
  async onToggle(event) {
    if (this.data.actionBusy) return;
    const task = this.data.items.find(item => item.id === event.detail.id);
    if (!task) return;
    this.setData({ actionBusy: true });
    try {
      await repository.update(task.id, task.version, { ...pickFields(task), done: !task.done });
      if (this._alive && this._visible) await this.refresh();
    } catch (error) { if (this._alive && this._visible) this.setData({ feedback: feedback(error, 'write') }); }
    finally { if (this._alive) this.setData({ actionBusy: false }); }
  },
  onFeedback(event) {
    const kind = event.detail.kind;
    if (kind === 'retry') return this.refresh();
    if (kind === 'retryMore') return this.onMore();
    if (kind === 'pending') return wx.navigateTo({ url: '/pages/pending/index' });
    if (kind === 'account') return wx.switchTab({ url: '/pages/account/index' });
    if (kind === 'list') return wx.switchTab({ url: '/pages/tasks/index' });
  }

});
