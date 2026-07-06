const auth = require('../../../utils/auth')
const userService = require('../../../services/user')
const confirmUtil = require('../../../utils/confirm')

Page({
  data: {
    balance: '--',
    amount: '',
    submitting: false
  },

  onShow() {
    if (!auth.requireLogin()) {
      return
    }
    this.loadBalance()
  },

  onPullDownRefresh() {
    this.loadBalance().finally(function () {
      wx.stopPullDownRefresh()
    })
  },

  loadBalance() {
    return userService.getBalance().then((data) => {
      this.setData({ balance: Number(data.balance || 0).toFixed(2) })
    }).catch(function () {
    })
  },

  onAmountInput(e) {
    this.setData({ amount: e.detail.value })
  },

  recharge() {
    if (this.data.submitting) {
      return
    }
    const raw = (this.data.amount || '').trim()
    if (!/^\d+(\.\d{1,2})?$/.test(raw)) {
      wx.showToast({ title: '请输入正确的金额', icon: 'none' })
      return
    }
    const amount = Number(raw)
    if (amount < 0.01 || amount > 100000) {
      wx.showToast({ title: '金额需在 0.01~100000 之间', icon: 'none' })
      return
    }
    confirmUtil.confirm({
      title: '确认充值',
      content: '确认充值 ¥' + amount.toFixed(2) + '？'
    }).then((ok) => {
      if (!ok) {
        return
      }
      this.setData({ submitting: true })
      userService.recharge(amount).then((data) => {
        this.setData({
          amount: '',
          balance: Number(data.balance || 0).toFixed(2)
        })
        wx.showToast({ title: '充值成功', icon: 'success' })
      }).catch(function () {
      }).finally(() => {
        this.setData({ submitting: false })
      })
    })
  },

  goBills() {
    wx.navigateTo({ url: '/pages/wallet/bills/index' })
  }
})
