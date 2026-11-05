const repository = require('../../services/knowledge-repository');
const navigation = require('../../services/knowledge-navigation');
const taskNavigation = require('../../services/navigation');
const images = require('../../services/images');
const { validId, pickFields } = require('../../shared/knowledge-schema');
const { toNodes } = require('../../utils/note-nodes');
const confirm = options => new Promise(resolve => wx.showModal({ ...options, success: resolve, fail: () => resolve({ confirm: false }) }));
Page({
  data: { note: null, nodes: [], status: 'loading', busy: false, errorMessage: '' },
  onLoad(options) { this._alive = true; this._epoch = 0; if (options && validId(options.id)) this._id = options.id; else this.setData({ status: 'error', errorMessage: '缺少或不合法的内容编号' }); },
  onShow() { this._visible = true; if (this._id) this.refresh(); },
  onHide() { this._visible = false; this._epoch += 1; }, onUnload() { this._alive = false; this._epoch += 1; },
  async refresh() {
    const epoch = ++this._epoch; this.setData({ status: 'loading', errorMessage: '' });
    try { const note = await repository.get(this._id); if (this._alive && epoch === this._epoch) this.setData({ note, nodes: toNodes(note.content), status: 'ready' }); }
    catch (error) { if (this._alive && epoch === this._epoch) this.setData({ status: 'error', note: null, errorMessage: error.message }); }
  },
  onEdit() { if (!this.data.busy && this.data.note) navigation.editor({ id: this._id }); },
  async onStar() {
    if (this.data.busy || !this.data.note) return;
    const note = this.data.note; this.setData({ busy: true, errorMessage: '' });
    try { await repository.update(note.id, note.version, { ...pickFields(note), favorite: !note.favorite }); if (this._alive && this._visible) await this.refresh(); }
    catch (error) { if (this._alive) this.setData({ errorMessage: error.message + (error.queued ? '；请到待处理页核对原操作。' : '') }); }
    finally { if (this._alive) this.setData({ busy: false }); }
  },
  async onRemove() {
    if (this.data.busy || !this.data.note) return;
    const note = this.data.note;
    const answer = await confirm({ title: '删除这条内容？', content: '会解除图片引用；图片仍保留在私人图库中。' });
    if (!answer.confirm || !this._alive || this.data.busy) return;
    this.setData({ busy: true, errorMessage: '' });
    try { await repository.remove(note.id, note.version); if (this._alive && this._visible) navigation.back(); }
    catch (error) { if (this._alive) this.setData({ errorMessage: error.message + (error.queued ? '；请到待处理页核对原操作。' : '') }); }
    finally { if (this._alive) this.setData({ busy: false }); }
  },
  async onPreview(event) {
    if (this.data.busy || !this.data.note || !this.data.note.assetIds.includes(event.currentTarget.dataset.id)) return;
    this.setData({ busy: true, errorMessage: '' });
    try { await images.preview(event.currentTarget.dataset.id); }
    catch (error) { if (this._alive) this.setData({ errorMessage: error.message || error.errMsg }); }
    finally { if (this._alive) this.setData({ busy: false }); }
  },
  onCopyLink() { if (this.data.note && this.data.note.url) wx.setClipboardData({ data: this.data.note.url }); },
  onTask() { if (this.data.note && this.data.note.taskId) taskNavigation.openDetail(this.data.note.taskId); },
  onPending() { wx.navigateTo({ url: '/pages/pending/index' }); }, onBack() { navigation.back(); }
});
