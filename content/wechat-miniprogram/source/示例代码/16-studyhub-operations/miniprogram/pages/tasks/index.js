const { feedback } = require('../../utils/feedback');
const repository = require('../../services/cloud-repository');
const navigation = require('../../services/navigation');
const { pickFields } = require('../../utils/task');
const { taskRow, appendRows } = require('../../utils/task-view');
Page({
  data: { items: [], filter: 'all', cursor: null, hasMore: false, status: 'loading', errorMessage: '', feedback: null,
    loadingMore: false, actionBusy: false, windowPages: 0, windowNumber: 1, windowLimit: 6 },
  onLoad() { this._alive = true; this._epoch = 0; this._records = []; },
  onShow() { this._visible = true; this.refresh(); },
  onHide() { this._visible = false; this._epoch += 1; },
  onUnload() { this._alive = false; this._epoch += 1; this._records = []; },
  async refresh() {
    const epoch = ++this._epoch; this._records = [];
    this.setData({ status: 'loading', errorMessage: '', feedback: null, loadingMore: false, items: [], cursor: null,
      hasMore: false, windowPages: 0, windowNumber: 1 });
    try {
      const page = await repository.list({ filter: this.data.filter });
      if (!this._alive || !this._visible || epoch !== this._epoch) return;
      this.setData({ items: page.items.map(taskRow), cursor: page.nextCursor, hasMore: page.nextCursor !== null,
        windowPages: 1, status: page.items.length ? 'ready' : 'empty' });
      this._records = page.items;
    } catch (error) { if (this._alive && epoch === this._epoch) this.setData({ status: 'error', errorMessage: error.message, feedback: feedback(error) }); }
  },
  onMore() { return this.loadMore(false); }, onNextWindow() { return this.loadMore(true); },
  async loadMore(nextWindow) {
    if (this.data.loadingMore || !this.data.hasMore || !['ready','empty'].includes(this.data.status)) return;
    if (nextWindow !== (this.data.windowPages >= this.data.windowLimit)) return;
    const epoch = this._epoch, cursor = this.data.cursor;
    this.setData({ loadingMore: true, errorMessage: '', feedback: null });
    try {
      const page = await repository.list({ filter: this.data.filter, cursor });
      if (!this._alive || !this._visible || epoch !== this._epoch) return;
      const previous = nextWindow ? [] : this._records, seen = new Set(previous.map(x => x.id));
      const added = page.items.filter(x => { if (seen.has(x.id)) return false; seen.add(x.id); return true; });
      const projected = added.map(taskRow);
      const patch = nextWindow ? { items: projected } : appendRows(this.data.items, projected).patch;
      this.setData({ ...patch, cursor: page.nextCursor, hasMore: page.nextCursor !== null,
        windowPages: nextWindow ? 1 : this.data.windowPages + 1,
        windowNumber: nextWindow ? this.data.windowNumber + 1 : this.data.windowNumber,
        status: previous.length + added.length ? 'ready' : 'empty' });
      this._records = [...previous, ...added];
    } catch (error) {
      if (this._alive && epoch === this._epoch) {
        const view = feedback(error), action = nextWindow ? 'nextWindow' : 'retryMore';
        this.setData({ errorMessage: error.message, feedback: view && view.action === 'retry' ? { ...view, action, actionText: nextWindow ? '重试下一组' : '重试下一页' } : view });
      }
    } finally { if (this._alive && epoch === this._epoch) this.setData({ loadingMore: false }); }
  },
  onFilter(event) { const filter = event.currentTarget.dataset.filter; if (!['all','pending','done'].includes(filter)) return; this.setData({ filter }); this.refresh(); },
  onCreate() { navigation.openEditor(); }, onOpen(event) { navigation.openDetail(event.detail.id); },
  async onToggle(event) {
    if (this.data.actionBusy) return;
    const task = this._records.find(x => x.id === event.detail.id); if (!task) return;
    this.setData({ actionBusy: true });
    try { await repository.update(task.id, task.version, { ...pickFields(task), done: !task.done }); if (this._alive && this._visible) await this.refresh(); }
    catch (error) { if (this._alive && this._visible) this.setData({ feedback: feedback(error, 'write') }); }
    finally { if (this._alive) this.setData({ actionBusy: false }); }
  },
  onFeedback(event) {
    const kind = event.detail.kind;
    if (kind === 'retry') return this.refresh();
    if (kind === 'retryMore') return this.onMore();
    if (kind === 'nextWindow') return this.onNextWindow();
    if (kind === 'pending') return wx.navigateTo({ url: '/pages/pending/index' });
    if (kind === 'account') return wx.switchTab({ url: '/pages/account/index' });
    if (kind === 'list') return wx.switchTab({ url: '/pages/tasks/index' });
  }
});
