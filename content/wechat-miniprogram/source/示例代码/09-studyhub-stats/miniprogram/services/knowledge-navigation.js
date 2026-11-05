const { validId } = require('../shared/knowledge-schema');
function detail(id) {
  if (!validId(id)) throw new Error('内容编号不合法');
  wx.navigateTo({ url: '/pages/knowledge-detail/index?id=' + encodeURIComponent(id) });
}
function editor({ id = '', taskId = '', kind = 'note' } = {}) {
  if ((id && !validId(id)) || (taskId && !validId(taskId)) || !['note', 'link'].includes(kind)) throw new Error('编辑参数不合法');
  wx.navigateTo({ url: '/pages/knowledge-editor/index?kind=' + kind + (id ? '&id=' + encodeURIComponent(id) : '')
    + (taskId ? '&taskId=' + encodeURIComponent(taskId) : '') });
}
function back() {
  const fallback = () => wx.switchTab({ url: '/pages/knowledge/index' });
  if (getCurrentPages().length > 1) wx.navigateBack({ delta: 1, fail: fallback }); else fallback();
}
module.exports = { detail, editor, back };
