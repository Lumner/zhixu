const cloud = require('wx-server-sdk');
const { createHandler } = require('./sync-domain');
const { createTransactionStore } = require('./transaction-store');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const handler = createHandler({
  store: createTransactionStore(cloud.database({ throwOnNotFound: false })),
  storage: {
    async upload(cloudPath, buffer) { return (await cloud.uploadFile({ cloudPath, fileContent: buffer })).fileID; },
    async download(fileID) { return (await cloud.downloadFile({ fileID })).fileContent; },
    async remove(fileID) {
      const response = await cloud.deleteFile({ fileList: [fileID] });
      const item = response.fileList && response.fileList[0];
      if (!item || item.fileID !== fileID || item.status !== 0) throw new Error('STORAGE_DELETE_UNCONFIRMED');
    }
  },
  getContext: () => cloud.getWXContext(),
  expectedAppId: process.env.STUDYHUB_APP_ID,
  logger: console
});
exports.main = event => handler(event);
