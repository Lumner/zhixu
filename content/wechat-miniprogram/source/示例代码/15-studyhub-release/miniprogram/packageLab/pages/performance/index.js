const { comparison, dataset, percentile } = require('../../../utils/perf-scenario');
const { taskRow } = require('../../../utils/task-view');
const { utf8Bytes } = require('../../../utils/report-file');
const { createPatchWaiter } = require('../../../utils/patch-waiter');
Page({
  data: { busy: false, modelText: '', nativeText: '', entriesText: '', readyText: '', benchRows: [] },
  onLoad() {
    this._alive = true; this._visible = true; this._epoch = 0; this._owner = null; this._loadWall = Date.now();
    this._waiter = createPatchWaiter({ send: (patch, callback) => this.setData(patch, callback) });
  },
  onReady() { const value = Date.now() - this._loadWall; this.setData({ readyText: value >= 0 ? `本页onLoad到onReady墙钟差：${value}ms；不是小程序冷启动或首像素时间。` : '时钟变化，本次生命周期差值作废。' }); },
  onShow() { this._visible = true; if (this._cancelled) { this._cancelled = false; this.setData({ nativeText: '上次测量未完成，样本已作废。可重新选择模式。' }); } },
  onHide() { this._visible = false; this._cancelled = this._owner !== null; this._owner = null; this._epoch++; this._waiter.cancel(); this.setData({ busy: false }); },
  onUnload() { this._alive = false; this._visible = false; this._owner = null; this._epoch++; this._waiter.dispose(); },
  onModel() { this.setData({ modelText: JSON.stringify(comparison(), null, 2) }); },
  async onNative(event) {
    const mode = event.currentTarget.dataset.mode;
    if (!['full','path'].includes(mode) || this._owner !== null || !this._visible) return;
    const token = ++this._epoch; this._owner = token;
    this.setData({ busy: true, nativeText: '固定数据测量中；离开页面会作废本轮。' });
    let rows = dataset().map(taskRow), bytes = 0; const samples = [];
    try {
      const initialMs = await this._waiter.apply({ benchRows: rows });
      for (let index = 0; index < 40; index++) {
        if (!this._alive || !this._visible || token !== this._epoch) throw Object.assign(new Error('cancelled'), { code: 'CANCELLED' });
        const at = index % rows.length;
        rows = rows.map((row, i) => i === at ? { ...row, done: !row.done } : row);
        const patch = mode === 'full' ? { benchRows: rows } : { ['benchRows[' + at + '].done']: rows[at].done };
        bytes += utf8Bytes(JSON.stringify(patch)); samples.push(await this._waiter.apply(patch));
      }
      if (this._alive && this._visible && token === this._epoch) this.setData({ nativeText: JSON.stringify({
        mode, rows: rows.length, updateCalls: samples.length, updateJsonBytes: bytes, initialCallbackMs: initialMs,
        callbackMedianMs: percentile(samples, 0.5), callbackP95Ms: percentile(samples, 0.95),
        clock: 'Date.now墙钟，可能受分辨率与改时影响',
        meaning: 'setData调用到更新回调的本轮分布；不是FPS、网络流量、物理绘制完成或冷启动。'
      }, null, 2) });
    } catch (error) { if (this._alive && this._visible && token === this._epoch) this.setData({ nativeText: '本轮没有完整有效结果：' + (error.code || error.message) }); }
    finally { if (this._owner === token) { this._owner = null; if (this._alive && this._visible) this.setData({ busy: false }); } }
  },
  onEntries() {
    const app = getApp(); const result = app.performanceEntries ? app.performanceEntries.snapshot() : { active: false, entries: [] };
    this.setData({ entriesText: JSON.stringify(result, null, 2) });
  },
  onImages() { wx.navigateTo({ url: '/packageLab/pages/image-lab/index' }); },
  onQuality() { wx.navigateTo({ url: '/packageLab/pages/quality-lab/index' }); }
});
