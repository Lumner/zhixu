const { values } = require('./task-draft-core');
const { pickFields, validateFields, isValidId } = require('../utils/task');
const { feedback } = require('../utils/feedback');
const { sameJson } = require('../utils/canonical-json');
const copy = x => JSON.parse(JSON.stringify(x));
const same = sameJson;
const fail = (code, message) => Object.assign(new Error(message), { code });
const defaults = () => ({ title: '', description: '', category: 'general', priority: 'normal', dueDate: '', done: false });
function createTaskSession({ repository, outbox, drafts, emit, setTimer = setTimeout, clearTimer = clearTimeout }) {
  let alive = true, epoch = 0, owner = '', id = '', record = null, latestVersion = null, baseline = defaults(), timer = null, opening = false;
  let state = { status: 'loading', fields: defaults(), busy: false, dirty: false, localState: 'clean', feedback: null,
    draftPreview: '', cloudPreview: '', draftStale: false, message: '', confirmed: false, opId: '' };
  const update = patch => { state = { ...state, ...patch }; if (alive) emit(copy(state)); };
  function stopTimer() { if (timer !== null) clearTimer(timer); timer = null; }
  function checkRevision() {
    const current = drafts.get(owner, id);
    if ((current ? current.revision : 0) !== (record ? record.revision : 0)) throw fail('DRAFT_CHANGED', '当前草稿已被其他页面更新');
  }
  function persist(phase, attempt = null) {
    record = drafts.save(owner, id, record ? record.revision : 0, { phase, attempt, values: values(state.fields), baseVersion: latestVersion });
    update({ localState: 'saved' });
  }
  function flush() {
    stopTimer();
    if (!owner || !['editing', 'identityChanged'].includes(state.status)) return true;
    try {
      if (!state.dirty) {
        if (record) { drafts.clear(owner, id, record.revision); record = null; }
        update({ localState: 'clean' }); return true;
      }
      if (!record || !same(record.values, state.fields) || record.baseVersion !== latestVersion) persist('editing');
      else checkRevision();
      update({ localState: 'saved', feedback: state.feedback && ['DRAFT_STORAGE', 'LOCAL_STORAGE'].includes(state.feedback.code) ? null : state.feedback }); return true;
    } catch (error) { update({ localState: 'error', feedback: feedback(error, 'draft') }); return false; }
  }
  async function assertIdentity() {
    if (await outbox.identity() !== owner) throw fail('IDENTITY_CHANGED', '当前账号或环境已经变化');
  }
  function attemptFeedback(error) {
    const view = feedback(error, 'write');
    return view && ['LOCAL_STORAGE', 'DRAFT_STORAGE'].includes(error.code) ? { ...view, action: 'replay', actionText: '用原编号核对' } : view;
  }
  function cleanupFeedback(error) {
    const view = feedback(error, 'draft');
    return view && view.action === 'saveDraft' ? { ...view, actionText: '只重试本地清理' } : view;
  }
  async function deliverOriginal() {
    checkRevision(); await assertIdentity();
    const result = await outbox.resume(copy(record.attempt), owner);
    // 回执是原操作结果，不声称对应任务此刻仍存在。
    if (!alive) {
      try { drafts.clear(owner, id, record.revision); record = null; } catch (_) { /* 封存仍可用原编号核对。 */ }
      return result;
    }
    update({ confirmed: true, status: 'saved', dirty: false, message: '原操作已取得有效回执。返回列表可读取当前云端状态。', feedback: null });
    try { drafts.clear(owner, id, record.revision); record = null; update({ localState: 'clean' }); }
    catch (error) { update({ localState: 'error', message: '云端原操作已确认，但本地草稿清理未确认。可只重试本地清理。', feedback: cleanupFeedback(error) }); }
    return result;
  }
  return {
    snapshot: () => copy(state),
    async open(resourceId = '') {
      if (opening) return; opening = true; const token = ++epoch;
      stopTimer(); owner = ''; record = null; id = resourceId;
      update({ status: 'loading', fields: defaults(), confirmed: false, feedback: null, message: '', draftPreview: '', cloudPreview: '' });
      try {
        if (id && !isValidId(id)) throw fail('INVALID_INPUT', '任务编号不合法');
        const identity = await outbox.identity();
        if (!alive || token !== epoch) return;
        const old = drafts.get(identity, id);
        if (old && old.phase === 'sealed') {
          if (await outbox.identity() !== identity) throw fail('IDENTITY_CHANGED', '核对期间身份发生变化');
          if (!alive || token !== epoch) return;
          owner = identity; record = old; latestVersion = old.baseVersion; baseline = old.values;
          update({ status: 'sealed', fields: old.values, busy: false, dirty: false, localState: 'saved', opId: old.attempt.opId,
            draftPreview: JSON.stringify(old.values, null, 2), cloudPreview: '', draftStale: false,
            message: '发现已封存指令。可直接使用原编号核对；历史回执不证明任务此刻仍存在。' });
          return;
        }
        let initial = defaults(), version = null;
        if (id) { const task = await repository.get(id); initial = values(pickFields(task)); version = task.version; }
        if (await outbox.identity() !== identity) throw fail('IDENTITY_CHANGED', '读取期间身份发生变化');
        if (!alive || token !== epoch) return;
        owner = identity; baseline = initial; latestVersion = version; record = old;
        update({ status: old ? old.phase === 'sealed' ? 'sealed' : 'choice' : 'editing',
          fields: old && old.phase === 'sealed' ? old.values : initial, busy: false, dirty: false,
          localState: old ? 'saved' : 'clean', opId: old && old.attempt ? old.attempt.opId : '',
          draftPreview: old ? JSON.stringify(old.values, null, 2) : '', cloudPreview: JSON.stringify(initial, null, 2),
          draftStale: !!old && old.baseVersion !== version,
          message: old ? old.phase === 'sealed' ? '发现已经封存的提交；只使用原编号核对，不生成新提交。' : '发现未提交草稿，请比较后选择恢复或采用当前云端内容。' : '' });
      } catch (error) { if (alive && token === epoch) update({ status: 'error', feedback: feedback(error), message: '未覆盖本地缓存；身份或初始读取未确认时不恢复私人草稿。' }); }
      finally { opening = false; }
    },
    restore(adoptLatest = false) {
      if (state.status !== 'choice' || state.busy) return;
      try {
        checkRevision();
        if (record.baseVersion !== latestVersion && !adoptLatest) throw fail('DRAFT_STALE', '请先比较草稿与当前版本，再明确选择采用当前版本作为提交基础');
        const restored = values(record.values);
        // 只有调用者显式确认 adoptLatest 才会采用新版本；不自动发送。
        record = drafts.save(owner, id, record.revision, { phase: 'editing', attempt: null, baseVersion: latestVersion, values: restored });
        update({ status: 'editing', fields: restored, dirty: !same(restored, baseline), localState: 'saved', feedback: null, message: '已恢复输入。保存时仍会校验云端版本。' });
      } catch (error) { update({ feedback: feedback(error, 'write') }); }
    },
    discardUnsent() {
      if (state.status !== 'choice' || state.busy) return;
      try { drafts.clear(owner, id, record.revision); record = null; update({ status: 'editing', fields: baseline, dirty: false, localState: 'clean', feedback: null, message: '已采用初始读取的内容；尚未发出写入。' }); }
      catch (error) { update({ feedback: feedback(error, 'write') }); }
    },
    change(patch) {
      if (state.status !== 'editing' || state.busy) return;
      try {
        const next = values({ ...state.fields, ...patch });
        update({ fields: next, dirty: !same(next, baseline), localState: 'dirty', feedback: null, message: '' });
        stopTimer(); timer = setTimer(() => { timer = null; if (alive) flush(); }, 600);
      } catch (error) { update({ feedback: feedback(error, 'write') }); }
    },
    flush,
    async submit() {
      if (state.status !== 'editing' || state.busy) return;
      const invalid = validateFields(state.fields);
      if (invalid) { update({ feedback: feedback(fail('INVALID_INPUT', invalid)) }); return; }
      update({ busy: true, feedback: null });
      try {
        if (!flush()) return;
        await assertIdentity(); if (!alive) return;
        const fields = values(state.fields), action = id ? 'update' : 'create';
        const payload = id ? { id, version: latestVersion, fields } : { fields };
        const existing = (await outbox.list(owner)).filter(row => id ? ['update', 'remove'].includes(row.action) && row.payload.id === id : row.action === 'create');
        if (!alive) return;
        const sameOperation = existing.find(row => row.action === action && same(row.payload, payload));
        if (existing.length && !sameOperation) throw Object.assign(fail('EXISTING_OPERATION', '已有相关原操作，请先核对待处理与云端内容再决定后续输入'), { queued: true });
        const opId = sameOperation ? sameOperation.opId : outbox.newOperationId();
        const attempt = { opId, action, payload };
        persist('sealed', attempt); update({ status: 'sealed', opId, message: '输入和原编号已封存，正在等待结果。' });
        await deliverOriginal();
      } catch (error) {
        if (alive) {
          const sealed = record && record.phase === 'sealed';
          let view = sealed ? attemptFeedback(error) : feedback(error);
          if (!sealed && view && view.action === 'retry') view = { ...view, title: '提交前确认未完成', message: '本次新写入尚未发出，本地输入仍在。网络恢复后可再次手动提交。', action: '', actionText: '' };
          update({ feedback: view, message: sealed ? '封存仍在。可核对原编号或进入待处理页。' : '输入仍在，提交前步骤未确认。' });
        }
      }
      finally { if (alive) update({ busy: false }); }
    },
    async replay() {
      if (state.status !== 'sealed' || state.busy) return;
      update({ busy: true, feedback: null });
      try { await deliverOriginal(); }
      catch (error) { if (alive) update({ feedback: attemptFeedback(error) }); }
      finally { if (alive) update({ busy: false }); }
    },
    cleanup() {
      if (!state.confirmed || !record || state.busy) return;
      try { if (drafts.get(owner, id)) drafts.clear(owner, id, record.revision); record = null; update({ localState: 'clean', feedback: null, message: '已清理当前已确认草稿。' }); }
      catch (error) { update({ feedback: cleanupFeedback(error) }); }
    },
    async finishSealed(confirmed) {
      if (!confirmed || state.status !== 'sealed' || state.busy) return;
      update({ busy: true, feedback: null });
      try {
        await assertIdentity(); checkRevision();
        const row = (await outbox.list(owner)).find(item => item.opId === record.attempt.opId);
        if (row && row.state === 'pending') throw fail('LOCAL_STATE', '原操作结果未确认，不能结束后重新创建；请先用原编号核对');
        if (row && row.state === 'blocked') await outbox.discard(row.opId);
        drafts.clear(owner, id, record.revision); record = null;
        if (alive) update({ status: 'ended', localState: 'clean', dirty: false, message: '仅已结束此表单草稿，不代表云端已保存。请到云端核对后再决定后续操作。' });
      } catch (error) { if (alive) update({ feedback: feedback(error, 'write'), message: error.message }); }
      finally { if (alive) update({ busy: false }); }
    },
    async checkIdentity() {
      if (!owner || state.busy) return;
      try { await assertIdentity(); }
      catch (error) { if (alive && error.code === 'IDENTITY_CHANGED') { flush(); stopTimer(); update({ status: 'identityChanged', draftPreview: '', cloudPreview: '', feedback: feedback(error) }); } }
    },
    close() { flush(); alive = false; epoch += 1; stopTimer(); }
  };
}
module.exports = { createTaskSession, defaults };
