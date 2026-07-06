const TOKEN_KEY = 'campus_token'
const USER_KEY = 'campus_user'

function getAppInstance() {
  try {
    return getApp()
  } catch (e) {
    return null
  }
}

function getToken() {
  return wx.getStorageSync(TOKEN_KEY) || ''
}

function getUser() {
  return wx.getStorageSync(USER_KEY) || null
}

function setSession(data) {
  const token = data && data.token ? data.token : ''
  const user = data && data.user ? data.user : null
  wx.setStorageSync(TOKEN_KEY, token)
  wx.setStorageSync(USER_KEY, user)

  const app = getAppInstance()
  if (app) {
    app.globalData.token = token
    app.globalData.user = user
  }
}

function updateUser(user) {
  wx.setStorageSync(USER_KEY, user)
  const app = getAppInstance()
  if (app) {
    app.globalData.user = user
  }
}

function clearSession() {
  wx.removeStorageSync(TOKEN_KEY)
  wx.removeStorageSync(USER_KEY)
  const app = getAppInstance()
  if (app) {
    app.globalData.token = ''
    app.globalData.user = null
  }
}

function isLoggedIn() {
  return !!getToken()
}

function isVerified() {
  const user = getUser()
  return !!(user && user.authStatus === 'verified')
}

function currentRouteWithQuery() {
  const pages = getCurrentPages()
  if (!pages || pages.length === 0) {
    return '/pages/posts/list/index'
  }
  const page = pages[pages.length - 1]
  const options = page.options || {}
  const query = Object.keys(options).map(function (key) {
    return key + '=' + encodeURIComponent(options[key])
  }).join('&')
  return '/' + page.route + (query ? '?' + query : '')
}

function requireLogin() {
  if (isLoggedIn()) {
    return true
  }
  const redirect = encodeURIComponent(currentRouteWithQuery())
  wx.navigateTo({
    url: '/pages/auth/login/index?redirect=' + redirect
  })
  return false
}

function requireVerified() {
  if (!requireLogin()) {
    return false
  }
  if (isVerified()) {
    return true
  }
  wx.navigateTo({
    url: '/pages/user/verify/index'
  })
  return false
}

module.exports = {
  getToken,
  getUser,
  setSession,
  updateUser,
  clearSession,
  isLoggedIn,
  isVerified,
  requireLogin,
  requireVerified
}
