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
    sheetShow: false,
    tempMap: {},
    tempCount: 0,
    selMap: {},
    selectedCount: 0,
    sides: constants.sideOptions,
    sorts: constants.sortOptions,
    categories: constants.categoryOptions,
    posts: [],
    hasMore: false,
    loading: false,
    loggedIn: false,
    collapsed: false
  },

  onPageScroll(e) {
    // 收起/展开用两个错开的阈值（迟滞），避免高度变化把 scrollTop 推回阈值附近来回抖
    const t = e.scrollTop
    if (!this.data.collapsed && t > 100) {
      this.setData({ collapsed: true })
    } else if (this.data.collapsed && t < 20) {
      this.setData({ collapsed: false })
    }
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

  // chips 行是单选：点中即只筛该分类，再点一次取消回到全部；多选走「﹀」面板
  toggleCat(e) {
    const value = e.currentTarget.dataset.value
    const cats = this.selectedCats || []
    if (cats.length === 1 && cats[0] === value) {
      this.commitCats([])
    } else {
      this.commitCats([value])
    }
  },

  clearCats() {
    if (!(this.selectedCats || []).length) {
      return
    }
    this.commitCats([])
  },

  commitCats(cats) {
    this.selectedCats = cats
    const selMap = {}
    cats.forEach(function (v) { selMap[v] = true })
    this.setData({ selMap: selMap, selectedCount: cats.length })
    this.loadPosts()
  },

  openFilter() {
    const tempMap = {}
    ;(this.selectedCats || []).forEach(function (v) {
      tempMap[v] = true
    })
    this.setData({
      sheetShow: true,
      tempMap: tempMap,
      tempCount: (this.selectedCats || []).length
    })
  },

  closeFilter() {
    this.setData({ sheetShow: false })
  },

  toggleTempCat(e) {
    const value = e.currentTarget.dataset.value
    const map = Object.assign({}, this.data.tempMap)
    if (map[value]) {
      delete map[value]
    } else {
      map[value] = true
    }
    this.setData({ tempMap: map, tempCount: Object.keys(map).length })
  },

  resetTemp() {
    this.setData({ tempMap: {}, tempCount: 0 })
  },

  applyFilter() {
    this.setData({ sheetShow: false })
    this.commitCats(Object.keys(this.data.tempMap))
  },

  onSortChange(e) {
    this.setData({ sortIndex: Number(e.detail.value) })
    this.loadPosts()
  },

  onSearch() {
    this.loadPosts()
  },

  buildQuery(page) {
    return {
      side: this.data.sides[this.data.sideIndex].value,
      sort: this.data.sorts[this.data.sortIndex].value,
      categories: (this.selectedCats || []).join(','),
      keyword: this.data.keyword,
      page: page,
      size: PAGE_SIZE
    }
  },

  decorateList(list) {
    // setData 单次上限 1MB：缩略图只保留网络地址或小图，且累计不超过预算；
    // 新版后端 images 为 [{full, thumb}]，旧版为字符串数组，两种都兼容
    let thumbBudget = 600 * 1024
    return (list || []).map(function (item) {
      const hasPrice = Number(item.rewardValue) > 0
      const first = (item.images && item.images.length) ? item.images[0] : ''
      const thumbSrc = !first ? '' : (typeof first === 'string' ? first : (first.thumb || first.full || ''))
      let thumb = ''
      if (thumbSrc) {
        if (thumbSrc.indexOf('data:') !== 0) {
          thumb = thumbSrc
        } else if (thumbSrc.length <= 150 * 1024 && thumbBudget >= thumbSrc.length) {
          thumb = thumbSrc
          thumbBudget -= thumbSrc.length
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
  },

  loadPosts() {
    this.pageNum = 0
    this.setData({ loading: true })
    return postService.list(this.buildQuery(0)).then((res) => {
      // 新版后端返回分页对象 {list, hasMore}；兼容旧版直接返回数组
      const isPaged = res && !Array.isArray(res)
      const posts = this.decorateList(isPaged ? res.list : res)
      this.setData({
        posts: posts,
        hasMore: isPaged ? !!res.hasMore : false
      })
    }).catch(function () {
    }).finally(() => {
      this.setData({ loading: false })
    })
  },

  onReachBottom() {
    if (this.loadingMore || !this.data.hasMore) {
      return
    }
    this.loadingMore = true
    const next = (this.pageNum || 0) + 1
    postService.list(this.buildQuery(next)).then((res) => {
      const data = (res && !Array.isArray(res)) ? res : { list: [], hasMore: false }
      const items = this.decorateList(data.list)
      this.pageNum = next
      const start = this.data.posts.length
      const patch = { hasMore: !!data.hasMore }
      items.forEach(function (item, i) {
        patch['posts[' + (start + i) + ']'] = item
      })
      this.setData(patch)
    }).catch(function () {
    }).finally(() => {
      this.loadingMore = false
    })
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
