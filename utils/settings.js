// 消息相关的本地偏好设置（仅存本机）
const KEY = 'campus_chat_settings'

const DEFAULTS = {
  fontSize: 'std',            // 聊天字号: small / std / large
  badgeEnabled: true,         // tabBar 未读角标
  autoRead: true,             // 进入会话自动标记已读
  interactionEnabled: true    // 接收互动消息（订单/评价等互动通知）
}

function getSettings() {
  const saved = wx.getStorageSync(KEY) || {}
  return Object.assign({}, DEFAULTS, saved)
}

function setSetting(key, value) {
  const saved = Object.assign({}, getSettings())
  saved[key] = value
  wx.setStorageSync(KEY, saved)
  return saved
}

module.exports = {
  getSettings,
  setSetting
}
