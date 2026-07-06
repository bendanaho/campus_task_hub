const postService = require('../../../services/posts')
const auth = require('../../../utils/auth')
const badge = require('../../../utils/badge')
const constants = require('../../../utils/constants')
const format = require('../../../utils/format')

const AVATAR_COLORS = ['#2E6BFF', '#0FB77A', '#F5570B', '#8B5CF6', '#0EA5C4', '#E1518F']
const SIDE_CLASS = {
  payer: 'reward',
  earner: 'service',
  none: 'mutual'
}
const PAGE_SIZE = 10

Page({
  data: {
    statusBarHeight: 20,
    keyword: '',
    sideIndex: 0,
    sortIndex: 0,
    category: '',
    sides: constants.sideOptions,
    sorts: constants.sortOptions,
    categories: constants.categoryOptions,
    posts: [],
    hasMore: false,
    loading: false,
    loggedIn: false
  },

  onLoad() {
    let statusBarHeight = 20
    try {
      const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync()
      statusBarHeight = info.statusBarHeight || 20
    } catch (e) {
    }
    this.setData({ statusBarHeight: statusBarHeight })
    this.loadPosts()
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 0 })
    }
    badge.refreshUnread(this)
    this.setData({ loggedIn: auth.isLoggedIn() })
  },

  onPullDownRefresh() {
    this.loadPosts().finally(function () {
      wx.stopPullDownRefresh()
    })
  },

  onKeywordInput(e) {
    this.setData({ keyword: e.detail.value })
  },

  onSideTap(e) {
    const index = Number(e.currentTarget.dataset.index)
    if (index === this.data.sideIndex) {
      return
    }
    this.setData({ sideIndex: index })
    this.loadPosts()
  },

  onCategoryTap(e) {
    const value = e.currentTarget.dataset.value || ''
    if (value === this.data.category) {
      return
    }
    this.setData({ category: value })
    this.loadPosts()
  },

  onSortChange(e) {
    this.setData({ sortIndex: Number(e.detail.value) })
    this.loadPosts()
  },

  onSearch() {
    this.loadPosts()
  },

  loadPosts() {
    const side = this.data.sides[this.data.sideIndex].value
    const sort = this.data.sorts[this.data.sortIndex].value
    this.setData({ loading: true })
    return postService.list({
      side: side,
      sort: sort,
      categories: this.data.category,
      keyword: this.data.keyword
    }).then((list) => {
      // setData 单次上限 1MB，base64 图片不能整包带进列表：
      // 缩略图只保留网络地址或小图，且累计不超过预算；完整图片由详情页单独拉取
      let thumbBudget = 600 * 1024
      const posts = (list || []).map(function (item) {
        const hasPrice = Number(item.rewardValue) > 0
        const first = (item.images && item.images.length) ? item.images[0] : ''
        let thumb = ''
        if (first) {
          if (first.indexOf('data:') !== 0) {
            thumb = first
          } else if (first.length <= 150 * 1024 && thumbBudget >= first.length) {
            thumb = first
            thumbBudget -= first.length
          }
        }
        return Object.assign({}, item, {
          images: [],
          sideText: format.sideLabel(item.publisherSide),
          sideClass: SIDE_CLASS[item.publisherSide] || 'service',
          publishText: format.relativeTime(item.publishTime),
          deadlineText: item.publisherSide === 'payer' ? format.shortTime(item.deadline) : '',
          moneyText: format.formatMoney(item.rewardValue),
          hasPrice: hasPrice,
          priceAlt: item.publisherSide === 'none' ? '免费互助' : (item.reward || '面议'),
          avatarChar: item.publisherName ? item.publisherName.slice(0, 1) : '同',
          avatarColor: AVATAR_COLORS[(Number(item.publisherId) || 0) % AVATAR_COLORS.length],
          creditText: Number(item.publisherCredit || 0).toFixed(1),
          thumb: thumb
        })
      })
      // 本地分批渲染：全量存实例属性，data 里只放当前批次
      this.allPosts = posts
      this.setData({
        posts: posts.slice(0, PAGE_SIZE),
        hasMore: posts.length > PAGE_SIZE
      })
    }).catch(function () {
    }).finally(() => {
      this.setData({ loading: false })
    })
  },

  onReachBottom() {
    const all = this.allPosts || []
    const current = this.data.posts.length
    if (current >= all.length) {
      if (this.data.hasMore) {
        this.setData({ hasMore: false })
      }
      return
    }
    const end = Math.min(current + PAGE_SIZE, all.length)
    const patch = { hasMore: end < all.length }
    for (let i = current; i < end; i += 1) {
      patch['posts[' + i + ']'] = all[i]
    }
    this.setData(patch)
  },

  openDetail(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({
      url: '/pages/posts/detail/index?id=' + id
    })
  },

  goPublish() {
    if (!auth.requireVerified()) {
      return
    }
    wx.switchTab({
      url: '/pages/posts/publish/index'
    })
  },

  goLogin() {
    auth.goLogin()
  }
})
