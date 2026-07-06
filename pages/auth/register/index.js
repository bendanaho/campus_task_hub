const authService = require('../../../services/auth')

Page({
  data: {
    username: '',
    phone: '',
    email: '',
    password: ''
  },

  onInput(e) {
    const key = e.currentTarget.dataset.key
    this.setData({
      [key]: e.detail.value
    })
  },

  submit() {
    if (!this.data.username || !this.data.phone || !this.data.password) {
      wx.showToast({ title: '请填写用户名、手机号和密码', icon: 'none' })
      return
    }
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
    })
  }
})
