// 导出项目实际 draw 函数产生的指令，供可选静态布局预览；不是微信截图。
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const project = path.join(root, '示例代码/09-studyhub-stats/miniprogram');
const chart = require(path.join(project, 'utils/stats-chart'));
const lab = require(path.join(project, 'utils/stats-lab-data'));
for (const name of ['normal', 'empty']) {
  const operations = []; let points = [];
  const ctx = {
    clearRect(...args) { operations.push({ type: 'clear', args }); },
    fillRect(...args) { operations.push({ type: 'rect', args, color: this.fillStyle }); },
    fillText(text, x, y) { operations.push({ type: 'text', text, x, y, color: this.fillStyle, align: this.textAlign, font: this.font }); },
    beginPath() { points = []; }, moveTo(x, y) { points.push([x, y]); }, lineTo(x, y) { points.push([x, y]); },
    stroke() { operations.push({ type: 'line', points: [...points], color: this.strokeStyle }); }
  };
  const report = lab.report(name), plan = chart.layout(343, 230, report.days);
  chart.draw(ctx, plan);
  fs.writeFileSync(path.join(root, '验证', '第八阶段图表布局-' + name + '.json'), JSON.stringify({ name, report, plan, operations }, null, 2) + '\n');
}
