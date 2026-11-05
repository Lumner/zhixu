const METHODS = ['getWindowInfo','getAppBaseInfo','chooseMedia','chooseImage','getPerformance'];
function parseVersion(value) {
  if (typeof value !== 'string' || !/^\d{1,5}(?:\.\d{1,5}){0,3}$/.test(value.trim())) return null;
  return value.trim().split('.').map(Number);
}
function compareVersion(left, right) {
  const a = parseVersion(left), b = parseVersion(right); if (!a || !b) return null;
  for (let i = 0; i < Math.max(a.length,b.length); i++) { const delta = (a[i] || 0) - (b[i] || 0); if (delta) return delta > 0 ? 1 : -1; }
  return 0;
}
function capability(api, name) {
  const callable = typeof api[name] === 'function';
  if (!callable) return { name, callable: false, declared: 'missing' };
  if (typeof api.canIUse !== 'function') return { name, callable, declared: 'unknown' };
  try { const answer = api.canIUse(name); return { name, callable, declared: answer === true ? 'supported' : answer === false ? 'unsupported' : 'unknown' }; }
  catch (_) { return { name, callable, declared: 'unknown' }; }
}
const numberOrNull = (value, min, max) => typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max ? value : null;
const textOrUnknown = value => typeof value === 'string' && value.length > 0 && value.length <= 64 ? value : '未知';
function normalizeWindow(info) {
  info = info && typeof info === 'object' ? info : {};
  const result = {};
  for (const key of ['windowWidth','windowHeight','screenWidth','screenHeight']) result[key] = numberOrNull(info[key],1,20000);
  result.pixelRatio = numberOrNull(info.pixelRatio,0.1,10);
  result.statusBarHeight = numberOrNull(info.statusBarHeight,0,500);
  const safe = info.safeArea;
  result.bottomInsetEstimate = safe && result.screenHeight !== null && numberOrNull(safe.bottom,0,result.screenHeight) !== null ? result.screenHeight - safe.bottom : null;
  return result;
}
function readEnvironment(api = {}, renderer) {
  const warnings = [];
  function read(name) { if (typeof api[name] !== 'function') { warnings.push(name + ':missing'); return {}; }
    try { const value = api[name](); if (!value || typeof value !== 'object') { warnings.push(name + ':invalid'); return {}; } return value; }
    catch (_) { warnings.push(name + ':failed'); return {}; }
  }
  const app = read('getAppBaseInfo'), window = normalizeWindow(read('getWindowInfo'));
  return { app: { SDKVersion: textOrUnknown(app.SDKVersion), version: textOrUnknown(app.version), language: textOrUnknown(app.language),
      fontSizeSetting: numberOrNull(app.fontSizeSetting,1,100), fontSizeScaleFactor: numberOrNull(app.fontSizeScaleFactor,0.5,5) },
    window, renderer: ['webview','skyline'].includes(renderer) ? renderer : '未知',
    capabilities: METHODS.map(name => capability(api,name)), warnings };
}
module.exports = { parseVersion, compareVersion, capability, normalizeWindow, readEnvironment };
