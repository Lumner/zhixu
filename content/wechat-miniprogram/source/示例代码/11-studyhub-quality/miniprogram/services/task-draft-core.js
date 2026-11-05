const { validateFields, isValidId } = require('../utils/task');
const clone = value => JSON.parse(JSON.stringify(value));
const fail = (code, message) => Object.assign(new Error(message), { code });
const fieldsKeys = ['title', 'description', 'category', 'priority', 'dueDate', 'done'];
function values(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).length !== 6
    || fieldsKeys.some(key => !Object.prototype.hasOwnProperty.call(input, key))
    || typeof input.title !== 'string' || input.title.length > 40
    || validateFields({ ...input, title: '草稿' })) throw fail('DRAFT_DATA', '草稿输入结构不合法');
  const out = {}; fieldsKeys.forEach(key => { out[key] = input[key]; }); return out;
}
function slotFor(id) { if (id !== '' && !isValidId(id)) throw fail('DRAFT_DATA', '草稿资源编号不合法'); return id ? 'task:id:' + id : 'task:new'; }
function validVersion(version) { return version === null || Number.isSafeInteger(version) && version >= 1 && version <= 1000000000; }
function attemptFor(row) {
  if (!row.attempt || !/^[A-Za-z0-9_-]{16,100}$/.test(row.attempt.opId)) throw fail('DRAFT_DATA', '草稿原操作编号不合法');
  const id = row.slot === 'task:new' ? '' : row.slot.slice(8);
  const expected = { action: id ? 'update' : 'create', payload: id ? { id, version: row.baseVersion, fields: values(row.values) } : { fields: values(row.values) } };
  if (row.attempt.action !== expected.action || JSON.stringify(row.attempt.payload) !== JSON.stringify(expected.payload)) throw fail('DRAFT_DATA', '原指令与封存输入不一致');
  return { opId: row.attempt.opId, ...expected };
}
function createTaskDraftStore({ read, write, now = Date.now }) {
  function key(owner) {
    if (typeof owner !== 'string' || !owner || owner.length > 300) throw fail('DRAFT_DATA', '草稿身份范围不合法');
    return 'studyhub.task-drafts.v1:' + encodeURIComponent(owner);
  }
  function clean(row) {
    if (!row || typeof row.slot !== 'string' || !(row.slot === 'task:new' || row.slot.startsWith('task:id:') && isValidId(row.slot.slice(8)))
      || !Number.isSafeInteger(row.revision) || row.revision < 1 || !validVersion(row.baseVersion)
      || (row.slot === 'task:new' ? row.baseVersion !== null : row.baseVersion === null)
      || !Number.isSafeInteger(row.updatedAt) || row.updatedAt < 0 || !['editing', 'sealed'].includes(row.phase)) throw fail('DRAFT_DATA', '草稿元数据损坏');
    const out = { slot: row.slot, revision: row.revision, baseVersion: row.baseVersion, phase: row.phase,
      updatedAt: row.updatedAt, values: values(row.values), attempt: null };
    if (row.phase === 'sealed') out.attempt = attemptFor({ ...out, attempt: row.attempt });
    else if (row.attempt !== null) throw fail('DRAFT_DATA', '未提交草稿不应带有发送指令');
    return out;
  }
  function load(owner) {
    let saved; try { saved = read(key(owner)); } catch (_) { throw fail('DRAFT_STORAGE', '读取本地草稿失败'); }
    if (saved === '' || saved === undefined) return [];
    if (!saved || saved.schemaVersion !== 1 || saved.owner !== owner || !Array.isArray(saved.items) || saved.items.length > 6) throw fail('DRAFT_DATA', '草稿容器损坏');
    const rows = saved.items.map(clean);
    if (new Set(rows.map(row => row.slot)).size !== rows.length) throw fail('DRAFT_DATA', '草稿槽重复');
    return rows;
  }
  function put(owner, rows) {
    try { write(key(owner), { schemaVersion: 1, owner, items: clone(rows) }); }
    catch (_) { throw fail('DRAFT_STORAGE', '本地草稿写入未确认'); }
  }
  return {
    get(owner, id) { return load(owner).find(row => row.slot === slotFor(id)) || null; },
    list(owner) { return clone(load(owner)); },
    save(owner, id, expectedRevision, value) {
      const rows = load(owner), slot = slotFor(id), old = rows.find(row => row.slot === slot);
      if ((old ? old.revision : 0) !== expectedRevision) throw fail('DRAFT_CHANGED', '另一个页面已更新此草稿');
      if (!old && rows.length >= 6) throw fail('DRAFT_STORAGE', '当前身份已有六份任务草稿，请先处理旧草稿');
      const next = clean({ ...value, slot, revision: expectedRevision + 1, updatedAt: now() });
      put(owner, [...rows.filter(row => row.slot !== slot), next]); return clone(next);
    },
    clear(owner, id, expectedRevision) {
      const rows = load(owner), slot = slotFor(id), old = rows.find(row => row.slot === slot);
      if ((old ? old.revision : 0) !== expectedRevision) throw fail('DRAFT_CHANGED', '草稿已经变化，不能清理其他页面的新内容');
      put(owner, rows.filter(row => row.slot !== slot));
    }
  };
}
module.exports = { createTaskDraftStore, values, slotFor, attemptFor };
