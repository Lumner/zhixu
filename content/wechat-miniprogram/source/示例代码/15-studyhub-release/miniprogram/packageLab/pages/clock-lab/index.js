// 本地五秒练习，不调用云、不保存专注记录；进程重启会丢失本例状态。
Page({
  data: { left: 5, message: '点击开始五秒练习' },
  onLoad() { this._deadline = 0; },
  onShow() { this._visible = true; this.render(); if (this._deadline) this.startTicker(); },
  onHide() { this._visible = false; this.stopTicker(); },
  onUnload() { this._visible = false; this.stopTicker(); },
  onStart() { this._deadline = Date.now() + 5000; this.render(); this.startTicker(); },
  startTicker() { this.stopTicker(); if (this._deadline && this._visible) this._ticker = setInterval(() => this.render(), 200); },
  stopTicker() { if (this._ticker !== undefined) clearInterval(this._ticker); this._ticker = undefined; },
  render() {
    if (!this._deadline || !this._visible) return;
    const left = Math.max(0, Math.ceil((this._deadline - Date.now()) / 1000));
    this.setData({ left, message: left ? '本地练习计时中' : '本地练习已到时，未保存云端' });
    if (!left) { this._deadline = 0; this.stopTicker(); }
  }
});
