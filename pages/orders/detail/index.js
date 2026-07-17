const auth = require('../../../utils/auth')
const orderService = require('../../../services/orders')
const postService = require('../../../services/posts')
const chatService = require('../../../services/chat')
const reviewService = require('../../../services/reviews')
const format = require('../../../utils/format')
const confirmUtil = require('../../../utils/confirm')

const STATUS_CLASS = {
  pending: 'amber',
  in_progress: '',
  completed: 'green',
  cancelled: 'gray',
  disputed: 'amber',
  closed: 'gray'
}

function resolutionLabel(order) {
  const map = {
    refund: '仲裁结果：全额退款给付款方',
    settle: '仲裁结果：全额结算给收款方',
    partial: '仲裁结果：部分结算 ¥' + format.formatMoney(order.resolutionAmountToEarner) + ' 给收款方'
  }
  const base = map[order.resolution] || '订单已结案'
  return order.resolutionNote ? base + '（' + order.resolutionNote + '）' : base
}

Page({
  data: {
    chatId: '',
    loading: true,
    loadedOnce: false,
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

  onShow() {
    if (!auth.isLoggedIn()) {
      return
    }
    // 若 onLoad 首次加载因未登录被跳过（登录后 navigateBack 回到本页），此处补首屏加载；
    // 已加载过则仅在从会话等页面返回时静默刷新，避免与首次重复。
    if (!this.data.loadedOnce) {
      this.loadData()
    } else {
      this.loadData(true)
    }
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

  loadData(silent) {
    const chatId = this.data.chatId
    if (!chatId) {
      this.setData({ loading: false, loadedOnce: true, active: null, history: [] })
      return Promise.resolve()
    }
    if (!silent) {
      this.setData({ loading: true })
    }
    return Promise.all([
      orderService.byChat(chatId).catch(function () { return null }),
      orderService.history(chatId).catch(function () { return [] }),
      // 聚合会话接口：一次拿对方昵称 + 任务发布者 id（判断"我能否接受订单"要用），
      // 老后端无该接口时回退普通会话列表（届时无 taskPublisherId，接受入口仍在订单中心）
      chatService.enrichedConversations().then(function (list) {
        return (list || []).map(function (it) {
          const c = (it && it.conversation) || {}
          return { id: c.id, partnerName: c.partnerName, taskPublisherId: it && it.taskPublisherId }
        })
      }).catch(function () {
        return chatService.conversations().catch(function () { return [] })
      })
    ]).then((results) => {
      const user = auth.getUser()
      const uid = user ? String(user.id) : ''
      const conv = (results[2] || []).find(function (c) { return c.id === chatId })
      const partnerName = conv && conv.partnerName ? conv.partnerName : '对方'
      const publisherId = conv && conv.taskPublisherId != null ? String(conv.taskPublisherId) : ''
      const active = this.decorateActive(results[0], uid, partnerName, publisherId)
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
      // 兜底：聚合接口没给 taskPublisherId 时（老后端/会话未命中），按帖子详情
      // 再确认一次"我是否发布者"，是则补出「接受订单」按钮
      if (active && active.status === 'pending' && !active.canAccept && results[0] && results[0].postId) {
        const self = this
        postService.detail(results[0].postId).then(function (data) {
          const t = (data && data.task) || {}
          const stillPending = self.data.active && self.data.active.id === active.id
            && self.data.active.status === 'pending'
          if (stillPending && t.publisherId != null && String(t.publisherId) === uid) {
            self.setData({ 'active.canAccept': true })
          }
        }).catch(function () {})
      }
      return this.refreshReviewFlag(active)
    }).catch(function () {
    }).finally(() => {
      this.setData({ loading: false, loadedOnce: true })
    })
  },

  // 已完成订单默认显示评价入口，若后端确认已评价则收起（查询失败按未评价处理，保留入口）
  refreshReviewFlag(active) {
    if (!active || active.status !== 'completed' || !active.partnerId) {
      return Promise.resolve()
    }
    return reviewService.hasReviewed(active.id).then((data) => {
      const cur = this.data.active
      if (cur && cur.id === active.id && data && data.hasReviewed) {
        this.setData({ 'active.canReview': false })
      }
    }).catch(function () {
    })
  },

  decorateActive(order, uid, partnerName, publisherId) {
    if (!order || !order.id) {
      return null
    }
    const isPayer = order.payerId != null && String(order.payerId) === uid
    const isEarner = order.earnerId != null && String(order.earnerId) === uid
    // 只有帖子发布者能接受待接受订单（接单/下单方无此权限，后端同规则）
    const canAccept = order.status === 'pending' && !!publisherId && publisherId === uid
    const partnerId = isPayer
      ? (order.earnerId != null ? String(order.earnerId) : '')
      : (isEarner ? (order.payerId != null ? String(order.payerId) : '') : '')
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
      canAccept: canAccept,
      canCancel: order.status === 'pending' && (isPayer || isEarner),
      canConfirm: order.status === 'in_progress' && ((isPayer && !order.payerConfirmed) || (isEarner && !order.earnerConfirmed)),
      canDispute: order.status === 'in_progress' && (isPayer || isEarner),
      // 先按状态乐观显示评价入口，refreshReviewFlag 查到已评价再收起
      canReview: order.status === 'completed' && (isPayer || isEarner) && !!partnerId,
      partnerId: partnerId,
      partnerName: partnerName || '对方',
      disputeText: order.status === 'disputed' && order.disputeReason
        ? '申诉理由：' + order.disputeReason
        : (order.status === 'closed' ? resolutionLabel(order) : '')
    }
  },

  // 发布者接受待接受订单（→ 进行中）。悬赏报酬已在发布时冻结；服务/组队单对方下单时已冻结
  acceptOrder() {
    const active = this.data.active
    if (!active) return
    confirmUtil.confirm({
      title: '接受订单',
      content: '接受后订单进入进行中，完成后双方确认结算。确认接受？'
    }).then((ok) => {
      if (!ok) return
      orderService.accept(active.id).then(() => {
        wx.showToast({ title: '已接受，订单进行中', icon: 'none' })
        this.loadData()
      }).catch(function () {
      })
    })
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
      orderService.confirm(active.id).then((order) => {
        const completed = order && order.status === 'completed'
        if (completed) {
          wx.showToast({ title: '订单已完成', icon: 'success' })
        } else {
          wx.showToast({ title: '已确认，等待对方确认', icon: 'none' })
        }
        this.loadData().then(() => {
          if (completed) {
            this.promptReview()
          }
        })
      }).catch(function () {
      })
    })
  },

  // 订单完成后引导评价，与列表页 confirmOrder 的「去评价」一致
  promptReview() {
    const active = this.data.active
    if (!active || active.status !== 'completed' || !active.canReview || !active.partnerId) {
      return
    }
    wx.showModal({
      title: '订单已完成',
      content: '去评价对方吧',
      confirmText: '去评价',
      success: (res) => {
        if (res.confirm) {
          this.goReview()
        }
      }
    })
  },

  goReview() {
    const active = this.data.active
    if (!active) return
    if (!active.partnerId) {
      wx.showToast({ title: '无法识别评价对象', icon: 'none' })
      return
    }
    wx.navigateTo({
      url: '/pages/reviews/create/index?orderId=' + active.id +
        '&toUserId=' + active.partnerId +
        '&toUserName=' + encodeURIComponent(active.partnerName || '对方')
    })
  },

  disputeOrder() {
    const active = this.data.active
    if (!active) return
    wx.showModal({
      title: '订单申诉',
      editable: true,
      placeholderText: '请填写申诉理由（必填）',
      confirmText: '提交申诉',
      success: (res) => {
        if (!res.confirm) return
        const reason = (res.content || '').trim()
        if (!reason) {
          wx.showToast({ title: '请填写申诉理由', icon: 'none' })
          return
        }
        orderService.dispute(active.id, reason).then(() => {
          wx.showToast({ title: '已提交申诉，等待平台仲裁', icon: 'none' })
          this.loadData()
        }).catch(function () {
        })
      }
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
