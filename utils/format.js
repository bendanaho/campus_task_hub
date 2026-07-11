function pad(n) {
  return n < 10 ? '0' + n : '' + n
}

function formatTime(value) {
  if (!value) return ''
  const text = String(value).replace('T', ' ')
  return text.length > 16 ? text.slice(0, 16) : text
}

function formatMoney(value) {
  const n = Number(value || 0)
  return n.toFixed(2)
}

function sideLabel(value) {
  const map = {
    payer: '悬赏',
    earner: '服务',
    none: '互助'
  }
  return map[value] || value || '未知'
}

function orderStatusLabel(value) {
  const map = {
    pending: '待接受',
    in_progress: '进行中',
    completed: '已完成',
    cancelled: '已取消',
    disputed: '申诉处理中',
    closed: '已结案'
  }
  return map[value] || value || '未知'
}

function todayDate() {
  const d = new Date()
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate())
}

function parseDate(value) {
  if (!value) return null
  const d = new Date(String(value).replace(' ', 'T'))
  return isNaN(d.getTime()) ? null : d
}

function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
}

function relativeTime(value) {
  const d = parseDate(value)
  if (!d) return ''
  const diff = Date.now() - d.getTime()
  if (diff < 60 * 1000) return '刚刚'
  if (diff < 60 * 60 * 1000) return Math.floor(diff / (60 * 1000)) + ' 分钟前'
  if (diff < 24 * 60 * 60 * 1000) return Math.floor(diff / (60 * 60 * 1000)) + ' 小时前'
  if (diff < 48 * 60 * 60 * 1000) return '昨天'
  if (diff < 7 * 24 * 60 * 60 * 1000) return Math.floor(diff / (24 * 60 * 60 * 1000)) + ' 天前'
  return formatTime(value).slice(0, 10)
}

function shortTime(value) {
  const d = parseDate(value)
  if (!d) return ''
  const now = new Date()
  const hm = pad(d.getHours()) + ':' + pad(d.getMinutes())
  if (isSameDay(d, now)) return '今天 ' + hm
  if (isSameDay(d, new Date(now.getTime() + 24 * 60 * 60 * 1000))) return '明天 ' + hm
  return (d.getMonth() + 1) + '月' + d.getDate() + '日 ' + hm
}

module.exports = {
  formatTime,
  formatMoney,
  sideLabel,
  orderStatusLabel,
  todayDate,
  relativeTime,
  shortTime
}
