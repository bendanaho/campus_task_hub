const request = require('../utils/request')

function login(data) {
  return request({
    url: '/api/login',
    method: 'POST',
    data: data,
    showLoading: true
  })
}

function register(data) {
  return request({
    url: '/api/register',
    method: 'POST',
    data: data,
    showLoading: true
  })
}

function logout() {
  return request({
    url: '/api/logout',
    method: 'POST'
  })
}

module.exports = {
  login,
  register,
  logout
}
