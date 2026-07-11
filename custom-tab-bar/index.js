Component({
  data: {
    selected: 0,
    unreadTotal: 0,
    themeCls: '',
    accent: 'b1',
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
