// 客户端/云函数各保留一份相同协议；整理脚本检查内容一致。
const DURATIONS = [10, 300, 1500, 2700];
const STATES = ['running', 'paused', 'completed', 'stopped'];
const terminal = state => state === 'completed' || state === 'stopped';
const validId = value => typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value);
const integer = value => Number.isSafeInteger(value) && value >= 0;
function validSession(row) {
  if (!row || !validId(row.id) || !DURATIONS.includes(row.plannedSeconds) || !STATES.includes(row.state)
    || !integer(row.version) || row.version < 1 || !integer(row.startedAt) || !integer(row.updatedAt) || row.updatedAt < row.startedAt
    || !integer(row.accumulatedMs) || row.accumulatedMs > row.plannedSeconds * 1000
    || !(row.taskId === '' || validId(row.taskId)) || typeof row.taskTitle !== 'string' || row.taskTitle.length > 40
    || (row.taskId && !row.taskTitle) || row.isDemo !== (row.plannedSeconds === 10)) return false;
  const remaining = row.plannedSeconds * 1000 - row.accumulatedMs;
  if (row.state === 'running') return remaining > 0 && integer(row.segmentStartedAt) && row.segmentStartedAt >= row.startedAt
    && row.updatedAt >= row.segmentStartedAt && row.deadlineAt === row.segmentStartedAt + remaining
    && row.endedAt === null && row.effectiveSeconds === null;
  if (row.segmentStartedAt !== null || row.deadlineAt !== null) return false;
  if (row.state === 'paused') return remaining > 0 && row.endedAt === null && row.effectiveSeconds === null;
  return integer(row.endedAt) && row.endedAt >= row.startedAt && row.endedAt <= row.updatedAt
    && row.effectiveSeconds === Math.floor(row.accumulatedMs / 1000)
    && (row.state === 'completed' ? remaining === 0 : remaining > 0);
}
function validAck(value) {
  return value && validId(value.sessionId) && Number.isSafeInteger(value.version) && value.version > 0 && STATES.includes(value.state);
}
module.exports = { DURATIONS, STATES, terminal, validId, validSession, validAck };
