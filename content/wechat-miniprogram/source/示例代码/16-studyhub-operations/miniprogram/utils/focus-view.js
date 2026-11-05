const { terminal } = require('../shared/focus-contract');
const labels = { running: '计时中', paused: '已暂停', completed: '已完成', stopped: '提前结束' };
function formatSeconds(seconds) {
  const value = Math.max(0, Math.floor(seconds));
  return String(Math.floor(value / 60)).padStart(2, '0') + ':' + String(value % 60).padStart(2, '0');
}
function view(session, estimatedNow) {
  if (!session) return { countdown: '--:--', elapsed: '00:00', label: '尚未开始', awaiting: false };
  const total = session.plannedSeconds * 1000;
  const remaining = session.state === 'running' ? Math.max(0, Math.min(total - session.accumulatedMs, session.deadlineAt - estimatedNow)) : total - session.accumulatedMs;
  return { countdown: formatSeconds(Math.ceil(remaining / 1000)), elapsed: formatSeconds(Math.floor((total - remaining) / 1000)),
    label: labels[session.state], awaiting: session.state === 'running' && remaining === 0, terminal: terminal(session.state) };
}
function localTime(timestamp) {
  if (timestamp === null) return '尚未结束';
  const d = new Date(timestamp), pad = value => String(value).padStart(2, '0');
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
}
function createServerClock(serverNow, sentAt, receivedAt) {
  if (![serverNow, sentAt, receivedAt].every(Number.isSafeInteger) || receivedAt < sentAt || receivedAt - sentAt > 10000) {
    throw Object.assign(new Error('本轮时间核对误差较大，请重新核对云端'), { code: 'CLOCK_SYNC' });
  }
  let lastLocal = receivedAt, lastEstimated = serverNow, stale = false;
  return {
    read(localNow) {
      if (!Number.isSafeInteger(localNow) || localNow < lastLocal || localNow - lastLocal > 5000) stale = true;
      if (!stale) { lastEstimated = serverNow + localNow - receivedAt; lastLocal = localNow; }
      return { now: lastEstimated, needsSync: stale };
    }
  };
}
module.exports = { view, formatSeconds, localTime, createServerClock, labels };
