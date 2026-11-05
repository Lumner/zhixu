const api = require('../../../services/platform-api');
const files = require('../../../services/report-files');
const format = require('../../../utils/report-file');
const lab = require('../../../utils/stats-lab-data');
const stats = require('../../../services/stats-repository');
const transfer = require('../../../services/file-transfer');
const notice = require('../../../services/notice-repository');
const share = require('../../../utils/public-share');
Page({
  data: { capabilities: [], report: null, source: 'demo', sourceText: '固定练习', busy: false, message: '', fileName: '',
    progress: 0, transferId: '', clipboardPreview: '', noticeText: '尚未核对消息配置', noticeReady: false },
  onLoad() { this._alive = true; this._epoch = 0; this._noticeEpoch = 0; this._busy = false;
    this.setData({ capabilities: api.capabilities(), report: lab.report() }); },
  onShow() { this._visible = true; if (!this._busy) this.refreshNotice(); },
  onHide() { this._visible = false; this._noticeEpoch += 1; if (this._transfer) this._transfer.abort(); },
  onUnload() { this._alive = false; this._epoch += 1; this._noticeEpoch += 1; if (this._transfer) this._transfer.abort(); },
  async run(work) {
    if (this._busy) return;
    this._busy = true; const epoch = this._epoch;
    this.setData({ busy: true, message: '' });
    try { await work(); }
    catch (error) { if (this._alive && epoch === this._epoch) this.setData({ message: error.code === 'CANCELLED' ? '已取消，原数据保持。' : error.message }); }
    finally { this._busy = false; if (this._alive && epoch === this._epoch) this.setData({ busy: false }); }
  },
  onPrivacy() { wx.navigateTo({ url: '/packageLab/pages/privacy/index' }); },
  onDemo() { if (!this._busy) { this._file = null; this.setData({ report: lab.report(), source: 'demo', sourceText: '固定练习', fileName: '', message: '' }); } },
  onCloud() { return this.run(async () => {
    const report = await stats.week();
    if (!this._alive) return;
    this._file = null; this.setData({ report, source: 'cloud', sourceText: '当前身份的云端读取结果', fileName: '', message: '已读取；导出前请确认汇总内容。' });
  }); },
  onSave() { return this.run(async () => {
    const saved = await files.save(this.data.report, this.data.source);
    if (!this._alive) return;
    this._file = saved; this.setData({ fileName: saved.fileName, message: '已写入小程序本地目录：' + saved.bytes + ' 字节；这还不是手机“下载”目录或完整备份。' });
  }); },
  onShareFile() { return this.run(async () => {
    if (!this._file) throw api.error('LOCAL_STATE', '请先生成本地报告文件');
    await api.call('shareFileMessage', { filePath: this._file.filePath, fileName: this._file.fileName });
    if (this._alive) this.setData({ message: '文件转发接口已返回；不据此判断对方是否接收或阅读。' });
  }); },
  onReadOwn() { return this.run(async () => {
    if (!this._file) throw api.error('LOCAL_STATE', '请先生成文件');
    const value = await files.read(this._file.filePath);
    if (this._alive) this.setData({ message: '本地重新读取并校验通过：' + value.report.totals.totalSeconds + ' 秒。' });
  }); },
  onChoose() { return this.run(async () => {
    const value = await files.choose({ isActive: () => this._alive && this._visible });
    if (this._alive) this.setData({ message: '外部文件格式校验通过：' + value.report.totals.totalSeconds + ' 秒；仅预览合计，不写云，不将文件自称的来源当作真实性证明。' });
  }); },
  onClearFile() { return this.run(async () => {
    if (!this._file) throw api.error('LOCAL_STATE', '当前页面没有待清理的课程文件');
    const slot = this.data.source; await files.remove(slot);
    if (this._alive) { this._file = null; this.setData({ fileName: '', message: '已清理当前课程文件槽。' }); }
  }); },
  onCopy() { return this.run(async () => {
    await api.call('setClipboardData', { data: format.summary(this.data.report, this.data.source) });
    if (this._alive) this.setData({ message: '摘要已复制。' });
  }); },
  onPaste() { return this.run(async () => {
    const value = await api.call('getClipboardData', {}, wx, { isActive: () => this._alive && this._visible });
    if (this._alive) this.setData({ clipboardPreview: typeof value.data === 'string' ? value.data.slice(0, 200) : '', message: '仅在本页预览前 200 个代码单元，不上传剪贴板。' });
  }); },
  onUploadDemo() { return this.run(async () => {
    // 无论当前屏幕是否选择云报告，网络实验始终重新生成固定练习文件。
    this.setData({ transferId: '', progress: 0 });
    const saved = await files.save(lab.report(), 'demo');
    if (!this._alive || !this._visible) return;
    const operation = transfer.upload(saved.filePath, progress => { if (this._alive && this._visible) this.setData({ progress }); });
    this._transfer = operation;
    try { const result = await operation.promise; if (this._alive) this.setData({ transferId: result.id, message: '固定练习已上传，编号在本地服务中保留十分钟。' }); }
    finally { if (this._transfer === operation) this._transfer = null; }
  }); },
  onDownloadDemo() { return this.run(async () => {
    const operation = transfer.download(this.data.transferId, progress => { if (this._alive && this._visible) this.setData({ progress }); });
    this._transfer = operation;
    try {
      const path = await operation.promise, value = await files.read(path);
      if (!this._alive) return;
      if (format.pack(value.report, value.source) !== format.pack(lab.report(), 'demo')) throw api.error('PROTOCOL', '下载内容不是固定教学报告');
      await files.save(value.report, 'demo', 'download');
      if (this._alive) this.setData({ message: '下载到临时路径，校验后另存 download 槽；重启服务或十分钟后旧编号失效。' });
    } finally { if (this._transfer === operation) this._transfer = null; }
  }); },
  onCancelTransfer() { if (this._transfer) this._transfer.abort(); },
  async refreshNotice() {
    const epoch = ++this._noticeEpoch;
    this.setData({ noticeReady: false });
    try {
      const value = await notice.prepare();
      if (!this._alive || !this._visible || epoch !== this._noticeEpoch) return;
      this._notice = value; this.setData({ noticeText: notice.stateText(value), noticeReady: value.enabled && value.state === 'ready' });
    } catch (error) { if (this._alive && this._visible && epoch === this._noticeEpoch) this.setData({ noticeText: error.message }); }
  },
  onNotice() {
    if (this._busy || !this._visible || !this.data.noticeReady || !this._notice) return;
    const prepared = this._notice;
    // run 的 work 立即执行；下面调用前没有 await，不先跑网络再尝试弹授权界面。
    return this.run(async () => {
      const result = await api.call('requestSubscribeMessage', { tmplIds: [prepared.templateId] });
      if (!this._alive || !this._visible) return;
      const answer = result[prepared.templateId];
      if (answer !== 'accept') { this.setData({ noticeText: '本模板结果：' + (answer || '未确认') + '；未请求服务端发送。' }); return; }
      this.setData({ noticeReady: false, noticeText: '已同意本次申请，正在请求服务端发送练习回执……' });
      try { const value = await notice.send(prepared.id); if (this._alive) this.setData({ noticeText: notice.stateText(value) }); }
      catch (error) { if (this._alive) this.setData({ noticeText: error.message + '；请点“核对状态”，不要自动再次发送。' }); }
    });
  },
  onShareAppMessage() { return share.card(); }
});
