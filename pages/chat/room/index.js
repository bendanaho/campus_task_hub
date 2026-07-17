const auth = require('../../../utils/auth')
const chatService = require('../../../services/chat')
const orderService = require('../../../services/orders')
const postService = require('../../../services/posts')
const reviewService = require('../../../services/reviews')
const format = require('../../../utils/format')
const confirm = require('../../../utils/confirm').confirm
const settings = require('../../../utils/settings')
const socket = require('../../../utils/socket')
const upload = require('../../../utils/upload')

const SYS_PREFIX = 'sys-notify-'

const WITHDRAW_WINDOW = 120 * 1000

// 时间分组：与上一条间隔超过 5 分钟才在气泡上方渲染一次分隔时间
const TIME_GROUP_GAP = 5 * 60 * 1000

// 会话草稿（含未发送输入 / 发送失败文案）本地存储键前缀
const DRAFT_PREFIX = 'chat-draft-'

// 支付卡片状态全集（与后端 ChatService 对齐）：
// escrowed=托管冻结中；released=订单完成托管款已转给对方；refunded=订单未成退回；
// arbitrated=按仲裁结果分配。未知状态兜底"已处理"，绝不能误显示成"已取消"
const PAYMENT_STATUS_TEXT = {
  pending: '待处理',
  paid: '已支付',
  escrowed: '托管中 · 订单完成后到账',
  released: '已到账（订单完成自动转账）',
  refunded: '已退回（订单未完成）',
  arbitrated: '已按仲裁结果分配',
  cancelled: '已取消'
}

const QUICK_PHRASES = ['在吗？', '多少钱？', '好的', '已到楼下', '麻烦快一点', '谢谢！']

