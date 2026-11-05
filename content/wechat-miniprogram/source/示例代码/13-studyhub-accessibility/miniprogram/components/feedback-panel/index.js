Component({
  properties: { feedback: { type: Object, value: null } },
  methods: { onAction() { const value = this.properties.feedback; if (value && value.action) this.triggerEvent('action', { kind: value.action }); } }
});
