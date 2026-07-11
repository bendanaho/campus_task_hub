// 头像解析与本机自定义头像。
// avatar 字段三种形态：http(s)/data: 图片地址；'color:#xxxxxx' 纯色模板；空 → 按 uid 分配默认色。
// 后端暂无头像更新接口，自定义头像先存本机（MY_KEY），接口就绪后可改为提交后端。
const COLORS = ['#2E6BFF', '#0FB77A', '#F5570B', '#8B5CF6', '#0EA5C4', '#E1518F', '#F5A70B', '#17233D']
const MY_KEY = 'campus_my_avatar'

function getMyAvatar() {
  return wx.getStorageSync(MY_KEY) || ''
}

function setMyAvatar(value) {
  if (value) {
    wx.setStorageSync(MY_KEY, value)
  } else {
    wx.removeStorageSync(MY_KEY)
  }
}

function resolve(avatar, name, uid) {
  const char = name ? String(name).slice(0, 1) : '同'
  const a = avatar || ''
  if (a.indexOf('color:') === 0) {
    return { kind: 'color', color: a.slice(6), char: char, src: '' }
  }
  if (a.indexOf('http') === 0 || a.indexOf('data:') === 0) {
    return { kind: 'image', src: a, char: char, color: '' }
  }
  return { kind: 'color', color: COLORS[(Number(uid) || 0) % COLORS.length], char: char, src: '' }
}

module.exports = {
  COLORS,
  resolve,
  getMyAvatar,
  setMyAvatar
}
