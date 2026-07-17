const auth = require('../../../utils/auth')
const orderService = require('../../../services/orders')
const postService = require('../../../services/posts')
const reviewService = require('../../../services/reviews')
const format = require('../../../utils/format')
const confirmUtil = require('../../../utils/confirm')
const badge = require('../../../utils/badge')
const history = require('../../../utils/history')

const HIST_KEY = 'orders'
const HIDDEN_KEY = 'campus_hidden_orders'
const DRAFT_KEY = 'campus_pub_draft'
const FINISHED = ['completed', 'cancelled', 'closed']

const SIDE_CLASS = {
  payer: 'orange',
  earner: '',
  none: 'green'
}

// 三大主标签下的二级筛选 chip
const SUB_TABS = {
  published: [
    { label: '在卖', value: 'onsale' },
    { label: '草稿', value: 'draft' },
    { label: '已下架', value: 'offline' }
  ],
  sold: [
    { label: '全部', value: 'all' },
    { label: '待接受', value: 'pending' },
    { label: '待评价', value: 'toreview' },
    { label: '退款中', value: 'refunding' }
  ],
  bought: [
    { label: '全部', value: 'all' },
    { label: '待接受', value: 'pending' },
    { label: '待评价', value: 'toreview' },
    { label: '退款中', value: 'refunding' }
  ]
}

const SORTS = [
  { label: '最新优先', value: 'time_desc' },
  { label: '最早优先', value: 'time_asc' },
  { label: '金额从高到低', value: 'amount_desc' },
  { label: '金额从低到高', value: 'amount_asc' }
]

// 时间区间：value 为天数，0 表示不限
const TIME_RANGES = [
  { label: '全部', value: 0 },
  { label: '近7天', value: 7 },
  { label: '近30天', value: 30 },
  { label: '近90天', value: 90 }
]

const DAY_MS = 24 * 60 * 60 * 1000

// 仲裁结果文案
function resolutionLabel(order) {
  const map = {
    refund: '仲裁结果：全额退款给付款方',
    settle: '仲裁结果：全额结算给收款方',
    partial: '仲裁结果：部分结算 ¥' + format.formatMoney(order.resolutionAmountToEarner) + ' 给收款方'
  }
  const base = map[order.resolution] || '订单已结案'
  return order.resolutionNote ? base + '（' + order.resolutionNote + '）' : base
}

// 二级筛选判断：待付款=pending / 待评价=completed 且未评价 / 退款中=disputed / 全部=不限
function matchOrderSub(o, sub) {
  const s = o.order.status
  if (sub === 'pending') return s === 'pending'
  if (sub === 'toreview') return s === 'completed' && !o.reviewed
  if (sub === 'refunding') return s === 'disputed'
  return true
}

// 按标题/对方昵称关键词匹配
function matchKeyword(title, partner, kw) {
  return (title && String(title).toLowerCase().indexOf(kw) !== -1) ||
    (partner && String(partner).toLowerCase().indexOf(kw) !== -1)
}

// 时间区间过滤：无有效时间或不限时一律保留
function withinRange(value, days) {
  if (!days || !value) return true
  const d = new Date(String(value).replace(' ', 'T'))
  if (isNaN(d.getTime())) return true
  return Date.now() - d.getTime() <= days * DAY_MS
}

function sortList(list, sort, getTime, getAmount) {
  return list.slice().sort(function (a, b) {
    if (sort === 'amount_desc') return getAmount(b) - getAmount(a)
    if (sort === 'amount_asc') return getAmount(a) - getAmount(b)
    const ta = String(getTime(a) || '')
    const tb = String(getTime(b) || '')
    return sort === 'time_asc' ? (ta < tb ? -1 : 1) : (ta > tb ? -1 : 1)
  })
}

// 草稿的相对编辑时间（draft.ts 为毫秒时间戳）
function draftAgeText(ts) {
  if (!ts) return ''
  const diff = Date.now() - Number(ts)
  if (diff < 60 * 1000) return '刚刚'
  if (diff < 60 * 60 * 1000) return Math.floor(diff / (60 * 1000)) + ' 分钟前'
  if (diff < DAY_MS) return Math.floor(diff / (60 * 60 * 1000)) + ' 小时前'
  return Math.floor(diff / DAY_MS) + ' 天前'
}

