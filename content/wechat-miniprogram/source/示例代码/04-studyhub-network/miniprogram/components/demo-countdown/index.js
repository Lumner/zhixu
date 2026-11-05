const timerCleanup = require('../../behaviors/timer-cleanup');
const { formatSeconds } = require('../../utils/task');
Component({
  behaviors: [timerCleanup],
  options: { styleIsolation: 'isolated' },
  properties: { duration: { type: Number, value: 10 } },
  data: { remaining: 10, label: '00:10', running: false },
  observers: {
    duration() { if (this._alive) this.onReset(); }
  },
  lifetimes: {
    attached() {
      this._alive = true;
      this._visible = true;
      this.onReset();
    },
    detached() {
      this._alive = false;
      this._visible = false;
      // Behavior 会负责 clearTicker；此处不再向已移除的组件 setData。
    }
  },
  pageLifetimes: {
    show() {
      this._visible = true;
      this.syncClock();
      this.ensureTicker();
    },
    hide() {
      this._visible = false;
      this.clearTicker();
    }
  },
  methods: {
    onReset() {
      this.clearTicker();
      this._endAt = 0;
      this._finished = false;
      const value = this.data.duration;
      const remaining = Number.isFinite(value) && value >= 1 && value <= 3600 ? Math.floor(value) : 10;
      this.setData({ remaining, label: formatSeconds(remaining), running: false });
    },
    onStart() {
      if (this.data.running) return;
      if (this.data.remaining === 0) this.onReset();
      this._finished = false;
      this._endAt = Date.now() + this.data.remaining * 1000;
      this.setData({ running: true });
      this.syncClock();
      this.ensureTicker();
    },
    onPause() {
      if (!this.data.running) return;
      this.syncClock();
      this._endAt = 0;
      this.clearTicker();
      this.setData({ running: false });
    },
    ensureTicker() {
      if (!this._alive || !this._visible || !this.data.running || this._timer != null) return;
      this._timer = setInterval(() => this.syncClock(), 250);
    },
    syncClock() {
      if (!this._alive || !this.data.running) return;
      const remaining = Math.max(0, Math.ceil((this._endAt - Date.now()) / 1000));
      this.setData({ remaining, label: formatSeconds(remaining) });
      if (remaining === 0) {
        this.setData({ running: false });
        this._endAt = 0;
        this.clearTicker();
        if (!this._finished) {
          this._finished = true;
          this.triggerEvent('finish', {});
        }
      }
    }
  }
});
