const auth = require('./auth')
const chatService = require('../services/chat')

function setTabBadge(page, total) {
  try {
    if (!page || typeof page.getTabBar !== 'function') {
      return
    }
    const tabBar = page.getTabBar()
    if (tabBar && typeof tabBar.setData === 'function') {
      tabBar.setData({ unreadTotal: total })
    }
  } catch (e) {
    // 安全跳过
  }
}

function refreshUnread(page) {
  if (!auth.isLoggedIn()) {
    setTabBadge(page, 0)
    return Promise.resolve(0)
  }

  return chatService.unread()
    .then(function (res) {
      const total = res && res.total ? Number(res.total) : 0
      setTabBadge(page, total)
      return total
    })
    .catch(function () {
      // 静默失败，不打扰用户
      return 0
    })
}

module.exports = {
  refreshUnread
}
