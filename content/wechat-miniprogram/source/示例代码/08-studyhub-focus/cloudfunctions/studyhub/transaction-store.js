const { createDatabaseStore } = require('./database-store');
function createTransactionStore(db) {
  const simple = createDatabaseStore(db);
  return { list: simple.list, get: simple.get,
    async listFocus(actor, cursor, limit) {
      const where = { ...actor }; if (cursor) where._id = db.command.gt(cursor);
      return (await db.collection('studyhub_focus_sessions').where(where).orderBy('_id', 'asc').limit(limit).get()).data;
    },
    async listKnowledge(actor, cursor, limit) {
      const where = { ...actor }; if (cursor) where._id = db.command.gt(cursor);
      return (await db.collection('studyhub_notes').where(where).orderBy('_id', 'asc').limit(limit).get()).data;
    },
    async listImages(actor, cursor, limit) {
      const where = { ...actor }; if (cursor) where._id = db.command.gt(cursor);
      return (await db.collection('studyhub_assets').where(where).orderBy('_id', 'asc').limit(limit).get()).data;
    },
    async transaction(work) {
      const transaction = await db.startTransaction();
      const tx = {
        async get(name, id) { return (await transaction.collection(name).doc(id).get()).data || null; },
        async set(name, id, value) {
          const data = { ...value }; delete data._id;
          await transaction.collection(name).doc(id).set({ data });
        },
        async remove(name, id) { await transaction.collection(name).doc(id).remove(); }
      };
      try { const result = await work(tx); await transaction.commit(); return result; }
      catch (error) {
        try { await transaction.rollback(); } catch (_) { /* 保留原始错误；不猜测提交结果。 */ }
        throw error;
      }
    }
  };
}
module.exports = { createTransactionStore };