// 各主标签 / 二级筛选下的空态文案
function buildEmpty(main, sub, showHidden) {
  if (main === 'published') {
    if (sub === 'offline') return { emoji: '📦', title: '没有已下架的任务', sub: '撤回或已结束的任务会归档到这里', btn: '' }
    if (sub === 'draft') return { emoji: '📝', title: '暂无草稿', sub: '编辑发布内容时会自动为你保存草稿', btn: '去发布' }
    return { emoji: '🏷️', title: '还没有在卖的任务', sub: '发布一条互助或悬赏，让同学来接单', btn: '去发布' }
  }
  if (showHidden) {
    return { emoji: '🗂️', title: '没有已隐藏的订单', sub: '被你移除的订单会出现在这里', btn: '' }
  }
  if (sub === 'pending') return { emoji: '💰', title: '没有待接受的订单', sub: '', btn: '' }
  if (sub === 'toreview') return { emoji: '⭐', title: '没有待评价的订单', sub: '', btn: '' }
  if (sub === 'refunding') return { emoji: '🛡️', title: '没有退款中的订单', sub: '', btn: '' }
  return { emoji: '📋', title: main === 'sold' ? '还没有卖出的订单' : '还没有买到的订单', sub: '去大厅逛逛，接单或发布需求', btn: '去大厅' }
}

