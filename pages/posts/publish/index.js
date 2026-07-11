const postService = require('../../../services/posts')
const auth = require('../../../utils/auth')
const badge = require('../../../utils/badge')
const constants = require('../../../utils/constants')
const format = require('../../../utils/format')
const imageUtil = require('../../../utils/image')

const MAX_IMAGES = 3
const MAX_TITLE_LEN = 30
const MAX_DESC_LEN = 500
const MAX_REWARD = 100000
const REWARD_PATTERN = /^\d+(\.\d{1,2})?$/

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
    maxImages: MAX_IMAGES,
    submitting: false
  },

  onLoad() {
    this.setData({ date: format.todayDate() })
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 2 })
    }
    badge.refreshUnread(this)
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
    auth.goLogin()
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
    if (this.data.submitting) {
      return
    }
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

    if (this.data.title.length > MAX_TITLE_LEN) {
      wx.showToast({ title: '标题不能超过 ' + MAX_TITLE_LEN + ' 字', icon: 'none' })
      return
    }

    if (this.data.description.length > MAX_DESC_LEN) {
      wx.showToast({ title: '描述不能超过 ' + MAX_DESC_LEN + ' 字', icon: 'none' })
      return
    }

    if (side !== 'none' && this.data.rewardValue !== '') {
      if (!REWARD_PATTERN.test(this.data.rewardValue) || rewardNumber < 0 || rewardNumber > MAX_REWARD) {
        wx.showToast({ title: '金额需为 0-100000 的数字，最多两位小数', icon: 'none' })
        return
      }
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

    this.setData({ submitting: true })
    postService.create(payload).then((data) => {
      const task = data && data.task ? data.task : null
      const go = function () {
        if (task && task.id) {
          wx.navigateTo({ url: '/pages/posts/detail/index?id=' + task.id })
        } else {
          wx.switchTab({ url: '/pages/posts/list/index' })
        }
      }
      // 首次发布弹一次性引导，之后只 toast
      if (!wx.getStorageSync('campus_pub_guide_shown')) {
        wx.setStorageSync('campus_pub_guide_shown', 1)
        wx.showModal({
          title: '发布成功',
          content: '可以随时在「我的 → 我的发布」里查看和管理你发布的任务',
          showCancel: false,
          confirmText: '知道了',
          complete: go
        })
      } else {
        wx.showToast({ title: '发布成功', icon: 'success' })
        setTimeout(go, 600)
      }
    }).catch(function () {
    }).finally(() => {
      this.setData({ submitting: false })
    })
  }
})
