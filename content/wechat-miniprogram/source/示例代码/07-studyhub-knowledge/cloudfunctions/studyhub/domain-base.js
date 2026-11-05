const crypto = require('node:crypto');
const CATEGORIES = ['general', 'syntax', 'layout', 'project'];
const PRIORITIES = ['low', 'normal', 'high'];
const FIELD_KEYS = ['title', 'description', 'category', 'priority', 'dueDate', 'done'];

function reject(code, message) { throw Object.assign(new Error(message), { publicCode: code }); }
function isObject(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }
function assertKeys(value, allowed) {
  if (!isObject(value) || Object.keys(value).some(key => !allowed.includes(key))) {
    reject('INVALID_INPUT', '请求包含不允许的字段或结构');
  }
}
function validDate(value) {
  if (value === '') return true;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return year >= 2000 && year <= 2099 && date.getFullYear() === year
    && date.getMonth() === month - 1 && date.getDate() === day;
}
function cleanFields(value) {
  assertKeys(value, FIELD_KEYS);
  if (typeof value.title !== 'string' || !value.title.trim() || value.title.trim().length > 40) reject('INVALID_INPUT', '标题长度须为 1—40 个代码单元');
  if (typeof value.description !== 'string' || value.description.length > 1000) reject('INVALID_INPUT', '备注最多 1000 个代码单元');
  if (!CATEGORIES.includes(value.category) || !PRIORITIES.includes(value.priority)) reject('INVALID_INPUT', '分类或优先级不合法');
  if (!validDate(value.dueDate) || typeof value.done !== 'boolean') reject('INVALID_INPUT', '日期或完成状态不合法');
  return { title: value.title.trim(), description: value.description.trim(), category: value.category,
    priority: value.priority, dueDate: value.dueDate, done: value.done };
}
function validId(id) { return typeof id === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(id); }
function checkId(id) { if (!validId(id)) reject('INVALID_INPUT', '任务 ID 不合法'); }
function checkVersion(version) {
  if (!Number.isSafeInteger(version) || version < 1 || version > 1000000000) reject('INVALID_INPUT', '任务版本不合法');
}
function principal(context, expectedAppId) {
  if (!expectedAppId) reject('NOT_CONFIGURED', '云函数未配置允许的小程序 AppID');
  if (!context || typeof context.OPENID !== 'string' || !context.OPENID
    || typeof context.APPID !== 'string' || context.APPID !== expectedAppId) {
    reject('UNAUTHENTICATED', '缺少有效的微信调用身份');
  }
  return { ownerId: context.OPENID, ownerAppId: context.APPID };
}
function publicTask(task) {
  checkId(task._id);
  checkVersion(task.version);
  if (!Number.isFinite(task.createdAt) || !Number.isFinite(task.updatedAt)) throw new Error('Stored task time invalid');
  const fields = Object.fromEntries(FIELD_KEYS.map(key => [key, task[key]]));
  return { id: task._id, ...cleanFields(fields), createdAt: task.createdAt,
    updatedAt: task.updatedAt, version: task.version };
}

function createHandler({ store, getContext, expectedAppId, now = Date.now, logger = console }) {
  return async function handle(event) {
    try {
      const actor = principal(getContext(), expectedAppId);
      if (!isObject(event)) reject('INVALID_INPUT', '请求必须是对象');
      event = { ...event };
      delete event.userInfo; // 兼容平台附带的信息；身份只取 getWXContext，不信任此字段。
      const action = event.action;
      let data;
      if (action === 'whoami') {
        assertKeys(event, ['action']);
        data = { authenticated: true, appId: actor.ownerAppId,
          userTag: crypto.createHash('sha256').update(actor.ownerAppId + ':' + actor.ownerId).digest('hex').slice(0, 12) };
      } else if (action === 'list') {
        assertKeys(event, ['action', 'cursor', 'limit', 'filter']);
        const cursor = event.cursor === undefined || event.cursor === null ? null : event.cursor;
        if (cursor !== null) checkId(cursor);
        const limit = event.limit === undefined ? 10 : event.limit;
        if (!Number.isInteger(limit) || limit < 1 || limit > 20) reject('INVALID_INPUT', '每页数量须为 1—20');
        const filter = event.filter === undefined ? 'all' : event.filter;
        if (!['all', 'pending', 'done'].includes(filter)) reject('INVALID_INPUT', '筛选条件不合法');
        const rows = await store.list(actor, { cursor, limit: limit + 1, filter });
        const items = rows.slice(0, limit).map(publicTask);
        data = { items, nextCursor: rows.length > limit ? items[items.length - 1].id : null };
      } else if (action === 'get') {
        assertKeys(event, ['action', 'id']); checkId(event.id);
        const task = await store.get(actor, event.id);
        if (!task) reject('NOT_FOUND', '任务不存在或不可访问');
        data = publicTask(task);
      } else {
        reject('INVALID_INPUT', '不支持的操作');
      }
      return { ok: true, data };
    } catch (error) {
      if (error.publicCode) return { ok: false, error: { code: error.publicCode, message: error.message } };
      logger.error({ type: 'studyhub-internal-error', code: error.errCode || error.code || error.name || 'UNKNOWN' });
      return { ok: false, error: { code: 'INTERNAL', message: '服务暂时不可用，请查看云函数日志' } };
    }
  };
}
module.exports = { createHandler, cleanFields, validDate, validId, principal,
  reject, assertKeys, checkId, checkVersion, publicTask };
