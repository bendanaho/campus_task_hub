const postService = require('../../../services/posts')
const auth = require('../../../utils/auth')
const constants = require('../../../utils/constants')
const format = require('../../../utils/format')
const imageUtil = require('../../../utils/image')

const MAX_IMAGES = 3

Page({
  data: {
    loggedIn: false,
    verified: false,
    sideIndex: 0,
    categoryIndex: 0,
    sides: constants.publishSideOptions,
    categories: constants.categoryOptions,
    title: '',
    description: '',
    rewardValue: '',
    contact: '站内联系',
    serviceTime: '',
    date: '',
    time: '18:00',
    images: [],
    maxImages: MAX_IMAGES
  },

  onLoad() {
    this.setData({ date: format.todayDate() })
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 2 })
    }
    this.setData({
      loggedIn: auth.isLoggedIn(),
      verified: auth.isVerified()
    })
  },

  onInput(e) {
    const key = e.currentTarget.dataset.key
    this.setData({
      [key]: e.detail.value
    })
  },

  onSideChange(e) {
    this.setData({ sideIndex: Number(e.detail.value) })
  },

  onCategoryChange(e) {
    this.setData({ categoryIndex: Number(e.detail.value) })
  },

  onDateChange(e) {
    this.setData({ date: e.detail.value })
  },

  onTimeChange(e) {
    this.setData({ time: e.detail.value })
  },

  goLogin() {
    wx.navigateTo({ url: '/pages/auth/login/index' })
  },

  goVerify() {
    wx.navigateTo({ url: '/pages/user/verify/index' })
  },

  addImage() {
    const remain = MAX_IMAGES - this.data.images.length
    if (remain <= 0) {
      return
    }
    imageUtil.chooseImages(remain).then((list) => {
      if (list.length) {
        this.setData({ images: this.data.images.concat(list) })
      }
    }).catch(function () {
      wx.showToast({ title: '选图失败', icon: 'none' })
    })
  },

  removeImage(e) {
    const index = Number(e.currentTarget.dataset.index)
    const images = this.data.images.slice()
    images.splice(index, 1)
    this.setData({ images: images })
  },

  previewImage(e) {
    imageUtil.preview(this.data.images, Number(e.currentTarget.dataset.index))
  },

  submit() {
    if (!auth.requireVerified()) {
      return
    }
    const side = this.data.sides[this.data.sideIndex].value
    const category = this.data.categories[this.data.categoryIndex].value
    const rewardNumber = Number(this.data.rewardValue || 0)

    if (!this.data.title || !this.data.description) {
      wx.showToast({ title: '请填写标题和描述', icon: 'none' })
      return
    }

    if (side !== 'none' && rewardNumber < 0) {
      wx.showToast({ title: '金额不能为负数', icon: 'none' })
      return
    }

    const rewardText = side === 'none'
      ? '无偿互助'
      : (rewardNumber > 0 ? rewardNumber.toFixed(2) + '元' : '面议')

    const payload = {
      title: this.data.title,
      publisherSide: side,
      category: category,
      description: this.data.description,
      reward: rewardText,
      rewardValue: side === 'none' ? 0 : rewardNumber,
      images: this.data.images,
      contact: this.data.contact || '站内联系'
    }

    if (side === 'payer') {
      payload.deadline = this.data.date + 'T' + this.data.time + ':00'
    }

    if (side === 'earner') {
      payload.serviceTime = this.data.serviceTime
    }

    postService.create(payload).then((data) => {
      wx.showToast({ title: '发布成功', icon: 'success' })
      const task = data && data.task ? data.task : null
      setTimeout(function () {
        if (task && task.id) {
          wx.navigateTo({ url: '/pages/posts/detail/index?id=' + task.id })
        } else {
          wx.switchTab({ url: '/pages/posts/list/index' })
        }
      }, 600)
    }).catch(function () {
    })
  }
})
