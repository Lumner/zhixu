const { assertKeys, reject } = require('./domain-base');
const { dto } = require('./focus');
const { terminal } = require('./focus-contract');
const core = require('./stats-core');
function createStatsService({ store, now, owned, focus }) {
  return {
    async read(actor, event) {
      assertKeys(event, ['action', 'endDate']);
      // 先校验输入，避免无效查询触发无关核对。
      core.weekWindow(event.endDate, now());
      const latest = await focus.read(actor, { action: 'focusCurrent' });
      const asOf = Math.max(now(), latest.serverNow);
      const window = core.weekWindow(event.endDate, asOf);
      const rows = []; let cursor = null;
      while (true) {
        const page = await store.statsBatch(actor, { startAt: window.startAt,
          cutoffExclusive: window.cutoffExclusive, cursor, limit: 51 });
        if (!Array.isArray(page) || page.length > 51) throw new Error('Invalid statistics page');
        let previous = cursor;
        const clean = page.map(row => {
          if (!owned(row, actor) || (previous !== null && row._id <= previous)) throw new Error('Statistics scope or cursor mismatch');
          previous = row._id;
          const value = dto(row);
          if (value.isDemo || !terminal(value.state) || value.endedAt < window.startAt || value.endedAt >= window.cutoffExclusive) throw new Error('Statistics filter mismatch');
          return value;
        });
        // 多取的一条用于证明是否还存在后续；不能把超限结果当完整统计返回。
        if (rows.length + clean.length > core.MAX_SESSIONS) reject('STATS_TOO_LARGE', '记录超过教学版完整汇总上限，请升级统计读取或汇总方案');
        rows.push(...clean.slice(0, 50));
        if (clean.length <= 50) break;
        cursor = clean[49].id;
      }
      return core.aggregate(rows, window.dateTo, asOf);
    }
  };
}
module.exports = { createStatsService };
