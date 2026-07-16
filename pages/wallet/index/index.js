const auth = require('../../../utils/auth')
const userService = require('../../../services/user')
const confirmUtil = require('../../../utils/confirm')

Page({
  data: {
    balance: '--',
    frozenBalance: '0.00',
    hasFrozen: false,
    balanceError: false,
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
      // 新版后端返回冻结余额 frozenBalance（发布"我出钱"、托管转账会冻结）
      const frozen = Number((data && data.frozenBalance) || 0)
      this.setData({
        balance: Number((data && data.balance) || 0).toFixed(2),
        frozenBalance: frozen.toFixed(2),
        hasFrozen: frozen > 0,
        balanceError: false
      })
    }).catch(() => {
      // 加载失败：标记错误态，余额位改显「点击重试」，避免长期停在「¥--」
      this.setData({ balanceError: true })
    })
  },

  onAmountInput(e) {
    this.setData({ amount: e.detail.value })
  },

  pickAmount(e) {
    this.setData({ amount: String(e.currentTarget.dataset.value) })
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
          balance: Number(data.balance || 0).toFixed(2),
          balanceError: false
        })
        wx.showToast({ title: '充值成功', icon: 'success' })
      }).catch(function () {
        // 失败提示由 request.js 统一弹出（服务端具体消息 / 网络异常），此处不再覆盖
      }).finally(() => {
        this.setData({ submitting: false })
      })
    })
  },

  goBills() {
    wx.navigateTo({ url: '/pages/wallet/bills/index' })
  }
})
