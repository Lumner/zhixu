const repository = require('../../services/knowledge-repository');
const tasks = require('../../services/cloud-repository');
const images = require('../../services/images');
const navigation = require('../../services/knowledge-navigation');
const schema = require('../../shared/knowledge-schema');
const { toNodes } = require('../../utils/note-nodes');
Page({
  data: { title: '', content: '', tagsInput: '', url: '', favorite: false, assetIds: [], taskId: '', taskTitle: '',
    kindIndex: 0, kinds: ['学习笔记', '资源收藏'], loading: true, saving: false, blocked: false, saved: false,
    recoveryRequired: false, errorMessage: '', nodes: [], assetRows: [], selected: [], loadingAssets: false, hasMoreAssets: false, assetError: '' },
  async onLoad(options = {}) {
    this._alive = true; this._assetEpoch = 0;
    try {
      if (options.id !== undefined && !schema.validId(options.id)) throw new Error('内容编号不合法');
      if (options.taskId !== undefined && !schema.validId(options.taskId)) throw new Error('关联任务编号不合法');
      if (options.kind !== undefined && !['note', 'link'].includes(options.kind)) throw new Error('内容类型不合法');
      this._id = options.id || '';
      let taskId = options.taskId || '';
      if (this._id) {
        const note = await repository.get(this._id); if (!this._alive) return;
        this._version = note.version; taskId = note.taskId;
        this.setData({ title: note.title, content: note.content, tagsInput: note.tags.join(', '), url: note.url,
          favorite: note.favorite, kindIndex: note.kind === 'link' ? 1 : 0, assetIds: note.assetIds, taskId });
      } else this.setData({ kindIndex: options.kind === 'link' ? 1 : 0, taskId });
      if (taskId) {
        try { const task = await tasks.get(taskId); if (this._alive) this.setData({ taskTitle: task.title }); }
        catch (_) { if (this._alive) this.setData({ taskTitle: '关联任务暂不可用，可解除关联后保存' }); }
      }
      if (this._alive) { this._initialized = true; this.updateSelected(); await this.loadAssets(false); }
    } catch (error) { if (this._alive) this.setData({ blocked: true, errorMessage: error.message }); }
    finally { if (this._alive) this.setData({ loading: false }); }
  },
  onShow() { if (this._initialized && this._alive) this.loadAssets(false); },
  onUnload() { this._alive = false; this._assetEpoch += 1; },
  locked() { return this.data.loading || this.data.saving || this.data.saved || this.data.blocked || this.data.recoveryRequired; },
  onText(event) {
    const field = event.currentTarget.dataset.field;
    if (!this.locked() && ['title', 'content', 'tagsInput', 'url'].includes(field)) this.setData({ [field]: event.detail.value });
  },
  onKind(event) { const index = Number(event.detail.value); if (!this.locked() && [0, 1].includes(index)) this.setData({ kindIndex: index }); },
  onFavorite(event) { if (!this.locked()) this.setData({ favorite: event.detail.value }); },
  onUnlinkTask() { if (!this.locked()) this.setData({ taskId: '', taskTitle: '' }); },
  fields() {
    return schema.cleanFields({ kind: this.data.kindIndex === 1 ? 'link' : 'note', title: this.data.title,
      content: this.data.content, tags: this.data.tagsInput.split(/[,，]/).map(tag => tag.trim()).filter(Boolean),
      url: this.data.url, favorite: this.data.favorite, assetIds: this.data.assetIds, taskId: this.data.taskId });
  },
  onPreview() { if (!this.data.loading) this.setData({ nodes: toNodes(this.data.content) }); },
  async loadAssets(more) {
    if (this.data.loadingAssets) return;
    const epoch = ++this._assetEpoch; this.setData({ loadingAssets: true, assetError: '' });
    try {
      const page = await images.list(more ? this._assetCursor : null);
      if (!this._alive || epoch !== this._assetEpoch) return;
      const previous = more ? this.data.assetRows : [], seen = new Set(previous.map(item => item.id));
      const rows = [...previous, ...page.items.filter(item => item.state === 'active' && !seen.has(item.id))];
      this._assetCursor = page.nextCursor;
      this.setData({ assetRows: rows, hasMoreAssets: page.nextCursor !== null }); this.updateSelected();
    } catch (error) { if (this._alive && epoch === this._assetEpoch) this.setData({ assetError: error.message }); }
    finally { if (this._alive && epoch === this._assetEpoch) this.setData({ loadingAssets: false }); }
  },
  onMoreAssets() { if (this.data.hasMoreAssets) this.loadAssets(true); },
  onRefreshAssets() { this.loadAssets(false); },
  updateSelected() {
    const selected = this.data.assetIds.map(id => { const asset = this.data.assetRows.find(row => row.id === id); return { id, caption: asset ? asset.caption : '已关联图片（可移除）' }; });
    this.setData({ selected, assetRows: this.data.assetRows.map(row => ({ ...row, selected: this.data.assetIds.includes(row.id) })) });
  },
  onAsset(event) {
    if (this.locked()) return;
    const id = event.currentTarget.dataset.id, ids = this.data.assetIds;
    if (!schema.validId(id)) return;
    if (!ids.includes(id) && !this.data.assetRows.some(row => row.id === id)) return;
    if (!ids.includes(id) && ids.length >= 3) { this.setData({ assetError: '最多选择三张图片' }); return; }
    this.setData({ assetIds: ids.includes(id) ? ids.filter(value => value !== id) : [...ids, id] }); this.updateSelected();
  },
  async onSubmit() {
    if (this.locked()) return;
    let fields;
    try { fields = this.fields(); } catch (error) { this.setData({ errorMessage: error.message }); return; }
    this.setData({ saving: true, errorMessage: '' });
    try {
      if (this._id) await repository.update(this._id, this._version, fields); else await repository.create(fields);
      if (this._alive) { this.setData({ saved: true }); wx.showToast({ title: '已保存' }); navigation.back(); }
    } catch (error) { if (this._alive) this.setData({ errorMessage: error.message, recoveryRequired: error.queued === true }); }
    finally { if (this._alive) this.setData({ saving: false }); }
  },
  onGallery() { if (!this.data.saving) wx.navigateTo({ url: '/pages/gallery/index' }); },
  onPending() { wx.navigateTo({ url: '/pages/pending/index' }); }, onBack() { navigation.back(); }
});
