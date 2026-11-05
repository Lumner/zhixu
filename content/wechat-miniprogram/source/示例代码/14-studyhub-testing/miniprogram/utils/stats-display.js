const { OFFSET_MS, dayKey } = require('../shared/stats-core');
const pad = value => String(value).padStart(2, '0');
function timestampText(value) {
  const date = new Date(value + OFFSET_MS);
  return dayKey(value) + ' ' + pad(date.getUTCHours()) + ':' + pad(date.getUTCMinutes()) + ':' + pad(date.getUTCSeconds());
}
function display(report) {
  const totals = report.totals;
  return { totalMinutes: (totals.totalSeconds / 60).toFixed(1), averageMinutes: (totals.totalSeconds / 7 / 60).toFixed(1),
    completedRate: totals.finishedSessions ? (totals.completedSessions / totals.finishedSessions * 100).toFixed(1) + '%' : '—',
    asOfText: timestampText(report.asOf), rows: report.days.map(day => ({ ...day, minutes: (day.totalSeconds / 60).toFixed(1) })) };
}
module.exports = { display, timestampText };
