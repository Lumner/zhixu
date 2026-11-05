const { parseCreate, parseUpdate, parseList, DomainError, validId } = require('../dist/contracts.js');
function createStore({ capacity = 100 } = {}) {
  if (!Number.isInteger(capacity) || capacity < 1 || capacity > 100) throw new Error('INVALID_CAPACITY');
  const records = new Map(), receipts = new Map(); let sequence = 0;
  const clone = value => structuredClone(value);
  const actorCheck = actor => { if (!['A', 'B'].includes(actor)) throw new DomainError('UNAUTHORIZED'); };
  const dto = row => ({ id: row.id, version: row.version, title: row.title, done: row.done, priority: row.priority });
  function replay(actor, opId, content) {
    const row = receipts.get(actor + ':' + opId);
    if (!row) return null;
    if (row.content !== content) throw new DomainError('OP_REUSED');
    return clone(row.result);
  }
  function reserve() { if (receipts.size >= capacity) throw new DomainError('CAPACITY'); }
  return {
    list(actor, query = {}) {
      actorCheck(actor); const { limit, cursor } = parseList(query);
      const rows = [...records.values()].filter(row => row.owner === actor && (!cursor || row.id > cursor)).sort((a,b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
      const page = rows.slice(0,limit);
      return { items: page.map(dto), nextCursor: rows.length > limit ? page[page.length - 1].id : null };
    },
    create(actor, body) {
      actorCheck(actor); const { opId, fields } = parseCreate(body), content = JSON.stringify({ kind: 'create', fields });
      const old = replay(actor,opId,content); if (old) return old;
      reserve(); if (records.size >= capacity) throw new DomainError('CAPACITY');
      const id = 't' + String(++sequence).padStart(4,'0'), row = { id, owner: actor, version: 1, ...fields };
      records.set(id,row); const result = dto(row); receipts.set(actor + ':' + opId,{ content, result: clone(result) }); return result;
    },
    update(actor,id,body) {
      actorCheck(actor); if (!validId(id)) throw new DomainError('INVALID_INPUT');
      const { opId,version,fields } = parseUpdate(body), content = JSON.stringify({ kind: 'update', id, version, fields });
      const old = replay(actor,opId,content); if (old) return old;
      const row = records.get(id); if (!row || row.owner !== actor) throw new DomainError('NOT_FOUND');
      if (row.version !== version) throw new DomainError('CONFLICT');
      reserve(); const next = { ...row, ...fields, version: version + 1 }; records.set(id,next);
      const result = dto(next); receipts.set(actor + ':' + opId,{ content, result: clone(result) }); return result;
    },
    counts: () => ({ records: records.size, receipts: receipts.size })
  };
}
module.exports = { createStore };
