// 课程原创的固定练习数据，不依赖第三方公开接口。
const groups = [
  { id: 'syntax', label: 'JavaScript', topics: ['变量', '条件判断', '循环', '函数', '对象', '数组', '展开语法', '作用域', 'this', '回调', 'Promise', 'async await', '异常处理', '模块化', 'JSON'] },
  { id: 'layout', label: '页面布局', topics: ['WXML', 'WXSS', 'Flex', '盒模型', '列表渲染', '条件渲染', '组件插槽', '表单', '选择器', 'rpx', '长文本', '空状态', '按钮事件', '样式隔离', '页面适配'] },
  { id: 'network', label: '网络开发', topics: ['HTTP', 'GET', 'POST', '状态码', 'JSON响应', '请求超时', '取消请求', '有限重试', '竞态处理', '游标分页', '加载更多', '下拉刷新', '搜索防抖', '缓存策略', '数据校验'] }
];
const resources = groups.flatMap((group, groupIndex) => group.topics.map((topic, index) => ({
  id: 'resource_' + String(groupIndex * 15 + index + 1).padStart(3, '0'),
  title: group.label + '：' + topic + '练习', category: group.id,
  summary: '围绕“' + topic + '”写一个最小示例，先预测结果，再运行、修改并解释变化。',
  minutes: 10 + (index % 5) * 5
})));
module.exports = { resources };
