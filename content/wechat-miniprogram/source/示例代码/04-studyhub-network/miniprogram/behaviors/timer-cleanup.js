// 可被多个使用 _timer 的组件复用；组件自己的 detached 仍会执行。
module.exports = Behavior({
  methods: {
    clearTicker() {
      if (this._timer !== null && this._timer !== undefined) {
        clearInterval(this._timer);
        this._timer = null;
      }
    }
  },
  lifetimes: {
    detached() { this.clearTicker(); }
  }
});
