const request = require('../utils/request')

function create(data) {
  return request({
    url: '/api/orders',
    method: 'POST',
    data: data,
    showLoading: true
  })
}

function accept(id) {
  return request({ url: '/api/orders/' + id + '/accept', method: 'POST', showLoading: true })
}

function cancel(id) {
  return request({ url: '/api/orders/' + id + '/cancel', method: 'POST', showLoading: true })
}

function confirm(id) {
  return request({ url: '/api/orders/' + id + '/confirm', method: 'POST', showLoading: true })
}

function byChat(chatId) {
  return request({ url: '/api/orders/by-chat?chatId=' + encodeURIComponent(chatId), method: 'GET' })
}

function history(chatId) {
  return request({ url: '/api/orders?chatId=' + encodeURIComponent(chatId), method: 'GET' })
}

function mine(role) {
  const query = role ? '?role=' + encodeURIComponent(role) : ''
  return request({ url: '/api/orders/mine' + query, method: 'GET' })
}

// 申诉进行中的订单（冻结资金，等待管理员仲裁）
function dispute(id, reason) {
  return request({
    url: '/api/orders/' + id + '/dispute',
    method: 'POST',
    data: { reason: reason },
    showLoading: true
  })
}

module.exports = {
  create,
  accept,
  cancel,
  confirm,
  byChat,
  history,
  mine,
  dispute
}
