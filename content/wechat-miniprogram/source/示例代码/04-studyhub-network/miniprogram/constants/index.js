const STORAGE_KEY = 'studyhub.tasks.v2';
const LEGACY_KEY = 'studyhub.tasks.v1';
const MAX_TASKS = 200;
const CATEGORIES = [
  { id: 'general', label: '通用' },
  { id: 'syntax', label: '基础语法' },
  { id: 'layout', label: '页面布局' },
  { id: 'project', label: '项目实践' }
];
const PRIORITIES = [
  { id: 'low', label: '低' },
  { id: 'normal', label: '普通' },
  { id: 'high', label: '高' }
];
module.exports = { STORAGE_KEY, LEGACY_KEY, MAX_TASKS, CATEGORIES, PRIORITIES };
