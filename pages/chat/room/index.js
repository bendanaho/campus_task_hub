const auth = require('../../../utils/auth')
const chatService = require('../../../services/chat')
const orderService = require('../../../services/orders')
const format = require('../../../utils/format')

function parsePayment(raw) {
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch (e) {
    return null
  }
}

Page({
  data: {
    chatId: '',
    user: null,
    partnerId: '',
    partnerName: '',
    taskTitle: '',
    messages: [],
    input: '',
    payAmount: '',
    paymentKindIndex: 0,
    paymentKinds: [
      { label: '收款', value: 'request' },
      { label: '转账', value: 'transfer' }
    ],
    activeOrder: null,
    bottomId: 'bottom'
  },

  onLoad(options) {
    this.setData({
      chatId: decodeURIComponent(options.chatId || '')
    })
  },

  onShow() {
    if (!auth.requireLogin()) {
      return
    }
    this.setData({ user: auth.getUser() })
    this.loadContext()
  },

  loadContext() {
    Promise.all([
      chatService.conversations(),
      orderService.byChat(this.data.chatId).catch(function () { return null })
    ]).then((res) => {
      const conversations = res[0] || []
      const found = conversations.find((item) => item.id === this.data.chatId)
      const activeOrder = res[1] || null
      this.setData({
        partnerId: found ? found.partnerId : '',
        partnerName: found ? found.partnerName : '',
        taskTitle: found ? found.taskTitle : '',
        activeOrder: activeOrder ? Object.assign({}, activeOrder, {
          statusText: format.orderStatusLabel(activeOrder.status),
          amountText: format.formatMoney(activeOrder.amount)
        }) : null
      })
      this.loadMessages()
    }).catch(() => {
      this.loadMessages()
    })
  },

  loadMessages() {
    chatService.messages(this.data.chatId).then((list) => {
      const user = auth.getUser()
      const uid = user ? String(user.id) : ''
      const messages = (list || []).map(function (item) {
        const payment = parsePayment(item.payment)
        const isMine = String(item.senderId) === uid
        return Object.assign({}, item, {
          isMine: isMine,
          bubbleClass: isMine ? 'mine' : 'other',
          timeText: format.formatTime(item.time),
          paymentInfo: payment,
          paymentTitle: payment && payment.kind === 'request' ? '收款请求' : '转账',
          paymentStatusText: payment ? (payment.status === 'pending' ? '待处理' : (payment.status === 'paid' ? '已支付' : '已取消')) : '',
          paymentAmountText: payment ? format.formatMoney(payment.amount) : '',
          canPay: payment && payment.status === 'pending' && String(payment.payerId) === uid,
          canCancelPayment: payment && payment.status === 'pending' && isMine
        })
      })
      this.setData({ messages: messages })
      chatService.markRead(this.data.chatId).catch(function () {})
    }).catch(function () {
    })
  },

  onInput(e) {
    this.setData({ input: e.detail.value })
  },

  sendText() {
    const content = this.data.input.trim()
    if (!content) {
      return
    }
    chatService.sendMessage(this.data.chatId, content).then(() => {
      this.setData({ input: '' })
      this.loadMessages()
    }).catch(function () {
    })
  },

  onAmountInput(e) {
    this.setData({ payAmount: e.detail.value })
  },

  onKindChange(e) {
    this.setData({ paymentKindIndex: Number(e.detail.value) })
  },

  sendPayment() {
    if (!auth.requireVerified()) {
      return
    }
    const amount = Number(this.data.payAmount)
    if (!this.data.partnerId) {
      wx.showToast({ title: '缺少对方信息', icon: 'none' })
      return
    }
    if (!amount || amount <= 0) {
      wx.showToast({ title: '请输入金额', icon: 'none' })
      return
    }
    chatService.sendPayment(this.data.chatId, {
      partnerId: this.data.partnerId,
      kind: this.data.paymentKinds[this.data.paymentKindIndex].value,
      amount: amount
    }).then(() => {
      this.setData({ payAmount: '' })
      this.loadMessages()
    }).catch(function () {
    })
  },

  payCard(e) {
    chatService.pay(e.currentTarget.dataset.id).then(() => {
      wx.showToast({ title: '支付成功', icon: 'success' })
      this.loadMessages()
    }).catch(function () {
    })
  },

  cancelCard(e) {
    chatService.cancelPayment(e.currentTarget.dataset.id).then(() => {
      wx.showToast({ title: '已取消', icon: 'success' })
      this.loadMessages()
    }).catch(function () {
    })
  },

  withdraw(e) {
    chatService.withdraw(e.currentTarget.dataset.id).then(() => {
      wx.showToast({ title: '已撤回', icon: 'success' })
      this.loadMessages()
    }).catch(function () {
    })
  }
})
