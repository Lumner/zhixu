const { COLLECTION } = require('./domain');
function createStore(db) {
  return {
    async get(id) { return (await db.collection(COLLECTION).doc(id).get()).data || null; },
    async transaction(work) {
      const transaction = await db.startTransaction();
      const tx = {
        async get(id) { return (await transaction.collection(COLLECTION).doc(id).get()).data || null; },
        async set(id, value) { const data = { ...value }; delete data._id; await transaction.collection(COLLECTION).doc(id).set({ data }); }
      };
      try { const result = await work(tx); await transaction.commit(); return result; }
      catch (error) { try { await transaction.rollback(); } catch (_) { /* 保留未确认结果。 */ } throw error; }
    }
  };
}
module.exports = { createStore };
