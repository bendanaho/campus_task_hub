const auth = require('../../../utils/auth')
const authService = require('../../../services/auth')
const userService = require('../../../services/user')
const confirmUtil = require('../../../utils/confirm')
const badge = require('../../../utils/badge')
const avatarUtil = require('../../../utils/avatar')

function decorateUser(user) {
  if (!user) {
    return null
  }
  return Object.assign({}, user, {
    avatarShow: avatarUtil.getMyAvatar() || user.avatar || '',
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
    balance: '--'
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 4 })
    }
    badge.refreshUnread(this)
    this.refresh()
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
      this.setData({ balance: Number(data.balance || 0).toFixed(2) })
    }).catch(function () {
    })
    return Promise.all([profileTask, balanceTask])
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

  goOrders() {
    wx.switchTab({ url: '/pages/orders/list/index' })
  },

  goMessages() {
    wx.switchTab({ url: '/pages/chat/list/index' })
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
      authService.logout().catch(function () {
      }).finally(function () {
        auth.clearSession()
        wx.showToast({ title: '已退出', icon: 'success' })
        wx.reLaunch({ url: '/pages/posts/list/index' })
      })
    })
  }
})
