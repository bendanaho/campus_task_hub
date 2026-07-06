const request = require('../utils/request')

function getProfile(id) {
  return request({ url: '/api/users/' + id, method: 'GET' })
}

function updatePhone(phone) {
  return request({
    url: '/api/user/phone',
    method: 'PUT',
    data: { phone: phone },
    showLoading: true
  })
}

function updateEmail(email) {
  return request({
    url: '/api/user/email',
    method: 'PUT',
    data: { email: email },
    showLoading: true
  })
}

function submitAuth(data) {
  return request({
    url: '/api/auth',
    method: 'POST',
    data: data,
    showLoading: true
  })
}

function getBalance() {
  return request({ url: '/api/user/balance', method: 'GET' })
}

function recharge(amount) {
  return request({
    url: '/api/user/recharge',
    method: 'POST',
    data: { amount: amount },
    showLoading: true
  })
}

function getBills() {
  return request({ url: '/api/user/bills', method: 'GET' })
}

module.exports = {
  getProfile,
  updatePhone,
  updateEmail,
  submitAuth,
  getBalance,
  recharge,
  getBills
}
