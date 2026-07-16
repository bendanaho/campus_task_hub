const config = require('../config/index')
const auth = require('./auth')

// 面向用户的错误文案统一在此维护，保证全局口径一致（修复8）。
// 状态码 / errorCode 只写进日志（logWarn），不暴露给终端用户。
const MSG = {
  NETWORK: '网络开小差了，请稍后重试',
  SERVER: '服务开小差了，请稍后重试',
  LOGIN_REQUIRED: '请先登录',
  FORBIDDEN: '没有权限进行此操作',
  VERIFY_REQUIRED: '请先完成实名认证',
  DEFAULT_FAIL: '请求失败'
}

let loadingCount = 0
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

function logWarn(url, method, code, message) {
  try {
    const logger = getRealtimeLogger()
    if (logger && typeof logger.warn === 'function') {
      logger.warn(url, method, code, message)
      return
    }
  } catch (e) {
    // 降级到 console
  }
  console.warn('[request]', url, method, code, message)
}

function isOffline() {
  try {
    const app = getApp()
    return !!(app && app.globalData && app.globalData.offline === true)
  } catch (e) {
    return false
  }
}

function showRequestLoading() {
  loadingCount += 1

  if (loadingCount === 1) {
    wx.showLoading({ title: '加载中', mask: true })
  }
}

function hideRequestLoading() {
  if (loadingCount <= 0) {
    return
  }

  loadingCount -= 1

  if (loadingCount === 0) {
    wx.hideLoading()
  }
}

// 错误提示与 loading 共用微信的提示通道：并发失败时若 loading 遮罩仍在，
// showToast 会被遮罩顶掉、或随后 hideLoading 把这条 toast 一并关掉（修复4）。
// 因此提示前先强制收起 loading，再弹 toast。
function ensureLoadingHidden() {
  if (loadingCount > 0) {
    loadingCount = 0
    wx.hideLoading()
  }
}

function toast(title) {
  ensureLoadingHidden()
  wx.showToast({ title: title, icon: 'none' })
}

// 鉴权失败清 session 后标记登录态失效，让顶层页刷新 loggedIn / 显示温和横幅（修复7）。
function markAuthExpired() {
  try {
    const app = getApp()
    if (app && typeof app.markAuthExpired === 'function') {
      app.markAuthExpired()
    }
  } catch (e) {
    // 无 app 实例时忽略，不影响主流程
  }
}

function handleHttpError(url, method, statusCode, reject, silentAuth) {
  logWarn(url, method, statusCode, 'HTTP ' + statusCode)

  if (statusCode === 401) {
    // 401 = 未登录 / 登录失效：清 session，非静默时跳登录（修复1）
    auth.clearSession()
    markAuthExpired()
    if (!silentAuth) {
      toast(MSG.LOGIN_REQUIRED)
      auth.goLogin()
    }
  } else if (statusCode === 403) {
    // 403 = 已登录但无权限：仅提示，不清 session、不跳登录（修复1）
    if (!silentAuth) {
      toast(MSG.FORBIDDEN)
    }
  } else if (!silentAuth) {
    toast(MSG.SERVER)
  }

  reject({ statusCode: statusCode, message: 'HTTP ' + statusCode })
}

function handleBusinessError(url, method, body, reject, silentAuth) {
  const message = body && body.message ? body.message : MSG.DEFAULT_FAIL
  const errorCode = body ? body.errorCode : 0

  logWarn(url, method, errorCode, message)

  if (errorCode === 1002 || errorCode === 2005) {
    auth.clearSession()
    markAuthExpired()
    if (!silentAuth) {
      toast(MSG.LOGIN_REQUIRED)
      auth.goLogin()
    }
  } else if (silentAuth) {
    // 后台静默请求：不打扰用户，交给调用方兜底
  } else if (errorCode === 2006) {
    toast(MSG.VERIFY_REQUIRED)
    wx.navigateTo({ url: '/pages/user/verify/index' })
  } else {
    toast(message)
  }

  reject(body || { message: message, errorCode: errorCode })
}

function request(options) {
  const method = (options.method || 'GET').toUpperCase()
  const data = options.data || {}
  const showLoading = !!options.showLoading
  // silentAuth: 后台静默请求（如未读角标轮询），鉴权失败只清 session 不弹窗不跳登录
  const silentAuth = !!options.silentAuth
  const url = config.API_BASE_URL + options.url

  return new Promise(function (resolve, reject) {
    if (isOffline()) {
      toast(MSG.NETWORK)
      reject({ message: MSG.NETWORK, offline: true })
      return
    }

    if (showLoading) {
      showRequestLoading()
    }

    function done() {
      if (showLoading) {
        hideRequestLoading()
      }
    }

    function attempt(retriesLeft) {
      const token = auth.getToken()

      wx.request({
        url: url,
        method: method,
        data: data,
        timeout: 10000,
        header: {
          'Content-Type': 'application/json',
          Authorization: token ? 'Bearer ' + token : ''
        },
        success: function (res) {
          const body = res.data

          if (res.statusCode < 200 || res.statusCode >= 300) {
            done()
            handleHttpError(options.url, method, res.statusCode, reject, silentAuth)
            return
          }

          if (!body || body.success !== true) {
            done()
            handleBusinessError(options.url, method, body, reject, silentAuth)
            return
          }

          done()
          resolve(body.data)
        },
        fail: function (err) {
          if (method === 'GET' && retriesLeft > 0) {
            setTimeout(function () {
              attempt(retriesLeft - 1)
            }, 500)
            return
          }

          const errMsg = err && err.errMsg ? err.errMsg : 'request:fail'
          logWarn(options.url, method, 'NETWORK', errMsg)
          done()
          toast(MSG.NETWORK)
          reject(err)
        }
      })
    }

    attempt(method === 'GET' ? 1 : 0)
  })
}

module.exports = request
