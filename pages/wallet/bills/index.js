const auth = require('../../../utils/auth')
const userService = require('../../../services/user')
const format = require('../../../utils/format')

Page({
  data: {
    list: [],
    totalIn: '0.00',
    totalOut: '0.00',
    loading: true,
    loaded: false,
    error: false
  },

  onShow() {
    if (!auth.requireLogin()) {
      return
    }
    this.loadBills()
  },

  onPullDownRefresh() {
    this.loadBills().finally(function () {
      wx.stopPullDownRefresh()
    })
  },

  loadBills() {
    this.setData({ loading: true, error: false })
    return userService.getBills().then((data) => {
      const list = (data.list || []).map(function (item) {
        return Object.assign({}, item, {
          timeText: format.formatTime(item.time),
          amountText: format.formatMoney(item.amount),
          directionText: item.direction === 'in' ? '收入' : '支出'
        })
      })
      this.setData({
        list: list,
        totalIn: format.formatMoney(data.totalIn),
        totalOut: format.formatMoney(data.totalOut),
        loaded: true,
        error: false
      })
    }).catch(() => {
      // 加载失败：标记错误态，让页面渲染「点击重试」而非误显示空态/¥0.00
      this.setData({ error: true })
    }).finally(() => {
      this.setData({ loading: false })
    })
  }
})
