const { validSession, terminal } = require('./focus-contract');
const DAY_MS = 86400000;
const OFFSET_MS = 8 * 3600000;
const POLICY = 'focus-end-day-v1';
const MAX_SESSIONS = 500; // 教学业务上限，不是平台配额。
const FOCUS_KEYS = ['id', 'taskId', 'taskTitle', 'plannedSeconds', 'isDemo', 'state', 'accumulatedMs',
  'segmentStartedAt', 'deadlineAt', 'startedAt', 'endedAt', 'updatedAt', 'version', 'effectiveSeconds'];
function invalid(message) { throw Object.assign(new Error(message), { code: 'INVALID_INPUT', publicCode: 'INVALID_INPUT' }); }
const ordinal = timestamp => Math.floor((timestamp + OFFSET_MS) / DAY_MS);
const keyForOrdinal = value => new Date(value * DAY_MS).toISOString().slice(0, 10);
const dayKey = timestamp => keyForOrdinal(ordinal(timestamp));
function parseDay(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) invalid('日期格式须为 YYYY-MM-DD');
  const [year, month, day] = value.split('-').map(Number);
  const timestamp = Date.UTC(year, month - 1, day), date = new Date(timestamp);
  if (year < 2000 || year > 2099 || date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) invalid('统计日期不合法');
  return timestamp / DAY_MS;
}
function weekWindow(endDate, asOf) {
  if (!Number.isSafeInteger(asOf) || asOf < 0) invalid('核对时间不合法');
  const dateTo = endDate === undefined ? dayKey(asOf) : endDate;
  const last = parseDay(dateTo);
  if (last > ordinal(asOf)) invalid('不能查询未来日期');
  const first = last - 6;
  const startAt = first * DAY_MS - OFFSET_MS, endExclusive = (last + 1) * DAY_MS - OFFSET_MS;
  return { dateFrom: keyForOrdinal(first), dateTo, startAt, endExclusive,
    cutoffExclusive: Math.min(endExclusive, asOf + 1), firstOrdinal: first };
}
function summaries(days) {
  const totals = { totalSeconds: 0, completedSessions: 0, stoppedSessions: 0, finishedSessions: 0,
    activeDays: 0, longestActiveDays: 0 };
  let streak = 0;
  for (const day of days) {
    totals.totalSeconds += day.totalSeconds;
    totals.completedSessions += day.completedSessions;
    totals.stoppedSessions += day.stoppedSessions;
    totals.finishedSessions += day.finishedSessions;
    if (day.totalSeconds > 0) { totals.activeDays += 1; streak += 1; } else streak = 0;
    totals.longestActiveDays = Math.max(totals.longestActiveDays, streak);
  }
  return totals;
}
function aggregate(rows, endDate, asOf) {
  const window = weekWindow(endDate, asOf);
  const days = Array.from({ length: 7 }, (_, index) => ({ date: keyForOrdinal(window.firstOrdinal + index),
    totalSeconds: 0, completedSessions: 0, stoppedSessions: 0, finishedSessions: 0 }));
  const identities = new Map();
  for (const row of rows) {
    if (!validSession(row)) throw new Error('无效专注记录，拒绝汇总');
    const signature = JSON.stringify(FOCUS_KEYS.map(key => row[key]));
    if (identities.has(row.id)) {
      if (identities.get(row.id) !== signature) throw new Error('同一会话出现冲突版本，拒绝汇总');
      continue; // 完全相同的重复输入只贡献一次。
    }
    identities.set(row.id, signature);
    if (row.isDemo || !terminal(row.state) || row.endedAt < window.startAt || row.endedAt >= window.cutoffExclusive) continue;
    const day = days[ordinal(row.endedAt) - window.firstOrdinal];
    day.totalSeconds += Math.floor(row.accumulatedMs / 1000);
    day.finishedSessions += 1;
    if (row.state === 'completed') day.completedSessions += 1; else day.stoppedSessions += 1;
  }
  const totals = summaries(days);
  if (totals.finishedSessions > MAX_SESSIONS) throw new Error('统计记录超过教学上限');
  return { policyVersion: POLICY, timezone: 'UTC+08:00', consistency: 'paged-read', complete: true,
    dateFrom: window.dateFrom, dateTo: window.dateTo, asOf, startAt: window.startAt,
    endExclusive: window.endExclusive, cutoffExclusive: window.cutoffExclusive,
    maxSessions: MAX_SESSIONS, sessionCount: totals.finishedSessions, days, totals };
}
function validReport(report) {
  try {
    if (!report || report.policyVersion !== POLICY || report.timezone !== 'UTC+08:00' || report.consistency !== 'paged-read'
      || report.complete !== true || report.maxSessions !== MAX_SESSIONS || !Array.isArray(report.days) || report.days.length !== 7) return false;
    const window = weekWindow(report.dateTo, report.asOf);
    for (const key of ['dateFrom', 'dateTo', 'startAt', 'endExclusive', 'cutoffExclusive']) if (report[key] !== window[key]) return false;
    for (let index = 0; index < 7; index++) {
      const day = report.days[index];
      if (!day || day.date !== keyForOrdinal(window.firstOrdinal + index)) return false;
      if (!['totalSeconds', 'completedSessions', 'stoppedSessions', 'finishedSessions'].every(key => Number.isSafeInteger(day[key]) && day[key] >= 0)) return false;
      if (day.completedSessions + day.stoppedSessions !== day.finishedSessions || day.finishedSessions > MAX_SESSIONS
        || day.totalSeconds > day.finishedSessions * 2700 || day.totalSeconds < day.completedSessions * 300) return false;
    }
    const totals = summaries(report.days);
    if (!report.totals || !Object.keys(totals).every(key => report.totals[key] === totals[key])) return false;
    return report.sessionCount === totals.finishedSessions && report.sessionCount <= MAX_SESSIONS;
  } catch (_) { return false; }
}
module.exports = { DAY_MS, OFFSET_MS, POLICY, MAX_SESSIONS, ordinal, dayKey, parseDay, weekWindow, aggregate, summaries, validReport };
