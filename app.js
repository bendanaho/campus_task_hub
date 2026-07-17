// 包装全局 Page：每个页面 onLoad/onShow 自动应用外观主题（themeCls / 导航栏 / tabBar）
const themeUtil = require('./utils/theme')
const originalPage = Page
Page = function (config) {
  const originOnLoad = config.onLoad
  // 深色模式下切页闪白的根因：themeCls 原来只在 onShow 里 setData，
  // 新页面第一帧先按浅色渲染、下一拍才变深。onLoad 在首帧渲染前执行，
  // 在这里就把主题类注入 data，首帧即深色（applyPage 幂等，onShow 再调无害）
  config.onLoad = function () {
    themeUtil.applyPage(this)
    if (originOnLoad) {
      originOnLoad.apply(this, arguments)
    }
  }
  // 原生导航栏/窗口背景是异步原生调用，个别平台在 onLoad 时机会被吞掉，
  // onReady（首帧已渲染）再断言一次，确保深色下导航栏不残留白色
  const originOnReady = config.onReady
  config.onReady = function () {
    themeUtil.applyPage(this)
    if (originOnReady) {
      originOnReady.apply(this, arguments)
    }
  }
  const originOnShow = config.onShow
  config.onShow = function () {
    themeUtil.applyPage(this)
    try {
      // 登录过期后用户重新登录（token 恢复）时，自动收起“登录已过期”横幅（修复7）
      const app = getApp()
      if (app && app.globalData.authExpired && app.globalData.token) {
        app.clearAuthExpired()
      }
      // 全局横幅：每个页面自动订阅断网/登录过期状态并下发到 data（无需各页改 js）。
      // 页面只要在 wxml 顶部放 offline-banner / auth-expired-banner 元素即可展示。
      if (app && !this.__bannerSubscribed) {
        this.__bannerSubscribed = true
        const self = this
        this.__bannerFn = function (s) {
          if (self.setData) {
            self.setData(s)
          }
        }
        const cur = app.onBannerChange(this.__bannerFn)
        this.setData(cur)
      }
    } catch (e) {
    }
    if (originOnShow) {
      originOnShow.apply(this, arguments)
    }
  }
  const originOnUnload = config.onUnload
  config.onUnload = function () {
    try {
      const app = getApp()
      if (app && this.__bannerFn) {
        app.offBannerChange(this.__bannerFn)
      }
    } catch (e) {
    }
    if (originOnUnload) {
      originOnUnload.apply(this, arguments)
    }
  }
  // 登录过期横幅点击 → 去登录（页面未自定义时用默认实现）
  if (typeof config.onReLogin !== 'function') {
    config.onReLogin = function () {
      try {
        require('./utils/auth').goLogin()
      } catch (e) {
      }
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
    // 构建标记：vConsole 里看到这行即确认跑的是当前版本（排查"改了没生效"）
    console.log('[campus-build] v0717-2 darkfix+payment-status')
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
          app.setOffline(res.networkType === 'none')
        },
        fail() {
          app.setOffline(false)
        }
      })
      wx.onNetworkStatusChange(function (res) {
        const wasOffline = app.globalData.offline === true
        const nowOffline = !res.isConnected
        app.setOffline(nowOffline)
        // 网络由断→通：立即重连 WebSocket，避免命中退避最长等 30s（修复3）
        if (wasOffline && !nowOffline) {
          try {
            require('./utils/socket').resetAndReconnect()
          } catch (e) {
          }
        }
      })
    } catch (e) {
      app.setOffline(false)
    }
  },

  // ===== 全局横幅状态（断网 / 登录过期）=====
  // 小程序无全局 DOM，横幅需各页在根节点自行渲染。约定接入方式（修复2/修复7）：
  //   1) 页面 onLoad: this._onBanner = (s) => this.setData(s); getApp().onBannerChange(this._onBanner)
  //   2) 页面 onUnload: getApp().offBannerChange(this._onBanner)
  //   3) wxml 顶部:
  //      <view wx:if="{{offline}}" class="offline-banner">网络连接已断开</view>
  //      <view wx:elif="{{authExpired}}" class="auth-expired-banner" bindtap="onReLogin">登录已过期，点此重新登录</view>
  //   4) 网络恢复时 offline 变 false，页面可在回调里触发数据刷新，替代反复弹 toast。
  _bannerListeners: [],

  onBannerChange(fn) {
    if (typeof fn === 'function' && this._bannerListeners.indexOf(fn) === -1) {
      this._bannerListeners.push(fn)
    }
    return this._bannerState()
  },

  offBannerChange(fn) {
    const idx = this._bannerListeners.indexOf(fn)
    if (idx > -1) {
      this._bannerListeners.splice(idx, 1)
    }
  },

  _bannerState() {
    return {
      offline: !!this.globalData.offline,
      authExpired: !!this.globalData.authExpired
    }
  },

  _emitBannerChange() {
    const state = this._bannerState()
    this._bannerListeners.slice().forEach(function (fn) {
      try {
        fn(state)
      } catch (e) {
      }
    })
  },

  setOffline(offline) {
    const next = !!offline
    if (this.globalData.offline === next) {
      return
    }
    this.globalData.offline = next
    this._emitBannerChange()
  },

  markAuthExpired() {
    if (this.globalData.authExpired) {
      return
    }
    this.globalData.authExpired = true
    this._emitBannerChange()
  },

  clearAuthExpired() {
    if (!this.globalData.authExpired) {
      return
    }
    this.globalData.authExpired = false
    this._emitBannerChange()
  },

  globalData: {
    token: '',
    user: null,
    offline: false,
    authExpired: false
  }
})
