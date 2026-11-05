const cloud = require('wx-server-sdk');
const { createHandler } = require('./domain');
const { createDatabaseStore } = require('./database-store');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const handler = createHandler({
  store: createDatabaseStore(cloud.database()),
  getContext: () => cloud.getWXContext(),
  expectedAppId: process.env.STUDYHUB_APP_ID,
  logger: console
});
exports.main = event => handler(event);
