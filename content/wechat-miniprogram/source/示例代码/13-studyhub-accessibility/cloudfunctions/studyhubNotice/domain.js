const crypto = require('node:crypto');
const COLLECTION = 'studyhub_notice_attempts';
const states = ['ready', 'sending', 'sent', 'failed', 'unknown'];
function reject(code, message) { throw Object.assign(new Error(message), { publicCode: code }); }
function keys(value, allowed) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !allowed.includes(key))) reject('INVALID_INPUT', '消息请求字段不合法');
}
function dayKey(timestamp) { return new Date(timestamp + 8 * 3600000).toISOString().slice(0, 10); }
function timeText(timestamp) { return new Date(timestamp + 8 * 3600000).toISOString().slice(0, 19).replace('T', ' '); }
function readConfig(env) {
  const c = { enabled: env.NOTICE_ENABLED === 'true', appId: env.STUDYHUB_APP_ID,
    templateId: env.NOTICE_TEMPLATE_ID || '', thingKey: env.NOTICE_THING_KEY || '', timeKey: env.NOTICE_TIME_KEY || '',
    pageState: env.NOTICE_PAGE_STATE || 'developer' };
  c.enabled = c.enabled && /^[A-Za-z0-9_-]{10,200}$/.test(c.templateId) && /^thing[1-9]\d?$/.test(c.thingKey)
    && /^time[1-9]\d?$/.test(c.timeKey) && ['developer', 'trial', 'formal'].includes(c.pageState);
  return c;
}
function createHandler({ store, getContext, config, send, now = Date.now, logger = console }) {
  return async input => {
    try {
      keys(input, ['action', 'id']);
      const context = getContext();
      if (!config.appId) reject('NOT_CONFIGURED', '请配置消息函数允许的 AppID');
      if (!context || context.APPID !== config.appId || typeof context.OPENID !== 'string' || !context.OPENID) reject('UNAUTHENTICATED', '缺少可信微信调用身份');
      const actor = { ownerId: context.OPENID, ownerAppId: context.APPID };
      if (!['prepare', 'send'].includes(input.action)) reject('INVALID_INPUT', '不支持的消息操作');
      if (input.action === 'prepare') keys(input, ['action']);
      if (!config.enabled) return { ok: true, data: { enabled: false, message: '订阅消息未启用，请按清单配置真实模板与权限' } };
      const timestamp = now(), day = dayKey(timestamp);
      // 与模板 ID 无关：即使当日换模板也不能再产生第二次尝试。
      const id = crypto.createHash('sha256').update(JSON.stringify([actor.ownerAppId, actor.ownerId, day, 'platform-receipt-v1'])).digest('hex');
      const check = row => {
        if (row && (row.ownerId !== actor.ownerId || row.ownerAppId !== actor.ownerAppId || !states.includes(row.state) || row.state === 'ready')) throw new Error('Stored notice attempt invalid');
        return row;
      };
      const result = state => ({ enabled: true, id, day, templateId: config.templateId, state });
      if (input.action === 'prepare') {
        const old = check(await store.get(id));
        return { ok: true, data: result(old ? old.state : 'ready') };
      }
      if (input.id !== id) reject('EXPIRED', '发送编号已过期或不属于当前用户，请重新核对');
      const claim = await store.transaction(async tx => {
        const old = check(await tx.get(id));
        if (old) return { claimed: false, state: old.state };
        await tx.set(id, { ...actor, day, state: 'sending', templateId: config.templateId, createdAt: timestamp, updatedAt: timestamp });
        return { claimed: true };
      });
      if (!claim.claimed) return { ok: true, data: result(claim.state) };
      let state = 'unknown', platformCode = null;
      try {
        const response = await send({ touser: actor.ownerId, templateId: config.templateId,
          page: 'pages/public-lab/index?demo=normal', miniprogramState: config.pageState, lang: 'zh_CN',
          data: { [config.thingKey]: { value: '平台能力练习已完成' }, [config.timeKey]: { value: timeText(timestamp) } } });
        const code = response && (response.errCode !== undefined ? response.errCode : response.errcode);
        if (Number.isInteger(code)) { platformCode = code; state = code === 0 ? 'sent' : 'failed'; }
      } catch (error) {
        const code = error.errCode !== undefined ? error.errCode : error.errcode;
        if (Number.isInteger(code) && code !== 0) { platformCode = code; state = 'failed'; }
        // 无明确平台结果的超时/断线，不能当作没有发送并重试。
      }
      try {
        await store.transaction(async tx => {
          const row = check(await tx.get(id));
          if (!row || row.state !== 'sending') throw new Error('Notice claim changed');
          await tx.set(id, { ...row, state, platformCode, updatedAt: now() });
        });
      } catch (_) { state = 'unknown'; }
      return { ok: true, data: result(state) };
    } catch (error) {
      if (error.publicCode) return { ok: false, error: { code: error.publicCode, message: error.message } };
      logger.error({ type: 'notice-unconfirmed', code: error.code || error.name || 'UNKNOWN' });
      return { ok: false, error: { code: 'UNCONFIRMED', message: '消息操作未确认，只核对状态，不自动重新发送' } };
    }
  };
}
module.exports = { COLLECTION, states, dayKey, timeText, readConfig, createHandler };
