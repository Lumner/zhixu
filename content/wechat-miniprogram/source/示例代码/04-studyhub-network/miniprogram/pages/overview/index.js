const repository = require('../../services/task-repository');
const { summarize } = require('../../utils/task');
Page({
  data: { total: 0, completed: 0, remaining: 0, errorMessage: '', showTimer: true, duration: 10, finishedCount: 0 },
  onShow() {
    try { this.setData({ ...summarize(repository.listTasks()), errorMessage: '' }); }
    catch (error) { this.setData({ errorMessage: error.message }); }
  },
  onToggleTimer() { this.setData({ showTimer: !this.data.showTimer }); },
  onChangeDuration() { this.setData({ duration: this.data.duration === 10 ? 20 : 10 }); },
  onFinish() { this.setData({ finishedCount: this.data.finishedCount + 1 }); }
});