const EMOJIS = [
  '😀', '😁', '😂', '🤣', '😃', '😄', '😅', '😆',
  '😉', '😊', '😋', '😎', '😍', '😘', '🙂', '🤗',
  '🤔', '😐', '😑', '🙄', '😏', '😮', '😪', '😴',
  '😌', '😜', '😝', '🤤', '😒', '😔', '🙃', '🤑',
  '😲', '🙁', '😖', '😞', '😟', '😤', '😢', '😭',
  '😨', '😩', '🤯', '😬', '😰', '😱', '🥵', '😳',
  '🤪', '😵', '😡', '😠', '🤬', '😷', '🤒', '🤕',
  '🤢', '🥳', '🥰', '😇', '🤠', '🤡', '👻', '💀',
  '👍', '👎', '👌', '🙏', '🤝', '💪', '👏', '🙌',
  '👋', '✌️', '🤞', '🤙', '☝️', '✍️', '💅', '👀',
  '❤️', '💔', '💕', '💯', '🔥', '⭐', '✨', '🎉',
  '🎊', '🌹', '🍀', '🌈', '☀️', '⚡', '💧', '❄️',
  '🍜', '☕', '🍔', '🍎', '🎂', '🍺', '📚', '💰',
  '🧧', '🎁', '⏰', '📍', '✅', '❌', '❓', '❗'
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
    quickPhrases: QUICK_PHRASES,
    tradeDone: false,
    canReview: false,
    hasNewReview: false,
    isSystemChat: false,
    fontClass: '',
    atBottom: true,
    showPay: false,
    showMore: false,
    inputFocused: false,
    kbHeight: 0
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
    // WS 已负责实时刷新，此处仅作兜底轮询，故间隔从 4s 拉长到 15s，降低长会话下
    // 每次全量 GET + 全量 setData 的开销。真正的增量拉取（since/afterId 游标、
    // 只 append 新消息）需后端消息接口支持游标参数，前端暂无法实现。
    this.pollTimer = setInterval(() => {
      this.loadMessages(true)
      // WS 断线时的兜底：订单按钮也跟着轮询刷新，不会一直停在旧状态
      this.refreshOrderSilently()
    }, 15000)
    // WS 即时刷新（轮询保留作兜底）
    this.stopRealtime()
    this.unsubChat = socket.on('CHAT_UPDATE', (msg) => {
      if (msg && msg.chatId === this.data.chatId) {
        this.loadMessages(true)
        // 订单状态变化（接受/确认/申诉/结案）也会触发 CHAT_UPDATE：一并静默重拉
        // 订单上下文，让对方的按钮（确认下单/确认完成/去评价）即时出现，无需退出重进
        this.refreshOrderSilently()
      }
    })
    // 对方接受/确认订单时后端会给我推 PERSONAL_NOTICE：同样即时刷新订单按钮
    this.unsubNotice = socket.on('PERSONAL_NOTICE', () => {
      this.refreshOrderSilently()
    })
    // 返回会话时恢复上次离开留下的未发送/发送失败草稿（每个页面实例只恢复一次）
    if (!this.draftRestored) {
      this.draftRestored = true
      this.restoreDraft()
    }
  },

  onReady() {
    // 量一次消息滚动区可视高度，用于 bindscroll 判断是否贴底
    this.measureMessagesHeight()
  },

  measureMessagesHeight() {
    const self = this
    wx.createSelectorQuery().select('.messages').boundingClientRect(function (rect) {
      if (rect && rect.height) {
        self.msgViewHeight = rect.height
      }
    }).exec()
  },

  // 记录用户是否贴底：翻看历史（未贴底）时不因新消息被强制拉回底部
  onMessagesScroll(e) {
    const d = e.detail || {}
    const vh = this.msgViewHeight || 0
    // 量不到视口高度时保守认为贴底（回退到旧的"总是滚到最新"行为）
    const atBottom = !vh || (d.scrollHeight - d.scrollTop - vh) < 80
    if (atBottom !== this.data.atBottom) {
      this.setData({ atBottom: atBottom })
    }
  },

  onHide() {
    this.stopPolling()
    this.stopRealtime()
  },

  onUnload() {
    this.saveDraft()
    if (this.blurTimer) {
      clearTimeout(this.blurTimer)
      this.blurTimer = null
    }
    this.stopPolling()
    this.stopRealtime()
  },

  // 离开会话前把未发送输入与发送失败的文案暂存本地，返回时恢复，避免用户白打一段字
  saveDraft() {
    // 仅暂存失败的文本消息；图片消息 content 是本地临时路径，重进页面已失效，不入草稿
    const failedTexts = (this.data.messages || []).filter(function (m) {
      return m.failed && m.content && m.type !== 'image'
    }).map(function (m) {
      return m.content
    })
    const draft = (this.data.input || '').trim()
    const parts = failedTexts.concat(draft ? [draft] : [])
    const key = DRAFT_PREFIX + this.data.chatId
    try {
      if (parts.length) {
        wx.setStorageSync(key, parts.join('\n'))
      } else {
        wx.removeStorageSync(key)
      }
    } catch (e) {}
  },

  restoreDraft() {
    const key = DRAFT_PREFIX + this.data.chatId
    let draft = ''
    try {
      draft = wx.getStorageSync(key) || ''
    } catch (e) {
      draft = ''
    }
    if (draft) {
      try { wx.removeStorageSync(key) } catch (e) {}
      if (!this.data.input) {
        this.setData({ input: draft })
        wx.showToast({ title: '已恢复未发送内容', icon: 'none' })
      }
    }
  },

  stopRealtime() {
    if (this.unsubChat) {
      this.unsubChat()
      this.unsubChat = null
    }
    if (this.unsubNotice) {
      this.unsubNotice()
      this.unsubNotice = null
    }
    if (this.orderRefreshTimer) {
      clearTimeout(this.orderRefreshTimer)
      this.orderRefreshTimer = null
    }
  },

  stopPolling() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer)
      this.pollTimer = null
    }
  },

  loadContext() {
    Promise.all([
      // 聚合会话接口带 taskPublisherId：判断"我能否就地接受订单"要用；老后端回退普通接口
      chatService.enrichedConversations().then(function (list) {
        return (list || []).map(function (it) {
          const c = (it && it.conversation) || {}
          return {
            id: c.id,
            partnerId: c.partnerId,
            partnerName: c.partnerName,
            taskId: c.taskId,
            taskTitle: c.taskTitle,
            taskPublisherId: it && it.taskPublisherId,
            taskPublisherSide: it && it.taskPublisherSide,
            taskStatus: it && it.taskStatus,
            taskDeleted: !!(it && it.taskDeleted)
          }
        })
      }).catch(function () {
        return chatService.conversations().catch(function () { return [] })
      }),
      orderService.byChat(this.data.chatId).catch(function () { return null })
    ]).then((res) => {
      const conversations = res[0] || []
      const found = conversations.find((item) => item.id === this.data.chatId)
      const activeOrder = res[1] || null
      const user = auth.getUser()
      const uid = user ? String(user.id) : ''
      const publisherId = found && found.taskPublisherId != null ? String(found.taskPublisherId) : ''
      // 会话信息存实例属性：WS 静默刷新时无需再拉会话列表，即可复算「订单按钮 + 购买入口」
      this._conv = found || null
      this._publisherId = publisherId
      this.setData({
        partnerId: found ? found.partnerId : '',
        partnerName: found ? found.partnerName : '',
        taskTitle: found ? found.taskTitle : ''
      })
      this.applyActiveOrder(activeOrder)
      this.refreshOrderExtras(activeOrder)
      this.loadMessages()
    }).catch(() => {
      this.loadMessages()
    })
  },

  // 会话内就地下单：拉一次帖子详情核实在售并取金额，确认后创建订单
  // （款项由后端在下单/发布时冻结托管，双方确认完成即自动转给收款方）
  buyNow() {
    if (!auth.requireVerified()) {
      return
    }
    const taskId = this._buyTaskId
    if (!taskId || this.buying) {
      return
    }
    this.buying = true
    const self = this
    postService.detail(taskId).then(function (data) {
      const task = (data && data.task) || {}
      const side = task.publisherSide
      const money = Number(task.rewardValue) > 0 ? '¥' + format.formatMoney(task.rewardValue) : ''
      let title, content
      if (side === 'payer') {
        title = '确认接单'
        content = '将创建订单，等待发布者接受。' + (money ? '赏金 ' + money + ' 已由平台冻结托管，完成后打给你。' : '')
      } else if (side === 'none') {
        title = '确认参加'
        content = '将向发起者申请参加，不涉及任何费用。'
      } else {
        title = '确认购买'
        content = money
          ? ('将创建订单并立即从你的余额冻结 ' + money + '（对方未接受或取消会自动退回），双方确认完成后自动转给对方。')
          : '将创建订单，费用面议，可先在会话中沟通。'
      }
      return confirm({ title: title, content: content }).then(function (ok) {
        if (!ok) {
          return
        }
        return orderService.create({ postId: taskId, chatId: self.data.chatId }).then(function () {
          wx.showToast({ title: side === 'none' ? '已申请参加' : '已下单，等待对方确认', icon: 'none' })
          self.loadContext()
        })
      })
    }).catch(function () {
    }).then(function () {
      self.buying = false
    })
  },

  // 把订单算成头部按钮需要的展示态。loadContext 与 WS 静默刷新共用同一份逻辑，
  // 避免两处判断分叉导致"一边有按钮一边没有"
  decorateOrder(order, uid, publisherId) {
    if (!order) {
      return null
    }
    const isPayer = order.payerId != null && String(order.payerId) === uid
    const myConfirmed = isPayer ? !!order.payerConfirmed : !!order.earnerConfirmed
    const otherConfirmed = isPayer ? !!order.earnerConfirmed : !!order.payerConfirmed
    return Object.assign({}, order, {
      statusText: format.orderStatusLabel(order.status),
      amountText: format.formatMoney(order.amount),
      // 就地操作：待接受且我是发布者 → 接受；进行中且我未确认 → 确认完成；
      // 双方确认后后端自动结算转钱、订单直接完成
      canAcceptHere: order.status === 'pending' && !!publisherId && publisherId === uid,
      canConfirmHere: order.status === 'in_progress' && !myConfirmed,
      // 我是最后一个确认的（对方已确认，我一点即完成结算）→ 只写"确认"；否则"确认完成"
      confirmLabel: otherConfirmed ? '确认' : '确认完成',
      waitingOther: order.status === 'in_progress' && myConfirmed && !otherConfirmed,
      waitingAccept: order.status === 'pending' && (!publisherId || publisherId !== uid),
      // 进行中随时可申诉给管理员定夺：资金保持冻结，等待仲裁（退款/结算/部分结算）
      canDisputeHere: order.status === 'in_progress',
      isDisputed: order.status === 'disputed'
    })
  },

  // 依据「当前订单 + 会话信息」一次算出头部的订单按钮与购买入口。
  // loadContext 与 WS 静默刷新共用：对方接受/确认/取消订单时，两者都会即时跟着变。
  applyActiveOrder(order) {
    const user = auth.getUser()
    const uid = user ? String(user.id) : ''
    const publisherId = this._publisherId || ''
    const found = this._conv
    const decorated = this.decorateOrder(order, uid, publisherId)
    // 会话内直接购买：对方的帖子、帖子在售、且当前没有活跃订单（上一单已取消/结案则可再买）
    const orderBlocking = decorated && ['cancelled', 'closed'].indexOf(decorated.status) === -1
    const taskOpen = found && !found.taskDeleted && (!found.taskStatus || found.taskStatus === 'open')
    const canBuy = !!(found && found.taskId && publisherId && publisherId !== uid && taskOpen && !orderBlocking)
    const side = found && found.taskPublisherSide
    this._buyTaskId = canBuy ? found.taskId : null
    this.setData({
      buyLabel: canBuy ? (side === 'payer' ? '接单' : (side === 'none' ? '参加' : '购买')) : '',
      activeOrder: decorated
    })
  },

  // 只重拉订单状态并刷新头部按钮，不碰消息列表（不打断输入/滚动）。
  // 300ms 节流：一次订单操作会连带触发系统消息+通知等多条推送，避免重复请求。
  refreshOrderSilently() {
    if (this.data.isSystemChat || this.orderRefreshTimer) {
      return
    }
    const self = this
    this.orderRefreshTimer = setTimeout(function () {
      self.orderRefreshTimer = null
      orderService.byChat(self.data.chatId).then(function (order) {
        self.applyActiveOrder(order || null)
        self.refreshOrderExtras(order || null)
      }).catch(function () {})
    }, 300)
  },

  // 就地接受订单（发布者）：接受后进入进行中
  acceptActiveOrder() {
    const order = this.data.activeOrder
    if (!order || !order.canAcceptHere) {
      return
    }
    confirm({
      title: '确认下单',
      content: '接受后订单进入进行中，双方确认完成即自动结算给收款方。确认接受？',
      confirmText: '接受'
    }).then((ok) => {
      if (!ok) return
      orderService.accept(order.id).then(() => {
        wx.showToast({ title: '已接受，订单进行中', icon: 'none' })
        this.loadContext()
      }).catch(function () {})
    })
  },

  // 任务进行到一半出问题：就地申诉给管理员定夺。资金保持冻结，
  // 管理员仲裁（全额退款 / 全额结算 / 部分结算）后订单结案
  disputeActiveOrder() {
    const order = this.data.activeOrder
    if (!order || !order.canDisputeHere) {
      return
    }
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
        orderService.dispute(order.id, reason).then(() => {
          wx.showToast({ title: '已提交申诉，资金冻结，等待管理员裁决', icon: 'none' })
          this.loadContext()
        }).catch(function () {
        })
      }
    })
  },

  // 就地确认完成：双方都确认后，后端自动把托管款项转给收款方并完成订单
  confirmActiveOrder() {
    const order = this.data.activeOrder
    if (!order || !order.canConfirmHere) {
      return
    }
    confirm({
      title: '确认完成',
      content: '双方都确认后，托管款项将自动转给收款方并完成订单。确认？'
    }).then((ok) => {
      if (!ok) return
      orderService.confirm(order.id).then((data) => {
        wx.showToast({
          title: data && data.status === 'completed' ? '已完成，款项已结算' : '已确认，等待对方确认',
          icon: 'none'
        })
        this.loadContext()
      }).catch(function () {})
    })
  },

  // 订单完成后的附加状态：交易成功标记、是否可评价、对方是否已评价我
  refreshOrderExtras(order) {
    if (!order || order.status !== 'completed') {
      this.setData({ tradeDone: false, canReview: false, reviewedDone: false, hasNewReview: false })
      return
    }
    this.setData({ tradeDone: true })
    // 已评价 → 收起"去评价对方"、改显"已评价"；每次 onShow 都重查，评完返回即刷新
    reviewService.hasReviewed(order.id).then((data) => {
      const reviewed = !!(data && data.hasReviewed)
      this.setData({ canReview: !reviewed, reviewedDone: reviewed })
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

  // 支付卡片 / 表情 / 快捷短语面板会改变消息滚动区高度，
  // 展开收起后重新量一次，避免 atBottom 用陈旧高度误判（回归修复）
  remeasureLater() {
    const self = this
    return function () {
      self.measureMessagesHeight()
    }
  },

  toggleEmoji() {
    const next = !this.data.showEmoji
    // 展开表情面板前收起键盘，避免面板与键盘互相遮挡；同时收起「+」面板
    if (next && wx.hideKeyboard) {
      wx.hideKeyboard({})
    }
    this.setData({ showEmoji: next, showMore: false }, this.remeasureLater())
  },

  // 「+」面板：内含 转账 / 图片（仿微信）
  toggleMore() {
    const next = !this.data.showMore
    if (next && wx.hideKeyboard) {
      wx.hideKeyboard({})
    }
    this.setData({ showMore: next, showEmoji: false }, this.remeasureLater())
  },

  // + 面板里点「转账」：收起面板，展开支付卡片输入
  onMoreTransfer() {
    this.setData({ showMore: false, showPay: !this.data.showPay }, this.remeasureLater())
  },

  // + 面板里点「图片」：收起面板，选图发送
  onMoreImage() {
    this.setData({ showMore: false }, this.remeasureLater())
    this.chooseImage()
  },

  onInputFocus() {
    if (this.blurTimer) {
      clearTimeout(this.blurTimer)
      this.blurTimer = null
    }
    // 聚焦输入框时收起表情/「+」面板，行为与微信一致
    this.setData({ inputFocused: true, showEmoji: false, showMore: false }, this.remeasureLater())
  },

  // 键盘不再整页上推（adjust-position=false），改为手动把底部区抬高键盘高度：
  // 顶部会话头与历史消息保持原位，"发的第一条消息"不会被顶出屏幕
  onKbHeightChange(e) {
    const h = (e.detail && e.detail.height) || 0
    if (h === this.data.kbHeight) {
      return
    }
    const self = this
    const wasAtBottom = this.data.atBottom
    this.setData({ kbHeight: h }, function () {
      // 消息可视区高度变了，重新量一次供贴底判断；原本贴底的保持看到最新一条
      self.measureMessagesHeight()
      if (h > 0 && wasAtBottom) {
        const msgs = self.data.messages || []
        const last = msgs.length ? msgs[msgs.length - 1] : null
        if (last) {
          self.setData({ intoView: 'msg-' + last.id })
        }
      }
    })
  },

  onInputBlur() {
    // 延迟收起，保证点击快捷短语能先于失焦触发
    const self = this
    this.blurTimer = setTimeout(function () {
      self.setData({ inputFocused: false }, self.remeasureLater())
      self.blurTimer = null
    }, 200)
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
        const isImage = item.type === 'image'
        return Object.assign({}, item, {
          isSystem: item.type === 'system',
          isImage: isImage,
          // 图片消息 content 为后端图片相对地址(/uploads/xxx)，补全为完整 URL 供 <image> 使用
          // 已经转过本地文件的图优先用本地路径（真机 <image> 直载 http/IP 会失败）
          imageUrl: isImage ? (upload.getCachedLocal(upload.fullUrl(item.content)) || upload.fullUrl(item.content)) : '',
          isMine: isMine,
          bubbleClass: isMine ? 'mine' : 'other',
          paymentInfo: payment,
          paymentTitle: payment && payment.kind === 'request' ? '收款请求' : '转账',
          paymentStatusText: payment ? (PAYMENT_STATUS_TEXT[payment.status] || '已处理') : '',
          paymentAmountText: payment ? format.formatMoney(payment.amount) : '',
          paymentNote: payment && payment.note ? String(payment.note) : '',
          canPay: payment && payment.status === 'pending' && String(payment.payerId) === uid,
          canCancelPayment: payment && payment.status === 'pending' && isMine
        })
      })
      // 保留尚未成功上屏的本地乐观消息（发送中 / 失败待重发）
      const locals = (this.data.messages || []).filter(function (item) {
        return isLocalId(item.id) && (item.pending || item.failed)
      })
      const merged = mapped.concat(locals)

      const current = this.data.messages || []
      // 内容级签名：撤回、支付卡状态变化即使条数不变也要刷新
      const signature = function (arr) {
        return arr.map(function (m) {
          return String(m.id) + ':' + (m.withdrawn ? 1 : 0) + ':' + (m.paymentInfo ? m.paymentInfo.status : '')
        }).join(',')
      }
      if (silent && !this.data.loading && signature(merged) === signature(current)) {
        // 无任何变化，跳过 setData，避免打断输入
        return
      }

      // 时间分组：仅当与上一条已展示时间间隔超过阈值时才渲染一次分隔时间，
      // 避免每条气泡都挂一行完整日期。文案复用 format.shortTime（当天 HH:mm、跨天带日期）
      let prevShownTime = 0
      const messages = merged.map(function (m) {
        const t = parseMessageTime(m.time)
        let showTime = ''
        if (t && (!prevShownTime || t - prevShownTime > TIME_GROUP_GAP)) {
          showTime = format.shortTime(m.time)
          prevShownTime = t
        }
        return Object.assign({}, m, { showTime: showTime })
      })

      const lastNew = messages.length ? messages[messages.length - 1] : null
      const lastCur = current.length ? current[current.length - 1] : null
      const patch = { messages: messages, loading: false }
      // 只有出现新的末条消息才移动滚动位置，状态变化不把用户从历史消息拉回底部；
      // 且仅当用户本来就贴底、或最新一条是自己发送时才滚到底，翻看历史时不被强制拉回。
      // （更完善的做法是显示"N 条新消息↓"浮标，这里按需求用 atBottom 启发式实现）
      if (lastNew && (!lastCur || String(lastNew.id) !== String(lastCur.id) || messages.length !== current.length)) {
        if (this.data.atBottom || lastNew.isMine) {
          patch.intoView = 'msg-' + lastNew.id
        }
      }
      this.setData(patch)
      // 真机上 <image> 直载 http/IP 常被限制：对 http 图片主动走 wx.request
      // 通道预取为本地文件（与业务 API 同通道），不等 binderror 再补救
      this.prefetchImages(messages)
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

  sendQuick(e) {
    const text = e.currentTarget.dataset.text
    if (!text) {
      return
    }
    // 防连点刷屏：短时间内忽略重复点击
    const now = Date.now()
    if (this.lastQuickAt && now - this.lastQuickAt < 600) {
      return
    }
    this.lastQuickAt = now
    // 与 sendText 收尾保持一致：收起表情面板
    this.setData({ showEmoji: false })
    this.pushLocalAndSend(text)
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
      showTime: ''
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

  // 选图 → 上传临时文件 → 以 type='image' 发送（复用本地乐观消息 + loadMessages 刷新）
  chooseImage() {
    const self = this
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      // 压缩后再传：原图动辄数 MB，服务器带宽有限，会话里会长时间灰块加载不出
      sizeType: ['compressed'],
      success: function (res) {
        const files = res.tempFiles || []
        const path = files.length ? files[0].tempFilePath : ''
        if (path) {
          self.sendImage(path)
        }
      }
    })
  },

  sendImage(tempFilePath) {
    const localId = 'local-' + Date.now()
    // 乐观上屏：先用本地临时路径展示，上传成功后由 loadMessages 换成后端图片消息
    const localMsg = {
      id: localId,
      type: 'image',
      isImage: true,
      content: tempFilePath,
      imageUrl: tempFilePath,
      isMine: true,
      pending: true,
      bubbleClass: 'mine',
      showTime: ''
    }
    this.setData({
      messages: (this.data.messages || []).concat([localMsg]),
      intoView: 'msg-' + localId,
      showEmoji: false
    })
    const self = this
    upload.uploadImage(tempFilePath).then(function (url) {
      return chatService.sendMessage(self.data.chatId, url, 'image')
    }).then(function () {
      self.setData({
        messages: self.data.messages.filter(function (item) {
          return item.id !== localId
        })
      })
      self.loadMessages(true)
    }).catch(function () {
      // 上传或发送失败：转为失败态，点击气泡或下方提示可重发（uploadImage 已自带 toast）
      self.setData({
        messages: self.data.messages.map(function (item) {
          return item.id === localId
            ? Object.assign({}, item, { pending: false, failed: true })
            : item
        })
      })
    })
  },

  // 点击图片气泡：失败态→重发；发送中→忽略；正常→全屏预览（可左右滑看会话内全部图片）
  // 对列表里仍指向 http 远程地址的图片消息，逐条转本地文件后原位替换。
  // upload.toLocalFile 内部有完成缓存 + 进行中去重，轮询反复调用无害。
  prefetchImages(messages) {
    const self = this
    ;(messages || []).forEach(function (m, index) {
      if (!m.isImage || !m.imageUrl || String(m.imageUrl).indexOf('http') !== 0) {
        return
      }
      upload.toLocalFile(m.imageUrl).then(function (path) {
        const cur = (self.data.messages || [])[index]
        // 轮询可能重排消息：确认还是同一条再替换
        if (cur && String(cur.id) === String(m.id)) {
          self.setData({
            ['messages[' + index + '].imageUrl']: path,
            ['messages[' + index + '].imageFailed']: false
          })
        }
      }).catch(function () {
        // 静默：直载可能本来就能成功；彻底失败由 binderror 路径提示
      })
    })
  },

  // 内联图片加载失败（真机 http/IP 限制、大图弱网）：先走 wx.request 拉字节转本地
  // 文件重试一次（与业务 API 同通道，真机可用）；再失败才显示"点击查看"提示
  onImageLoadError(e) {
    const index = Number(e.currentTarget.dataset.index)
    const msg = (this.data.messages || [])[index]
    if (!msg) {
      return
    }
    if (msg.imageFixTried) {
      if (!msg.imageFailed) {
        this.setData({ ['messages[' + index + '].imageFailed']: true })
      }
      return
    }
    this.setData({ ['messages[' + index + '].imageFixTried']: true })
    const self = this
    const remote = msg.content && String(msg.content).indexOf('/') === 0
      ? upload.fullUrl(msg.content)
      : msg.imageUrl
    upload.toLocalFile(remote).then(function (path) {
      self.setData({
        ['messages[' + index + '].imageUrl']: path,
        ['messages[' + index + '].imageFailed']: false
      })
    }).catch(function (err) {
      // 把真实失败原因带到提示里，便于定位（域名受限/超时/写文件失败等）
      const raw = (err && (err.errMsg || err.message)) || ''
      self.setData({
        ['messages[' + index + '].imageFailed']: true,
        ['messages[' + index + '].imageFailMsg']: String(raw).slice(0, 40)
      })
    })
  },

  onImageTap(e) {
    const id = e.currentTarget.dataset.id
    const msg = this.findMessage(id)
    if (!msg) {
      return
    }
    if (msg.failed) {
      this.resendLocal(e)
      return
    }
    if (msg.pending || !msg.imageUrl) {
      return
    }
    const urls = (this.data.messages || []).filter(function (m) {
      return m.type === 'image' && m.imageUrl && !m.pending && !m.failed
    }).map(function (m) {
      return m.imageUrl
    })
    wx.previewImage({
      current: msg.imageUrl,
      urls: urls.length ? urls : [msg.imageUrl]
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
    if (found.type === 'image') {
      this.sendImage(found.content)
    } else {
      this.pushLocalAndSend(found.content)
    }
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
    if (!this.data.partnerId) {
      wx.showToast({ title: '缺少对方信息', icon: 'none' })
      return
    }
    const raw = Number(this.data.payAmount)
    if (!raw || raw <= 0) {
      wx.showToast({ title: '请输入金额', icon: 'none' })
      return
    }
    // 规整为两位小数，确认弹窗展示与提交后端用同一个值，避免"显示 ¥2.00 实发 1.999"的不一致
    const amount = Math.round(raw * 100) / 100
    if (amount < 0.01) {
      wx.showToast({ title: '金额不能低于 0.01 元', icon: 'none' })
      return
    }
    if (amount > 5000) {
      wx.showToast({ title: '单笔金额不能超过 5000 元', icon: 'none' })
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
        this.setData({ payAmount: '', showPay: false })
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
    // 已撤回 / 系统消息 / 支付卡片 / 本地未成功消息不走撤回：
    // 支付卡片的作废只走卡片上的"取消"按钮，避免 withdraw 与 cancel-payment 两套作废入口状态不一致
    if (!msg || msg.withdrawn || msg.type === 'system' || msg.type === 'payment' || isLocalId(msg.id)) {
      return
    }
    // 不可撤回时给出可见反馈，而不是静默无反应（输入框占位符宣称"长按气泡可撤回"）
    if (!msg.isMine) {
      wx.showToast({ title: '只能撤回自己的消息', icon: 'none' })
      return
    }
    const sentAt = parseMessageTime(msg.time)
    if (!sentAt || Date.now() - sentAt > WITHDRAW_WINDOW) {
      wx.showToast({ title: '超过2分钟不能撤回', icon: 'none' })
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

  onBubbleTap(e) {
    // 整条气泡可点重发（配合发送失败态）
    const id = e.currentTarget.dataset.id
    const msg = this.findMessage(id)
    if (msg && msg.failed) {
      this.resendLocal(e)
    }
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
