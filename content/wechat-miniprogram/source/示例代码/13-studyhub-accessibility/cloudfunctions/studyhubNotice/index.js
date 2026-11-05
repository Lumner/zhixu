const cloud = require('wx-server-sdk');
const { createHandler, readConfig } = require('./domain');
const { createStore } = require('./store');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const handle = createHandler({ store: createStore(cloud.database({ throwOnNotFound: false })),
  getContext: () => cloud.getWXContext(), config: readConfig(process.env),
  send: payload => cloud.openapi.subscribeMessage.send(payload) });
exports.main = event => handle(event);
