const auth = require('../../../utils/auth')
const chatService = require('../../../services/chat')
const format = require('../../../utils/format')
const badge = require('../../../utils/badge')
const confirmUtil = require('../../../utils/confirm')
const socket = require('../../../utils/socket')
const history = require('../../../utils/history')

const HIST_KEY = 'chat'

const SYS_PREFIX = 'sys-notify-'
const HIDDEN_KEY = 'campus_hidden_convs'

// 当前登录用户 id（字符串化，便于与订单/任务快照里的 id 比较）
function currentUid() {
  const u = auth.getUser()
  return u && u.id != null ? String(u.id) : ''
}

// 判定某会话是否"待我处理"，是则返回可展示的标签文案，否则返回空串。
// 依据 enriched 的订单快照 + reviewed，与后端 userNeedsAction 口径保持一致：
//   1) 待接受：订单 pending 且我是任务发布者
//   2) 待确认：订单 in_progress 且对方已确认、我尚未确认
//   3) 待评价：订单 completed 且我还没评价
function pendingLabel(conv, uid) {
  const order = conv && conv.order
  if (!order || !order.status) {
    return ''
  }
  const st = order.status
  if (st === 'pending') {
    return String(conv.taskPublisherId) === uid ? '待接受' : ''
  }
  if (st === 'in_progress') {
    const isPayer = String(order.payerId) === uid
    const myConfirmed = isPayer ? !!order.payerConfirmed : !!order.earnerConfirmed
    const otherConfirmed = isPayer ? !!order.earnerConfirmed : !!order.payerConfirmed
    return (otherConfirmed && !myConfirmed) ? '待确认' : ''
  }
  if (st === 'completed') {
    return conv.reviewed ? '' : '待评价'
  }
  return ''
}

