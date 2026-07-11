const auth = require('../../../utils/auth')
const userService = require('../../../services/user')
const avatarUtil = require('../../../utils/avatar')
const imageUtil = require('../../../utils/image')

const PHONE_REG = /^1\d{10}$/
const EMAIL_REG = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/

function maskPhone(phone) {
  const p = phone ? String(phone) : ''
  if (!p) {
    return '未设置'
  }
  if (p.length < 7) {
    return p
  }
  return p.slice(0, 3) + '****' + p.slice(-4)
}

function maskEmail(email) {
  const e = email ? String(email) : ''
  if (!e) {
    return '未设置'
  }
  const at = e.indexOf('@')
  if (at <= 1) {
    return e
  }
  return e.slice(0, 1) + '***' + e.slice(at)
}

Page({
  data: {
    phoneMasked: '',
    emailMasked: '',
    phone: '',
    email: '',
    verified: false,
    submitting: false,
    username: '',
    uid: 0,
    avatarValue: '',
    hasCustomAvatar: false,
    colors: avatarUtil.COLORS
  },

  onShow() {
    if (!auth.requireLogin()) {
      return
    }
    const user = auth.getUser() || {}
    const my = avatarUtil.getMyAvatar()
    this.setData({
      phoneMasked: maskPhone(user.phone),
      emailMasked: maskEmail(user.email),
      verified: user.authStatus === 'verified',
      username: user.username || '',
      uid: user.id || 0,
      avatarValue: my || user.avatar || '',
      hasCustomAvatar: !!my
    })
  },

  pickAvatarImage() {
    imageUtil.chooseImages(1).then((list) => {
      if (!list.length) {
        return
      }
      avatarUtil.setMyAvatar(list[0])
      this.setData({ avatarValue: list[0], hasCustomAvatar: true })
      wx.showToast({ title: '头像已更新', icon: 'success' })
    }).catch(function () {
      wx.showToast({ title: '选图失败', icon: 'none' })
    })
  },

  pickColor(e) {
    const value = 'color:' + e.currentTarget.dataset.color
    avatarUtil.setMyAvatar(value)
    this.setData({ avatarValue: value, hasCustomAvatar: true })
  },

  resetAvatar() {
    avatarUtil.setMyAvatar('')
    const user = auth.getUser() || {}
    this.setData({ avatarValue: user.avatar || '', hasCustomAvatar: false })
  },

  onInput(e) {
    const key = e.currentTarget.dataset.key
    this.setData({
      [key]: e.detail.value
    })
  },

  save() {
    if (this.data.submitting) {
      return
    }
    const phone = (this.data.phone || '').trim()
    const email = (this.data.email || '').trim()
    if (!phone && !email) {
      wx.showToast({ title: '请输入新手机号或新邮箱', icon: 'none' })
      return
    }
    if (phone && !PHONE_REG.test(phone)) {
      wx.showToast({ title: '手机号格式不正确', icon: 'none' })
      return
    }
    if (email && !EMAIL_REG.test(email)) {
      wx.showToast({ title: '邮箱格式不正确', icon: 'none' })
      return
    }
    this.setData({ submitting: true })
    let chain = Promise.resolve()
    if (phone) {
      chain = chain.then(function () {
        return userService.updatePhone(phone)
      }).then(function (profile) {
        auth.updateUser(profile)
      })
    }
    if (email) {
      chain = chain.then(function () {
        return userService.updateEmail(email)
      }).then(function (profile) {
        auth.updateUser(profile)
      })
    }
    chain.then(() => {
      const user = auth.getUser() || {}
      this.setData({
        phone: '',
        email: '',
        phoneMasked: maskPhone(user.phone),
        emailMasked: maskEmail(user.email)
      })
      wx.showToast({ title: '已保存', icon: 'success' })
      setTimeout(function () {
        wx.navigateBack()
      }, 600)
    }).catch(function () {
    }).finally(() => {
      this.setData({ submitting: false })
    })
  },

  goVerify() {
    wx.navigateTo({ url: '/pages/user/verify/index' })
  }
})
