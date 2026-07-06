Component({
  properties: {
    emoji: {
      type: String,
      value: ''
    },
    title: {
      type: String,
      value: ''
    },
    sub: {
      type: String,
      value: ''
    },
    btnText: {
      type: String,
      value: ''
    }
  },

  methods: {
    onAction() {
      this.triggerEvent('action');
    }
  }
});
