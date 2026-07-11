const auth = require('../../../utils/auth')
const chatService = require('../../../services/chat')
const orderService = require('../../../services/orders')
const reviewService = require('../../../services/reviews')
const format = require('../../../utils/format')
const confirm = require('../../../utils/confirm').confirm
const settings = require('../../../utils/settings')

const SYS_PREFIX = 'sys-notify-'

const WITHDRAW_WINDOW = 120 * 1000

const EMOJIS = [
  '😀', '😄', '😂', '🤣', '😊', '😍', '😉', '🤔',
  '😅', '😭', '😳', '😴', '🙏', '👍', '👎', '👌',
  '🤝', '💪', '🎉', '❤️', '🔥', '⭐', '🌹', '🍀',
  '🍜', '☕', '📚', '🏃', '⚽', '🎮', '🚴', '📦'
]

function parsePayment(raw) {
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch (e) {
    return null
  }
}

function parseMessageTime(value) {
  if (!value) return 0
  const d = new Date(String(value).replace(' ', 'T'))
  return isNaN(d.getTime()) ? 0 : d.getTime()
}

function isLocalId(id) {
  return String(id).indexOf('local-') === 0
}

Page({
  data: {
    chatId: '',
    user: null,
    partnerId: '',
    partnerName: '',
    taskTitle: '',
    messages: [],
    loading: true,
    input: '',
    payAmount: '',
    paymentKindIndex: 0,
    paymentKinds: [
      { label: '收款', value: 'request' },
      { label: '转账', value: 'transfer' }
    ],
    activeOrder: null,
    intoView: '',
    showEmoji: false,
    emojis: EMOJIS,
    tradeDone: false,
    canReview: false,
    hasNewReview: false,
    isSystemChat: false,
    fontClass: ''
  },

  onLoad(options) {
    const chatId = decodeURIComponent(options.chatId || '')
    const isSystemChat = chatId.indexOf(SYS_PREFIX) === 0
    this.setData({
      chatId: chatId,
      isSystemChat: isSystemChat
    })
    if (isSystemChat) {
      wx.setNavigationBarTitle({ title: '系统通知' })
    }
  },

  onShow() {
    if (!auth.requireLogin()) {
      return
    }
    const prefs = settings.getSettings()
    this.autoRead = prefs.autoRead
    this.setData({
      user: auth.getUser(),
      fontClass: 'font-' + prefs.fontSize
    })
    if (this.data.isSystemChat) {
      this.setData({ partnerName: '系统通知' })
      this.loadMessages()
    } else {
      this.loadContext()
    }
    this.stopPolling()
    this.pollTimer = setInterval(() => this.loadMessages(true), 4000)
  },

  onHide() {
    this.stopPolling()
  },

  onUnload() {
    this.stopPolling()
  },

  stopPolling() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer)
      this.pollTimer = null
    }
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
      this.refreshOrderExtras(activeOrder)
      this.loadMessages()
    }).catch(() => {
      this.loadMessages()
    })
  },

  // 订单完成后的附加状态：交易成功标记、是否可评价、对方是否已评价我
  refreshOrderExtras(order) {
    if (!order || order.status !== 'completed') {
      this.setData({ tradeDone: false, canReview: false, hasNewReview: false })
      return
    }
    this.setData({ tradeDone: true })
    reviewService.hasReviewed(order.id).then((data) => {
      this.setData({ canReview: !(data && data.hasReviewed) })
    }).catch(function () {
    })
    const me = auth.getUser()
    if (me && me.id) {
      reviewService.list(me.id).then((reviews) => {
        const mine = (reviews || []).some(function (r) {
          return String(r.orderId) === String(order.id)
        })
        this.setData({ hasNewReview: mine })
      }).catch(function () {
      })
    }
  },

  goReview() {
    const order = this.data.activeOrder
    if (!order) {
      return
    }
    wx.navigateTo({
      url: '/pages/reviews/create/index?orderId=' + order.id +
        '&toUserId=' + this.data.partnerId +
        '&toUserName=' + encodeURIComponent(this.data.partnerName || '对方')
    })
  },

  goMyReviews() {
    const me = auth.getUser()
    if (!me || !me.id) {
      return
    }
    wx.navigateTo({
      url: '/pages/reviews/list/index?userId=' + me.id + '&name=' + encodeURIComponent(me.username || '')
    })
  },

  toggleEmoji() {
    this.setData({ showEmoji: !this.data.showEmoji })
  },

  onEmojiTap(e) {
    const emoji = e.currentTarget.dataset.emoji || ''
    this.setData({ input: this.data.input + emoji })
  },

  loadMessages(silent) {
    return chatService.messages(this.data.chatId).then((list) => {
      const user = auth.getUser()
      const uid = user ? String(user.id) : ''
      const mapped = (list || []).map(function (item) {
        const payment = parsePayment(item.payment)
        const isMine = item.senderId != null && String(item.senderId) === uid
        return Object.assign({}, item, {
          isSystem: item.type === 'system',
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
      // 保留尚未成功上屏的本地乐观消息（发送中 / 失败待重发）
      const locals = (this.data.messages || []).filter(function (item) {
        return isLocalId(item.id) && (item.pending || item.failed)
      })
      const messages = mapped.concat(locals)

      const current = this.data.messages || []
      // 内容级签名：撤回、支付卡状态变化即使条数不变也要刷新
      const signature = function (arr) {
        return arr.map(function (m) {
          return String(m.id) + ':' + (m.withdrawn ? 1 : 0) + ':' + (m.paymentInfo ? m.paymentInfo.status : '')
        }).join(',')
      }
      if (silent && !this.data.loading && signature(messages) === signature(current)) {
        // 无任何变化，跳过 setData，避免打断输入
        return
      }

      const lastNew = messages.length ? messages[messages.length - 1] : null
      const lastCur = current.length ? current[current.length - 1] : null
      const patch = { messages: messages, loading: false }
      // 只有出现新的末条消息才移动滚动位置，状态变化不把用户从历史消息拉回底部
      if (lastNew && (!lastCur || String(lastNew.id) !== String(lastCur.id) || messages.length !== current.length)) {
        patch.intoView = 'msg-' + lastNew.id
      }
      this.setData(patch)
      if (this.autoRead !== false) {
        chatService.markRead(this.data.chatId).catch(function () {})
      }
    }).catch(() => {
      if (!silent) {
        this.setData({ loading: false })
      }
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
    this.setData({ input: '', showEmoji: false })
    this.pushLocalAndSend(content)
  },

  pushLocalAndSend(content) {
    const localId = 'local-' + Date.now()
    const localMsg = {
      id: localId,
      type: 'text',
      content: content,
      isMine: true,
      pending: true,
      bubbleClass: 'mine',
      timeText: ''
    }
    this.setData({
      messages: (this.data.messages || []).concat([localMsg]),
      intoView: 'msg-' + localId
    })
    chatService.sendMessage(this.data.chatId, content).then(() => {
      this.setData({
        messages: this.data.messages.filter(function (item) {
          return item.id !== localId
        })
      })
      this.loadMessages(true)
    }).catch(() => {
      this.setData({
        messages: this.data.messages.map(function (item) {
          return item.id === localId
            ? Object.assign({}, item, { pending: false, failed: true })
            : item
        })
      })
    })
  },

  resendLocal(e) {
    const localId = e.currentTarget.dataset.id
    const found = (this.data.messages || []).find(function (item) {
      return String(item.id) === String(localId)
    })
    if (!found || !found.failed) {
      return
    }
    this.setData({
      messages: this.data.messages.filter(function (item) {
        return String(item.id) !== String(localId)
      })
    })
    this.pushLocalAndSend(found.content)
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
    const kind = this.data.paymentKinds[this.data.paymentKindIndex]
    const partnerName = this.data.partnerName || '对方'
    confirm({
      title: '发送支付卡片',
      content: '将向' + partnerName + '发起' + kind.label + ' ¥' + format.formatMoney(amount) + '，确认发送？',
      confirmText: '发送'
    }).then((ok) => {
      if (!ok) {
        return
      }
      chatService.sendPayment(this.data.chatId, {
        partnerId: this.data.partnerId,
        kind: kind.value,
        amount: amount
      }).then(() => {
        this.setData({ payAmount: '' })
        this.loadMessages()
      }).catch(function () {
      })
    })
  },

  findMessage(id) {
    return (this.data.messages || []).find(function (item) {
      return String(item.id) === String(id)
    })
  },

  payCard(e) {
    const id = e.currentTarget.dataset.id
    const msg = this.findMessage(id)
    const amountText = msg && msg.paymentAmountText ? msg.paymentAmountText : format.formatMoney(0)
    const partnerName = this.data.partnerName || '对方'
    confirm({
      title: '确认支付',
      content: '将向' + partnerName + '支付 ¥' + amountText + '，确认继续？',
      confirmText: '支付'
    }).then((ok) => {
      if (!ok) {
        return
      }
      chatService.pay(id).then(() => {
        wx.showToast({ title: '支付成功', icon: 'success' })
        this.loadMessages()
      }).catch(function () {
      })
    })
  },

  cancelCard(e) {
    const id = e.currentTarget.dataset.id
    const msg = this.findMessage(id)
    const amountText = msg && msg.paymentAmountText ? msg.paymentAmountText : format.formatMoney(0)
    const partnerName = this.data.partnerName || '对方'
    confirm({
      title: '取消支付卡片',
      content: '确定取消与' + partnerName + '的这笔 ¥' + amountText + ' 支付卡片吗？',
      confirmText: '取消卡片'
    }).then((ok) => {
      if (!ok) {
        return
      }
      chatService.cancelPayment(id).then(() => {
        wx.showToast({ title: '已取消', icon: 'success' })
        this.loadMessages()
      }).catch(function () {
      })
    })
  },

  onBubbleLongpress(e) {
    const id = e.currentTarget.dataset.id
    const msg = this.findMessage(id)
    if (!msg || !msg.isMine || msg.withdrawn || msg.type === 'system' || isLocalId(msg.id)) {
      return
    }
    const sentAt = parseMessageTime(msg.time)
    if (!sentAt || Date.now() - sentAt > WITHDRAW_WINDOW) {
      return
    }
    wx.showActionSheet({
      itemList: ['撤回消息'],
      success: (res) => {
        if (res.tapIndex === 0) {
          this.doWithdraw(id)
        }
      }
    })
  },

  doWithdraw(id) {
    chatService.withdraw(id).then(() => {
      wx.showToast({ title: '已撤回', icon: 'success' })
      this.loadMessages()
    }).catch(function () {
      // 失败提示由 request.js 统一 toast 后端 message
    })
  },

  openOrderDetail() {
    // 上一页就是同会话的订单详情时返回而非再压栈，避免两页互跳撑爆页面栈
    const pages = getCurrentPages()
    const prev = pages.length > 1 ? pages[pages.length - 2] : null
    if (prev && prev.route === 'pages/orders/detail/index' && prev.data && prev.data.chatId === this.data.chatId) {
      wx.navigateBack()
      return
    }
    wx.navigateTo({
      url: '/pages/orders/detail/index?chatId=' + encodeURIComponent(this.data.chatId)
    })
  }
})
