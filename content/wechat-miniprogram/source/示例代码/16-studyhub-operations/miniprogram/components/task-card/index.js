const { taskMeta } = require('../../utils/task');
Component({
  options: { styleIsolation: 'isolated' },
  properties: {
    task: { type: Object, value: null },
    disabled: { type: Boolean, value: false }
  },
  data: { meta: '' },
  observers: {
    task(task) {
      const meta = task ? typeof task.meta === 'string' ? task.meta : taskMeta(task) : '';
      if (this.data.meta !== meta) this.setData({ meta });
    }
  },
  methods: {
    onOpen() {
      if (this.data.disabled || !this.data.task) return;
      this.triggerEvent('open', { id: this.data.task.id });
    },
    onToggle() {
      if (this.data.disabled || !this.data.task) return;
      this.triggerEvent('toggle', { id: this.data.task.id });
    }
  }
});
