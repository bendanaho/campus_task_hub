const auth = require('../../../utils/auth')
const userService = require('../../../services/user')
const reviewService = require('../../../services/reviews')
const format = require('../../../utils/format')
const avatarUtil = require('../../../utils/avatar')
const upload = require('../../../utils/upload')

// 头像展示统一走 fullUrl；'color:xxx' 纯色模板与空值原样交给 ua-avatar。
function avatarSrc(a) {
  if (!a) {
    return ''
  }
  if (String(a).indexOf('color:') === 0) {
    return a
  }
  return upload.fullUrl(a)
}

// profilePhotos 可能是 JSON 数组字符串，解析后逐张补全为可访问 URL（最多5张）。
function parsePhotos(raw) {
  let arr = raw
  if (typeof raw === 'string') {
    try {
      arr = JSON.parse(raw)
    } catch (e) {
      arr = []
    }
  }
  if (!Array.isArray(arr)) {
    return []
  }
  return arr.slice(0, 5).map(upload.fullUrl)
}

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
    bio: user.bio || '',
    photos: parsePhotos(user.profilePhotos)
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
      // 他人主页走公开资料接口（/api/users/{id} 已限制只能查自己）
      userService.getPublicProfile(id),
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
        // 头像可公开展示；本机自定义头像只对自己生效。统一 fullUrl 补全后再交给组件
        profile.avatarShow = avatarSrc(isSelf
          ? (avatarUtil.getMyAvatar() || (user && user.avatar) || '')
          : ((user && user.avatar) || ''))
      }
      this.setData({
        profile: profile,
        reviews: list.slice(0, 3),
        reviewsTotal: list.length,
        isSelf: isSelf
      })
      // 展示照片是 http 远程地址时预取为本地文件后原位替换（真机 <image> 直载受限）
      const self = this
      ;(profile && profile.photos || []).forEach(function (url, idx) {
        if (!url || String(url).indexOf('http') !== 0) {
          return
        }
        upload.toLocalFile(url).then(function (path) {
          const cur = self.data.profile && self.data.profile.photos
          if (cur && cur[idx] === url) {
            self.setData({ ['profile.photos[' + idx + ']']: path })
          }
        }).catch(function () {})
      })
    }).catch(function () {
    }).finally(() => {
      this.setData({ loading: false })
    })
  },

  previewPhoto(e) {
    const idx = e.currentTarget.dataset.index
    const urls = (this.data.profile && this.data.profile.photos) || []
    if (!urls.length) {
      return
    }
    wx.previewImage({ urls: urls, current: urls[idx] || urls[0] })
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
