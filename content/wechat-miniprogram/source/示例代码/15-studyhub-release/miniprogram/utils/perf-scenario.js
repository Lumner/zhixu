const { utf8Bytes } = require('./report-file');
const { taskRow } = require('./task-view');
const copy = value => JSON.parse(JSON.stringify(value));
function dataset(count = 120) {
  if (!Number.isInteger(count) || count < 1 || count > 200) throw new Error('Invalid fixture count');
  return Array.from({ length: count }, (_, index) => ({ id: 'fixed_' + index, title: '固定教学任务 ' + index,
    description: '只用于逻辑层的固定备注。'.repeat(8), category: 'general', priority: 'normal', dueDate: '', done: false, version: 1, createdAt: 1000, updatedAt: 1000 }));
}
function runScenario(strategy, count = 120, updates = 40) {
  if (!['full','path'].includes(strategy) || !Number.isInteger(updates) || updates < 1 || updates > 100) throw new Error('Invalid scenario');
  const records = dataset(count), rows = records.map(taskRow); let bytes = 0;
  for (let index = 0; index < updates; index++) {
    const at = index % count; rows[at] = { ...rows[at], done: !rows[at].done };
    const patch = strategy === 'full' ? { benchRows: rows } : { ['benchRows[' + at + '].done']: rows[at].done };
    bytes += utf8Bytes(JSON.stringify(patch));
  }
  return { strategy, calls: updates, updateJsonBytes: bytes, initialJsonBytes: utf8Bytes(JSON.stringify({ benchRows: dataset(count).map(taskRow) })), finalRows: copy(rows) };
}
function comparison() {
  const full = runScenario('full'), path = runScenario('path');
  const { finalRows: a, ...baseline } = full, { finalRows: b, ...optimized } = path;
  return { fixtureRows: 120, updates: 40, baseline, optimized, sameFinalState: JSON.stringify(a) === JSON.stringify(b),
    dtoJsonBytes: utf8Bytes(JSON.stringify({ benchRows: dataset() })), viewJsonBytes: full.initialJsonBytes,
    note: 'JSON UTF-8近似数据量；不是原生桥实际字节、帧率、渲染耗时或网络流量。' };
}
function percentile(samples, p) {
  if (!Array.isArray(samples) || !samples.length || !samples.every(x => Number.isFinite(x) && x >= 0) || !(p > 0 && p <= 1)) throw new Error('Invalid samples');
  const sorted = [...samples].sort((a,b) => a-b); return sorted[Math.ceil(p * sorted.length) - 1];
}
module.exports = { dataset, runScenario, comparison, percentile };
