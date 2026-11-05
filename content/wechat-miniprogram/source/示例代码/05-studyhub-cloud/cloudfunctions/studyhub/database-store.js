function createDatabaseStore(db) {
  const collection = db.collection('studyhub_tasks');
  const scope = actor => ({ ownerAppId: actor.ownerAppId, ownerId: actor.ownerId });
  return {
    async list(actor, { cursor, limit, filter }) {
      const condition = scope(actor);
      if (filter !== 'all') condition.done = filter === 'done';
      if (cursor !== null) condition._id = db.command.gt(cursor);
      const response = await collection.where(condition).orderBy('_id', 'asc').limit(limit).get();
      return response.data;
    },
    async get(actor, id) {
      const response = await collection.where({ ...scope(actor), _id: id }).limit(1).get();
      return response.data[0] || null;
    },
    async create(actor, fields, timestamp) {
      const document = { ...fields, ...scope(actor), version: 1, createdAt: timestamp, updatedAt: timestamp };
      const result = await collection.add({ data: document });
      return { ...document, _id: result._id };
    },
    async update(actor, id, version, fields, timestamp) {
      const result = await collection.where({ ...scope(actor), _id: id, version }).update({
        data: { ...fields, updatedAt: timestamp, version: db.command.inc(1) }
      });
      return result.stats.updated === 1;
    },
    async remove(actor, id, version) {
      const result = await collection.where({ ...scope(actor), _id: id, version }).remove();
      return result.stats.removed === 1;
    }
  };
}
module.exports = { createDatabaseStore };
