const postService = require('../../../services/posts')
const auth = require('../../../utils/auth')
const badge = require('../../../utils/badge')
const constants = require('../../../utils/constants')
const format = require('../../../utils/format')
const socket = require('../../../utils/socket')
const history = require('../../../utils/history')
const upload = require('../../../utils/upload')

const HIST_KEY = 'posts'

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
    showOnboard: false,
    obIndex: 0,
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
    loadingMore: false,
    loggedIn: false,
    collapsed: false,
    hasNewPosts: false,
    searchFocus: false,
    searchHistory: []
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
    // 首次启动的 3 页新手引导（看过一次不再出现）
    try {
      if (!wx.getStorageSync('campus_onboard_v1')) {
        this.setData({ showOnboard: true })
      }
    } catch (e) {
    }
    let statusBarHeight = 20
    try {
      const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync()
      statusBarHeight = info.statusBarHeight || 20
    } catch (e) {
    }
    this.setData({ statusBarHeight: statusBarHeight })
    // 大厅是常驻 tab 页不销毁，WS 订阅一次即可：有新帖/有帖被接走时提示刷新
    const markStale = () => {
      if (!this.data.hasNewPosts) {
        this.setData({ hasNewPosts: true })
      }
    }
    socket.on('NEW_TASK', markStale)
    // 帖子被下架/撤回/删除时同样提示刷新（后端 85114d7 起广播 TASK_CLOSED）
    socket.on('TASK_CLOSED', markStale)
    socket.on('TASK_TAKEN', markStale)
    this.loadPosts()
  },

  refreshFromPill() {
    wx.pageScrollTo({ scrollTop: 0, duration: 200 })
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

  // 一键清除搜索词并回到全部列表（spec 修复13）
  onClearKeyword() {
    if (!this.data.keyword) {
      return
    }
    this.setData({ keyword: '' })
    this.reloadTop()
  },

  // 筛选/排序/搜索切换统一走这里：先回顶再加载，配合列表遮罩给出即时反馈（spec 修复7）
  reloadTop() {
    wx.pageScrollTo({ scrollTop: 0, duration: 150 })
    return this.loadPosts()
  },

  onSideTap(e) {
    const index = Number(e.currentTarget.dataset.index)
    if (index === this.data.sideIndex) {
      return
    }
    this.setData({ sideIndex: index })
    this.reloadTop()
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
    this.reloadTop()
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
    this.reloadTop()
  },

  onSearch() {
    if (this.data.keyword.trim()) {
      this.setData({ searchHistory: history.push(HIST_KEY, this.data.keyword) })
    }
    this.reloadTop()
  },

  onHistTap(e) {
    const term = e.currentTarget.dataset.term
    this.setData({ keyword: term, searchFocus: false })
    this.reloadTop()
  },

  onHistClear() {
    this.setData({ searchHistory: history.clear(HIST_KEY) })
  },

  onSearchFocus() {
    this.setData({ searchFocus: true, searchHistory: history.get(HIST_KEY) })
  },

  onSearchBlur() {
    setTimeout(() => {
      this.setData({ searchFocus: false })
    }, 200)
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
          // 新版后端图片为 /uploads/xxx 相对路径：补全域名（否则被当作包内路径加载失败），
          // 已预取过本地文件的直接用本地路径（真机 http/IP 直载受限）
          const full = upload.fullUrl(thumbSrc)
          thumb = upload.getCachedLocal(full) || full
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
        // 金额方向标：悬赏=接单方完成可得；服务=下单方需支付，消除"¥50 是我付还是我拿"歧义
        priceHint: hasPrice ? (item.publisherSide === 'payer' ? '完成可得' : (item.publisherSide === 'earner' ? '需支付' : '')) : '',
        avatarChar: item.publisherName ? item.publisherName.slice(0, 1) : '同',
        avatarColor: AVATAR_COLORS[(Number(item.publisherId) || 0) % AVATAR_COLORS.length],
        // 有上传头像(/uploads/xxx 相对路径或完整 URL)则显示真实头像，否则回退首字色块
        // 已预取过本地文件的头像直接用本地路径（真机 <image> 直载 http/IP 受限）
        avatarUrl: (item.publisherAvatar && String(item.publisherAvatar).indexOf('color:') !== 0)
          ? (upload.getCachedLocal(upload.fullUrl(item.publisherAvatar)) || upload.fullUrl(item.publisherAvatar))
          : '',
        creditText: Number(item.publisherCredit || 0).toFixed(1),
        thumb: thumb
      })
    })
  },

  loadPosts() {
    this.pageNum = 0
    this.setData({ loading: true, hasNewPosts: false })
    return postService.list(this.buildQuery(0)).then((res) => {
      // 新版后端返回分页对象 {list, hasMore}；兼容旧版直接返回数组
      const isPaged = res && !Array.isArray(res)
      const posts = this.decorateList(isPaged ? res.list : res)
      this.setData({
        posts: posts,
        hasMore: isPaged ? !!res.hasMore : false
      })
      this.prefetchAvatars(0)
    }).catch(function () {
    }).finally(() => {
      this.setData({ loading: false })
    })
  },

  // 把仍指向 http 远程地址的发布者头像/卡片缩略图转成本地文件后原位替换（真机可显示）。
  // toLocalFile 有完成缓存 + 去重，翻页/刷新反复调用无害。
  prefetchAvatars(startIndex) {
    const self = this
    const list = this.data.posts || []
    function fetchField(idx, item, field) {
      const url = item && item[field]
      if (!url || String(url).indexOf('http') !== 0) {
        return
      }
      upload.toLocalFile(url).then(function (path) {
        const cur = (self.data.posts || [])[idx]
        if (cur && cur.id === item.id) {
          self.setData({ ['posts[' + idx + '].' + field]: path })
        }
      }).catch(function () {})
    }
    for (let i = startIndex; i < list.length; i++) {
      fetchField(i, list[i], 'avatarUrl')
      fetchField(i, list[i], 'thumb')
    }
  },

  onReachBottom() {
    if (this.data.loadingMore || !this.data.hasMore) {
      return
    }
    // loadingMore 进 data 驱动 UI：仅真正上拉加载时底部才显示「加载中…」（spec 修复6）
    this.setData({ loadingMore: true })
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
      this.prefetchAvatars(start)
    }).catch(function () {
    }).finally(() => {
      this.setData({ loadingMore: false })
    })
  },

  openDetail(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({
      url: '/pages/posts/detail/index?id=' + id
    })
  },

  // 头像图加载失败(404/域名未配置等)：回退到该项的首字色块头像
  onAvatarError(e) {
    const idx = e.currentTarget.dataset.index
    if (idx === undefined || idx === null || idx === '') {
      return
    }
    const patch = {}
    patch['posts[' + idx + '].avatarUrl'] = ''
    this.setData(patch)
  },

  // ---- 新手引导 ----
  onObSwipe(e) {
    this.setData({ obIndex: (e.detail && e.detail.current) || 0 })
  },

  closeOnboard() {
    try {
      wx.setStorageSync('campus_onboard_v1', 1)
    } catch (e) {
    }
    this.setData({ showOnboard: false })
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
