const postService = require('../../../services/posts')
const reviewService = require('../../../services/reviews')
const chatService = require('../../../services/chat')
const orderService = require('../../../services/orders')
const auth = require('../../../utils/auth')
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

  loadDetail() {
    this.setData({ loading: true })
    postService.detail(this.data.id).then((data) => {
      const task = data.task || {}
      const publisher = data.publisher || {}
      task.sideText = format.sideLabel(task.publisherSide)
      task.publishText = format.formatTime(task.publishTime)
      task.deadlineText = format.formatTime(task.deadline)
      task.moneyText = format.formatMoney(task.rewardValue)
      task.images = Array.isArray(task.images) ? task.images : []
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
      this.setData({ reviews: list })
    }).catch(function () {
    }).finally(() => {
      this.setData({ loading: false })
    })
  },

  previewImage(e) {
    imageUtil.preview(this.data.task.images, Number(e.currentTarget.dataset.index))
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
  }
})
