const { request, makeError } = require('./request');
const { PAGE_SIZE } = require('../config/network');
const CATEGORIES = ['syntax', 'layout', 'network'];

function validatePage(data) {
  const validItems = data && Array.isArray(data.items) && data.items.every(item =>
    item && typeof item.id === 'string' && item.id.length > 0
    && typeof item.title === 'string' && item.title.length > 0
    && typeof item.summary === 'string' && CATEGORIES.includes(item.category)
    && Number.isInteger(item.minutes) && item.minutes > 0 && item.minutes <= 180);
  if (!validItems || !(data.nextCursor === null || (typeof data.nextCursor === 'string' && data.nextCursor.length > 0))
    || !Number.isInteger(data.total) || data.total < 0) {
    throw makeError('protocol', '资源列表结构不合法');
  }
  return data;
}

function fetchPage({ keyword = '', category = 'all', cursor = null, mode = 'normal' }) {
  const data = { q: keyword.trim(), category, limit: PAGE_SIZE,
    mode: mode === 'slow' ? 'normal' : mode, delayMs: mode === 'slow' ? 4000 : 0 };
  if (cursor !== null) data.cursor = cursor;
  const handle = request({ path: '/api/resources', data });
  return { promise: handle.promise.then(validatePage), cancel: handle.cancel };
}

module.exports = { fetchPage, validatePage };
