Component({
  properties: {
    count: {
      type: Number,
      value: 3,
      observer(val) {
        this.buildList(val);
      }
    }
  },

  data: {
    list: []
  },

  lifetimes: {
    attached() {
      this.buildList(this.data.count);
    }
  },

  methods: {
    buildList(count) {
      const n = Math.max(0, Math.floor(Number(count) || 0));
      const list = [];
      for (let i = 0; i < n; i += 1) {
        list.push(i);
      }
      this.setData({ list });
    }
  }
});
