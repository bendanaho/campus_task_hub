const auth = require('../../../utils/auth')
const userService = require('../../../services/user')

Page({
  data: {
    realName: '',
    studentId: '',
    college: '',
    className: '',
    user: null
  },

  onShow() {
    if (!auth.requireLogin()) {
      return
    }
    this.setData({ user: auth.getUser() })
  },

  onInput(e) {
    const key = e.currentTarget.dataset.key
    this.setData({
      [key]: e.detail.value
    })
  },

  submit() {
    if (!this.data.realName || !this.data.studentId || !this.data.college) {
      wx.showToast({ title: '请填写姓名、学号和学院', icon: 'none' })
      return
    }
    userService.submitAuth({
      realName: this.data.realName,
      studentId: this.data.studentId,
      college: this.data.college,
      className: this.data.className
    }).then((profile) => {
      auth.updateUser(profile)
      wx.showToast({ title: '认证成功', icon: 'success' })
      setTimeout(function () {
        wx.navigateBack()
      }, 600)
    }).catch(function () {
    })
  }
})
