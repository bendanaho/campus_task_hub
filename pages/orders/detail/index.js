const auth = require('../../../utils/auth')
const orderService = require('../../../services/orders')
const format = require('../../../utils/format')
const confirmUtil = require('../../../utils/confirm')

const STATUS_CLASS = {
  pending: 'amber',
  in_progress: '',
  completed: 'green',
  cancelled: 'gray'
}

Page({
  data: {
    chatId: '',
    loading: true,
    active: null,
    history: []
  },

  onLoad(options) {
    const chatId = options && options.chatId ? decodeURIComponent(options.chatId) : ''
    this.setData({ chatId: chatId })
    if (!auth.requireLogin()) {
      this.setData({ loading: false })
      return
    }
    this.loadData()
  },

  onPullDownRefresh() {
    if (!auth.isLoggedIn()) {
      wx.stopPullDownRefresh()
      return
    }
    this.loadData().finally(function () {
      wx.stopPullDownRefresh()
    })
  },

  loadData() {
    const chatId = this.data.chatId
    if (!chatId) {
      this.setData({ loading: false, active: null, history: [] })
      return Promise.resolve()
    }
    this.setData({ loading: true })
    return Promise.all([
      orderService.byChat(chatId).catch(function () { return null }),
      orderService.history(chatId).catch(function () { return [] })
    ]).then((results) => {
      const user = auth.getUser()
      const uid = user ? String(user.id) : ''
      const active = this.decorateActive(results[0], uid)
      const history = (results[1] || []).slice().reverse().map(function (order) {
        return {
          id: order.id,
          statusText: format.orderStatusLabel(order.status),
          statusClass: STATUS_CLASS[order.status] || '',
          amountText: format.formatMoney(order.amount),
          createdText: format.formatTime(order.createdAt),
          isCurrent: !!(active && order.id === active.id)
        }
      })
      this.setData({ active: active, history: history })
    }).catch(function () {
    }).finally(() => {
      this.setData({ loading: false })
    })
  },

  decorateActive(order, uid) {
    if (!order || !order.id) {
      return null
    }
    const isPayer = order.payerId != null && String(order.payerId) === uid
    const isEarner = order.earnerId != null && String(order.earnerId) === uid
    const timeline = []
    if (order.createdAt) {
      timeline.push({ label: '创建订单', time: format.formatTime(order.createdAt) })
    }
    if (order.acceptedAt) {
      timeline.push({ label: '接受订单', time: format.formatTime(order.acceptedAt) })
    }
    if (order.completedAt) {
      timeline.push({ label: '订单完成', time: format.formatTime(order.completedAt) })
    }
    return {
      id: order.id,
      status: order.status,
      statusText: format.orderStatusLabel(order.status),
      statusClass: STATUS_CLASS[order.status] || '',
      amountText: format.formatMoney(order.amount),
      payerConfirmed: !!order.payerConfirmed,
      earnerConfirmed: !!order.earnerConfirmed,
      payerText: order.payerConfirmed ? '已确认' : '待确认',
      earnerText: order.earnerConfirmed ? '已确认' : '待确认',
      timeline: timeline,
      autoText: order.autoConfirmAt && order.status === 'in_progress'
        ? '若对方未确认，将于 ' + format.formatTime(order.autoConfirmAt) + ' 自动结算'
        : '',
      canCancel: order.status === 'pending' && (isPayer || isEarner),
      canConfirm: order.status === 'in_progress' && ((isPayer && !order.payerConfirmed) || (isEarner && !order.earnerConfirmed))
    }
  },

  cancelOrder() {
    const active = this.data.active
    if (!active) return
    confirmUtil.confirm({
      title: '取消订单',
      content: '确认取消该订单？'
    }).then((ok) => {
      if (!ok) return
      orderService.cancel(active.id).then(() => {
        wx.showToast({ title: '已取消', icon: 'success' })
        this.loadData()
      }).catch(function () {
      })
    })
  },

  confirmOrder() {
    const active = this.data.active
    if (!active) return
    confirmUtil.confirm({
      title: '确认完成',
      content: '确认对方已完成？双方均确认后订单将结算'
    }).then((ok) => {
      if (!ok) return
      orderService.confirm(active.id).then(() => {
        wx.showToast({ title: '已确认', icon: 'success' })
        this.loadData()
      }).catch(function () {
      })
    })
  },

  goChat() {
    const chatId = this.data.chatId
    if (!chatId) return
    // 上一页就是同会话的聊天室时返回而非再压栈，避免两页互跳撑爆页面栈
    const pages = getCurrentPages()
    const prev = pages.length > 1 ? pages[pages.length - 2] : null
    if (prev && prev.route === 'pages/chat/room/index' && prev.data && prev.data.chatId === chatId) {
      wx.navigateBack()
      return
    }
    wx.navigateTo({
      url: '/pages/chat/room/index?chatId=' + encodeURIComponent(chatId)
    })
  }
})
