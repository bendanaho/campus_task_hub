const authService = require('../../../services/auth')
const auth = require('../../../utils/auth')

const tabPages = [
  '/pages/posts/list/index',
  '/pages/chat/list/index',
  '/pages/posts/publish/index',
  '/pages/orders/list/index',
  '/pages/user/home/index'
]

function goAfterLogin(redirect) {
  const target = redirect || '/pages/user/home/index'
  const path = target.split('?')[0]
  if (tabPages.indexOf(path) >= 0) {
    wx.switchTab({ url: path })
  } else {
    wx.redirectTo({ url: target })
  }
}

Page({
  data: {
    account: '',
    password: '',
    redirect: '',
    submitting: false
  },

  onLoad(options) {
    this.setData({
      redirect: options.redirect ? decodeURIComponent(options.redirect) : ''
    })
  },

  onAccountInput(e) {
    this.setData({ account: e.detail.value })
  },

  onPasswordInput(e) {
    this.setData({ password: e.detail.value })
  },

  submit() {
    if (this.data.submitting) {
      return
    }
    if (!this.data.account || !this.data.password) {
      wx.showToast({ title: '请输入账号和密码', icon: 'none' })
      return
    }
    this.setData({ submitting: true })
    authService.login({
      account: this.data.account,
      password: this.data.password
    }).then((data) => {
      auth.setSession(data)
      wx.showToast({ title: '登录成功', icon: 'success' })
      goAfterLogin(this.data.redirect)
    }).catch(function () {
    }).finally(() => {
      this.setData({ submitting: false })
    })
  },

  goRegister() {
    wx.navigateTo({
      url: '/pages/auth/register/index'
    })
  }
})
