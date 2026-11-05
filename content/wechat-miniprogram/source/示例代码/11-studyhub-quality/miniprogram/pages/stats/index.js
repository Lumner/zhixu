const { feedback } = require('../../utils/feedback');
const repository = require('../../services/stats-repository');
const { dayKey } = require('../../shared/stats-core');
Page({
  data: { status: 'loading', report: null, endDate: '', today: '', errorMessage: '', feedback: null },
  onLoad() { this._alive = true; this._epoch = 0; },
  onShow() { this._visible = true; this.refresh(); },
  onHide() { this._visible = false; this._epoch += 1; }, onUnload() { this._alive = false; this._epoch += 1; },
  async refresh() {
    const epoch = ++this._epoch, endDate = this.data.endDate || undefined;
    this.setData({ status: 'loading', report: null, errorMessage: '', feedback: null });
    try {
      const report = await repository.week(endDate);
      if (!this._alive || !this._visible || epoch !== this._epoch) return;
      this.setData({ status: 'ready', report, today: dayKey(report.asOf) });
    } catch (error) { if (this._alive && epoch === this._epoch) this.setData({ status: 'error', report: null, errorMessage: error.message, feedback: feedback(error) }); }
  },
  onDate(event) { this.setData({ endDate: event.detail.value }); this.refresh(); },
  onLatest() { this.setData({ endDate: '' }); this.refresh(); },
  onLab() { wx.navigateTo({ url: '/pages/stats-lab/index' }); },
  onHistory() { wx.navigateTo({ url: '/pages/focus-history/index' }); },
  onFeedback(event) {
    const kind = event.detail.kind;
    if (kind === 'retry') return this.refresh();
    if (kind === 'pending') return wx.navigateTo({ url: '/pages/pending/index' });
    if (kind === 'account') return wx.switchTab({ url: '/pages/account/index' });
    if (kind === 'list') return wx.switchTab({ url: '/pages/tasks/index' });
  }

});
