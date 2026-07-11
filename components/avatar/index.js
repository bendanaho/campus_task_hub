const avatarUtil = require('../../utils/avatar')

Component({
  properties: {
    avatar: { type: String, value: '' },
    name: { type: String, value: '' },
    uid: { type: null, value: 0 },
    size: { type: Number, value: 86 }
  },

  data: {
    d: { kind: 'color', color: '#2E6BFF', char: '同', src: '' }
  },

  observers: {
    'avatar, name, uid': function () {
      this.refresh()
    }
  },

  lifetimes: {
    attached() {
      this.refresh()
    }
  },

  methods: {
    refresh() {
      this.setData({
        d: avatarUtil.resolve(this.data.avatar, this.data.name, this.data.uid)
      })
    }
  }
})
