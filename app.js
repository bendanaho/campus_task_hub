App({
  onLaunch() {
    const token = wx.getStorageSync('campus_token') || ''
    const user = wx.getStorageSync('campus_user') || null
    this.globalData.token = token
    this.globalData.user = user
  },
  globalData: {
    token: '',
    user: null
  }
})
