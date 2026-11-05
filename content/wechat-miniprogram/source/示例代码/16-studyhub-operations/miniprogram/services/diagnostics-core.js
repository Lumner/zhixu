const EVENTS = new Set(['rpc-ok', 'rpc-fail', 'runtime-error', 'unhandled']);
const ACTIONS = new Set(['ping', 'whoami', 'list', 'get', 'create', 'update', 'remove', 'importTask', 'imageList', 'statsWeek']);
const CODES = new Set(['OK', 'UNCAUGHT', 'UNHANDLED', 'NOT_CONFIGURED', 'CLOUD_TIMEOUT', 'TRANSPORT', 'PROTOCOL', 'CONFLICT', 'INVALID_INPUT', 'FORBIDDEN', 'INTERNAL', 'BUSINESS']);
function bucket(value) {
  if (!Number.isFinite(value) || value < 0) return 'unknown';
  if (value < 250) return '<250ms';
  if (value < 1000) return '250-999ms';
  if (value < 3000) return '1000-2999ms';
  if (value < 12000) return '3000-11999ms';
  return '>=12000ms';
}
function createJournal({ enabled = false, capacity = 80 } = {}) {
  if (!Number.isInteger(capacity) || capacity < 1 || capacity > 200) throw new Error('INVALID_CAPACITY');
  let events = [], accepted = 0, dropped = 0, sequence = 0;
  function record(event, fields = {}) {
    if (enabled !== true || !EVENTS.has(event)) return false;
    if (!fields || typeof fields !== 'object') fields = {};
    // 从零构造允许的字段；不复制payload/error/stack/URL/ID等任意对象。
    const row = { seq: ++sequence, event, action: ACTIONS.has(fields.action) ? fields.action : 'other',
      code: CODES.has(fields.code) ? fields.code : 'OTHER', elapsed: bucket(fields.elapsedMs) };
    events.push(row); accepted++;
    if (events.length > capacity) { events.shift(); dropped++; }
    return true;
  }
  return { record, snapshot: () => ({ enabled: enabled === true, capacity, accepted, dropped, events: events.map(row => ({ ...row })) }),
    clear() { events = []; accepted = 0; dropped = 0; sequence = 0; } };
}
function summarize(events) {
  const rows = Array.isArray(events) ? events.filter(row => row && ['rpc-ok', 'rpc-fail'].includes(row.event)) : [];
  const attempts = rows.length, failures = rows.filter(row => row.event === 'rpc-fail').length;
  const timeouts = rows.filter(row => row.code === 'CLOUD_TIMEOUT' && row.event === 'rpc-fail').length;
  const ratio = attempts ? failures / attempts : null;
  const signal = attempts < 20 ? 'insufficient' : failures >= 3 && ratio >= 0.2 ? 'investigate' : 'no-threshold-hit';
  return { attempts, failures, timeouts, ratio, signal, scope: '仅当前有界内存RPC样本；非线上可用率、时间窗口、全量统计或实际告警。' };
}
module.exports = { createJournal, bucket, summarize };
