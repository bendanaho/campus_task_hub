const authService = require('../../../services/auth')
const auth = require('../../../utils/auth')
const socket = require('../../../utils/socket')

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
    return
  }
  // 非 tab 页：若回跳目标恰为登录页下方的上一页，直接 navigateBack，
  // 避免用 redirectTo 把同一页面再 push 一份、造成实例重复堆叠。
  const pages = getCurrentPages()
  if (pages && pages.length >= 2) {
    const prev = pages[pages.length - 2]
    if (prev && ('/' + prev.route) === path) {
      wx.navigateBack()
      return
    }
  }
  wx.redirectTo({ url: target })
}

Page({
  data: {
    account: '',
    password: '',
    redirect: '',
    showPwd: false,
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

  togglePwd() {
    this.setData({ showPwd: !this.data.showPwd })
  },

  submit() {
    if (this.data.submitting) {
      return
    }
    const account = (this.data.account || '').trim()
    if (!account || !this.data.password) {
      wx.showToast({ title: '请输入账号和密码', icon: 'none' })
      return
    }
    // 回写 trim 后的账号，保证界面与上送一致
    this.setData({ account: account, submitting: true })
    const redirect = this.data.redirect
    authService.login({
      account: account,
      password: this.data.password
    }).then((data) => {
      auth.setSession(data)
      socket.connect()
      // 先让“登录成功”toast 展示完整，再跳转（switchTab 会连带把 toast 吞掉）
      wx.showToast({ title: '登录成功', icon: 'success' })
      setTimeout(function () {
        goAfterLogin(redirect)
      }, 700)
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
