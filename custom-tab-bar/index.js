Component({
  data: {
    selected: 0,
    unreadTotal: 0,
    themeCls: '',
    accent: 'b1',
    iconAccent: '',
    list: [
      {
        pagePath: '/pages/posts/list/index',
        text: '大厅',
        base: 'hall',
        icon: '/assets/tabbar/hall.png',
        iconActive: '/assets/tabbar/hall-active.png'
      },
      {
        pagePath: '/pages/chat/list/index',
        text: '消息',
        base: 'chat',
        icon: '/assets/tabbar/chat.png',
        iconActive: '/assets/tabbar/chat-active.png'
      },
      {
        pagePath: '/pages/posts/publish/index',
        text: '发布',
        publish: true
      },
      {
        pagePath: '/pages/orders/list/index',
        text: '订单',
        base: 'order',
        icon: '/assets/tabbar/order.png',
        iconActive: '/assets/tabbar/order-active.png'
      },
      {
        pagePath: '/pages/user/home/index',
        text: '我的',
        base: 'user',
        icon: '/assets/tabbar/user.png',
        iconActive: '/assets/tabbar/user-active.png'
      }
    ]
  },

  // 背景色 b6~b10 没有专属的 tab 选中图标资源，按最接近的现有配色回退（无则用默认激活图），
  // 避免选中这些主题时当前 tab 图标指向不存在的 PNG 而变空白。
  observers: {
    accent: function (accent) {
      const map = { b2: 'b2', b3: 'b3', b4: 'b4', b5: 'b5', dark: 'dark', b6: 'b4', b7: 'b3', b8: 'b2', b9: '', b10: 'b2' }
      this.setData({ iconAccent: Object.prototype.hasOwnProperty.call(map, accent) ? map[accent] : '' })
    }
  },

  methods: {
    switchTab(e) {
      const index = Number(e.currentTarget.dataset.index)
      const item = this.data.list[index]
      if (index === this.data.selected) {
        return
      }
      wx.switchTab({ url: item.pagePath })
    }
  }
})
