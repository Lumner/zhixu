const repository = require('../../services/focus-repository');
const outbox = require('../../services/outbox');
const { terminal, validId } = require('../../shared/focus-contract');
const { view, createServerClock } = require('../../utils/focus-view');
Page({
  data: { session: null, countdown: '--:--', elapsed: '00:00', label: '正在核对', awaiting: false,
    loading: true, busy: false, synced: false, canWrite: false, pendingCount: 0, errorMessage: '',
    taskId: '', taskTitle: '', durationIndex: 2, durations: ['10 秒实验', '5 分钟', '25 分钟', '45 分钟'],
    keepAwake: false, screenMessage: '' },
  onLoad() { this._alive = true; this._epoch = 0; this._writing = false; this._autoCount = 0; this._nextAutoAt = 0; },
  onShow() {
    this._visible = true; this._autoCount = 0; this._nextAutoAt = 0;
    const app = getApp(), intent = app.globalData.focusTaskIntent;
    delete app.globalData.focusTaskIntent;
    if (intent && validId(intent.taskId)) this.setData({ taskId: intent.taskId, taskTitle: intent.taskTitle });
    this._session = null; this.setData({ session: null, ...view(null), synced: false, busy: this._writing });
    this.sync();
  },
  onHide() { this._visible = false; this._epoch += 1; this.stopTicker(); this._clock = null; this.setScreen(false); },
  onUnload() { this._alive = false; this._visible = false; this._epoch += 1; this.stopTicker(); this._clock = null; this.setScreen(false); },
  stopTicker() { if (this._ticker !== undefined) clearInterval(this._ticker); this._ticker = undefined; },
  startTicker() {
    this.stopTicker();
    if (this._alive && this._visible && this._session && this._session.state === 'running' && this.data.synced) {
      this._ticker = setInterval(() => this.render(), 500);
    }
  },
  onSync() { if (!this._writing) this.sync(); },
  async sync(automatic = false) {
    if (!this._alive || !this._visible) return;
    if (!automatic) this._autoCount = 0;
    const epoch = ++this._epoch; this.stopTicker(); this._clock = null;
    this.setData({ loading: true, synced: false, canWrite: false, errorMessage: '' }); this.setScreen(false);
    try {
      const items = await outbox.list();
      if (!this._alive || !this._visible || epoch !== this._epoch) return;
      const snapshot = await repository.current();
      if (!this._alive || !this._visible || epoch !== this._epoch) return;
      this._session = snapshot.session;
      const pendingCount = items.filter(item => ['focusStart', 'focusPause', 'focusResume', 'focusStop'].includes(item.action)).length;
      this.setData({ session: snapshot.session, pendingCount });
      this._clock = createServerClock(snapshot.serverNow, snapshot.sentAt, snapshot.receivedAt);
      this.setData({ synced: true, loading: false, canWrite: !pendingCount && !this._writing });
      this.render(); this.startTicker();
    } catch (error) {
      if (this._alive && epoch === this._epoch) this.setData({ errorMessage: error.message, synced: false, canWrite: false });
    } finally { if (this._alive && epoch === this._epoch) this.setData({ loading: false }); }
  },
  render() {
    if (!this._alive || !this._visible || !this._clock) return;
    const reading = this._clock.read(Date.now());
    if (reading.needsSync) {
      this.setData({ synced: false, canWrite: false, errorMessage: '设备时间或页面运行间隔发生变化，请核对云端' });
      this.stopTicker(); this.setScreen(false); this.autoSync(); return;
    }
    const next = view(this._session, reading.now), patch = {};
    for (const key of Object.keys(next)) if (this.data[key] !== next[key]) patch[key] = next[key];
    if (Object.keys(patch).length) this.setData(patch);
    this.setScreen(Boolean(this.data.keepAwake && this._session && this._session.state === 'running' && this.data.synced));
    if (this.data.awaiting) this.autoSync();
  },
  autoSync() {
    if (this.data.loading || this._writing || this._autoCount >= 3 || Date.now() < this._nextAutoAt) return;
    this._autoCount += 1; this._nextAutoAt = Date.now() + 2000; this.sync(true);
  },
  onDuration(event) { const index = Number(event.detail.value); if (!this._writing && [0, 1, 2, 3].includes(index)) this.setData({ durationIndex: index }); },
  onClearTask() { if (!this._writing) this.setData({ taskId: '', taskTitle: '' }); },
  async write(action, target) {
    if (!this.data.canWrite || this._writing) return;
    this._writing = true; this.setData({ busy: true, canWrite: false, errorMessage: '' });
    try {
      if (action === 'start') await repository.start({ plannedSeconds: [10, 300, 1500, 2700][this.data.durationIndex], taskId: this.data.taskId });
      else await repository[action](target.id, target.version);
    } catch (error) {
      if (this._alive && this._visible) this.setData({ errorMessage: error.message + (error.queued ? '；原操作已保留，请到待处理页核对。' : ''), synced: false });
      return;
    } finally {
      this._writing = false;
      if (this._alive) this.setData({ busy: false });
    }
    // 回执可能是过去的结果；写入确认后重新读取最新会话，不把旧回执直接当当前状态。
    if (this._alive && this._visible) await this.sync();
  },
  onStart() { if (!this._session || terminal(this._session.state)) this.write('start'); },
  onPause() { if (this._session && this._session.state === 'running') this.write('pause', this._session); },
  onResume() { if (this._session && this._session.state === 'paused') this.write('resume', this._session); },
  async onStop() {
    if (!this._session || terminal(this._session.state) || !this.data.canWrite) return;
    const target = this._session;
    const answer = await new Promise(resolve => wx.showModal({ title: '提前结束本轮专注？', content: '按云端确认的计时段保存，暂停时长不累计；已到时则记为完成。', success: resolve, fail: () => resolve({ confirm: false }) }));
    if (answer.confirm && this._alive && this._visible) await this.write('stop', target);
  },
  onScreen(event) { this.setData({ keepAwake: event.detail.value, screenMessage: '' }); this.render(); },
  setScreen(wanted) {
    if (this._screenTarget === wanted) return; this._screenTarget = wanted;
    if (typeof wx.setKeepScreenOn !== 'function') {
      if (wanted && this._alive) this.setData({ screenMessage: '当前环境不支持屏幕常亮，计时可继续' }); return;
    }
    wx.setKeepScreenOn({ keepScreenOn: wanted, fail: () => {
      if (wanted && this._screenTarget === wanted && this._alive && this._visible) this.setData({ screenMessage: '未能开启常亮，计时可继续' });
    } });
  },
  onHistory() { wx.navigateTo({ url: '/pages/focus-history/index' }); },
  onLab() { wx.navigateTo({ url: '/packageLab/pages/clock-lab/index' }); },
  onPending() { wx.navigateTo({ url: '/pages/pending/index' }); }
});
