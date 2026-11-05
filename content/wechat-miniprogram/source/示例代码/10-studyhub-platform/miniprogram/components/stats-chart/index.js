const { layout, draw, pixelRatio } = require('../../utils/stats-chart');
Component({
  properties: { days: { type: Array, value: [] } },
  data: { unavailable: false },
  observers: { days() { this.schedule(); } },
  lifetimes: {
    attached() { this._alive = true; this._visible = true; this._epoch = 0; },
    ready() { this._ready = true; this.schedule(); },
    detached() { this._alive = false; this._epoch += 1; clearTimeout(this._timer); }
  },
  pageLifetimes: {
    show() { this._visible = true; this.schedule(); },
    hide() { this._visible = false; this._epoch += 1; clearTimeout(this._timer); },
    resize() { this.schedule(); }
  },
  methods: {
    schedule() {
      this._epoch = (this._epoch || 0) + 1; clearTimeout(this._timer);
      if (!this._alive || !this._ready || !this._visible || this.data.unavailable || this.properties.days.length !== 7) return;
      const epoch = this._epoch;
      this._timer = setTimeout(() => this.paint(epoch), 0);
    },
    paint(epoch) {
      if (!this._alive || !this._visible || epoch !== this._epoch) return;
      const days = this.properties.days.map(day => ({ ...day }));
      try {
        wx.createSelectorQuery().in(this).select('#chart').fields({ node: true, size: true }).exec(rows => {
          if (!this._alive || !this._visible || epoch !== this._epoch) return;
          try {
            const result = rows && rows[0], canvas = result && result.node;
            if (!canvas || typeof canvas.getContext !== 'function') throw new Error('Canvas 2D unavailable');
            const plan = layout(result.width, result.height, days), ctx = canvas.getContext('2d');
            let ratio = 1;
            try { if (typeof wx.getWindowInfo === 'function') ratio = pixelRatio(wx.getWindowInfo().pixelRatio); } catch (_) { /* 使用 1 倍画布。 */ }
            canvas.width = Math.round(result.width * ratio); canvas.height = Math.round(result.height * ratio);
            ctx.scale(ratio, ratio); // 宽高赋值先重置位图和变换，避免多次重绘累积缩放。
            draw(ctx, plan);
          } catch (_) { this.setData({ unavailable: true }); }
        });
      } catch (_) { if (this._alive && epoch === this._epoch) this.setData({ unavailable: true }); }
    }
  }
});
