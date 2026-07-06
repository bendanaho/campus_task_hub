const auth = require('../../../utils/auth')
const userService = require('../../../services/user')

Page({
  data: {
    realName: '',
    studentId: '',
    college: '',
    className: '',
    user: null,
    submitting: false
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
    if (this.data.submitting) {
      return
    }
    const realName = (this.data.realName || '').trim()
    const studentId = (this.data.studentId || '').trim()
    const college = (this.data.college || '').trim()
    if (realName.length < 2 || realName.length > 20) {
      wx.showToast({ title: '姓名需为 2~20 个字', icon: 'none' })
      return
    }
    if (!/^[A-Za-z0-9]{4,20}$/.test(studentId)) {
      wx.showToast({ title: '学号需为 4~20 位字母或数字', icon: 'none' })
      return
    }
    if (!college) {
      wx.showToast({ title: '请填写学院', icon: 'none' })
      return
    }
    this.setData({ submitting: true })
    userService.submitAuth({
      realName: realName,
      studentId: studentId,
      college: college,
      className: (this.data.className || '').trim()
    }).then((profile) => {
      auth.updateUser(profile)
      wx.showToast({ title: '认证成功', icon: 'success' })
      setTimeout(function () {
        wx.navigateBack()
      }, 600)
    }).catch(function () {
    }).finally(() => {
      this.setData({ submitting: false })
    })
  }
})
