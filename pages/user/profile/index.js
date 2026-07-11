const auth = require('../../../utils/auth')
const userService = require('../../../services/user')
const reviewService = require('../../../services/reviews')
const format = require('../../../utils/format')
const avatarUtil = require('../../../utils/avatar')

// 只保留可公开展示的字段，绝不透出 phone/email/realName/studentId
function safeProfile(user) {
  if (!user) {
    return null
  }
  return {
    id: user.id,
    username: user.username || '',
    avatarText: user.username ? user.username.slice(0, 1) : '同',
    creditText: Number(user.creditScore || 0).toFixed(1),
    verified: user.authStatus === 'verified',
    college: user.college || '',
    className: user.className || '',
    bio: user.bio || ''
  }
}

Page({
  data: {
    id: '',
    profile: null,
    reviews: [],
    reviewsTotal: 0,
    isSelf: false,
    loading: true
  },

  onLoad(options) {
    this.setData({ id: options.id || '' })
  },

  onShow() {
    if (!auth.requireLogin()) {
      return
    }
    this.fetchAll()
  },

  onPullDownRefresh() {
    this.fetchAll().finally(function () {
      wx.stopPullDownRefresh()
    })
  },

  fetchAll() {
    const id = this.data.id
    if (!id) {
      this.setData({ loading: false })
      return Promise.resolve()
    }
    const me = auth.getUser()
    return Promise.all([
      userService.getProfile(id),
      // 评价拉取失败不应拖垮整个资料页
      reviewService.list(id).catch(function () { return [] })
    ]).then((results) => {
      const user = results[0]
      const reviews = results[1]
      const list = (reviews || []).map(function (item) {
        return Object.assign({}, item, {
          // 本页不渲染评价图片，剔除 base64 大字段防 setData 超限
          images: [],
          timeText: format.formatTime(item.time)
        })
      })
      const isSelf = !!(me && String(me.id) === String(id))
      const profile = safeProfile(user)
      if (profile) {
        // 头像可公开展示；本机自定义头像只对自己生效
        profile.avatarShow = isSelf
          ? (avatarUtil.getMyAvatar() || (user && user.avatar) || '')
          : ((user && user.avatar) || '')
      }
      this.setData({
        profile: profile,
        reviews: list.slice(0, 3),
        reviewsTotal: list.length,
        isSelf: isSelf
      })
    }).catch(function () {
    }).finally(() => {
      this.setData({ loading: false })
    })
  },

  goAllReviews() {
    const profile = this.data.profile
    if (!profile) {
      return
    }
    wx.navigateTo({
      url: '/pages/reviews/list/index?userId=' + this.data.id + '&name=' + encodeURIComponent(profile.username)
    })
  },

  goEdit() {
    wx.navigateTo({ url: '/pages/user/edit/index' })
  }
})
