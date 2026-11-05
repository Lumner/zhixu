function layout(width, height, days) {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width < 180 || height < 120 || !Array.isArray(days) || days.length !== 7
    || !days.every(day => day && /^\d{4}-\d{2}-\d{2}$/.test(day.date) && Number.isFinite(day.totalSeconds) && day.totalSeconds >= 0)) throw new Error('图表尺寸或数据不合法');
  const axisMax = Math.ceil(Math.max(60, ...days.map(day => day.totalSeconds)) / 60) * 60;
  const left = Math.max(42, (axisMax / 60).toFixed(1).length * 6 + 14), right = 12, top = 24, bottom = 34;
  const plotWidth = width - left - right, plotHeight = height - top - bottom;
  const step = plotWidth / 7, barWidth = step * 0.56;
  return { width, height, left, top, plotWidth, plotHeight, axisMax,
    ticks: [0, axisMax / 2, axisMax].map(value => ({ y: top + plotHeight * (1 - value / axisMax), label: (value / 60).toFixed(1) })),
    bars: days.map((day, index) => ({ x: left + step * index + (step - barWidth) / 2,
      y: top + plotHeight * (1 - day.totalSeconds / axisMax), width: barWidth, height: plotHeight * day.totalSeconds / axisMax,
      labelX: left + step * (index + 0.5), label: width < 300 ? day.date.slice(8) : day.date.slice(5), value: day.totalSeconds })) };
}
function draw(ctx, plan) {
  ctx.clearRect(0, 0, plan.width, plan.height);
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, plan.width, plan.height);
  ctx.font = '11px sans-serif'; ctx.textBaseline = 'middle'; ctx.textAlign = 'right';
  for (const tick of plan.ticks) {
    ctx.strokeStyle = '#e2e8f0'; ctx.beginPath(); ctx.moveTo(plan.left, tick.y); ctx.lineTo(plan.left + plan.plotWidth, tick.y); ctx.stroke();
    ctx.fillStyle = '#64748b'; ctx.fillText(tick.label, plan.left - 6, tick.y);
  }
  ctx.textAlign = 'left'; ctx.fillStyle = '#64748b'; ctx.fillText('分钟', 2, 10);
  for (const bar of plan.bars) {
    ctx.fillStyle = '#16794b'; if (bar.height > 0) ctx.fillRect(bar.x, bar.y, bar.width, bar.height);
    ctx.fillStyle = '#475569'; ctx.textAlign = 'center'; ctx.fillText(bar.label, bar.labelX, plan.top + plan.plotHeight + 18);
  }
}
function pixelRatio(value) { return Number.isFinite(value) && value > 0 ? Math.min(3, Math.max(1, value)) : 1; }
module.exports = { layout, draw, pixelRatio };
