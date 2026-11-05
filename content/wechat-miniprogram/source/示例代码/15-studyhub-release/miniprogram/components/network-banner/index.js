const network = require('../../services/network');
Component({
  data: { kind: 'unknown', text: '网络状态尚未确认；仍需以实际请求为准。' },
  lifetimes: {
    attached() { this._alive = true; this._off = network.subscribe(state => {
      if (!this._alive) return;
      this.setData({ kind: state.kind, text: state.kind === 'offline' ? '当前报告无网络。已有表单可保留本地草稿；恢复连接后请手动核对。'
        : state.kind === 'online' ? '设备报告有网络连接；服务器可达性以请求结果为准，不自动投递待处理写入。' : '网络状态尚未确认；以实际请求结果为准。' });
    }); },
    detached() { this._alive = false; if (this._off) this._off(); }
  },
  pageLifetimes: { show() { network.refresh(); } }
});
