const { aggregate } = require('../shared/stats-core');
const asOf = Date.UTC(2026, 10, 2, 4); // 固定的 UTC+08:00 2026-11-02 12:00，本地教学数据。
const ended = (day, hour = 12, minute = 0) => Date.UTC(2026, 9, day, hour - 8, minute);
function record(id, endAt, accumulatedMs, state = 'completed', plannedSeconds = 300) {
  const startedAt = endAt - accumulatedMs;
  return { id, taskId: '', taskTitle: '', plannedSeconds, isDemo: plannedSeconds === 10, state,
    accumulatedMs, segmentStartedAt: null, deadlineAt: null, startedAt, endedAt: endAt,
    updatedAt: endAt, version: 2, effectiveSeconds: Math.floor(accumulatedMs / 1000) };
}
function dataset(name) {
  if (name === 'empty') return [];
  const nov1 = Date.UTC(2026, 10, 1, 4), nov2 = Date.UTC(2026, 10, 2, 3);
  return [record('oct28', ended(28), 300000), record('oct29', ended(29), 60000, 'stopped'),
    record('nov1-cross', Date.UTC(2026, 9, 31, 16, 2), 300000), // 10月31日23:57 到 11月1日00:02。
    record('nov1-extra', nov1, 1500000, 'completed', 1500), record('nov2', nov2, 150099, 'stopped'),
    record('demo', nov2, 10000, 'completed', 10)];
}
function report(name = 'normal') { return aggregate(dataset(name), '2026-11-02', asOf); }
module.exports = { asOf, record, dataset, report };
