const auth = require('../../../utils/auth')
const userService = require('../../../services/user')

Page({
  data: {
    balance: '--',
    amount: ''
  },

  onShow() {
    if (!auth.requireLogin()) {
      return
    }
    this.loadBalance()
  },

  loadBalance() {
    userService.getBalance().then((data) => {
      this.setData({ balance: Number(data.balance || 0).toFixed(2) })
    }).catch(function () {
    })
  },

  onAmountInput(e) {
    this.setData({ amount: e.detail.value })
  },

  recharge() {
    const amount = Number(this.data.amount)
    if (!amount || amount <= 0) {
      wx.showToast({ title: '请输入充值金额', icon: 'none' })
      return
    }
    userService.recharge(amount).then((data) => {
      this.setData({
        amount: '',
        balance: Number(data.balance || 0).toFixed(2)
      })
      wx.showToast({ title: '充值成功', icon: 'success' })
    }).catch(function () {
    })
  },

  goBills() {
    wx.navigateTo({ url: '/pages/wallet/bills/index' })
  }
})
