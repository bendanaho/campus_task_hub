let realtimeLogger = null
let realtimeLoggerInited = false

function getRealtimeLogger() {
  if (realtimeLoggerInited) {
    return realtimeLogger
  }
  realtimeLoggerInited = true
  try {
    if (typeof wx.getRealtimeLogManager === 'function') {
      realtimeLogger = wx.getRealtimeLogManager()
    }
  } catch (e) {
    realtimeLogger = null
  }
  return realtimeLogger
}

function reportError(tag, detail) {
  console.error(tag, detail)
  try {
    const logger = getRealtimeLogger()
    if (logger && typeof logger.error === 'function') {
      logger.error(tag, detail)
    }
  } catch (e) {
    console.warn(tag, '实时日志上报失败')
  }
}

App({
  onLaunch() {
    const token = wx.getStorageSync('campus_token') || ''
    const user = wx.getStorageSync('campus_user') || null
    this.globalData.token = token
    this.globalData.user = user
    this.initNetworkStatus()
  },

  onError(msg) {
    reportError('[app:onError]', msg)
  },

  onUnhandledRejection(res) {
    const reason = res && res.reason !== undefined ? res.reason : res
    reportError('[app:onUnhandledRejection]', reason)
  },

  initNetworkStatus() {
    const app = this
    try {
      wx.getNetworkType({
        success(res) {
          app.globalData.offline = res.networkType === 'none'
        },
        fail() {
          app.globalData.offline = false
        }
      })
      wx.onNetworkStatusChange(function (res) {
        app.globalData.offline = !res.isConnected
      })
    } catch (e) {
      app.globalData.offline = false
    }
  },

  globalData: {
    token: '',
    user: null,
    offline: false
  }
})
