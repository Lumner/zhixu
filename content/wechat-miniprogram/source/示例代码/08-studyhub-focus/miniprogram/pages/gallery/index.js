const images = require('../../services/images');
Page({
  data: { items: [], cursor: null, hasMore: false, busy: false, caption: '', selectedPath: '', selectedBytes: 0, errorMessage: '' },
  onLoad() { this._alive = true; this._epoch = 0; },
  onShow() { this.refresh(); },
  onUnload() { this._alive = false; this._epoch += 1; },
  onCaption(event) { this.setData({ caption: event.detail.value }); },
  async refresh() { await this.load(false); },
  async onMore() { if (this.data.hasMore) await this.load(true); },
  async load(more) {
    if (this.data.busy) return;
    const epoch = ++this._epoch; this.setData({ busy: true, errorMessage: '' });
    try {
      const page = await images.list(more ? this.data.cursor : null);
      if (this._alive && epoch === this._epoch) this.setData({ items: more ? [...this.data.items, ...page.items] : page.items,
        cursor: page.nextCursor, hasMore: page.nextCursor !== null });
    } catch (error) { if (this._alive) this.setData({ errorMessage: error.message }); }
    finally { if (this._alive) this.setData({ busy: false }); }
  },
  async onChoose() {
    if (this.data.busy) return; this.setData({ busy: true, errorMessage: '' });
    try {
      const result = await images.choose();
      if (this._alive) { this._base64 = result.base64; this.setData({ selectedPath: result.localPath, selectedBytes: result.bytes }); }
    } catch (error) { if (this._alive) this.setData({ errorMessage: /cancel/.test(error.errMsg || '') ? '已取消选择，原选择保留' : error.message || error.errMsg }); }
    finally { if (this._alive) this.setData({ busy: false }); }
  },
  async onUpload() {
    if (this.data.busy || !this._base64) return;
    if (!this.data.caption.trim()) { this.setData({ errorMessage: '请填写图片标题' }); return; }
    this.setData({ busy: true, errorMessage: '' });
    let saved = false;
    try {
      await images.upload(this.data.caption, this._base64);
      saved = true;
      if (this._alive) { this._base64 = ''; this.setData({ selectedPath: '', selectedBytes: 0, caption: '' }); }
    } catch (error) { if (this._alive) this.setData({ errorMessage: error.message + '；待处理页保留已发出的操作，请先核对再重新选择上传。' }); }
    finally { if (this._alive) this.setData({ busy: false }); }
    if (this._alive && saved) await this.refresh();
  },
  async onPreview(event) {
    if (this.data.busy) return; this.setData({ busy: true, errorMessage: '' });
    try { await images.preview(event.currentTarget.dataset.id); }
    catch (error) { if (this._alive) this.setData({ errorMessage: error.message || error.errMsg }); }
    finally { if (this._alive) this.setData({ busy: false }); }
  },
  async onRemove(event) {
    if (this.data.busy) return;
    const id = event.currentTarget.dataset.id;
    const answer = await new Promise(resolve => wx.showModal({ title: '删除图片', content: '停止云端访问并清理文件。已经下载到设备的副本仍需手动清理。', success: resolve, fail: () => resolve({ confirm: false }) }));
    if (!answer.confirm || !this._alive || this.data.busy) return;
    this.setData({ busy: true, errorMessage: '' });
    let notice = '';
    try {
      const result = await images.remove(id);
      if (result.cleanupPending) notice = '已停止访问，物理文件清理待重试。可再次点击清理。';
    } catch (error) { notice = error.message; }
    finally { if (this._alive) this.setData({ busy: false }); }
    if (this._alive) await this.refresh();
    if (this._alive && notice) this.setData({ errorMessage: notice });
  },
  async onClearPreview() { await images.clearPreview(); wx.showToast({ title: '预览缓存已清理' }); },
  onPending() { wx.navigateTo({ url: '/pages/pending/index' }); }
});
