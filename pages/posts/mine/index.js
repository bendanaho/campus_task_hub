const postService = require('../../../services/posts')
const auth = require('../../../utils/auth')
const format = require('../../../utils/format')

const SIDE_CLASS = {
  payer: 'reward',
  earner: 'service',
  none: 'mutual'
}

const TABS = [
  { label: '全部', value: '' },
  { label: '进行中', value: 'open' },
  { label: '已关闭', value: 'closed' }
]

Page({
  data: {
    loggedIn: false,
    tabs: TABS,
    tabIndex: 0,
    posts: [],
    loading: false
  },

  onShow() {
    const loggedIn = auth.isLoggedIn()
    this.setData({ loggedIn: loggedIn })
    if (loggedIn) {
      this.loadPosts()
    }
  },

  onPullDownRefresh() {
    if (!this.data.loggedIn) {
      wx.stopPullDownRefresh()
      return
    }
    this.loadPosts().finally(function () {
      wx.stopPullDownRefresh()
    })
  },

  loadPosts() {
    this.setData({ loading: true })
    return postService.mine().then((list) => {
      const posts = (list || []).map(function (item) {
        return {
          id: item.id,
          title: item.title,
          status: item.status,
          statusText: item.status === 'open' ? '进行中' : '已关闭',
          sideText: format.sideLabel(item.publisherSide),
          sideClass: SIDE_CLASS[item.publisherSide] || 'service',
          hasPrice: Number(item.rewardValue) > 0,
          moneyText: format.formatMoney(item.rewardValue),
          priceAlt: item.publisherSide === 'none' ? '免费互助' : (item.reward || '面议'),
          timeText: format.relativeTime(item.publishTime)
        }
      })
      this.allPosts = posts
      this.applyFilter()
    }).catch(function () {
    }).finally(() => {
      this.setData({ loading: false })
    })
  },

  applyFilter() {
    const status = this.data.tabs[this.data.tabIndex].value
    const all = this.allPosts || []
    const posts = status
      ? all.filter(function (item) { return item.status === status })
      : all
    this.setData({ posts: posts })
  },

  onTabTap(e) {
    const index = Number(e.currentTarget.dataset.index)
    if (index === this.data.tabIndex) {
      return
    }
    this.setData({ tabIndex: index })
    this.applyFilter()
  },

  openDetail(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({
      url: '/pages/posts/detail/index?id=' + id
    })
  },

  goLogin() {
    auth.goLogin()
  },

  goPublish() {
    wx.switchTab({
      url: '/pages/posts/publish/index'
    })
  }
})
