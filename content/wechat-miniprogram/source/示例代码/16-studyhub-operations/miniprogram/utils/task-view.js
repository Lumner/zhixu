const { CATEGORIES, PRIORITIES } = require('../constants/index');
const { taskMeta } = require('./task');
function taskRow(task) { return { id: task.id, title: task.title, done: task.done, meta: taskMeta(task) }; }
function composeView(state) {
  const out = {};
  for (const key of ['status','busy','dirty','localState','feedback','draftStale','message','confirmed','opId']) out[key] = state[key];
  const visibleFields = state.status === 'identityChanged' ? { title:'',description:'',category:'general',priority:'normal',dueDate:'',done:false } : state.fields;
  for (const key of ['title','description','category','priority','dueDate','done']) out['fields.' + key] = visibleFields[key];
  out.categoryIndex = Math.max(0, CATEGORIES.findIndex(x => x.id === visibleFields.category));
  out.priorityIndex = Math.max(0, PRIORITIES.findIndex(x => x.id === visibleFields.priority));
  out.draftPreview = state.status === 'choice' ? state.draftPreview : '';
  out.cloudPreview = state.status === 'choice' ? state.cloudPreview : '';
  out.fieldsPreview = state.status === 'sealed' ? JSON.stringify(state.fields, null, 2) : '';
  return out;
}
function appendRows(oldRows, incoming) {
  const seen = new Set(oldRows.map(x => x.id)), rows = [], patch = {};
  for (const row of incoming) if (!seen.has(row.id)) { seen.add(row.id); patch['items[' + (oldRows.length + rows.length) + ']'] = row; rows.push(row); }
  return { added: rows, patch };
}
module.exports = { taskRow, composeView, appendRows };
