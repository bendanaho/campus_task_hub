const request = require('../utils/request')

function conversations() {
  return request({ url: '/api/conversations', method: 'GET' })
}

// 消息中心聚合接口：一次返回会话 + 未读数 + 订单快照 + 是否已评价，
// 避免"会话列表 + 逐条未读"的多次请求，显著加快消息中心加载。
function enrichedConversations() {
  return request({ url: '/api/conversations/enriched', method: 'GET' })
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

// 第三参 type 支持图片等非文本消息（type==='image' 时 content 传图片 URL）；
// 不传 type 时后端按 text 处理，保持既有文本发送调用兼容。
function sendMessage(chatId, content, type) {
  const data = { content: content }
  if (type) {
    data.type = type
  }
  return request({
    url: '/api/conversations/' + encodeURIComponent(chatId) + '/messages',
    method: 'POST',
    data: data
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
  enrichedConversations,
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
