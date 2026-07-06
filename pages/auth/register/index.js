const authService = require('../../../services/auth')

Page({
  data: {
    username: '',
    phone: '',
    email: '',
    password: '',
    submitting: false
  },

  onInput(e) {
    const key = e.currentTarget.dataset.key
    this.setData({
      [key]: e.detail.value
    })
  },

  submit() {
    if (this.data.submitting) {
      return
    }
    if (this.data.username.length < 2 || this.data.username.length > 20) {
      wx.showToast({ title: '用户名需 2~20 个字', icon: 'none' })
      return
    }
    if (!/^1\d{10}$/.test(this.data.phone)) {
      wx.showToast({ title: '请输入正确的手机号', icon: 'none' })
      return
    }
    if (this.data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.data.email)) {
      wx.showToast({ title: '邮箱格式不正确', icon: 'none' })
      return
    }
    if (this.data.password.length < 6) {
      wx.showToast({ title: '密码至少 6 位', icon: 'none' })
      return
    }
    this.setData({ submitting: true })
    authService.register({
      username: this.data.username,
      phone: this.data.phone,
      email: this.data.email,
      password: this.data.password
    }).then(() => {
      wx.showToast({ title: '注册成功', icon: 'success' })
      setTimeout(function () {
        wx.navigateBack()
      }, 600)
    }).catch(function () {
    }).finally(() => {
      this.setData({ submitting: false })
    })
  }
})
