const auth = require('../../../utils/auth')
const authService = require('../../../services/auth')
const userService = require('../../../services/user')
const confirmUtil = require('../../../utils/confirm')
const badge = require('../../../utils/badge')
const avatarUtil = require('../../../utils/avatar')
const themeUtil = require('../../../utils/theme')
const upload = require('../../../utils/upload')

// 头像展示统一走 fullUrl：后端返回的是 /uploads/xxx 相对路径，需补全为可访问 URL；
// 'color:xxx' 纯色模板与空值原样交给 ua-avatar 处理（空值回退首字头像）。
function avatarSrc(a) {
  if (!a) {
    return ''
  }
  if (String(a).indexOf('color:') === 0) {
    return a
  }
  return upload.fullUrl(a)
}

function decorateUser(user) {
  if (!user) {
    return null
  }
  return Object.assign({}, user, {
    avatarShow: avatarSrc(avatarUtil.getMyAvatar() || user.avatar || ''),
    avatarText: user.username ? user.username.slice(0, 1) : '我',
    verifyText: user.authStatus === 'verified' ? '已实名认证' : '未实名认证',
    verifyClass: user.authStatus === 'verified' ? 'ok' : '',
    verifyActionText: user.authStatus === 'verified' ? '已完成' : '去完成'
  })
}

Page({
  data: {
    loggedIn: false,
    user: null,
    balance: '--',
    balanceError: false,
    theme: { mode: 'light', bg: 'b1' },
    bgs: themeUtil.BGS,
    showPalette: false
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 4 })
    }
    badge.refreshUnread(this)
    this.setData({ theme: themeUtil.get() })
    this.refresh()
  },

  setLight() {
    this.applyTheme({ mode: 'light' })
  },

  setDark() {
    this.applyTheme({ mode: 'dark' })
  },

  // 调色盘图标点开/收起色块面板（展开后点色块即用，复用 pickBg）
  togglePalette() {
    this.setData({ showPalette: !this.data.showPalette })
  },

  pickBg(e) {
    this.applyTheme({ bg: e.currentTarget.dataset.value })
  },

  applyTheme(partial) {
    const t = themeUtil.set(partial)
    this.setData({ theme: t })
    themeUtil.applyPage(this)
  },

  onPullDownRefresh() {
    this.refresh().finally(function () {
      wx.stopPullDownRefresh()
    })
  },

  refresh() {
    const user = auth.getUser()
    this.setData({
      loggedIn: auth.isLoggedIn(),
      user: decorateUser(user)
    })
    if (!user || !user.id) {
      return Promise.resolve()
    }
    const profileTask = userService.getProfile(user.id).then((profile) => {
      auth.updateUser(profile)
      this.setData({ user: decorateUser(profile) })
    }).catch(function () {
    })
    const balanceTask = userService.getBalance().then((data) => {
      this.setData({ balance: Number(data.balance || 0).toFixed(2), balanceError: false })
    }).catch(() => {
      // 保留上次余额，仅标记「更新失败」以便重试，避免静默停在旧值/¥--
      this.setData({ balanceError: true })
    })
    return Promise.all([profileTask, balanceTask])
  },

  reloadBalance() {
    const user = auth.getUser()
    if (!user || !user.id) {
      return Promise.resolve()
    }
    return userService.getBalance().then((data) => {
      this.setData({ balance: Number(data.balance || 0).toFixed(2), balanceError: false })
    }).catch(() => {
      this.setData({ balanceError: true })
    })
  },

  // 点头像换头像：选图 → 上传取回 URL → 提交后端 → 本地更新并即时显示（fullUrl）
  changeAvatar() {
    if (!auth.requireLogin()) {
      return
    }
    const self = this
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sizeType: ['compressed'],
      success: function (res) {
        const file = (res.tempFiles || [])[0]
        if (!file || !file.tempFilePath) {
          return
        }
        wx.showLoading({ title: '上传中', mask: true })
        upload.uploadImage(file.tempFilePath).then(function (url) {
          return userService.updateProfile({ avatar: url }).then(function () {
            return url
          })
        }).then(function (url) {
          wx.hideLoading()
          // 换成后端头像后清掉本机自定义头像覆盖，避免旧覆盖继续遮挡
          avatarUtil.setMyAvatar('')
          const user = Object.assign({}, auth.getUser() || {}, { avatar: url })
          auth.updateUser(user)
          self.setData({ user: decorateUser(user) })
          wx.showToast({ title: '头像已更新', icon: 'success' })
        }).catch(function () {
          // 先关 loading 遮罩再提示：upload/request 的失败 toast 会被遮罩顶掉或随
          // 后续 hideLoading 一并关闭，这里在关遮罩后补一条兜底提示确保用户看得到
          wx.hideLoading()
          wx.showToast({ title: '头像上传失败，请重试', icon: 'none' })
        })
      },
      fail: function () {}
    })
  },

  goLogin() {
    auth.goLogin()
  },

  goVerify() {
    wx.navigateTo({ url: '/pages/user/verify/index' })
  },

  goWallet() {
    if (auth.requireLogin()) {
      wx.navigateTo({ url: '/pages/wallet/index/index' })
    }
  },

  goBills() {
    if (auth.requireLogin()) {
      wx.navigateTo({ url: '/pages/wallet/bills/index' })
    }
  },

  goAdmin() {
    wx.navigateTo({ url: '/pages/admin/index' })
  },

  goMine() {
    if (auth.requireLogin()) {
      wx.navigateTo({ url: '/pages/posts/mine/index' })
    }
  },

  goMyReviews() {
    if (!auth.requireLogin()) {
      return
    }
    const user = auth.getUser() || {}
    wx.navigateTo({
      url: '/pages/reviews/list/index?userId=' + user.id + '&name=' + encodeURIComponent(user.username || '')
    })
  },

  goEdit() {
    if (auth.requireLogin()) {
      wx.navigateTo({ url: '/pages/user/edit/index' })
    }
  },

  logout() {
    confirmUtil.confirm({
      title: '退出登录',
      content: '确定退出当前账号？'
    }).then(function (ok) {
      if (!ok) {
        return
      }
      // 服务端登出请求先发：request 同步读取 token，必须在 clearSession 前调用才带得上
      // 有效 token（否则空 token 请求会触发 403 提示）。fire-and-forget，不 await。
      authService.logout().catch(function () {
      })
      // 本地登出优先：立即清会话并跳转，避免弱网下等服务端超时时页面像卡死。
      require('../../../utils/socket').close()
      auth.clearSession()
      wx.showToast({ title: '已退出', icon: 'success' })
      wx.reLaunch({ url: '/pages/posts/list/index' })
    })
  }
})
