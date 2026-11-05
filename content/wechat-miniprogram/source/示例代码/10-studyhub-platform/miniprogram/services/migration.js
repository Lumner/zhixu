const { validateFields, isValidId } = require('../utils/task');
const outbox = require('./outbox');
const copy = value => JSON.parse(JSON.stringify(value));
function snapshot(read = key => wx.getStorageSync(key)) {
  const v2 = read('studyhub.tasks.v2');
  let sourceKey, tasks;
  if (v2 !== '' && v2 !== undefined) {
    if (!v2 || v2.schemaVersion !== 2 || !Array.isArray(v2.tasks)) throw new Error('v2 缓存损坏，先备份排查，不能回退覆盖');
    sourceKey = 'studyhub.tasks.v2'; tasks = v2.tasks;
  } else {
    sourceKey = 'studyhub.tasks.v1'; const v1 = read(sourceKey);
    if (v1 === '' || v1 === undefined) tasks = [];
    else if (!Array.isArray(v1)) throw new Error('v1 缓存不是数组');
    else tasks = v1.map(item => ({ ...item, description: '', category: 'general', priority: 'normal', dueDate: '' }));
  }
  if (tasks.length > 200) throw new Error('教学版每次最多导入 200 条');
  const ids = new Set();
  const items = tasks.map(task => {
    if (!task || !isValidId(task.id) || ids.has(task.id)) throw new Error('本地 ID 非法或重复');
    ids.add(task.id);
    const fields = { title: task.title, description: task.description, category: task.category,
      priority: task.priority, dueDate: task.dueDate, done: task.done };
    const error = validateFields(fields); if (error) throw new Error(error);
    return { localId: task.id, fields };
  });
  return copy({ sourceKey, items, backup: { sourceKey, raw: read(sourceKey), exportedAt: Date.now() } });
}
async function run(plan, progress, owner) {
  if (!owner) throw new Error('请先核对迁移所属账号和环境');
  for (let index = 0; index < plan.items.length; index += 1) {
    const item = plan.items[index];
    await outbox.submit('importTask', { sourceKey: plan.sourceKey, localId: item.localId, fields: item.fields }, owner);
    progress(index + 1, plan.items.length);
  }
}
module.exports = { snapshot, run };
