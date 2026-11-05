const { call } = require('./cloud-client');
const { validReport } = require('../shared/stats-core');
async function week(endDate) {
  const report = await call('statsWeek', endDate === undefined ? {} : { endDate });
  if (!validReport(report)) throw Object.assign(new Error('统计响应不完整或口径不匹配'), { code: 'PROTOCOL' });
  return report;
}
module.exports = { week };
