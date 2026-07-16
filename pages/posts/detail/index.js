const postService = require('../../../services/posts')
const reviewService = require('../../../services/reviews')
const chatService = require('../../../services/chat')
const orderService = require('../../../services/orders')
const auth = require('../../../utils/auth')
const confirmUtil = require('../../../utils/confirm')
const format = require('../../../utils/format')
const imageUtil = require('../../../utils/image')
const upload = require('../../../utils/upload')

function buildChatId(postId, currentUserId, partnerId) {
  const a = Math.min(Number(currentUserId), Number(partnerId))
  const b = Math.max(Number(currentUserId), Number(partnerId))
  return 'c-t' + postId + '-u' + a + '-' + b
}

Page({
  data: {
    id: '',
    task: null,
    publisher: null,
    reviews: [],
    reviewsTotal: 0,
    user: null,
    loading: true,
    loadError: false,
    acting: false,
    contacting: false,
    responding: false
  },

  onLoad(options) {
    this.setData({ id: options.id })
    this.loadDetail()
  },

  onShow() {
    this.setData({ user: auth.getUser() })
    this.updateOwnership()
  },

  updateOwnership() {
    const user = auth.getUser()
    const task = this.data.task
    this.setData({
      isMine: !!(user && task && String(user.id) === String(task.publisherId))
    })
  },

  onPullDownRefresh() {
    this.loadDetail().finally(function () {
      wx.stopPullDownRefresh()
    })
  },

  onShareAppMessage() {
    const task = this.data.task
    return {
      title: (task && task.title) || '校园互助',
      path: '/pages/posts/detail/index?id=' + this.data.id
    }
  },

  loadDetail() {
    this.setData({ loading: true, loadError: false })
    return postService.detail(this.data.id).then((data) => {
      const task = data.task || {}
      const publisher = data.publisher || {}
      task.sideText = format.sideLabel(task.publisherSide)
      task.publishText = format.formatTime(task.publishTime)
      task.deadlineText = format.formatTime(task.deadline)
      task.moneyText = format.formatMoney(task.rewardValue)
      // 与列表/我的发布一致：rewardValue>0 才显示 ¥，否则 none→免费互助 / 其余→面议
      task.hasPrice = Number(task.rewardValue) > 0
      task.priceAlt = task.publisherSide === 'none' ? '免费互助' : (task.reward || '面议')
      // 金额方向标 + 按类型的响应动词：悬赏=接单(完成可得)、服务=下单(需支付)、互助=参加
      task.priceHint = task.hasPrice ? (task.publisherSide === 'payer' ? '完成可得' : (task.publisherSide === 'earner' ? '需支付' : '')) : ''
      const respondText = task.publisherSide === 'payer' ? '我来接单'
        : (task.publisherSide === 'earner' ? '我要下单' : '我要参加')
      // 新版后端列表/详情只下发缩略图 thumb（full 已被剥离，体积小）。
      // 网格渲染 thumb；点击放大时再按需拉原图（/posts/{id}/images），此处先重置缓存。
      const rawImages = Array.isArray(task.images) ? task.images : []
      this.originalImages = null
      task.images = rawImages.map(function (img) {
        return typeof img === 'string' ? img : (img.thumb || img.full || '')
      }).filter(Boolean)
      publisher.avatarText = publisher.username ? publisher.username.slice(0, 1) : '同'
      // 头像可能是 /uploads/xxx 相对路径：ua-avatar 只把 http/data 视作图片，
      // 故先补全为完整 URL；'color:' 模板与空值原样传入，交由组件走首字色块兜底
      const rawAvatar = publisher.avatar || ''
      publisher.avatar = (rawAvatar && rawAvatar.indexOf('color:') !== 0) ? upload.fullUrl(rawAvatar) : rawAvatar
      this.setData({
        respondText: respondText,
        task: task,
        publisher: publisher
      })
      this.updateOwnership()
      if (publisher.id) {
        return reviewService.list(publisher.id)
      }
      return []
    }).then((reviews) => {
      const list = (reviews || []).map(function (item) {
        return Object.assign({}, item, {
          timeText: format.formatTime(item.time)
        })
      })
      this.setData({
        reviews: list.slice(0, 2),
        reviewsTotal: list.length
      })
    }).catch(() => {
      // 详情加载失败：置 loadError 驱动错误空态分支，避免整页白屏（spec 修复1）
      if (!this.data.task) {
        this.setData({ loadError: true })
      }
    }).finally(() => {
      this.setData({ loading: false })
    })
  },

  previewImage(e) {
    const index = Number(e.currentTarget.dataset.index)
    const thumbs = (this.data.task && this.data.task.images) || []
    // 已拉过原图则直接放大
    if (this.originalImages && this.originalImages.length) {
      imageUtil.preview(this.originalImages, index)
      return
    }
    const self = this
    const taskId = this.data.task && this.data.task.id
    if (!taskId) {
      imageUtil.preview(thumbs, index)
      return
    }
    // 详情只下发缩略图，点击放大时按需拉原图
    postService.images(taskId).then(function (list) {
      const fulls = (list || []).map(function (img) {
        if (typeof img === 'string') return img
        return (img && (img.full || img.thumb)) || ''
      }).filter(Boolean)
      self.originalImages = fulls.length ? fulls : thumbs
      imageUtil.preview(self.originalImages, index)
    }).catch(function () {
      // 拉原图失败退回用缩略图预览，至少能看
      imageUtil.preview(thumbs, index)
    })
  },

  // 下架自己的帖子（软下架，进行中订单不受影响）
  closeMyPost() {
    const task = this.data.task
    if (!task) {
      return
    }
    confirmUtil.confirm({
      title: '下架帖子',
      content: '下架后大厅不再显示「' + task.title + '」，进行中的订单不受影响'
    }).then((ok) => {
      if (!ok) return
      postService.closePost(task.id).then(() => {
        wx.showToast({ title: '已下架', icon: 'success' })
        this.loadDetail()
      }).catch(function () {
      })
    })
  },

  // 以本帖为模板再发一单：写入发布页草稿并跳转
  repost() {
    const task = this.data.task
    if (!task) {
      return
    }
    wx.setStorageSync('campus_pub_draft', {
      source: 'repost',
      ts: Date.now(),
      title: task.title || '',
      description: task.description || '',
      rewardValue: Number(task.rewardValue) > 0 ? String(task.rewardValue) : '',
      contact: task.contact || '站内联系',
      serviceTime: task.serviceTime || '',
      sideValue: task.publisherSide || 'payer',
      categoryValue: task.category || ''
    })
    wx.switchTab({ url: '/pages/posts/publish/index' })
  },

  reportPost() {
    if (!auth.requireLogin()) {
      return
    }
    const task = this.data.task
    if (!task) return
    const reasons = ['虚假信息', '违规内容', '疑似诈骗', '其他']
    wx.showActionSheet({
      itemList: reasons,
      success: (res) => {
        if (reasons[res.tapIndex] !== '其他') {
          this.submitReport(task.id, reasons[res.tapIndex])
          return
        }
        wx.showModal({
          title: '举报理由',
          editable: true,
          placeholderText: '请描述具体问题',
          confirmText: '提交',
          success: (m) => {
            if (!m.confirm) return
            const reason = (m.content || '').trim()
            if (!reason) {
              wx.showToast({ title: '请填写举报理由', icon: 'none' })
              return
            }
            this.submitReport(task.id, reason)
          }
        })
      }
    })
  },

  submitReport(id, reason) {
    postService.report(id, reason).then(function () {
      wx.showToast({ title: '已举报，等待平台处理', icon: 'none' })
    }).catch(function () {
    })
  },

  goPublisherProfile() {
    const publisher = this.data.publisher
    if (!publisher || !publisher.id) {
      return
    }
    wx.navigateTo({
      url: '/pages/user/profile/index?id=' + publisher.id
    })
  },

  goAllReviews() {
    const publisher = this.data.publisher
    if (!publisher || !publisher.id) {
      return
    }
    const task = this.data.task
    const name = publisher.username || (task && task.publisherName) || ''
    wx.navigateTo({
      url: '/pages/reviews/list/index?userId=' + publisher.id + '&name=' + encodeURIComponent(name)
    })
  },

  ensureChat() {
    const user = auth.getUser()
    const task = this.data.task
    if (!user || !task) {
      return Promise.reject(new Error('未登录'))
    }
    if (String(user.id) === String(task.publisherId)) {
      wx.showToast({ title: '不能操作自己发布的帖子', icon: 'none' })
      return Promise.reject(new Error('self'))
    }
    const chatId = buildChatId(task.id, user.id, task.publisherId)
    return chatService.ensureConversation({
      chatId: chatId,
      partnerId: task.publisherId,
      partnerName: task.publisherName,
      taskId: task.id,
      taskTitle: task.title
    }).then(function () {
      return chatId
    })
  },

  contactPublisher() {
    if (!auth.requireLogin()) {
      return
    }
    if (this.data.acting) {
      return
    }
    this.setData({ acting: true, contacting: true })
    this.ensureChat().then((chatId) => {
      wx.navigateTo({
        url: '/pages/chat/room/index?chatId=' + encodeURIComponent(chatId)
      })
    }).catch(function () {
    }).finally(() => {
      this.setData({ acting: false, contacting: false })
    })
  },

  respondPost() {
    if (!auth.requireVerified()) {
      return
    }
    const task = this.data.task
    if (!task) {
      return
    }
    if (this.data.acting) {
      return
    }
    // 入口即置位，覆盖整个「确认弹窗 + 建会话 + 下单」链路，防连点重复下单（spec 修复8）
    this.setData({ acting: true, responding: true })
    // 弹窗写清这一步会发生什么（建单/资金托管/到账时机），不让新用户盲点
    const side = task.publisherSide
    const money = task.hasPrice ? '¥' + task.moneyText : ''
    let title, content
    if (side === 'payer') {
      title = '确认接单'
      content = '将创建订单，等待发布者接受。'
        + (money ? '对方接受时赏金 ' + money + ' 由平台冻结托管，你完成任务、双方确认后打给你。' : '')
    } else if (side === 'earner') {
      title = '确认下单'
      content = '将创建订单，等待对方接受。'
        + (money ? '对方接受时服务费 ' + money + ' 将从你的余额冻结托管，服务完成、双方确认后支付给对方。' : '费用面议，可先在会话中沟通。')
    } else {
      title = '确认参加'
      content = '将向发起者申请参加并建立会话，不涉及任何费用。'
    }
    confirmUtil.confirm({
      title: title,
      content: content
    }).then((ok) => {
      if (!ok) {
        return
      }
      return this.ensureChat().then((chatId) => {
        return orderService.create({
          postId: this.data.task.id,
          chatId: chatId
        }).then(function () {
          wx.showToast({ title: '已提交，等待对方接受', icon: 'none' })
          wx.navigateTo({
            url: '/pages/chat/room/index?chatId=' + encodeURIComponent(chatId)
          })
        })
      })
    }).catch(function () {
    }).finally(() => {
      this.setData({ acting: false, responding: false })
    })
  }
})
