const repository = require('../../services/cloud-repository');
const navigation = require('../../services/navigation');
const { pickFields } = require('../../utils/task');
Page({
  data: { items: [], filter: 'all', cursor: null, hasMore: false, status: 'loading', errorMessage: '', loadingMore: false, actionBusy: false },
  onLoad() { this._alive = true; this._epoch = 0; },
  onShow() { this._visible = true; this.refresh(); },
  onHide() { this._visible = false; this._epoch += 1; },
  onUnload() { this._alive = false; this._epoch += 1; },
  async refresh() {
    const epoch = ++this._epoch;
    this.setData({ status: 'loading', errorMessage: '', loadingMore: false, items: [], cursor: null, hasMore: false });
    try {
      const page = await repository.list({ filter: this.data.filter });
      if (!this._alive || epoch !== this._epoch) return;
      this.setData({ items: page.items, cursor: page.nextCursor, hasMore: page.nextCursor !== null, status: page.items.length ? 'ready' : 'empty' });
    } catch (error) {
      if (this._alive && epoch === this._epoch) this.setData({ status: 'error', errorMessage: error.message });
    }
  },
  async onMore() {
    if (this.data.loadingMore || !this.data.hasMore || this.data.status !== 'ready') return;
    const epoch = this._epoch;
    this.setData({ loadingMore: true, errorMessage: '' });
    try {
      const page = await repository.list({ filter: this.data.filter, cursor: this.data.cursor });
      if (!this._alive || epoch !== this._epoch) return;
      const seen = new Set(this.data.items.map(task => task.id));
      this.setData({ items: [...this.data.items, ...page.items.filter(task => !seen.has(task.id))],
        cursor: page.nextCursor, hasMore: page.nextCursor !== null });
    } catch (error) { if (this._alive && epoch === this._epoch) this.setData({ errorMessage: error.message }); }
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
    } catch (error) { if (this._alive && this._visible) wx.showToast({ title: error.message, icon: 'none' }); }
    finally { if (this._alive) this.setData({ actionBusy: false }); }
  }
});
