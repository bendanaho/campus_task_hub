const config = require('../config/index')
const auth = require('./auth')

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

function handleHttpError(url, method, statusCode, reject, silentAuth) {
  logWarn(url, method, statusCode, 'HTTP ' + statusCode)

  if (statusCode === 401 || statusCode === 403) {
    auth.clearSession()
    if (!silentAuth) {
      wx.showToast({ title: '请先登录', icon: 'none' })
      auth.goLogin()
    }
  } else if (!silentAuth) {
    wx.showToast({ title: '服务异常(' + statusCode + ')', icon: 'none' })
  }

  reject({ statusCode: statusCode, message: '服务异常(' + statusCode + ')' })
}

function handleBusinessError(url, method, body, reject, silentAuth) {
  const message = body && body.message ? body.message : '请求失败'
  const errorCode = body ? body.errorCode : 0

  logWarn(url, method, errorCode, message)

  if (errorCode === 1002 || errorCode === 2005) {
    auth.clearSession()
    if (!silentAuth) {
      wx.showToast({ title: '请先登录', icon: 'none' })
      auth.goLogin()
    }
  } else if (silentAuth) {
    // 后台静默请求：不打扰用户，交给调用方兜底
  } else if (errorCode === 2006) {
    wx.showToast({ title: '请先完成实名认证', icon: 'none' })
    wx.navigateTo({ url: '/pages/user/verify/index' })
  } else {
    wx.showToast({ title: message, icon: 'none' })
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
      wx.showToast({ title: '当前网络不可用', icon: 'none' })
      reject({ message: '当前网络不可用', offline: true })
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
          wx.showToast({ title: '网络不给力，请稍后再试', icon: 'none' })
          reject(err)
        }
      })
    }

    attempt(method === 'GET' ? 1 : 0)
  })
}

module.exports = request
