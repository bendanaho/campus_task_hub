function confirm(options) {
  const opts = options || {}

  return new Promise(function (resolve) {
    wx.showModal({
      title: opts.title || '提示',
      content: opts.content || '',
      confirmText: opts.confirmText || '确定',
      success: function (res) {
        resolve(res.confirm === true)
      },
      fail: function () {
        resolve(false)
      }
    })
  })
}

module.exports = {
  confirm
}
