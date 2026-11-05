const outbox = require('../../services/outbox');
const drafts = require('../../services/task-drafts');
const { feedback } = require('../../utils/feedback');
Page({
  data: { items: [], status: 'loading', busy: false, feedback: null },
  onLoad() { this._alive = true; this._epoch = 0; }, onShow() { this._visible = true; this.refresh(); },
  onHide() { this._visible = false; this._epoch += 1; this.setData({ items: [] }); }, onUnload() { this._alive = false; this._epoch += 1; },
  async refresh() {
    const token = ++this._epoch; this.setData({ items: [], status: 'loading', feedback: null });
    try {
      const owner = await outbox.identity(), rows = drafts.list(owner);
      if (!this._alive || !this._visible || token !== this._epoch) return;
      this._owner = owner;
      this.setData({ status: rows.length ? 'ready' : 'empty', items: rows.map(row => ({ slot: row.slot, revision: row.revision,
        id: row.slot === 'task:new' ? '' : row.slot.slice(8), title: row.values.title || '尚未填写标题', phase: row.phase })) });
    } catch (error) { if (this._alive && token === this._epoch) this.setData({ status: 'error', feedback: feedback(error) }); }
  },
  onOpen(event) { const row = this.data.items.find(item => item.slot === event.currentTarget.dataset.slot); if (row) wx.navigateTo({ url: '/pages/task-compose/index' + (row.id ? '?id=' + encodeURIComponent(row.id) : '') }); },
  onDiscard(event) {
    const row = this.data.items.find(item => item.slot === event.currentTarget.dataset.slot);
    if (!row || row.phase !== 'editing' || this.data.busy) return;
    const expectedOwner = this._owner, token = this._epoch;
    wx.showModal({ title: '删除未提交的本地草稿', content: '只清理所选草稿，不修改云端。任务已被删除时也可在此清理；请先复制需要保留的输入。',
      success: async result => {
        if (!result.confirm || !this._alive || !this._visible || this.data.busy) return;
        this.setData({ busy: true }); let removed = false;
        try {
          if (await outbox.identity() !== expectedOwner) throw Object.assign(new Error('身份发生变化'), { code: 'IDENTITY_CHANGED' });
          if (!this._alive || !this._visible || token !== this._epoch) return;
          const current = drafts.get(expectedOwner, row.id);
          if (!current || current.revision !== row.revision || current.phase !== 'editing') throw Object.assign(new Error('草稿已变化'), { code: 'DRAFT_CHANGED' });
          drafts.clear(expectedOwner, row.id, row.revision); removed = true;
        } catch (error) { if (this._alive) this.setData({ feedback: feedback(error, 'write') }); }
        finally { if (this._alive) { this.setData({ busy: false }); if (removed && this._visible) this.refresh(); } }
      } });
  },
  async onCopy(event) {
    if (this.data.busy || typeof wx.setClipboardData !== 'function') return;
    const row = this.data.items.find(item => item.slot === event.currentTarget.dataset.slot); if (!row) return;
    const expectedOwner = this._owner, token = this._epoch;
    try {
      if (await outbox.identity() !== expectedOwner) throw Object.assign(new Error('身份变化'), { code: 'IDENTITY_CHANGED' });
      if (!this._alive || !this._visible || token !== this._epoch) return;
      const current = drafts.get(expectedOwner, row.id);
      if (!current || current.revision !== row.revision) throw Object.assign(new Error('草稿变化'), { code: 'DRAFT_CHANGED' });
      wx.setClipboardData({ data: JSON.stringify(current.values, null, 2), fail: () => { if (this._alive) this.setData({ feedback: { code: 'CLIPBOARD', title: '复制未完成', message: '请保留草稿并核对剪贴板能力。' } }); } });
    } catch (error) { if (this._alive) this.setData({ feedback: feedback(error) }); }
  },
  onFeedback(event) { if (event.detail.kind === 'account') wx.switchTab({ url: '/pages/account/index' }); else if (event.detail.kind === 'retry') this.refresh(); }
});