Page({
  data: {
    loggedIn: false,
    keyword: '',
    searchFocus: false,
    searchHistory: [],
    tab: 'todo',          // todo(待处理，默认) / unread(未读) / all(全部)
    currentList: [],       // 当前标签要渲染的会话
    conversations: [],     // 全部（受搜索影响）
    todoList: [],          // 待处理（不含系统消息）
    unreadList: [],        // 未读（含系统通知）
    todoCount: 0,          // 概览：待我处理的会话数
    unreadTotal: 0,        // 概览：未读消息总条数
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
      this.scheduleReload()
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
    if (this.reloadTimer) {
      clearTimeout(this.reloadTimer)
      this.reloadTimer = null
    }
  },

  // 合并高频 CHAT_UPDATE：300ms 内的多条推送只静默重载一次，避免整表连拉与 loading 闪烁
  scheduleReload() {
    if (this.reloadTimer) {
      clearTimeout(this.reloadTimer)
    }
    const self = this
    this.reloadTimer = setTimeout(function () {
      self.reloadTimer = null
      self.loadData()
      badge.refreshUnread(self)
    }, 300)
  },

  onPullDownRefresh() {
    this.loadData().finally(function () {
      wx.stopPullDownRefresh()
    })
  },

  loadData() {
    // 仅首屏翻 loading；已有数据后的刷新（含 WS 静默重载）不翻，避免闪烁
    const showLoading = !this.loaded
    if (showLoading) {
      this.setData({ loading: true })
    }
    // 优先用聚合接口（会话 + 未读 + 订单快照 + 是否已评价一次返回）；老后端无该接口时回退到"会话 + 未读"两次请求
    return chatService.enrichedConversations().then((list) => {
      this.applyConversations((list || []).map(function (it) {
        const c = it.conversation || {}
        return Object.assign({}, c, {
          unreadCount: it.unread || 0,
          order: it.order || null,
          reviewed: !!it.reviewed,
          taskPublisherId: it.taskPublisherId,
          taskPublisherSide: it.taskPublisherSide
        })
      }))
    }).catch(() => {
      return Promise.all([
        chatService.conversations(),
        chatService.unread()
      ]).then((res) => {
        const byChat = (res[1] || {}).byChat || {}
        // 老后端无订单快照，"待处理"会为空，但未读/全部仍可用（优雅降级）
        this.applyConversations((res[0] || []).map(function (item) {
          return Object.assign({}, item, { unreadCount: byChat[item.id] || 0 })
        }))
      }).catch(function () {})
    }).finally(() => {
      this.loaded = true
      if (showLoading) {
        this.setData({ loading: false })
      }
    })
  },

  // 统一处理会话列表：计算展示字段 + 待处理标签；
  // 系统会话始终保留（供"全部/未读"内联展示），左滑删除的普通会话在无新动态前保持隐藏
  applyConversations(items) {
    const uid = currentUid()
    const hidden = wx.getStorageSync(HIDDEN_KEY) || {}
    const all = items.map(function (item) {
      const isSys = String(item.id).indexOf(SYS_PREFIX) === 0
      return Object.assign({}, item, {
        isSys: isSys,
        lastTimeText: format.formatTime(item.lastTime),
        todoTag: isSys ? '' : pendingLabel(item, uid)
      })
    })
    // 后端已按 lastTime 倒序返回；此处仅过滤，保持原有时间倒序
    this.allItems = all.filter(function (c) {
      if (c.isSys) {
        return true
      }
      return hidden[c.id] !== String(c.lastTime || '')
    })
    this.applySearch()
  },

  onSearchInput(e) {
    this.setData({ keyword: e.detail.value })
    this.applySearch()
  },

  onSearchConfirm() {
    if (this.data.keyword.trim()) {
      this.setData({ searchHistory: history.push(HIST_KEY, this.data.keyword) })
    }
  },

  onHistTap(e) {
    this.setData({ keyword: e.currentTarget.dataset.term, searchFocus: false })
    this.applySearch()
  },

  onHistClear() {
    this.setData({ searchHistory: history.clear(HIST_KEY) })
  },

  onSearchFocus() {
    this.setData({ searchFocus: true, searchHistory: history.get(HIST_KEY) })
  },

  onSearchBlur() {
    setTimeout(() => {
      this.setData({ searchFocus: false })
    }, 200)
  },

  // 搜索/筛选只作用于"全部"标签；一次刷新三份列表与两个概览数字
  applySearch() {
    const all = this.allItems || []
    const kw = (this.data.keyword || '').trim().toLowerCase()
    // 全部：唯一带搜索的标签，含系统消息
    const allList = !kw ? all : all.filter(function (c) {
      return [c.partnerName, c.taskTitle, c.lastMessage].some(function (field) {
        return field && String(field).toLowerCase().indexOf(kw) !== -1
      })
    })
    // 待处理：需要我接受/确认/评价的会话，不含系统消息
    const todoList = all.filter(function (c) {
      return !c.isSys && !!c.todoTag
    })
    // 未读：含未读的系统通知，保持后端返回的时间倒序
    const unreadList = all.filter(function (c) {
      return c.unreadCount > 0
    })
    const unreadTotal = unreadList.reduce(function (n, c) {
      return n + (c.unreadCount || 0)
    }, 0)
    this.setData({
      conversations: allList,
      todoList: todoList,
      unreadList: unreadList,
      todoCount: todoList.length,
      unreadTotal: unreadTotal
    })
    this.syncCurrent()
  },

  // 按当前标签挑出要渲染的列表
  syncCurrent() {
    const t = this.data.tab
    const cur = t === 'todo' ? (this.data.todoList || [])
      : t === 'unread' ? (this.data.unreadList || [])
        : (this.data.conversations || [])
    this.setData({ currentList: cur })
  },

  switchTab(e) {
    const tab = e.currentTarget.dataset.tab
    if (!tab || tab === this.data.tab) {
      return
    }
    this.setData({ tab: tab, swipeId: '', searchFocus: false })
    this.syncCurrent()
  },

  // 扫把：全部标记已读（含系统通知）
  clearUnread() {
    const unreadConvs = (this.allItems || []).filter(function (c) { return c && c.unreadCount > 0 })
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
    const conv = (this.allItems || []).find(function (c) { return c.id === id })
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
