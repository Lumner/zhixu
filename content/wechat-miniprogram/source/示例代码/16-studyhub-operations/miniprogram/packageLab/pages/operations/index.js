const diagnostics = require('../../../services/diagnostics');
const { createJournal, summarize } = require('../../../services/diagnostics-core');
const environment = require('../../../services/environment');
Page({
  data: { stage: 'unknown', version: 'unknown', targetText: '', live: {}, sample: {}, sampleSummary: {}, message: '' },
  onLoad() { this._practice = createJournal({ enabled: true, capacity: 80 }); this.onRefresh(); },
  onRefresh() {
    const target = environment.inspect();
    this.setData({ stage: target.stage, version: target.version, targetText: target.ok ? '本地目标核对通过；仍需真实云验收' : target.problems.join('、'),
      live: diagnostics.snapshot(), sample: this._practice.snapshot(), sampleSummary: summarize(this._practice.snapshot().events) });
  },
  onDrill() {
    this._practice.clear();
    for (let i = 0; i < 20; i++) this._practice.record(i < 5 ? 'rpc-fail' : 'rpc-ok',
      { action: 'list', code: i < 5 ? 'CLOUD_TIMEOUT' : 'OK', elapsedMs: i < 5 ? 12000 : 180 });
    this.onRefresh(); this.setData({ message: '已生成20条固定内存样本，5次失败；没有真实请求、报错、消息或云操作。' });
  },
  onClear() { diagnostics.clear(); this._practice.clear(); this.onRefresh(); this.setData({ message: '仅清空本次进程中的课程诊断样本，不删除业务数据或云日志。' }); },
  onUnload() { this._practice.clear(); }
});
