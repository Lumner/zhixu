const repository = require('../../services/focus-repository');
const { labels, localTime, formatSeconds } = require('../../utils/focus-view');
const mapRow = row => ({ ...row, label: labels[row.state], startedText: localTime(row.startedAt), endedText: localTime(row.endedAt),
  effectiveText: row.effectiveSeconds === null ? '尚未形成终态记录' : formatSeconds(row.effectiveSeconds) });
Page({
  data: { items: [], cursor: null, hasMore: false, loading: false, loadingMore: false, errorMessage: '' },
  onLoad() { this._alive = true; this._epoch = 0; }, onShow() { this._visible = true; this.refresh(); },
  onHide() { this._visible = false; this._epoch += 1; }, onUnload() { this._alive = false; this._epoch += 1; },
  async refresh() {
    const epoch = ++this._epoch; this.setData({ loading: true, loadingMore: false, items: [], cursor: null, hasMore: false, errorMessage: '' });
    try {
      await repository.current(); // 先核对最近一轮的到时终态，再读取历史。
      if (!this._alive || !this._visible || epoch !== this._epoch) return;
      const page = await repository.list();
      if (this._alive && this._visible && epoch === this._epoch) this.setData({ items: page.items.map(mapRow), cursor: page.nextCursor, hasMore: page.nextCursor !== null });
    } catch (error) { if (this._alive && epoch === this._epoch) this.setData({ errorMessage: error.message }); }
    finally { if (this._alive && epoch === this._epoch) this.setData({ loading: false }); }
  },
  async onMore() {
    if (!this.data.hasMore || this.data.loadingMore || this.data.loading) return;
    const epoch = this._epoch; this.setData({ loadingMore: true });
    try {
      const page = await repository.list(this.data.cursor);
      if (!this._alive || !this._visible || epoch !== this._epoch) return;
      const seen = new Set(this.data.items.map(row => row.id));
      this.setData({ items: [...this.data.items, ...page.items.filter(row => !seen.has(row.id)).map(mapRow)], cursor: page.nextCursor, hasMore: page.nextCursor !== null });
    } catch (error) { if (this._alive && epoch === this._epoch) this.setData({ errorMessage: error.message }); }
    finally { if (this._alive && epoch === this._epoch) this.setData({ loadingMore: false }); }
  },
  onFocus() { wx.switchTab({ url: '/pages/focus/index' }); }
});
