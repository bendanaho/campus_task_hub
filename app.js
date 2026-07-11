// 包装全局 Page：每个页面 onShow 自动应用外观主题（themeCls / 导航栏 / tabBar）
const themeUtil = require('./utils/theme')
const originalPage = Page
Page = function (config) {
  const originOnShow = config.onShow
  config.onShow = function () {
    themeUtil.applyPage(this)
    if (originOnShow) {
      originOnShow.apply(this, arguments)
    }
  }
  return originalPage(config)
}

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
    this.initRealtime()
  },

  // WebSocket 实时通知：全局兜底处理（订单事件横幅 + 未读角标刷新）
  initRealtime() {
    const socket = require('./utils/socket')
    const badge = require('./utils/badge')
    if (this.globalData.token) {
      socket.connect()
    }
    function refreshTopBadge() {
      try {
        const pages = getCurrentPages()
        const top = pages && pages.length ? pages[pages.length - 1] : null
        if (top) {
          badge.refreshUnread(top)
        }
      } catch (e) {
      }
    }
    socket.on('PERSONAL_NOTICE', function (msg) {
      if (msg && msg.message) {
        wx.showToast({ title: msg.message, icon: 'none', duration: 2500 })
      }
      refreshTopBadge()
    })
    socket.on('CHAT_UPDATE', function () {
      refreshTopBadge()
    })
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
