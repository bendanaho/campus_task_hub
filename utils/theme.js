// 外观主题：浅色/深色 + 浅色下的页面背景色，本机持久化。
// app.js 里包装了全局 Page()，每个页面 onShow 自动调用 applyPage 注入 themeCls。
const KEY = 'campus_theme'

const BGS = [
  { label: '默认', value: 'b1', color: '#F4F6FA' },
  { label: '米白', value: 'b2', color: '#FAF6EF' },
  { label: '浅绿', value: 'b3', color: '#EFF7F1' },
  { label: '浅蓝', value: 'b4', color: '#EFF4FE' },
  { label: '浅粉', value: 'b5', color: '#FBF3F5' }
]

const DARK_PAPER = '#12161F'
const DARK_BAR = '#1C2230'

function get() {
  return Object.assign({ mode: 'light', bg: 'b1' }, wx.getStorageSync(KEY) || {})
}

function set(partial) {
  const t = Object.assign(get(), partial)
  wx.setStorageSync(KEY, t)
  return t
}

function clsOf(t) {
  return t.mode === 'dark' ? 'theme-dark' : 'theme-light bg-' + t.bg
}

function bgColorOf(t) {
  if (t.mode === 'dark') {
    return DARK_PAPER
  }
  const bg = BGS.find(function (b) { return b.value === t.bg })
  return (bg || BGS[0]).color
}

function applyPage(page) {
  const t = get()
  const cls = clsOf(t)
  try {
    if (page && page.data && page.data.themeCls !== cls) {
      page.setData({ themeCls: cls })
    }
  } catch (e) {
  }
  // 自定义 tabBar 与页面样式隔离，单独下发
  try {
    const tabBar = page && typeof page.getTabBar === 'function' && page.getTabBar()
    if (tabBar) {
      tabBar.setData({
        themeCls: t.mode === 'dark' ? 'theme-dark' : '',
        accent: t.mode === 'dark' ? 'dark' : t.bg
      })
    }
  } catch (e) {
  }
  // 原生导航栏配色（大厅是自定义导航，跳过）
  if (!page || page.route !== 'pages/posts/list/index') {
    try {
      wx.setNavigationBarColor({
        frontColor: t.mode === 'dark' ? '#ffffff' : '#000000',
        backgroundColor: t.mode === 'dark' ? DARK_BAR : '#ffffff'
      })
    } catch (e) {
    }
  }
  // 下拉刷新露出的窗口背景
  try {
    if (typeof wx.setBackgroundColor === 'function') {
      wx.setBackgroundColor({
        backgroundColor: bgColorOf(t),
        backgroundColorTop: bgColorOf(t),
        backgroundColorBottom: bgColorOf(t)
      })
    }
  } catch (e) {
  }
  return t
}

module.exports = { get, set, applyPage, BGS }
