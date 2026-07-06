const config = require('../config/index')
const auth = require('./auth')

let loadingCount = 0

function showRequestLoading() {
  loadingCount += 1

  if (loadingCount === 1) {
    wx.showLoading({ title: '加载中' })
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

function handleBusinessError(body, reject) {
  const message = body && body.message ? body.message : '请求失败'
  const errorCode = body ? body.errorCode : 0

  if (errorCode === 1002 || errorCode === 2005) {
    auth.clearSession()
    wx.showToast({ title: '请先登录', icon: 'none' })
    wx.navigateTo({ url: '/pages/auth/login/index' })
  } else if (errorCode === 2006) {
    wx.showToast({ title: '请先完成实名认证', icon: 'none' })
    wx.navigateTo({ url: '/pages/user/verify/index' })
  } else {
    wx.showToast({ title: message, icon: 'none' })
  }

  reject(body || { message: message, errorCode: errorCode })
}

function request(options) {
  const method = options.method || 'GET'
  const data = options.data || {}
  const showLoading = !!options.showLoading
  const token = auth.getToken()

  if (showLoading) {
    showRequestLoading()
  }

  return new Promise(function (resolve, reject) {
    wx.request({
      url: config.API_BASE_URL + options.url,
      method: method,
      data: data,
      header: {
        'Content-Type': 'application/json',
        Authorization: token ? 'Bearer ' + token : ''
      },
      success: function (res) {
        const body = res.data

        if (res.statusCode < 200 || res.statusCode >= 300) {
          handleBusinessError({
            success: false,
            errorCode: res.statusCode,
            message: '网络请求错误：' + res.statusCode
          }, reject)
          return
        }

        if (!body || body.success !== true) {
          handleBusinessError(body, reject)
          return
        }

        resolve(body.data)
      },
      fail: function (err) {
        wx.showToast({ title: '无法连接后端服务', icon: 'none' })
        reject(err)
      },
      complete: function () {
        if (showLoading) {
          hideRequestLoading()
        }
      }
    })
  })
}

module.exports = request
