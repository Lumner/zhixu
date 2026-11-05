function feedback(error, context = 'read') {
  const code = error && error.code || 'UNKNOWN';
  const view = (title, message, action = '', actionText = '') => ({ code, title, message, action, actionText });
  if (error && error.queued === true) return view('原操作需要核对', '指令已保留。请使用原编号核对；不要再次新建一份提交。', 'pending', '查看待处理');
  if (code === 'CANCELLED') return null;
  if (code === 'DRAFT_STALE') return view('先比较两个版本', '草稿基于旧版本。比较后明确选择是否采用刚读取的版本作为新的提交基础。');
  if (['NOT_CONFIGURED', 'CONFIG', 'UNAUTHENTICATED', 'IDENTITY_CHANGED'].includes(code)) return view('身份或环境需要核对', '请检查当前账号、云环境、函数部署与权限。', 'account', '核对身份与环境');
  if (['DRAFT_CHANGED', 'DRAFT_DATA'].includes(code)) return view('本地草稿需要核对', '草稿已被另一页面更新或格式损坏。保留当前输入，重新打开比较；不要覆盖原缓存。');
  if (['LOCAL_STORAGE', 'DRAFT_STORAGE'].includes(code)) return view('本地保存未确认', '请先保留当前内容，检查空间后再处理本地记录；不要清空整个缓存。', context === 'draft' ? 'saveDraft' : '', context === 'draft' ? '重试本地保存' : '');
  if (code === 'INVALID_INPUT') return view('请检查输入', error.message || '输入未通过校验。');
  if (code === 'NOT_FOUND') return view('内容不存在或不可访问', '可能已被删除，或当前身份没有权限。保留输入后返回核对。', 'list', '返回任务列表');
  if (code === 'CONFLICT') return view('云端版本已经变化', '先比较本地输入与最新内容，再决定采用哪个版本。');
  if (context !== 'read') return view('操作结果尚未确认', '界面超时不代表服务端没有执行。请核对原操作或消息状态，不自动重新发送。', 'pending', '查看原操作');
  if (['TRANSPORT', 'CLOUD_TIMEOUT', 'READ_TIMEOUT', 'INTERNAL', 'NETWORK', 'UNKNOWN'].includes(code)) return view('暂时没有取得结果', '可检查网络后手动重新读取。网络连接存在不等于服务器可达。', 'retry', '重新读取');
  if (code === 'PROTOCOL') return view('返回数据不符合约定', '没有将异常响应显示为零数据。请核对函数版本和响应协议。', 'retry', '重新读取');
  return view('暂时无法完成', error && error.message || '请保留当前内容后核对。');
}
module.exports = { feedback };
