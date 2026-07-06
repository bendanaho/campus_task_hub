const request = require('../utils/request')

function conversations() {
  return request({ url: '/api/conversations', method: 'GET' })
}

function ensureConversation(data) {
  return request({
    url: '/api/conversations/ensure',
    method: 'POST',
    data: data
  })
}

function messages(chatId) {
  return request({
    url: '/api/conversations/' + encodeURIComponent(chatId) + '/messages',
    method: 'GET'
  })
}

function sendMessage(chatId, content) {
  return request({
    url: '/api/conversations/' + encodeURIComponent(chatId) + '/messages',
    method: 'POST',
    data: { content: content }
  })
}

function markRead(chatId) {
  return request({
    url: '/api/conversations/' + encodeURIComponent(chatId) + '/read',
    method: 'POST'
  })
}

function sendPayment(chatId, data) {
  return request({
    url: '/api/conversations/' + encodeURIComponent(chatId) + '/payment',
    method: 'POST',
    data: data,
    showLoading: true
  })
}

function unread() {
  // 未读角标属后台静默请求：token 失效时不打断用户浏览
  return request({ url: '/api/messages/unread', method: 'GET', silentAuth: true })
}

function pay(messageId) {
  return request({ url: '/api/messages/' + messageId + '/pay', method: 'POST', showLoading: true })
}

function cancelPayment(messageId) {
  return request({ url: '/api/messages/' + messageId + '/cancel-payment', method: 'POST', showLoading: true })
}

function withdraw(messageId) {
  return request({ url: '/api/messages/' + messageId + '/withdraw', method: 'POST' })
}

module.exports = {
  conversations,
  ensureConversation,
  messages,
  sendMessage,
  markRead,
  sendPayment,
  unread,
  pay,
  cancelPayment,
  withdraw
}
