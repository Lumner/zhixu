const THEMES = {
  light: { background:'#ffffff', text:'#1f2937', muted:'#475569', error:'#b42318', primary:'#125b3a', onPrimary:'#ffffff' },
  dark: { background:'#111827', text:'#f9fafb', muted:'#cbd5e1', error:'#fca5a5', primary:'#86efac', onPrimary:'#052e16' }
};
function luminance(hex) {
  if (typeof hex !== 'string' || !/^#[0-9a-f]{6}$/i.test(hex)) throw new Error('仅接受不透明六位十六进制颜色');
  const channels = [1,3,5].map(at => parseInt(hex.slice(at,at+2),16)/255).map(x => x <= 0.04045 ? x/12.92 : Math.pow((x+0.055)/1.055,2.4));
  return channels[0]*0.2126+channels[1]*0.7152+channels[2]*0.0722;
}
function contrast(a,b) { const x=luminance(a),y=luminance(b);return (Math.max(x,y)+0.05)/(Math.min(x,y)+0.05); }
function paletteReport() { return Object.entries(THEMES).flatMap(([theme,p]) => [['正文',p.text,p.background],['辅助文字',p.muted,p.background],['错误',p.error,p.background],['主按钮',p.onPrimary,p.primary]].map(([name,fg,bg]) => ({ key:theme+'_'+name,theme,name,fg,bg,ratio:contrast(fg,bg),meetsTeachingTarget:contrast(fg,bg)>=4.5 }))); }
function taskName(task,action) { return action + '：' + task.title + '，' + (task.done ? '已完成' : '待完成'); }
function addTask(items, title, id) {
  if (typeof title !== 'string' || !title.trim() || title.trim().length > 40) return { ok:false,error:'标题必填，去除两端空格后最多40个UTF-16代码单元。' };
  if (items.length >= 20) return { ok:false,error:'本地演示最多20条，请重置后再练习。' };
  return { ok:true,items:[...items,{id,title:title.trim(),done:false}] };
}
function checkedTasks(items, ids) {
  if (!Array.isArray(ids) || ids.some(id => typeof id !== 'string') || ids.some(id => !items.some(item => item.id === id))) return null;
  const selected = new Set(ids); return items.map(item=>({...item,done:selected.has(item.id)}));
}
function summary(items) { return '共' + items.length + '项，已完成' + items.filter(x=>x.done).length + '项。'; }
function fontSize(mode) { return {normal:18,large:24,largest:32}[mode] || 18; }
module.exports = { THEMES, luminance, contrast, paletteReport, taskName, addTask, checkedTasks, summary, fontSize };
