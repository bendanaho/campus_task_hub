const auth = require('../../../utils/auth')
const userService = require('../../../services/user')
const format = require('../../../utils/format')

Page({
  data: {
    list: [],
    totalIn: '0.00',
    totalOut: '0.00',
    loading: true
  },

  onShow() {
    if (!auth.requireLogin()) {
      return
    }
    this.loadBills()
  },

  loadBills() {
    this.setData({ loading: true })
    userService.getBills().then((data) => {
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
        totalOut: format.formatMoney(data.totalOut)
      })
    }).catch(function () {
    }).finally(() => {
      this.setData({ loading: false })
    })
  }
})
