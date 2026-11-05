const repository = require('../../services/cloud-repository');
const { ping } = require('../../services/cloud-client');
Page({
  data: { userTag: '', appId: '', status: 'loading', errorMessage: '', pingMessage: '', pingBusy: false },
  onLoad() { this._alive = true; this._epoch = 0; },
  onShow() { this._visible = true; this.refresh(); },
  onHide() { this._visible = false; this._epoch += 1; },
  onUnload() { this._alive = false; this._epoch += 1; },
  async refresh() {
    const epoch = ++this._epoch;
    this.setData({ status: 'loading', errorMessage: '', userTag: '', appId: '' });
    try {
      const identity = await repository.whoami();
      if (this._alive && epoch === this._epoch) this.setData({ userTag: identity.userTag, appId: identity.appId, status: 'ready' });
    } catch (error) { if (this._alive && epoch === this._epoch) this.setData({ status: 'error', errorMessage: error.message }); }
  },
  onQuality() { wx.navigateTo({ url: '/packageLab/pages/quality-lab/index' }); },
  onPrivacy() { wx.navigateTo({ url: '/packageLab/pages/privacy/index' }); },
  onCompatibility() { wx.navigateTo({ url: '/packageLab/pages/compatibility/index' }); },
  onPerformance() { wx.navigateTo({ url: '/packageLab/pages/performance/index' }); },
  onDrafts() { wx.navigateTo({ url: '/pages/drafts/index' }); },
  onGallery() { wx.navigateTo({ url: '/pages/gallery/index' }); },
  onPending() { wx.navigateTo({ url: '/pages/pending/index' }); },
  onMigrate() { wx.navigateTo({ url: '/pages/migrate/index' }); },
  onPlatform() { wx.navigateTo({ url: '/packageLab/pages/platform/index' }); },
  async onPing() {
    if (this.data.pingBusy) return;
    this.setData({ pingBusy: true });
    try {
      const result = await ping();
      if (this._alive && this._visible) this.setData({ pingMessage: result.message + '；微信身份上下文：' + (result.hasWechatIdentity ? '存在' : '不存在') });
    } catch (error) { if (this._alive && this._visible) this.setData({ pingMessage: error.message }); }
    finally { if (this._alive) this.setData({ pingBusy: false }); }
  }
});