Page({
  data: {
    mainTabs: [
      { label: '我发布的', value: 'published', icon: '📋' },
      { label: '我卖出的', value: 'sold', icon: '💰' },
      { label: '我买到的', value: 'bought', icon: '🛒' }
    ],
    mainIndex: 0,
    curMain: 'published',
    // 当前主标签的二级筛选 chip 与选中项
    subTabs: SUB_TABS.published,
    subIndex: 0,
    curSub: 'onsale',
    // 订单标签（我卖出的/我买到的）数据
    orders: [],
    // 我发布的数据 + 草稿卡
    posts: [],
    draftCard: null,
    // 搜索（三个标签通用）
    keyword: '',
    searchFocus: false,
    searchHistory: [],
    // 筛选面板：时间区间 + 排序
    sorts: SORTS,
    sortIndex: 0,
    timeRanges: TIME_RANGES,
    timeRangeIndex: 0,
    filterPanelOpen: false,
    filterActive: false,
    // 空态文案
    empty: { emoji: '📋', title: '暂无内容', sub: '下拉刷新试试', btn: '' },
    loading: true,
    postsLoading: true,
    loggedIn: false,
    // 本地隐藏订单（仅订单标签可见入口）
    showHidden: false,
    roleHiddenCount: 0
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 3 })
    }
    badge.refreshUnread(this)
    this.setData({ loggedIn: auth.isLoggedIn() })
    if (auth.isLoggedIn()) {
      this.loadOrders()
      this.loadPosts()
    }
  },

  onPullDownRefresh() {
    if (!this.data.loggedIn) {
      wx.stopPullDownRefresh()
      return
    }
    Promise.all([this.loadOrders(), this.loadPosts()]).then(function () {
      wx.stopPullDownRefresh()
    })
  },

  // 依当前主标签渲染对应视图（发布=帖子，卖出/买到=订单）
  render() {
    if (this.data.curMain === 'published') {
      this.applyPosts()
    } else {
      this.applyOrders()
    }
  },

  // 切换主标签：重置二级筛选到默认、退出隐藏视图、收起筛选面板
  switchMain(e) {
    const idx = Number(e.currentTarget.dataset.index)
    if (idx === this.data.mainIndex) {
      return
    }
    const main = this.data.mainTabs[idx].value
    const subs = SUB_TABS[main]
    this.setData({
      mainIndex: idx,
      curMain: main,
      subTabs: subs,
      subIndex: 0,
      curSub: subs[0].value,
      showHidden: false,
      filterPanelOpen: false
    })
    this.render()
  },

  // 切换二级筛选 chip
  switchSub(e) {
    const idx = Number(e.currentTarget.dataset.index)
    if (idx === this.data.subIndex) {
      return
    }
    this.setData({ subIndex: idx, curSub: this.data.subTabs[idx].value })
    this.render()
  },

  loadOrders() {
    const user = auth.getUser()
    this.setData({ loading: true })
    return orderService.mine('').then((list) => {
      const currentId = user ? String(user.id) : ''
      const hidden = wx.getStorageSync(HIDDEN_KEY) || {}
      const orders = (list || []).map(function (item) {
        const order = item.order || {}
        const post = item.post || {}
        const isPublisher = post.publisherId && String(post.publisherId) === currentId
        const isPayer = order.payerId && String(order.payerId) === currentId
        const isEarner = order.earnerId && String(order.earnerId) === currentId
        const partnerId = item.partnerId
        const partnerName = item.partnerName || '对方'
        const isHidden = !!(order.id && hidden[order.id])

        return Object.assign({}, item, {
          id: order.id,
          order: Object.assign({}, order, {
            statusText: format.orderStatusLabel(order.status),
            amountText: format.formatMoney(order.amount),
            createdText: format.formatTime(order.createdAt)
          }),
          post: post,
          roleText: item.myRole === 'payer' ? '我付款' : '我收款',
          canAccept: order.status === 'pending' && isPublisher,
          canCancel: order.status === 'pending',
          canConfirm: order.status === 'in_progress' && ((isPayer && !order.payerConfirmed) || (isEarner && !order.earnerConfirmed)),
          canReview: order.status === 'completed',
          // 新版后端 /orders/mine 随行返回 reviewed（批量算好），直接采用
          reviewed: item.reviewed === true,
          canDelete: true,
          isHidden: isHidden,
          isFinished: FINISHED.indexOf(order.status) > -1,
          canDispute: order.status === 'in_progress',
          disputeText: order.status === 'disputed' && order.disputeReason
            ? '申诉理由：' + order.disputeReason
            : (order.status === 'closed' ? resolutionLabel(order) : ''),
          waitingText: order.status === 'in_progress' && ((isPayer && order.payerConfirmed) || (isEarner && order.earnerConfirmed))
            ? '你已确认完成，等待对方确认后结算（超时自动结算），之后可评价'
            : (order.status === 'in_progress' && ((isPayer && order.earnerConfirmed) || (isEarner && order.payerConfirmed))
              ? '对方已确认完成，请你确认'
              : ''),
          partnerId: partnerId,
          partnerName: partnerName
        })
      })
      // 全量存实例属性，角色分桶/二级筛选/搜索/排序在前端做（该接口无对应参数）
      this.allOrders = orders
      this.render()
      // 旧后端不返回 reviewed 字段时才退回逐单查询（新后端已随行返回，省 N 次请求）
      const missingReviewed = (list || []).length > 0
        && !Object.prototype.hasOwnProperty.call(list[0] || {}, 'reviewed')
      if (missingReviewed) {
        this.loadReviewFlags(orders)
      }
    }).catch(function () {
    }).finally(() => {
      this.setData({ loading: false })
    })
  },

  // 拉取我发布的帖子
  loadPosts() {
    this.setData({ postsLoading: true })
    return postService.mine().then((list) => {
      const posts = (list || []).map(function (item) {
        return {
          id: item.id,
          title: item.title,
          description: item.description || '',
          rewardValue: item.rewardValue,
          publisherSide: item.publisherSide,
          status: item.status,
          isOpen: item.status === 'open',
          statusText: item.status === 'open' ? '在卖' : '已下架',
          sideText: format.sideLabel(item.publisherSide),
          sideClass: SIDE_CLASS[item.publisherSide] || '',
          hasPrice: Number(item.rewardValue) > 0,
          moneyText: format.formatMoney(item.rewardValue),
          priceAlt: item.publisherSide === 'none' ? '免费互助' : '面议',
          publishTime: item.publishTime,
          timeText: format.relativeTime(item.publishTime)
        }
      })
      this.allPosts = posts
      this.render()
    }).catch(function () {
    }).finally(() => {
      this.setData({ postsLoading: false })
    })
  },

  // 对已完成订单并发查是否已评价；失败按未评价处理（按钮可点）
  loadReviewFlags(orders) {
    const targets = (orders || []).filter(function (o) {
      return o.canReview && o.order && o.order.id
    })
    if (!targets.length) {
      return
    }
    const tasks = targets.map(function (o) {
      return reviewService.hasReviewed(o.order.id).then(function (data) {
        return { id: o.order.id, reviewed: !!(data && data.hasReviewed) }
      }).catch(function () {
        return { id: o.order.id, reviewed: false }
      })
    })
    Promise.all(tasks).then((results) => {
      const map = {}
      results.forEach(function (r) { map[r.id] = r.reviewed })
      const all = (this.allOrders || []).map(function (o) {
        if (o.order && map.hasOwnProperty(o.order.id)) {
          return Object.assign({}, o, { reviewed: map[o.order.id] })
        }
        return o
      })
      this.allOrders = all
      this.render()
    })
  },

  // 我卖出的（earner）/ 我买到的（payer）视图：角色 + 二级筛选 + 隐藏 + 搜索 + 时间区间 + 排序
  applyOrders() {
    const role = this.data.curMain === 'sold' ? 'earner' : 'payer'
    const all = this.allOrders || []
    let roleHidden = 0
    all.forEach(function (o) {
      if (o.myRole === role && o.isHidden) {
        roleHidden += 1
      }
    })
    // 隐藏订单清空时自动退回正常视图
    const showHidden = this.data.showHidden && roleHidden > 0
    const sub = this.data.subTabs[this.data.subIndex].value
    const kw = (this.data.keyword || '').trim().toLowerCase()
    const days = this.data.timeRanges[this.data.timeRangeIndex].value

    let orders = all.filter(function (o) {
      if (o.myRole !== role) return false
      // 隐藏视图：只按角色列出全部已隐藏订单，不再叠加二级/搜索/时间筛选，
      // 保证「显示已隐藏(N)」的 N 与可见行数一致、每条都能被恢复
      if (showHidden) return o.isHidden
      if (o.isHidden) return false
      if (!matchOrderSub(o, sub)) return false
      if (kw && !matchKeyword(o.title, o.partnerName, kw)) return false
      return withinRange(o.order.createdAt, days)
    })
    orders = sortList(orders, this.data.sorts[this.data.sortIndex].value,
      function (o) { return o.order.createdAt },
      function (o) { return Number(o.order.amount || 0) })

    this.setData({
      orders: orders,
      roleHiddenCount: roleHidden,
      showHidden: showHidden,
      empty: buildEmpty(this.data.curMain, sub, showHidden)
    })
  },

  // 我发布的视图：在卖 / 草稿 / 已下架
  applyPosts() {
    const sub = this.data.subTabs[this.data.subIndex].value
    if (sub === 'draft') {
      const draft = wx.getStorageSync(DRAFT_KEY)
      const has = !!(draft && draft.ts)
      this.setData({
        posts: [],
        draftCard: has ? {
          title: (draft.title || '').trim() || '未命名草稿',
          desc: draft.description || '',
          timeText: draftAgeText(draft.ts)
        } : null,
        empty: buildEmpty('published', 'draft', false)
      })
      return
    }
    const kw = (this.data.keyword || '').trim().toLowerCase()
    const days = this.data.timeRanges[this.data.timeRangeIndex].value
    let posts = (this.allPosts || []).filter(function (p) {
      const stateOk = sub === 'onsale' ? p.isOpen : !p.isOpen
      if (!stateOk) return false
      if (kw && !(p.title && String(p.title).toLowerCase().indexOf(kw) !== -1)) return false
      return withinRange(p.publishTime, days)
    })
    posts = sortList(posts, this.data.sorts[this.data.sortIndex].value,
      function (p) { return p.publishTime },
      function (p) { return Number(p.rewardValue || 0) })

    this.setData({
      posts: posts,
      draftCard: null,
      empty: buildEmpty('published', sub, false)
    })
  },

  // ---- 搜索 ----
  onSearchInput(e) {
    this.setData({ keyword: e.detail.value })
    this.render()
  },

  onSearchConfirm() {
    if (this.data.keyword.trim()) {
      this.setData({ searchHistory: history.push(HIST_KEY, this.data.keyword) })
    }
  },

  onHistTap(e) {
    this.setData({ keyword: e.currentTarget.dataset.term, searchFocus: false })
    this.render()
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

  // ---- 筛选面板：时间区间 + 排序 ----
  toggleFilter() {
    this.setData({ filterPanelOpen: !this.data.filterPanelOpen })
  },

  onTimeRange(e) {
    const idx = Number(e.currentTarget.dataset.index)
    this.setData({ timeRangeIndex: idx, filterActive: idx !== 0 || this.data.sortIndex !== 0 })
    this.render()
  },

  onSortPick(e) {
    const idx = Number(e.currentTarget.dataset.index)
    this.setData({ sortIndex: idx, filterActive: this.data.timeRangeIndex !== 0 || idx !== 0 })
    this.render()
  },

  // ---- 我发布的：撤回 / 草稿 ----
  // 撤回我发布、尚待响应的帖子：二次确认后调 closePost，成功即从列表移除
  withdrawPost(e) {
    const id = e.currentTarget.dataset.id
    confirmUtil.confirm({
      title: '撤回帖子',
      content: '撤回后大厅将不再展示该任务，冻结的悬赏报酬会退回到你的余额。确认撤回？'
    }).then((ok) => {
      if (!ok) return
      postService.closePost(id).then(() => {
        const rest = (this.allPosts || []).filter(function (p) { return p.id !== id })
        this.allPosts = rest
        this.render()
        wx.showToast({ title: '已撤回，冻结报酬已退回', icon: 'none' })
      }).catch(function () {
      })
    })
  },

  // 继续编辑草稿：发布页是 tabBar 页，只能 switchTab（navigateTo 无法打开 tabBar 页），
  // 发布页 onShow 会自动 restoreDraft 回填草稿内容
  editDraft() {
    wx.switchTab({ url: '/pages/posts/publish/index' })
  },

  openPost(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: '/pages/posts/detail/index?id=' + id })
  },

  // ---- 订单操作（沿用原全部订单能力）----
  // 申诉进行中的订单，理由必填，提交后订单进入仲裁流程并冻结资金
  disputeOrder(e) {
    const id = e.currentTarget.dataset.id
    wx.showModal({
      title: '订单申诉',
      editable: true,
      placeholderText: '请填写申诉理由（必填）',
      confirmText: '提交申诉',
      success: (res) => {
        if (!res.confirm) return
        const reason = (res.content || '').trim()
        if (!reason) {
          wx.showToast({ title: '请填写申诉理由', icon: 'none' })
          return
        }
        orderService.dispute(id, reason).then(() => {
          wx.showToast({ title: '已提交申诉，等待平台仲裁', icon: 'none' })
          this.loadOrders()
        }).catch(function () {
        })
      }
    })
  },

  // 任意订单可从列表移除（仅本地隐藏，不影响订单本身与后台记录）
  deleteOrder(e) {
    const id = e.currentTarget.dataset.id
    const item = (this.allOrders || []).find(function (o) { return o.order && o.order.id === id })
    const active = item && !item.isFinished
    confirmUtil.confirm({
      title: '删除记录',
      content: active
        ? '该订单仍在进行中：移除只影响你的列表显示，订单会照常进行与结算。确定移除？'
        : '仅从你的订单列表移除，不影响对方和平台记录'
    }).then((ok) => {
      if (!ok) return
      const hidden = wx.getStorageSync(HIDDEN_KEY) || {}
      hidden[id] = true
      wx.setStorageSync(HIDDEN_KEY, hidden)
      this.loadOrders()
    })
  },

  // 在「正常列表 / 已隐藏」两个视图间切换，给被隐藏订单一个恢复入口
  toggleHidden() {
    if (!this.data.showHidden && this.data.roleHiddenCount === 0) {
      return
    }
    this.setData({ showHidden: !this.data.showHidden })
    this.applyOrders()
  },

  // 把订单从本地隐藏名单移除，重新回到列表
  restoreOrder(e) {
    const id = e.currentTarget.dataset.id
    const hidden = wx.getStorageSync(HIDDEN_KEY) || {}
    delete hidden[id]
    wx.setStorageSync(HIDDEN_KEY, hidden)
    this.loadOrders()
  },

  goLogin() {
    auth.goLogin()
  },

  goHall() {
    wx.switchTab({ url: '/pages/posts/list/index' })
  },

  goPublish() {
    wx.switchTab({ url: '/pages/posts/publish/index' })
  },

  goDetail(e) {
    const chatId = e.currentTarget.dataset.chat
    if (!chatId) return
    wx.navigateTo({
      url: '/pages/orders/detail/index?chatId=' + encodeURIComponent(chatId)
    })
  },

  acceptOrder(e) {
    const id = e.currentTarget.dataset.id
    confirmUtil.confirm({
      title: '接受订单',
      content: '接受后金额将从付款方余额冻结，确认接受该订单？'
    }).then((ok) => {
      if (!ok) return
      orderService.accept(id).then(() => {
        wx.showToast({ title: '已接受', icon: 'success' })
        this.loadOrders()
      }).catch(function () {
      })
    })
  },

  cancelOrder(e) {
    const id = e.currentTarget.dataset.id
    confirmUtil.confirm({
      title: '取消订单',
      content: '确认取消该订单？'
    }).then((ok) => {
      if (!ok) return
      orderService.cancel(id).then(() => {
        wx.showToast({ title: '已取消', icon: 'success' })
        this.loadOrders()
      }).catch(function () {
      })
    })
  },

  confirmOrder(e) {
    const item = this.data.orders[Number(e.currentTarget.dataset.index)]
    if (!item) return
    confirmUtil.confirm({
      title: '确认完成',
      content: '确认对方已完成？双方均确认后订单将结算'
    }).then((ok) => {
      if (!ok) return
      orderService.confirm(item.order.id).then((order) => {
        if (order && order.status === 'completed') {
          wx.showToast({ title: '订单已完成', icon: 'success' })
        } else {
          wx.showToast({ title: '已确认，等待对方确认', icon: 'none' })
        }
        this.loadOrders()
        if (order && order.status === 'completed') {
          wx.showModal({
            title: '订单已完成',
            content: '去评价对方吧',
            confirmText: '去评价',
            success: function (res) {
              if (res.confirm) {
                if (!item.partnerId) {
                  wx.showToast({ title: '无法识别评价对象', icon: 'none' })
                  return
                }
                wx.navigateTo({
                  url: '/pages/reviews/create/index?orderId=' + item.order.id + '&toUserId=' + item.partnerId + '&toUserName=' + encodeURIComponent(item.partnerName)
                })
              }
            }
          })
        }
      }).catch(function () {
      })
    })
  },

  goChat(e) {
    const chatId = e.currentTarget.dataset.chat
    wx.navigateTo({
      url: '/pages/chat/room/index?chatId=' + encodeURIComponent(chatId)
    })
  },

  goReview(e) {
    const item = this.data.orders[Number(e.currentTarget.dataset.index)]
    if (!item) return
    if (item.reviewed) {
      wx.showToast({ title: '该订单已评价', icon: 'none' })
      return
    }
    if (!item.partnerId) {
      wx.showToast({ title: '无法识别评价对象', icon: 'none' })
      return
    }
    wx.navigateTo({
      url: '/pages/reviews/create/index?orderId=' + item.order.id + '&toUserId=' + item.partnerId + '&toUserName=' + encodeURIComponent(item.partnerName)
    })
  }
})
