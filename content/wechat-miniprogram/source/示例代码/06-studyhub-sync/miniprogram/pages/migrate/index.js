const migration = require('../../services/migration');
const outbox = require('../../services/outbox');
Page({
  data: { owner: '', sourceKey: '', titles: [], count: 0, completed: 0, busy: false, ready: false, errorMessage: '' },
  onLoad() { this._alive = true; }, onUnload() { this._alive = false; },
  async onPreview() {
    if (this.data.busy) return; this.setData({ busy: true, ready: false, errorMessage: '' });
    try {
      const owner = await outbox.identity(), plan = migration.snapshot();
      if (this._alive) { this._plan = plan; this._owner = owner; this.setData({ owner, sourceKey: plan.sourceKey,
        count: plan.items.length, titles: plan.items.map(item => ({ id: item.localId, title: item.fields.title })), completed: 0, ready: true }); }
    } catch (error) { if (this._alive) this.setData({ errorMessage: error.message }); }
    finally { if (this._alive) this.setData({ busy: false }); }
  },
  onBackup() { if (this._plan) wx.setClipboardData({ data: JSON.stringify(this._plan.backup, null, 2) }); },
  async onRun() {
    if (!this.data.ready || this.data.busy || !this.data.count) return;
    const plan = this._plan, owner = this._owner;
    const answer = await new Promise(resolve => wx.showModal({ title: '导入到所示云端账号？', content: '来源：' + plan.sourceKey + '，共 ' + plan.items.length + ' 条。设备缓存可能属于旧使用者，请确认归属并先备份。旧缓存会保留。', success: resolve, fail: () => resolve({ confirm: false }) }));
    if (!answer.confirm || !this._alive || this.data.busy) return;
    this.setData({ busy: true, completed: 0, errorMessage: '' });
    try { await migration.run(plan, completed => { if (this._alive) this.setData({ completed }); }, owner); }
    catch (error) { if (this._alive) this.setData({ errorMessage: error.message + '；已成功部分保留，核对后再次执行原来源快照可续传。' }); }
    finally { if (this._alive) this.setData({ busy: false }); }
  },
  onPending() { wx.navigateTo({ url: '/pages/pending/index' }); }
});
