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
    }
  };
}
module.exports = { createDatabaseStore };
