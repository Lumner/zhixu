// 仅支持行首“# ”和“- ”两种轻量标记；不是 Markdown/HTML 解析器。
function toNodes(content) {
  const lines = String(content).replace(/\r\n?/g, '\n').split('\n');
  const nodes = []; let list = null;
  for (const line of lines) {
    if (!line.trim()) { list = null; continue; }
    const item = { type: 'text', text: line.startsWith('# ') || line.startsWith('- ') ? line.slice(2) : line };
    if (line.startsWith('- ')) {
      if (!list) { list = { name: 'ul', children: [] }; nodes.push(list); }
      list.children.push({ name: 'li', children: [item] });
    } else {
      list = null; nodes.push({ name: line.startsWith('# ') ? 'h2' : 'p', children: [item] });
    }
  }
  return nodes;
}
module.exports = { toNodes };
