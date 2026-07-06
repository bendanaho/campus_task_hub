const auth = require('../../../utils/auth')
const reviewService = require('../../../services/reviews')
const imageUtil = require('../../../utils/image')

const MAX_IMAGES = 3

Page({
  data: {
    orderId: '',
    toUserId: '',
    toUserName: '',
    ratingIndex: 4,
    ratings: [1, 2, 3, 4, 5],
    content: '',
    hasReviewed: false,
    images: [],
    maxImages: MAX_IMAGES
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

  onRatingChange(e) {
    this.setData({ ratingIndex: Number(e.detail.value) })
  },

  onContentInput(e) {
    this.setData({ content: e.detail.value })
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
    if (this.data.hasReviewed) {
      wx.showToast({ title: '该订单已评价', icon: 'none' })
      return
    }
    reviewService.submit({
      orderId: Number(this.data.orderId),
      toUserId: Number(this.data.toUserId),
      toUserName: this.data.toUserName || '对方',
      rating: this.data.ratings[this.data.ratingIndex],
      content: this.data.content,
      images: this.data.images
    }).then(() => {
      wx.showToast({ title: '评价成功', icon: 'success' })
      setTimeout(function () {
        wx.navigateBack()
      }, 600)
    }).catch(function () {
    })
  }
})
