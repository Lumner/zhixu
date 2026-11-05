const { feedback } = require('../../utils/feedback');
const repository = require('../../services/knowledge-repository');
const navigation = require('../../services/knowledge-navigation');
const { normalizeTag } = require('../../shared/knowledge-schema');
Page({
  data: { q: '', tag: '', kindIndex: 0, kinds: ['全部', '学习笔记', '资源收藏'], favoriteOnly: false,
    items: [], status: 'loading', cursor: null, hasMore: false, loadingMore: false, errorMessage: '', feedback: null, scanned: 0 },
  onLoad() { this._alive = true; this._epoch = 0; },
  onShow() { this._visible = true; this.refresh(); },
  onHide() { this._visible = false; this.cancel(); },
  onUnload() { this._alive = false; this.cancel(); },
  cancel() { this._epoch += 1; clearTimeout(this._timer); },
  query() {
    return { q: this.data.q.trim(), tag: this.data.tag.trim() ? normalizeTag(this.data.tag) : '',
      kind: ['all', 'note', 'link'][this.data.kindIndex], favoriteOnly: this.data.favoriteOnly };
  },
  onInput(event) {
    const field = event.currentTarget.dataset.field;
    if (!['q', 'tag'].includes(field)) return;
    this.setData({ [field]: event.detail.value, items: [], status: 'waiting', feedback: null, hasMore: false, cursor: null, loadingMore: false });
    this.cancel(); this._timer = setTimeout(() => { if (this._alive && this._visible) this.refresh(); }, 300);
  },
  onKind(event) { const index = Number(event.detail.value); if (![0, 1, 2].includes(index)) return; this.setData({ kindIndex: index }); this.refresh(); },
  onFavorite(event) { this.setData({ favoriteOnly: event.detail.value }); this.refresh(); },
  async refresh() {
    this.cancel(); const epoch = this._epoch; let query;
    this.setData({ items: [], status: 'loading', loadingMore: false, cursor: null, hasMore: false, scanned: 0, errorMessage: '', feedback: null });
    try {
      query = this.query(); const page = await repository.list(query);
      if (!this._alive || !this._visible || epoch !== this._epoch) return;
      this._query = query; this.apply(page, false);
    } catch (error) { if (this._alive && epoch === this._epoch) this.setData({ status: 'error', errorMessage: error.message, feedback: feedback(error) }); }
  },
  apply(page, more) {
    const old = more ? this.data.items : [], seen = new Set(old.map(item => item.id));
    const items = [...old, ...page.items.filter(item => !seen.has(item.id))];
    this.setData({ items, cursor: page.nextCursor, hasMore: page.nextCursor !== null,
      scanned: (more ? this.data.scanned : 0) + page.scanned, status: items.length ? 'ready' : page.nextCursor ? 'searching' : 'empty' });
  },
  async onMore() {
    if (!this.data.hasMore || this.data.loadingMore || !this._query) return;
    const epoch = this._epoch, cursor = this.data.cursor; this.setData({ loadingMore: true, errorMessage: '', feedback: null });
    try {
      const page = await repository.list(this._query, cursor);
      if (this._alive && this._visible && epoch === this._epoch) this.apply(page, true);
    } catch (error) { if (this._alive && epoch === this._epoch) { const view = feedback(error); this.setData({ errorMessage: error.message, feedback: view && view.action === 'retry' ? { ...view, action: 'retryMore', actionText: '重试下一页' } : view }); } }
    finally { if (this._alive && epoch === this._epoch) this.setData({ loadingMore: false }); }
  },
  onOpen(event) { navigation.detail(event.currentTarget.dataset.id); },
  onNewNote() { navigation.editor(); }, onNewLink() { navigation.editor({ kind: 'link' }); },
  onLab() { wx.navigateTo({ url: '/pages/editor-lab/index' }); },
  onFeedback(event) {
    const kind = event.detail.kind;
    if (kind === 'retry') return this.refresh();
    if (kind === 'retryMore') return this.onMore();
    if (kind === 'pending') return wx.navigateTo({ url: '/pages/pending/index' });
    if (kind === 'account') return wx.switchTab({ url: '/pages/account/index' });
    if (kind === 'list') return wx.switchTab({ url: '/pages/tasks/index' });
  }

});
