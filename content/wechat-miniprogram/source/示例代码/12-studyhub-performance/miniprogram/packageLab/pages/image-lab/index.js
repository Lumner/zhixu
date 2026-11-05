Page({
  data: { mode: 'small', lazy: true, loaded: 0, failed: 0, rows: [], message: '相同公开包内资源可能命中缓存，load事件数不等于下载次数。' },
  onLoad() { this._alive = true; this._revision = 0; this.reset(); }, onUnload() { this._alive = false; this._revision++; },
  reset() { const revision = ++this._revision; this._seen = new Set();
    const src = '/packageLab/assets/fixture-' + this.data.mode + '.png';
    this.setData({ loaded: 0, failed: 0, rows: Array.from({ length: 12 }, (_, index) => ({ id: revision + '-' + index, revision, index, src })) });
  },
  onSize(event) { const mode = event.currentTarget.dataset.mode; if (['small','large'].includes(mode)) { this.setData({ mode }); this.reset(); } },
  onLazy(event) { this.setData({ lazy: event.detail.value }); this.reset(); },
  onResult(event) {
    const data = event.currentTarget.dataset;
    if (!this._alive || Number(data.revision) !== this._revision || this._seen.has(data.id)) return;
    this._seen.add(data.id); const key = event.type === 'load' ? 'loaded' : 'failed'; this.setData({ [key]: this.data[key] + 1 });
  }
});
