const { validReport } = require('../shared/stats-core');
const MAX_BYTES = 32768; // 教学文件上限，不是微信平台配额。
function fail(message) { throw Object.assign(new Error(message), { code: 'FILE_FORMAT' }); }
function utf8Bytes(text) {
  let bytes = 0;
  for (const char of text) { const cp = char.codePointAt(0); bytes += cp <= 0x7f ? 1 : cp <= 0x7ff ? 2 : cp <= 0xffff ? 3 : 4; }
  return bytes;
}
function selectReport(report) {
  if (!validReport(report)) fail('报告口径或合计不合法');
  // 显式列出字段，不能把来源对象中的额外身份/调试字段顺手导出。
  const keys = ['policyVersion', 'timezone', 'consistency', 'complete', 'dateFrom', 'dateTo', 'asOf',
    'startAt', 'endExclusive', 'cutoffExclusive', 'maxSessions', 'sessionCount'];
  const out = {}; keys.forEach(key => { out[key] = report[key]; });
  out.days = report.days.map(day => ({ date: day.date, totalSeconds: day.totalSeconds,
    completedSessions: day.completedSessions, stoppedSessions: day.stoppedSessions, finishedSessions: day.finishedSessions }));
  out.totals = {}; ['totalSeconds', 'completedSessions', 'stoppedSessions', 'finishedSessions', 'activeDays', 'longestActiveDays']
    .forEach(key => { out.totals[key] = report.totals[key]; });
  return out;
}
function pack(report, source) {
  if (!['demo', 'cloud'].includes(source)) fail('来源标记不合法');
  const file = { format: 'studyhub-week-report', version: 1, source, report: selectReport(report) };
  const text = JSON.stringify(file, null, 2);
  if (utf8Bytes(text) > MAX_BYTES) fail('文件超过教学上限');
  return text;
}
function unpack(text) {
  if (typeof text !== 'string' || utf8Bytes(text) > MAX_BYTES) fail('文件不是小型 UTF-8 文本');
  let file;
  try { file = JSON.parse(text.replace(/^\uFEFF/, '')); } catch (_) { fail('JSON 语法错误'); }
  if (!file || Object.keys(file).some(key => !['format', 'version', 'source', 'report'].includes(key))
    || file.format !== 'studyhub-week-report' || file.version !== 1 || !['demo', 'cloud'].includes(file.source)) fail('不支持的报告文件格式');
  return { source: file.source, report: selectReport(file.report) };
}
function summary(report, source) {
  const r = selectReport(report);
  return `${source === 'cloud' ? '云端读取' : '固定练习'}报告 ${r.dateFrom} 至 ${r.dateTo}：${r.totals.totalSeconds} 秒，${r.totals.completedSessions} 轮计划完成。UTC+08:00，整轮归结束日。`;
}
module.exports = { MAX_BYTES, utf8Bytes, selectReport, pack, unpack, summary };
