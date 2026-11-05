const lab = require('../../utils/stats-lab-data');
const share = require('../../utils/public-share');
Page({
  data: { report: null, label: '固定教学数据，不是分享者的私人报告' },
  onLoad() { this.setData({ report: lab.report() }); },
  onShareAppMessage() { return share.card(); },
  onStart() { wx.switchTab({ url: '/pages/tasks/index' }); }
});
