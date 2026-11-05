const { createReadController } = require('../../services/read-controller');
Page({
  data: { mode: 'normal', status: 'idle', items: [], feedback: null, stale: false, requests: 0 },
  onLoad() {
    this._alive = true; this._timers = new Set(); this._counts = {};
    this._reader = createReadController({ emit: state => { if (this._alive) this.setData(state); }, load: mode => {
      this._counts[mode] = (this._counts[mode] || 0) + 1;
      if (this._alive) this.setData({ requests: this.data.requests + 1 });
      const rows = [{ id: 'demo-one', title: '固定教学任务：观察读取状态' }, { id: 'demo-two', title: '切换模式，检查旧结果是否失效' }];
      if (mode === 'empty') return Promise.resolve([]);
      if (mode === 'error' || mode === 'flaky' && this._counts[mode] % 2 === 0) return Promise.reject(Object.assign(new Error('固定故障'), { code: 'NETWORK' }));
      if (mode === 'never') return new Promise(() => {});
      if (mode === 'slow') return new Promise(resolve => { const timer = setTimeout(() => { this._timers.delete(timer); resolve(rows); }, 3000); this._timers.add(timer); });
      return Promise.resolve(rows);
    } });
  },
  onShow() { if (this._reader) this._reader.request(this.data.mode, true); },
  onHide() { if (this._reader) this._reader.cancel(); },
  onUnload() { this._alive = false; if (this._reader) this._reader.dispose(); for (const timer of this._timers) clearTimeout(timer); this._timers.clear(); },
  onMode(event) { const mode = event.currentTarget.dataset.mode; if (!['normal', 'empty', 'error', 'flaky', 'slow', 'never'].includes(mode)) return; this.setData({ mode }); return this._reader.request(mode); },
  onRefresh() { return this._reader.request(this.data.mode, true); },
  onFeedback(event) { if (event.detail.kind === 'retry') this.onRefresh(); },
  onCompose() { wx.navigateTo({ url: '/pages/task-compose/index' }); }
});
