const auth = require('../../../utils/auth')
const reviewService = require('../../../services/reviews')
const imageUtil = require('../../../utils/image')

const MAX_IMAGES = 3
const MAX_CONTENT = 200

Page({
  data: {
    orderId: '',
    toUserId: '',
    toUserName: '',
    rating: 0,
    stars: [1, 2, 3, 4, 5],
    content: '',
    contentLen: 0,
    maxContent: MAX_CONTENT,
    hasReviewed: false,
    images: [],
    maxImages: MAX_IMAGES,
    submitting: false
  },

  onLoad(options) {
    this.setData({
      orderId: options.orderId || '',
      toUserId: options.toUserId || '',
      toUserName: options.toUserName ? decodeURIComponent(options.toUserName) : ''
    })
  },

  onShow() {
    if (!auth.requireLogin()) {
      return
    }
    if (this.data.orderId) {
      reviewService.hasReviewed(this.data.orderId).then((data) => {
        this.setData({ hasReviewed: !!data.hasReviewed })
      }).catch(function () {
      })
    }
  },

  onStarTap(e) {
    if (this.data.hasReviewed) {
      return
    }
    this.setData({ rating: Number(e.currentTarget.dataset.value) || 0 })
  },

  onContentInput(e) {
    const value = e.detail.value || ''
    this.setData({ content: value, contentLen: value.length })
  },

  addImage() {
    if (this.data.hasReviewed) {
      return
    }
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
    if (this.data.hasReviewed) {
      wx.showToast({ title: '该订单已评价', icon: 'none' })
      return
    }
    if (!this.data.rating) {
      wx.showToast({ title: '请先选择评分', icon: 'none' })
      return
    }
    this.setData({ submitting: true })
    reviewService.submit({
      orderId: Number(this.data.orderId),
      toUserId: Number(this.data.toUserId),
      toUserName: this.data.toUserName || '对方',
      rating: this.data.rating,
      content: this.data.content,
      images: this.data.images
    }).then(() => {
      wx.showToast({ title: '评价成功', icon: 'success' })
      setTimeout(function () {
        wx.navigateBack()
      }, 600)
    }).catch(function () {
      // 提交失败时保留已填写的评分/内容/图片，用户可直接重试
    }).finally(() => {
      this.setData({ submitting: false })
    })
  }
})
