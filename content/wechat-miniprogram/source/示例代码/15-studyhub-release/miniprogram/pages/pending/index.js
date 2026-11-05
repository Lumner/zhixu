const outbox = require('../../services/outbox');
const repository = require('../../services/cloud-repository');
const { pickFields } = require('../../utils/task');
const knowledge = require('../../services/knowledge-repository');
const noteSchema = require('../../shared/knowledge-schema');
Page({
  data: { items: [], busy: false, errorMessage: '', conflictId: '', localText: '', cloudText: '' },
  onLoad() { this._alive = true; }, onShow() { this.refresh(); }, onUnload() { this._alive = false; },
  async refresh() {
    try {
      const items = await outbox.list();
      if (this._alive) this.setData({ items: items.map(row => ({ opId: row.opId, action: row.action, state: row.state,
        errorCode: row.errorCode || '', errorMessage: row.errorMessage || '',
        isFocus: ['focusStart', 'focusPause', 'focusResume', 'focusStop'].includes(row.action),
        label: row.action === 'focusStart' ? '开始一轮专注' : row.action.startsWith('focus') ? '专注状态操作'
          : row.payload.fields ? row.payload.fields.title : row.payload.caption || row.payload.id || row.payload.localId })) });
    } catch (error) { if (this._alive) this.setData({ errorMessage: error.message }); }
  },
  async onRetry(event) {
    if (this.data.busy) return; this.setData({ busy: true, errorMessage: '' });
    try { await outbox.retry(event.currentTarget.dataset.id); }
    catch (error) { if (this._alive) this.setData({ errorMessage: error.message }); }
    finally { if (this._alive) { this.setData({ busy: false }); await this.refresh(); } }
  },
  async onCompare(event) {
    if (this.data.busy) return; this.setData({ busy: true, errorMessage: '', conflictId: '' });
    try {
      const row = (await outbox.list()).find(item => item.opId === event.currentTarget.dataset.id);
      if (!row || !['update', 'noteUpdate'].includes(row.action) || row.errorCode !== 'CONFLICT') throw new Error('该记录不是编辑冲突');
      const latest = row.action === 'noteUpdate' ? await knowledge.get(row.payload.id) : await repository.get(row.payload.id);
      if (this._alive) { this._latestVersion = latest.version; this.setData({ conflictId: row.opId,
        localText: JSON.stringify(row.payload.fields, null, 2), cloudText: JSON.stringify(row.action === 'noteUpdate' ? noteSchema.pickFields(latest) : pickFields(latest), null, 2) }); }
    } catch (error) { if (this._alive) this.setData({ errorMessage: error.message }); }
    finally { if (this._alive) this.setData({ busy: false }); }
  },
  async onRebase() {
    if (this.data.busy || !this.data.conflictId) return;
    const opId = this.data.conflictId, version = this._latestVersion;
    const answer = await new Promise(resolve => wx.showModal({ title: '用保留草稿覆盖所示字段？', content: '将重新提交展示的全部业务字段。笔记包括标签、附件和任务关联；期间再次变化仍会冲突。请先核对两份内容。', success: resolve, fail: () => resolve({ confirm: false }) }));
    if (!answer.confirm || !this._alive || this.data.busy) return;
    this.setData({ busy: true, errorMessage: '' });
    try { await outbox.rebase(opId, version); if (this._alive) this.setData({ conflictId: '' }); }
    catch (error) { if (this._alive) this.setData({ errorMessage: error.message }); }
    finally { if (this._alive) { this.setData({ busy: false }); await this.refresh(); } }
  },
  async onDiscard(event) {
    if (this.data.busy) return;
    const opId = event.currentTarget.dataset.id;
    const answer = await new Promise(resolve => wx.showModal({ title: '放弃被拒绝的草稿？', content: '仅能移除已收到业务拒绝的记录。需要保留内容时先点“复制草稿”。', success: resolve, fail: () => resolve({ confirm: false }) }));
    if (!answer.confirm || !this._alive || this.data.busy) return;
    this.setData({ busy: true });
    try { await outbox.discard(opId); if (this._alive) this.setData({ conflictId: '' }); }
    catch (error) { if (this._alive) this.setData({ errorMessage: error.message }); }
    finally { if (this._alive) { this.setData({ busy: false }); await this.refresh(); } }
  },
  onFocus() { wx.switchTab({ url: '/pages/focus/index' }); },
  async onCopy(event) {
    try {
      const row = (await outbox.list()).find(item => item.opId === event.currentTarget.dataset.id);
      if (row && this._alive) wx.setClipboardData({ data: JSON.stringify(row, null, 2) });
    } catch (error) { if (this._alive) this.setData({ errorMessage: error.message }); }
  }
});
