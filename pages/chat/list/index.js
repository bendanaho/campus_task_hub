const auth = require('../../../utils/auth')
const chatService = require('../../../services/chat')
const format = require('../../../utils/format')

Page({
  data: {
    loggedIn: false,
    conversations: [],
    unread: {},
    loading: true
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 1 })
    }
    this.setData({ loggedIn: auth.isLoggedIn() })
    if (auth.isLoggedIn()) {
      this.loadData()
    }
  },

  onPullDownRefresh() {
    this.loadData().finally(function () {
      wx.stopPullDownRefresh()
    })
  },

  loadData() {
    this.setData({ loading: true })
    return Promise.all([
      chatService.conversations(),
      chatService.unread()
    ]).then((res) => {
      const unread = res[1] || { byChat: {} }
      const byChat = unread.byChat || {}
      const conversations = (res[0] || []).map(function (item) {
        return Object.assign({}, item, {
          lastTimeText: format.formatTime(item.lastTime),
          unreadCount: byChat[item.id] || 0,
          avatarText: item.partnerName ? item.partnerName.slice(0, 1) : '同'
        })
      })
      this.setData({
        conversations: conversations,
        unread: unread
      })
    }).catch(function () {
    }).finally(() => {
      this.setData({ loading: false })
    })
  },

  goLogin() {
    wx.navigateTo({ url: '/pages/auth/login/index' })
  },

  openRoom(e) {
    const chatId = e.currentTarget.dataset.id
    wx.navigateTo({
      url: '/pages/chat/room/index?chatId=' + encodeURIComponent(chatId)
    })
  }
})
