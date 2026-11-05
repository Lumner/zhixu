// 独立本地实验：不调用云端，不把 HTML/Delta 当作知识库的持久化格式。
Page({
  data: { ready: false, count: 0, text: '', html: '', deltaText: '', errorMessage: '' },
  onLoad() { this._alive = true; }, onUnload() { this._alive = false; this._editor = null; },
  onEditorReady() {
    wx.createSelectorQuery().select('#editor').context(result => {
      if (!this._alive) return;
      if (!result || !result.context) { this.setData({ errorMessage: '未获得编辑器上下文' }); return; }
      this._editor = result.context; this.setData({ ready: true });
    }).exec();
  },
  onInput(event) { if (this._alive) this.setData({ count: String(event.detail.text || '').length }); },
  onBold() { if (this._editor) this._editor.format('bold'); },
  onSeed() {
    if (!this._editor) return;
    this._editor.setContents({ delta: { ops: [{ insert: '输入你的学习总结\n' }] },
      success: () => { if (this._alive) this.setData({ count: '输入你的学习总结\n'.length, text: '', html: '', deltaText: '' }); },
      fail: error => { if (this._alive) this.setData({ errorMessage: error.errMsg }); } });
  },
  onRead() {
    if (!this._editor) return;
    this._editor.getContents({
      success: result => {
        if (this._alive) this.setData({ text: result.text.slice(0, 2000), html: result.html.slice(0, 3000),
          deltaText: JSON.stringify(result.delta).slice(0, 3000), errorMessage: '' });
      },
      fail: error => { if (this._alive) this.setData({ errorMessage: error.errMsg }); }
    });
  }
});
