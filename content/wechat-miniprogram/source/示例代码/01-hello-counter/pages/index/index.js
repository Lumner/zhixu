Page({
  data: {
    count: 0
  },

  onIncrease() {
    const nextCount = this.data.count + 1;
    this.setData({ count: nextCount });
  },

  onReset() {
    this.setData({ count: 0 });
  }
});
