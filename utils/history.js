// 搜索历史（本机，最多 5 条，去重置顶）
const PREFIX = 'campus_hist_'

function get(key) {
  return wx.getStorageSync(PREFIX + key) || []
}

function push(key, term) {
  term = (term || '').trim()
  if (!term) {
    return get(key)
  }
  let list = get(key).filter(function (t) { return t !== term })
  list.unshift(term)
  list = list.slice(0, 5)
  wx.setStorageSync(PREFIX + key, list)
  return list
}

function clear(key) {
  wx.removeStorageSync(PREFIX + key)
  return []
}

module.exports = { get, push, clear }
