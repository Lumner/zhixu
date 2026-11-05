const lab = require('../../utils/stats-lab-data');
Page({
  data: { report: null, example: '有记录的例子' },
  onLoad() { this.setData({ report: lab.report() }); },
  onNormal() { this.setData({ report: lab.report(), example: '有记录的例子' }); },
  onEmpty() { this.setData({ report: lab.report('empty'), example: '零数据例子' }); }
});
