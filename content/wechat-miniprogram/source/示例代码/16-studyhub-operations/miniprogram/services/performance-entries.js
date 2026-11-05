function createEntryCollector({ api, enabled = false, limit = 40 }) {
  const rows = []; let observer = null, started = false, active = false;
  const allowed = new Set(['appLaunch','route','firstRender','firstPaint','firstContentfulPaint','largestContentfulPaint','downloadPackage']);
  function ingest(list) {
    if (!active || !list || typeof list.getEntries !== 'function') return;
    let entries; try { entries = list.getEntries(); } catch (_) { return; }
    if (!Array.isArray(entries)) return;
    for (const entry of entries) {
      if (!entry || !allowed.has(entry.name) || !['navigation','render','loadPackage'].includes(entry.entryType) || !Number.isFinite(entry.duration) || entry.duration < 0 || !Number.isFinite(entry.startTime) || entry.startTime < 0) continue;
      rows.push({ name: entry.name, entryType: String(entry.entryType).slice(0,30), startTime: entry.startTime, duration: entry.duration });
      if (rows.length > limit) rows.shift();
    }
  }
  return {
    start() {
      if (started || !enabled || typeof api.getPerformance !== 'function') return false;
      started = true;
      try { const performance = api.getPerformance(); if (!performance || typeof performance.createObserver !== 'function') return false;
        observer = performance.createObserver(ingest); active = true;
        try { observer.observe({ entryTypes: ['navigation','render','loadPackage'] }); }
        catch (_) { observer.observe({ entryTypes: ['navigation','render'] }); }
        return true;
      } catch (_) { active = false; if (observer && typeof observer.disconnect === 'function') { try { observer.disconnect(); } catch (_) {} } return false; }
    },
    snapshot: () => ({ enabled, active, entries: rows.map(x => ({ ...x })), note: '无条目表示未捕获/不支持，不代表启动耗时为零；不记录URL、查询或用户输入。' }),
    stop() { active = false; if (observer && typeof observer.disconnect === 'function') { try { observer.disconnect(); } catch (_) {} } observer = null; }
  };
}
module.exports = { createEntryCollector };
