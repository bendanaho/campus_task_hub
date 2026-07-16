// WebSocket 实时通知连接管理器（单例）。
// 协议：ws://<host>/ws/notification/{userId}，消息为 JSON 文本：
//   {"type":"NEW_TASK","postId":N,"title":"..."}   新帖广播
//   {"type":"TASK_TAKEN","postId":N}               悬赏被接广播
//   {"type":"PERSONAL_NOTICE","message":"..."}     订单事件单推
//   {"type":"CHAT_UPDATE","chatId":"..."}          会话有新内容
// 断线指数退避重连；同一 userId 服务端只保留最新连接。
const config = require('../config/index')
const auth = require('./auth')

let socket = null
let connectedUserId = null
let reconnectAttempts = 0
let reconnectTimer = null
let manualClose = false
const handlers = {}

function wsUrl(userId) {
  return config.API_BASE_URL.replace(/^http/, 'ws') + '/ws/notification/' + userId
}

function emit(type, msg) {
  const list = (handlers[type] || []).slice()
  list.forEach(function (fn) {
    try {
      fn(msg)
    } catch (e) {
      console.warn('[socket] handler error', type, e)
    }
  })
}

function openSocket() {
  // 用局部 s 持有本次连接实例：resetAndReconnect 主动重建时，旧 socket 的
  // 异步 onClose 才不会把新建立的连接 socket 误置为 null（避免竞态）。
  let s
  try {
    s = wx.connectSocket({ url: wsUrl(connectedUserId) })
  } catch (e) {
    socket = null
    scheduleReconnect()
    return
  }
  socket = s
  s.onOpen(function () {
    reconnectAttempts = 0
  })
  s.onMessage(function (res) {
    try {
      const msg = JSON.parse(res.data)
      if (msg && msg.type) {
        emit(msg.type, msg)
      }
    } catch (e) {
      // 非 JSON 消息忽略
    }
  })
  s.onClose(function () {
    if (socket === s) {
      socket = null
      scheduleReconnect()
    }
  })
  s.onError(function () {
    try {
      if (s) s.close({})
    } catch (e) {
    }
  })
}

function scheduleReconnect() {
  if (manualClose || !connectedUserId || reconnectTimer) {
    return
  }
  const delay = Math.min(30000, 1000 * Math.pow(2, reconnectAttempts))
  reconnectAttempts += 1
  reconnectTimer = setTimeout(function () {
    reconnectTimer = null
    if (!manualClose && connectedUserId) {
      openSocket()
    }
  }, delay)
}

// 登录态存在时建立连接；重复调用安全
function connect() {
  const user = auth.getUser()
  if (!user || !user.id) {
    return
  }
  if (socket && connectedUserId === user.id) {
    return
  }
  close()
  manualClose = false
  connectedUserId = user.id
  reconnectAttempts = 0
  openSocket()
}

function close() {
  manualClose = true
  if (reconnectTimer) {
    clearTimeout(reconnectTimer)
    reconnectTimer = null
  }
  if (socket) {
    try {
      socket.close({})
    } catch (e) {
    }
    socket = null
  }
  connectedUserId = null
}

// 网络由断→通时调用（见 app.js onNetworkStatusChange）：重置退避、清待重连 timer、
// 立即重连，避免命中指数退避最长等 30s 才恢复实时通知（修复3）。
function resetAndReconnect() {
  reconnectAttempts = 0
  if (reconnectTimer) {
    clearTimeout(reconnectTimer)
    reconnectTimer = null
  }
  const user = auth.getUser()
  if (!user || !user.id) {
    return
  }
  // 强制重建：close() 会断开可能已失效的旧连接，随后立即重新建立
  close()
  manualClose = false
  connectedUserId = user.id
  reconnectAttempts = 0
  openSocket()
}

// 订阅某类消息，返回取消订阅函数
function on(type, fn) {
  ;(handlers[type] = handlers[type] || []).push(fn)
  return function () {
    const list = handlers[type] || []
    const idx = list.indexOf(fn)
    if (idx > -1) {
      list.splice(idx, 1)
    }
  }
}

module.exports = {
  connect,
  close,
  resetAndReconnect,
  on
}
