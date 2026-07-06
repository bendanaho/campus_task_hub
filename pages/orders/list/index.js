const auth = require('../../../utils/auth')
const orderService = require('../../../services/orders')
const format = require('../../../utils/format')

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
    wx.navigateTo({ url: '/pages/auth/login/index' })
  },

  acceptOrder(e) {
    const id = e.currentTarget.dataset.id
    orderService.accept(id).then(() => {
      wx.showToast({ title: '已接受', icon: 'success' })
      this.loadOrders()
    }).catch(function () {
    })
  },

  cancelOrder(e) {
    const id = e.currentTarget.dataset.id
    orderService.cancel(id).then(() => {
      wx.showToast({ title: '已取消', icon: 'success' })
      this.loadOrders()
    }).catch(function () {
    })
  },

  confirmOrder(e) {
    const id = e.currentTarget.dataset.id
    orderService.confirm(id).then(() => {
      wx.showToast({ title: '已确认', icon: 'success' })
      this.loadOrders()
    }).catch(function () {
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
