const auth = require('../../../utils/auth')
const authService = require('../../../services/auth')
const userService = require('../../../services/user')

function decorateUser(user) {
  if (!user) {
    return null
  }
  return Object.assign({}, user, {
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
    this.refresh()
  },

  refresh() {
    const user = auth.getUser()
    this.setData({
      loggedIn: auth.isLoggedIn(),
      user: decorateUser(user)
    })
    if (!user || !user.id) {
      return
    }
    userService.getProfile(user.id).then((profile) => {
      auth.updateUser(profile)
      this.setData({ user: decorateUser(profile) })
    }).catch(function () {
    })
    userService.getBalance().then((data) => {
      this.setData({ balance: Number(data.balance || 0).toFixed(2) })
    }).catch(function () {
    })
  },

  goLogin() {
    wx.navigateTo({ url: '/pages/auth/login/index' })
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

  logout() {
    authService.logout().catch(function () {
    }).finally(function () {
      auth.clearSession()
      wx.showToast({ title: '已退出', icon: 'success' })
      wx.switchTab({ url: '/pages/posts/list/index' })
    })
  }
})
