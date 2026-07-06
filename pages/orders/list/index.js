const auth = require('../../../utils/auth')
const orderService = require('../../../services/orders')
const format = require('../../../utils/format')
const confirmUtil = require('../../../utils/confirm')
const badge = require('../../../utils/badge')

Page({
  data: {
    tabs: [
      { label: '全部', value: '' },
      { label: '我付款', value: 'payer' },
      { label: '我收款', value: 'earner' }
    ],
    tabIndex: 0,
    orders: [],
    loading: true,
    loggedIn: false
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 3 })
    }
    badge.refreshUnread(this)
    this.setData({ loggedIn: auth.isLoggedIn() })
    if (auth.isLoggedIn()) {
      this.loadOrders()
    }
  },

  onPullDownRefresh() {
    this.loadOrders().finally(function () {
      wx.stopPullDownRefresh()
    })
  },

  switchTab(e) {
    this.setData({ tabIndex: Number(e.currentTarget.dataset.index) })
    this.loadOrders()
  },

  loadOrders() {
    const user = auth.getUser()
    const role = this.data.tabs[this.data.tabIndex].value
    this.setData({ loading: true })
    return orderService.mine(role).then((list) => {
      const currentId = user ? String(user.id) : ''
      const orders = (list || []).map(function (item) {
        const order = item.order || {}
        const post = item.post || {}
        const isPublisher = post.publisherId && String(post.publisherId) === currentId
        const isPayer = order.payerId && String(order.payerId) === currentId
        const isEarner = order.earnerId && String(order.earnerId) === currentId
        const partnerId = item.partnerId
        const partnerName = item.partnerName || '对方'

        return Object.assign({}, item, {
          id: order.id,
          order: Object.assign({}, order, {
            statusText: format.orderStatusLabel(order.status),
            amountText: format.formatMoney(order.amount),
            createdText: format.formatTime(order.createdAt)
          }),
          post: post,
          roleText: item.myRole === 'payer' ? '我付款' : '我收款',
          canAccept: order.status === 'pending' && isPublisher,
          canCancel: order.status === 'pending',
          canConfirm: order.status === 'in_progress' && ((isPayer && !order.payerConfirmed) || (isEarner && !order.earnerConfirmed)),
          canReview: order.status === 'completed',
          partnerId: partnerId,
          partnerName: partnerName
        })
      })
      this.setData({ orders: orders })
    }).catch(function () {
    }).finally(() => {
      this.setData({ loading: false })
    })
  },

  goLogin() {
    auth.goLogin()
  },

  goHall() {
    wx.switchTab({ url: '/pages/posts/list/index' })
  },

  goDetail(e) {
    const chatId = e.currentTarget.dataset.chat
    if (!chatId) return
    wx.navigateTo({
      url: '/pages/orders/detail/index?chatId=' + encodeURIComponent(chatId)
    })
  },

  acceptOrder(e) {
    const id = e.currentTarget.dataset.id
    confirmUtil.confirm({
      title: '接受订单',
      content: '接受后金额将从付款方余额冻结，确认接受该订单？'
    }).then((ok) => {
      if (!ok) return
      orderService.accept(id).then(() => {
        wx.showToast({ title: '已接受', icon: 'success' })
        this.loadOrders()
      }).catch(function () {
      })
    })
  },

  cancelOrder(e) {
    const id = e.currentTarget.dataset.id
    confirmUtil.confirm({
      title: '取消订单',
      content: '确认取消该订单？'
    }).then((ok) => {
      if (!ok) return
      orderService.cancel(id).then(() => {
        wx.showToast({ title: '已取消', icon: 'success' })
        this.loadOrders()
      }).catch(function () {
      })
    })
  },

  confirmOrder(e) {
    const item = this.data.orders[Number(e.currentTarget.dataset.index)]
    if (!item) return
    confirmUtil.confirm({
      title: '确认完成',
      content: '确认对方已完成？双方均确认后订单将结算'
    }).then((ok) => {
      if (!ok) return
      orderService.confirm(item.order.id).then((order) => {
        wx.showToast({ title: '已确认', icon: 'success' })
        this.loadOrders()
        if (order && order.status === 'completed') {
          wx.showModal({
            title: '订单已完成',
            content: '去评价对方吧',
            confirmText: '去评价',
            success: function (res) {
              if (res.confirm) {
                wx.navigateTo({
                  url: '/pages/reviews/create/index?orderId=' + item.order.id + '&toUserId=' + item.partnerId + '&toUserName=' + encodeURIComponent(item.partnerName)
                })
              }
            }
          })
        }
      }).catch(function () {
      })
    })
  },

  goChat(e) {
    const chatId = e.currentTarget.dataset.chat
    wx.navigateTo({
      url: '/pages/chat/room/index?chatId=' + encodeURIComponent(chatId)
    })
  },

  goReview(e) {
    const item = this.data.orders[Number(e.currentTarget.dataset.index)]
    wx.navigateTo({
      url: '/pages/reviews/create/index?orderId=' + item.order.id + '&toUserId=' + item.partnerId + '&toUserName=' + encodeURIComponent(item.partnerName)
    })
  }
})
