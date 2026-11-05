const { reject, assertKeys, checkId, checkVersion } = require('./domain-base');
const contract = require('./focus-contract');
const FIELDS = ['taskId', 'taskTitle', 'plannedSeconds', 'isDemo', 'state', 'accumulatedMs',
  'segmentStartedAt', 'deadlineAt', 'startedAt', 'endedAt', 'updatedAt', 'version'];
function dto(row) {
  const result = { id: row._id, ...Object.fromEntries(FIELDS.map(key => [key, row[key]])),
    effectiveSeconds: contract.terminal(row.state) ? Math.floor(row.accumulatedMs / 1000) : null };
  if (!contract.validSession(result)) throw new Error('Stored focus session is invalid');
  return result;
}
const ack = row => ({ sessionId: row._id, version: row.version, state: row.state });
const at = (row, timestamp) => Math.max(timestamp, row.updatedAt);
function settle(row, timestamp) {
  dto(row); // 存储损坏时停止，不猜测时长。
  const timestampAt = at(row, timestamp);
  if (row.state !== 'running' || timestampAt < row.deadlineAt) return row;
  return { ...row, state: 'completed', accumulatedMs: row.plannedSeconds * 1000,
    segmentStartedAt: null, deadlineAt: null, endedAt: row.deadlineAt,
    updatedAt: timestampAt, version: row.version + 1 };
}
function transition(row, action, timestamp) {
  if (!['focusPause', 'focusResume', 'focusStop'].includes(action)) reject('INVALID_INPUT', '不支持的专注状态转换');
  const settled = settle(row, timestamp);
  if (settled !== row) return settled; // 到时优先，迟到的暂停/结束不能减少已完成时长。
  const timestampAt = at(row, timestamp);
  if (contract.terminal(row.state)) {
    if (action === 'focusStop') return row;
    reject('FOCUS_CHANGED', '这轮专注已经结束，请核对当前状态');
  }
  if (action === 'focusPause' && row.state !== 'running') reject('FOCUS_CHANGED', '这轮专注已经暂停，请核对当前状态');
  if (action === 'focusResume' && row.state !== 'paused') reject('FOCUS_CHANGED', '这轮专注已经在计时，请核对当前状态');
  if (action === 'focusResume') {
    return { ...row, state: 'running', segmentStartedAt: timestampAt,
      deadlineAt: timestampAt + row.plannedSeconds * 1000 - row.accumulatedMs, updatedAt: timestampAt, version: row.version + 1 };
  }
  const elapsed = row.state === 'running' ? Math.max(0, timestampAt - row.segmentStartedAt) : 0;
  const accumulatedMs = Math.min(row.plannedSeconds * 1000, row.accumulatedMs + elapsed);
  return { ...row, state: action === 'focusPause' ? 'paused' : 'stopped', accumulatedMs,
    segmentStartedAt: null, deadlineAt: null, endedAt: action === 'focusPause' ? null : timestampAt,
    updatedAt: timestampAt, version: row.version + 1 };
}
function createFocusService({ store, now, hash, owned, receiptId, checkReceipt }) {
  const slotId = actor => hash(JSON.stringify([actor.ownerAppId, actor.ownerId]));
  async function latest(tx, actor) {
    const slot = await tx.get('studyhub_focus_slots', slotId(actor));
    if (!slot) return null;
    if (!owned(slot, actor)) throw new Error('Focus slot owner mismatch');
    const row = await tx.get('studyhub_focus_sessions', slot.sessionId);
    if (!owned(row, actor)) throw new Error('Focus slot points to an unavailable session');
    dto(row); return row;
  }
  return {
    async read(actor, event) {
      if (event.action === 'focusList') {
        assertKeys(event, ['action', 'cursor']);
        const cursor = event.cursor === undefined || event.cursor === null ? null : event.cursor;
        if (cursor !== null) checkId(cursor);
        const rows = await store.listFocus(actor, cursor, 11), items = rows.slice(0, 10).map(dto);
        return { items, nextCursor: rows.length > 10 ? items[items.length - 1].id : null };
      }
      if (event.action === 'focusGet') {
        assertKeys(event, ['action', 'id']); checkId(event.id);
        const row = await store.transaction(tx => tx.get('studyhub_focus_sessions', event.id));
        if (!owned(row, actor)) reject('NOT_FOUND', '专注记录不存在或不可访问');
        return { session: dto(row), serverNow: Math.max(now(), row.updatedAt) };
      }
      assertKeys(event, ['action']);
      const timestamp = now();
      const row = await store.transaction(async tx => {
        const old = await latest(tx, actor); if (!old) return null;
        const current = settle(old, timestamp);
        if (current !== old) await tx.set('studyhub_focus_sessions', old._id, current);
        return current;
      });
      // current 会幂等地核对到时终态；没有后台调度器，也不增加统计汇总计数。
      return { session: row ? dto(row) : null, serverNow: Math.max(now(), row ? row.updatedAt : 0) };
    },
    async write(actor, event) {
      const action = event.action;
      assertKeys(event, action === 'focusStart' ? ['action', 'opId', 'fields'] : ['action', 'opId', 'id', 'version']);
      const payload = { action };
      if (action === 'focusStart') {
        assertKeys(event.fields, ['plannedSeconds', 'taskId']);
        if (!contract.DURATIONS.includes(event.fields.plannedSeconds)) reject('INVALID_INPUT', '请选择本例支持的专注时长');
        if (event.fields.taskId !== '') checkId(event.fields.taskId);
        payload.fields = { plannedSeconds: event.fields.plannedSeconds, taskId: event.fields.taskId };
      } else {
        checkId(event.id); checkVersion(event.version); Object.assign(payload, { id: event.id, version: event.version });
      }
      const rid = receiptId(actor, event.opId), fingerprint = hash(JSON.stringify(payload)), timestamp = now();
      return store.transaction(async tx => {
        const receipt = checkReceipt(await tx.get('studyhub_ops', rid), fingerprint);
        if (receipt) return receipt.result;
        let result;
        if (action === 'focusStart') {
          const previous = await latest(tx, actor);
          const previousSettled = previous ? settle(previous, timestamp) : null;
          if (previousSettled && !contract.terminal(previousSettled.state)) reject('FOCUS_ACTIVE', '已有一轮进行中的专注，请先查看或结束它');
          let task = null;
          if (payload.fields.taskId) {
            task = await tx.get('studyhub_tasks', payload.fields.taskId);
            if (!owned(task, actor)) reject('RELATED_TASK_UNAVAILABLE', '关联任务已删除或不可访问');
          }
          const startAt = Math.max(timestamp, previousSettled ? previousSettled.updatedAt : 0);
          const row = { _id: hash('focus:' + rid), ...actor, ...payload.fields, taskTitle: task ? task.title : '',
            isDemo: payload.fields.plannedSeconds === 10, state: 'running', accumulatedMs: 0,
            segmentStartedAt: startAt, deadlineAt: startAt + payload.fields.plannedSeconds * 1000,
            startedAt: startAt, endedAt: null, updatedAt: startAt, version: 1 };
          dto(row);
          if (previousSettled && previousSettled !== previous) await tx.set('studyhub_focus_sessions', previous._id, previousSettled);
          await tx.set('studyhub_focus_sessions', row._id, row);
          await tx.set('studyhub_focus_slots', slotId(actor), { ...actor, sessionId: row._id });
          result = ack(row);
        } else {
          const row = await tx.get('studyhub_focus_sessions', payload.id);
          if (!owned(row, actor)) reject('NOT_FOUND', '专注记录不存在或不可访问');
          dto(row);
          if (row.version !== payload.version) reject('FOCUS_CHANGED', '专注状态已经变化，请核对后再操作');
          if (!contract.terminal(row.state)) {
            const slot = await tx.get('studyhub_focus_slots', slotId(actor));
            if (!owned(slot, actor) || slot.sessionId !== row._id) throw new Error('Active session slot mismatch');
          }
          const next = transition(row, action, timestamp); dto(next);
          if (next !== row) await tx.set('studyhub_focus_sessions', row._id, next);
          result = ack(next);
        }
        await tx.set('studyhub_ops', rid, { ...actor, fingerprint, result, createdAt: timestamp });
        return result;
      });
    }
  };
}
module.exports = { createFocusService, settle, transition, dto };
