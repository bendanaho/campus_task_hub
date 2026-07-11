const auth = require('../../../utils/auth')
const chatService = require('../../../services/chat')
const format = require('../../../utils/format')
const badge = require('../../../utils/badge')
const confirmUtil = require('../../../utils/confirm')
const socket = require('../../../utils/socket')

const SYS_PREFIX = 'sys-notify-'
const HIDDEN_KEY = 'campus_hidden_convs'

Page({
  data: {
    loggedIn: false,
    keyword: '',
    conversations: [],
    sysConv: null,
    swipeId: '',
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
    badge.refreshUnread(this)
    // 页面可见期间，任何会话有新内容就静默刷新列表
    this.stopRealtime()
    this.unsubChat = socket.on('CHAT_UPDATE', () => {
      this.loadData()
      badge.refreshUnread(this)
    })
  },

  onHide() {
    this.stopRealtime()
  },

  onUnload() {
    this.stopRealtime()
  },

  stopRealtime() {
    if (this.unsubChat) {
      this.unsubChat()
      this.unsubChat = null
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
      const all = (res[0] || []).map(function (item) {
        return Object.assign({}, item, {
          lastTimeText: format.formatTime(item.lastTime),
          unreadCount: byChat[item.id] || 0,
          avatarText: item.partnerName ? item.partnerName.slice(0, 1) : '同'
        })
      })
      // 系统通知会话单独置顶，其余按会话列表展示；
      // 被左滑删除的会话在没有新消息前保持隐藏（lastTime 变了说明有新动态，自动恢复）
      const hidden = wx.getStorageSync(HIDDEN_KEY) || {}
      this.allConversations = all.filter(function (c) {
        if (String(c.id).indexOf(SYS_PREFIX) === 0) {
          return false
        }
        return hidden[c.id] !== String(c.lastTime || '')
      })
      const sysConv = all.find(function (c) {
        return String(c.id).indexOf(SYS_PREFIX) === 0
      }) || null
      this.setData({ sysConv: sysConv })
      this.applySearch()
    }).catch(function () {
    }).finally(() => {
      this.setData({ loading: false })
    })
  },

  onSearchInput(e) {
    this.setData({ keyword: e.detail.value })
    this.applySearch()
  },

  applySearch() {
    const all = this.allConversations || []
    const kw = (this.data.keyword || '').trim().toLowerCase()
    const conversations = !kw ? all : all.filter(function (c) {
      return [c.partnerName, c.taskTitle, c.lastMessage].some(function (field) {
        return field && String(field).toLowerCase().indexOf(kw) !== -1
      })
    })
    this.setData({ conversations: conversations })
  },

  // 扫把：全部标记已读
  clearUnread() {
    const unreadConvs = (this.allConversations || []).concat(this.data.sysConv || [])
      .filter(function (c) { return c && c.unreadCount > 0 })
    if (!unreadConvs.length) {
      wx.showToast({ title: '没有未读消息', icon: 'none' })
      return
    }
    confirmUtil.confirm({
      title: '清除未读',
      content: '将 ' + unreadConvs.length + ' 个会话全部标为已读？'
    }).then((ok) => {
      if (!ok) return
      Promise.all(unreadConvs.map(function (c) {
        return chatService.markRead(c.id).catch(function () {})
      })).then(() => {
        wx.showToast({ title: '已全部已读', icon: 'success' })
        this.loadData()
        badge.refreshUnread(this)
      })
    })
  },

  goSettings() {
    wx.navigateTo({ url: '/pages/chat/settings/index' })
  },

  openSystem() {
    if (!this.data.sysConv) {
      wx.showToast({ title: '暂无系统通知', icon: 'none' })
      return
    }
    wx.navigateTo({
      url: '/pages/chat/room/index?chatId=' + encodeURIComponent(this.data.sysConv.id)
    })
  },

  goLogin() {
    auth.goLogin()
  },

  goHall() {
    wx.switchTab({ url: '/pages/posts/list/index' })
  },

  openRoom(e) {
    if (this.data.swipeId) {
      this.setData({ swipeId: '' })
      return
    }
    const chatId = e.currentTarget.dataset.id
    wx.navigateTo({
      url: '/pages/chat/room/index?chatId=' + encodeURIComponent(chatId)
    })
  },

  onConvTouchStart(e) {
    this.touchX = e.touches[0].clientX
    this.touchY = e.touches[0].clientY
  },

  onConvTouchEnd(e) {
    const dx = e.changedTouches[0].clientX - this.touchX
    const dy = Math.abs(e.changedTouches[0].clientY - this.touchY)
    const id = e.currentTarget.dataset.id
    if (dx < -50 && dy < 40) {
      this.setData({ swipeId: id })
    } else if (dx > 30 && this.data.swipeId === id) {
      this.setData({ swipeId: '' })
    }
  },

  deleteConv(e) {
    const id = e.currentTarget.dataset.id
    const conv = (this.allConversations || []).find(function (c) { return c.id === id })
    const hidden = wx.getStorageSync(HIDDEN_KEY) || {}
    hidden[id] = String((conv && conv.lastTime) || '')
    wx.setStorageSync(HIDDEN_KEY, hidden)
    chatService.markRead(id).catch(function () {})
    this.setData({ swipeId: '' })
    wx.showToast({ title: '已删除，有新消息时会恢复', icon: 'none' })
    this.loadData().then(() => {
      badge.refreshUnread(this)
    })
  }
})
