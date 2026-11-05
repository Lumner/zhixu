const { createTaskSession } = require('../../services/task-session');
const repository = require('../../services/cloud-repository');
const outbox = require('../../services/outbox');
const drafts = require('../../services/task-drafts');
const navigation = require('../../services/navigation');
const { CATEGORIES, PRIORITIES } = require('../../constants/index');
const { createPatchWriter, getAt } = require('../../utils/view-patch');
const { composeView } = require('../../utils/task-view');
Page({
  data: { status: 'loading', fields: {}, categories: CATEGORIES, priorities: PRIORITIES, categoryIndex: 0, priorityIndex: 1,
    busy: false, feedback: null, dirty: false, localState: 'clean', message: '', draftPreview: '', cloudPreview: '', draftStale: false, confirmed: false, opId: '' },
  onLoad(options = {}) {
    this._alive = true; this._visible = true;
    this._writer = createPatchWriter({ send: patch => this.setData(patch), read: key => getAt(this.data, key), project: composeView,
      onError: () => { console.error({ type: 'compose-view-update-failed' }); } });
    try { this._id = navigation.readId(options, false); }
    catch (error) { this.setData({ status: 'error', message: error.message }); return; }
    this._session = createTaskSession({ repository, outbox, drafts, emit: state => {
      if (!this._alive) return;
      this._writer.write(state); this.updateAlert();
    } });
    this._session.open(this._id);
  },
  onShow() { this._visible = true; if (this._writer) this._writer.resume(); if (this._session) this._session.checkIdentity(); this.updateAlert(); },
  onHide() { this._visible = false; if (this._writer) this._writer.suspend(); if (this._session) this._session.flush(); this.disableAlert(); },
  onUnload() { this._visible = false; if (this._writer) this._writer.dispose(); if (this._session) this._session.close(); this._alive = false; this.disableAlert(); },
  onMetrics() { if (this._writer) { const m = this._writer.metrics(); this.setData({ renderStatsText: `任务会话视图更新：${m.calls}次，JSON近似${m.bytes}字节，跳过${m.skipped}次；只统计该适配器，不代表整页渲染耗时。` }); } },
  updateAlert() {
    if (!this._visible) return;
    const needed = this.data.localState === 'dirty' || this.data.localState === 'error' && !this.data.confirmed;
    if (needed === this._alert) return;
    if (!needed) { this.disableAlert(); return; }
    if (typeof wx.enableAlertBeforeUnload === 'function') {
      try { wx.enableAlertBeforeUnload({ message: '部分输入本地保存未确认，请先保留草稿。', fail() {} }); this._alert = true; } catch (_) { /* 仍有同步保存与页面内返回确认。 */ }
    }
  },
  disableAlert() { if (this._alert && typeof wx.disableAlertBeforeUnload === 'function') { try { wx.disableAlertBeforeUnload({ fail() {} }); } catch (_) {} } this._alert = false; },
  onText(event) { const key = event.currentTarget.dataset.field; if (['title', 'description'].includes(key) && this._session) this._session.change({ [key]: event.detail.value }); },
  onCategory(event) { const item = CATEGORIES[Number(event.detail.value)]; if (item && this._session) this._session.change({ category: item.id }); },
  onPriority(event) { const item = PRIORITIES[Number(event.detail.value)]; if (item && this._session) this._session.change({ priority: item.id }); },
  onDate(event) { if (this._session) this._session.change({ dueDate: event.detail.value }); },
  onClearDate() { if (this._session) this._session.change({ dueDate: '' }); },
  onDone(event) { if (this._session) this._session.change({ done: event.detail.value }); },
  onSaveLocal() { if (this._session) this._session.flush(); },
  onSubmit() { if (this._session) return this._session.submit(); },
  onReplay() { if (this._session) return this._session.replay(); },
  onCleanup() { if (this._session) this._session.cleanup(); },
  onRestore() {
    if (!this._session || this.data.busy) return;
    if (!this.data.draftStale) { this._session.restore(false); return; }
    wx.showModal({ title: '已比较两个版本？', content: '确认把草稿作为编辑内容，并采用刚读取的云端版本作为提交基础。不会立即写云；后续保存仍做版本检查。',
      success: result => { if (result.confirm && this._alive && this._visible) this._session.restore(true); } });
  },
  onDiscard() {
    if (!this._session || this.data.busy) return;
    wx.showModal({ title: '采用当前读取内容', content: '确认舍弃这份尚未提交的本地草稿？这不会修改云端。',
      success: result => { if (result.confirm && this._alive && this._visible) this._session.discardUnsent(); } });
  },
  onFinishSealed() {
    if (!this._session || this.data.busy) return;
    wx.showModal({ title: '先核对原操作与云端', content: '仅当原操作已不再待确认时结束此草稿；可能已被处理或舍弃，不据此认定云端保存。待确认指令不会被丢弃。',
      success: result => { if (result.confirm && this._alive && this._visible) this._session.finishSealed(true); } });
  },
  onCopy() {
    if (this.data.status === 'identityChanged' || typeof wx.setClipboardData !== 'function') return;
    const text = this.data.status === 'choice' ? this.data.draftPreview : JSON.stringify(this.data.fields, null, 2);
    wx.setClipboardData({ data: text, success: () => { if (this._alive) this.setData({ message: '已主动复制输入，请注意其中的私人内容。' }); }, fail: () => { if (this._alive) this.setData({ message: '复制未完成，请保留当前页面并核对能力。' }); } });
  },
  onPending() { wx.navigateTo({ url: '/pages/pending/index' }); },
  onFeedback(event) {
    const kind = event.detail.kind;
    if (kind === 'saveDraft') return this.data.confirmed ? this.onCleanup() : this.onSaveLocal();
    if (kind === 'replay') return this.onReplay();
    if (kind === 'pending') return this.onPending();
    if (kind === 'account') return wx.switchTab({ url: '/pages/account/index' });
    if (kind === 'list') return navigation.goToList();
    if (kind === 'retry' && this.data.status === 'error' && this._session) return this._session.open(this._id);
  },
  onBack() {
    if (!this._session || this._session.flush()) { this.disableAlert(); navigation.backOrList(); return; }
    wx.showModal({ title: '本地保存未确认', content: '当前输入可能丢失。建议先复制保留；仍要返回吗？',
      success: result => { if (result.confirm && this._alive && this._visible) { this.disableAlert(); navigation.backOrList(); } } });
  }
});
