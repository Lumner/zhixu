// 仅用于已校验的JSON业务对象：对象键排序，数组顺序保留，不改变字符串值。
function normalize(value) {
  if (Array.isArray(value)) return value.map(normalize);
  if (value !== null && typeof value === 'object') {
    const result = Object.create(null);
    for (const key of Object.keys(value).sort()) result[key] = normalize(value[key]);
    return result;
  }
  return value;
}
function sameJson(left, right) { return JSON.stringify(normalize(left)) === JSON.stringify(normalize(right)); }
module.exports = { sameJson };
