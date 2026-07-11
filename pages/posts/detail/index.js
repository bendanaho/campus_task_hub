const postService = require('../../../services/posts')
const reviewService = require('../../../services/reviews')
const chatService = require('../../../services/chat')
const orderService = require('../../../services/orders')
const auth = require('../../../utils/auth')
const confirmUtil = require('../../../utils/confirm')
const format = require('../../../utils/format')
const imageUtil = require('../../../utils/image')

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
    loading: true
  },

  onLoad(options) {
    this.setData({ id: options.id })
    this.loadDetail()
  },

  onShow() {
    this.setData({ user: auth.getUser() })
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
    this.setData({ loading: true })
    return postService.detail(this.data.id).then((data) => {
      const task = data.task || {}
      const publisher = data.publisher || {}
      task.sideText = format.sideLabel(task.publisherSide)
      task.publishText = format.formatTime(task.publishTime)
      task.deadlineText = format.formatTime(task.deadline)
      task.moneyText = format.formatMoney(task.rewardValue)
      // 新版后端 images 为 [{full, thumb}]，旧版为字符串数组：
      // 页面网格渲染 thumb（体积小），原图存实例属性供预览，不进 setData
      const rawImages = Array.isArray(task.images) ? task.images : []
      this.fullImages = rawImages.map(function (img) {
        return typeof img === 'string' ? img : (img.full || img.thumb || '')
      }).filter(Boolean)
      task.images = rawImages.map(function (img) {
        return typeof img === 'string' ? img : (img.thumb || img.full || '')
      }).filter(Boolean)
      publisher.avatarText = publisher.username ? publisher.username.slice(0, 1) : '同'
      this.setData({
        task: task,
        publisher: publisher
      })
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
    }).catch(function () {
    }).finally(() => {
      this.setData({ loading: false })
    })
  },

  previewImage(e) {
    const full = this.fullImages && this.fullImages.length ? this.fullImages : this.data.task.images
    imageUtil.preview(full, Number(e.currentTarget.dataset.index))
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
    this.ensureChat().then((chatId) => {
      wx.navigateTo({
        url: '/pages/chat/room/index?chatId=' + encodeURIComponent(chatId)
      })
    }).catch(function () {
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
    confirmUtil.confirm({
      title: '确认响应',
      content: '确认响应「' + task.title + '」？'
    }).then((ok) => {
      if (!ok) {
        return
      }
      this.ensureChat().then((chatId) => {
        return orderService.create({
          postId: this.data.task.id,
          chatId: chatId
        }).then(function () {
          wx.showToast({ title: '已提交响应', icon: 'success' })
          wx.navigateTo({
            url: '/pages/chat/room/index?chatId=' + encodeURIComponent(chatId)
          })
        })
      }).catch(function () {
      })
    })
  }
})
