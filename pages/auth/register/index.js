const authService = require('../../../services/auth')
const auth = require('../../../utils/auth')
const socket = require('../../../utils/socket')

Page({
  data: {
    username: '',
    phone: '',
    email: '',
    password: '',
    confirmPassword: '',
    showPwd: false,
    submitting: false
  },

  onInput(e) {
    const key = e.currentTarget.dataset.key
    this.setData({
      [key]: e.detail.value
    })
  },

  togglePwd() {
    this.setData({ showPwd: !this.data.showPwd })
  },

  submit() {
    if (this.data.submitting) {
      return
    }
    const username = (this.data.username || '').trim()
    // 手机号顺手去掉首尾及中间空格再走正则
    const phone = (this.data.phone || '').replace(/\s/g, '')
    const email = (this.data.email || '').trim()
    const password = this.data.password
    const confirmPassword = this.data.confirmPassword
    if (username.length < 2 || username.length > 20) {
      wx.showToast({ title: '用户名需 2~20 个字', icon: 'none' })
      return
    }
    if (!/^1\d{10}$/.test(phone)) {
      wx.showToast({ title: '请输入正确的手机号', icon: 'none' })
      return
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      wx.showToast({ title: '邮箱格式不正确', icon: 'none' })
      return
    }
    if (password.length < 6) {
      wx.showToast({ title: '密码至少 6 位', icon: 'none' })
      return
    }
    if (password !== confirmPassword) {
      wx.showToast({ title: '两次输入的密码不一致', icon: 'none' })
      return
    }
    // 回写 trim 后的干净值，保证界面与上送一致
    this.setData({ username: username, phone: phone, email: email, submitting: true })
    authService.register({
      username: username,
      phone: phone,
      email: email,
      password: password,
      confirmPassword: confirmPassword
    }).then((data) => {
      // 若接口返回了 token，则注册即登录，直接进主页
      if (data && data.token) {
        auth.setSession(data)
        socket.connect()
        wx.showToast({ title: '注册成功', icon: 'success' })
        setTimeout(function () {
          wx.switchTab({ url: '/pages/user/home/index' })
        }, 700)
        return
      }
      // 否则回退登录页并回填账号，用户只需补密码即可登录
      const pages = getCurrentPages()
      const prev = pages && pages.length >= 2 ? pages[pages.length - 2] : null
      if (prev && prev.route === 'pages/auth/login/index' && typeof prev.setData === 'function') {
        prev.setData({ account: username })
      }
      wx.showToast({ title: '注册成功，请登录', icon: 'success' })
      setTimeout(function () {
        wx.navigateBack()
      }, 700)
    }).catch(function () {
    }).finally(() => {
      this.setData({ submitting: false })
    })
  }
})
