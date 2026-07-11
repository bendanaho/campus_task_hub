const postService = require('../../../services/posts')
const auth = require('../../../utils/auth')
const format = require('../../../utils/format')
const confirmUtil = require('../../../utils/confirm')

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
    keyword: '',
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
          description: item.description || '',
          rewardValue: item.rewardValue,
          contact: item.contact || '',
          serviceTime: item.serviceTime || '',
          publisherSide: item.publisherSide,
          category: item.category || '',
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
    const kw = (this.data.keyword || '').trim().toLowerCase()
    let posts = status
      ? all.filter(function (item) { return item.status === status })
      : all
    if (kw) {
      posts = posts.filter(function (item) {
        return (item.title && item.title.toLowerCase().indexOf(kw) !== -1) ||
          (item.description && item.description.toLowerCase().indexOf(kw) !== -1)
      })
    }
    this.setData({ posts: posts })
  },

  onSearchInput(e) {
    this.setData({ keyword: e.detail.value })
    this.applyFilter()
  },

  // 下架进行中的帖子
  closePost(e) {
    const id = e.currentTarget.dataset.id
    confirmUtil.confirm({
      title: '下架帖子',
      content: '下架后大厅不再显示，进行中的订单不受影响'
    }).then((ok) => {
      if (!ok) return
      postService.closePost(id).then(() => {
        wx.showToast({ title: '已下架', icon: 'success' })
        this.loadPosts()
      }).catch(function () {
      })
    })
  },

  // 以该帖为模板再发一单
  repost(e) {
    const id = e.currentTarget.dataset.id
    const item = (this.allPosts || []).find(function (p) { return p.id === id })
    if (!item) return
    wx.setStorageSync('campus_pub_draft', {
      source: 'repost',
      ts: Date.now(),
      title: item.title || '',
      description: item.description || '',
      rewardValue: Number(item.rewardValue) > 0 ? String(item.rewardValue) : '',
      contact: item.contact || '站内联系',
      serviceTime: item.serviceTime || '',
      sideValue: item.publisherSide || 'payer',
      categoryValue: item.category || ''
    })
    wx.switchTab({ url: '/pages/posts/publish/index' })
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
