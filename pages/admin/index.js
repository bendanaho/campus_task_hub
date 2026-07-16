const auth = require('../../utils/auth')
const adminService = require('../../services/admin')
const format = require('../../utils/format')
const confirmUtil = require('../../utils/confirm')
const constants = require('../../utils/constants')

const DECISIONS = [
  { label: '全额退款给付款方', value: 'refund' },
  { label: '全额结算给收款方', value: 'settle' },
  { label: '部分结算给收款方', value: 'partial' }
]

// 帖子管理本地状态筛选：已下架取「非 open」以兼容 closed/deleted 等各种下架态
const POST_STATUS_FILTERS = [
  { label: '全部', value: 'all' },
  { label: '在架', value: 'open' },
  { label: '已下架', value: 'off' }
]

const POST_STATUS_TEXT = {
  open: '在架',
  closed: '已下架',
  deleted: '已删除'
}

const CATEGORY_TEXT = {}
constants.categoryOptions.forEach(function (c) {
  CATEGORY_TEXT[c.value] = c.label
})

function decoratePost(item) {
  const rewardNum = Number(item.rewardValue != null ? item.rewardValue : item.reward)
  return {
    id: item.id,
    title: item.title || '未命名帖子',
    status: item.status,
    statusText: POST_STATUS_TEXT[item.status] || item.status || '未知',
    publisherName: item.publisherName || '匿名用户',
    sideText: format.sideLabel(item.publisherSide),
    categoryText: CATEGORY_TEXT[item.category] || item.category || '其他',
    hasPrice: rewardNum > 0,
    moneyText: format.formatMoney(rewardNum),
    priceAlt: item.publisherSide === 'none' ? '免费互助' : (item.reward || '面议')
  }
}

Page({
  data: {
    tabIndex: 0,
    tabs: ['争议仲裁', '举报处理', '帖子管理'],
    disputes: [],
    reports: [],
    posts: [],
    postStatuses: POST_STATUS_FILTERS,
    postStatusIndex: 0,
    postKeyword: '',
    loading: true
  },

  onShow() {
    const user = auth.getUser()
    if (!user || user.role !== 1) {
      wx.showToast({ title: '仅管理员可访问', icon: 'none' })
      setTimeout(function () { wx.navigateBack() }, 600)
      return
    }
    this.loadData()
  },

  onPullDownRefresh() {
    this.loadData().finally(function () {
      wx.stopPullDownRefresh()
    })
  },

  onTabTap(e) {
    this.setData({ tabIndex: Number(e.currentTarget.dataset.index) })
  },

  loadData() {
    this.setData({ loading: true })
    return Promise.all([
      adminService.listDisputes().catch(function () { return [] }),
      adminService.listReports().catch(function () { return [] }),
      adminService.listAllPosts().catch(function () { return [] })
    ]).then((res) => {
      const disputes = (res[0] || []).map(function (item) {
        const order = item.order || {}
        return {
          id: order.id,
          postTitle: item.postTitle || '未知帖子',
          amountText: format.formatMoney(order.amount),
          payerName: item.payerName || '付款方',
          earnerName: item.earnerName || '收款方',
          disputedByName: item.disputedByName || '',
          disputeReason: order.disputeReason || '（未填写理由）',
          timeText: format.formatTime(order.disputedAt || order.createdAt)
        }
      })
      const reports = (res[1] || []).map(function (item) {
        const post = item.post || {}
        return {
          postId: post.id,
          title: post.title || '未知帖子',
          status: post.status,
          statusText: post.status === 'open' ? '在架' : '已下架',
          publisherName: post.publisherName || '',
          reportCount: item.reportCount || 0,
          reasons: (item.reasons || []).map(function (r) {
            return {
              reporterName: r.reporterName || '用户',
              reason: r.reason || '',
              timeText: format.formatTime(r.createdAt)
            }
          })
        }
      })
      // 契约为 List<PostDTO>；仍兼容后端偶发返回分页对象 {list} 的情况，避免整页 then 抛错
      const rawPosts = Array.isArray(res[2]) ? res[2] : ((res[2] && res[2].list) || [])
      this.allPosts = rawPosts.map(decoratePost)
      this.setData({ disputes: disputes, reports: reports })
      this.applyPostFilter()
    }).finally(() => {
      this.setData({ loading: false })
    })
  },

  // ---- 帖子管理（本地关键词/状态筛选，下架/删除复用举报标签的 service）----
  applyPostFilter() {
    const all = this.allPosts || []
    const statusVal = this.data.postStatuses[this.data.postStatusIndex].value
    const kw = (this.data.postKeyword || '').trim().toLowerCase()
    let list = all
    if (statusVal === 'open') {
      list = list.filter(function (p) { return p.status === 'open' })
    } else if (statusVal !== 'all') {
      list = list.filter(function (p) { return p.status !== 'open' })
    }
    if (kw) {
      list = list.filter(function (p) {
        return (p.title && p.title.toLowerCase().indexOf(kw) !== -1) ||
          (p.publisherName && p.publisherName.toLowerCase().indexOf(kw) !== -1)
      })
    }
    this.setData({ posts: list })
  },

  onPostKeyword(e) {
    this.setData({ postKeyword: e.detail.value })
    this.applyPostFilter()
  },

  onPostKeywordClear() {
    if (!this.data.postKeyword) return
    this.setData({ postKeyword: '' })
    this.applyPostFilter()
  },

  onPostStatusTap(e) {
    const index = Number(e.currentTarget.dataset.index)
    if (index === this.data.postStatusIndex) return
    this.setData({ postStatusIndex: index })
    this.applyPostFilter()
  },

  // ---- 争议仲裁 ----
  resolve(e) {
    const id = e.currentTarget.dataset.id
    const dispute = this.data.disputes.find(function (d) { return d.id === id })
    if (!dispute) return
    wx.showActionSheet({
      itemList: DECISIONS.map(function (d) { return d.label }),
      success: (res) => {
        const decision = DECISIONS[res.tapIndex]
        if (decision.value === 'partial') {
          this.askAmount(dispute, decision)
        } else {
          this.askNote(dispute, decision, null)
        }
      }
    })
  },

  askAmount(dispute, decision) {
    wx.showModal({
      title: '部分结算',
      editable: true,
      placeholderText: '结算给收款方的金额（0 ~ ' + dispute.amountText + '）',
      success: (res) => {
        if (!res.confirm) return
        const amount = Number((res.content || '').trim())
        if (!(amount >= 0) || amount > Number(dispute.amountText)) {
          wx.showToast({ title: '金额需在 0 ~ ' + dispute.amountText + ' 之间', icon: 'none' })
          return
        }
        this.askNote(dispute, decision, amount)
      }
    })
  },

  askNote(dispute, decision, amount) {
    wx.showModal({
      title: decision.label,
      editable: true,
      placeholderText: '处理说明（必填，双方可见）',
      confirmText: '提交裁决',
      success: (res) => {
        if (!res.confirm) return
        const note = (res.content || '').trim()
        if (!note) {
          wx.showToast({ title: '请填写处理说明', icon: 'none' })
          return
        }
        const payload = { decision: decision.value, note: note }
        if (amount !== null) {
          payload.amountToEarner = amount
        }
        adminService.resolveDispute(dispute.id, payload).then(() => {
          wx.showToast({ title: '已裁决', icon: 'success' })
          this.loadData()
        }).catch(function () {
        })
      }
    })
  },

  // ---- 举报处理 ----
  takedown(e) {
    const postId = e.currentTarget.dataset.id
    wx.showModal({
      title: '下架帖子',
      editable: true,
      placeholderText: '下架原因（发布者会收到通知）',
      confirmText: '下架',
      success: (res) => {
        if (!res.confirm) return
        adminService.closePost(postId, (res.content || '').trim()).then(() => {
          wx.showToast({ title: '已下架', icon: 'success' })
          this.loadData()
        }).catch(function () {
        })
      }
    })
  },

  removePost(e) {
    const postId = e.currentTarget.dataset.id
    confirmUtil.confirm({
      title: '删除帖子',
      content: '删除后帖子对所有人不可见（软删除），确定？'
    }).then((ok) => {
      if (!ok) return
      wx.showModal({
        title: '删除原因',
        editable: true,
        placeholderText: '删除原因（发布者会收到通知）',
        confirmText: '删除',
        success: (res) => {
          if (!res.confirm) return
          adminService.deletePost(postId, (res.content || '').trim()).then(() => {
            wx.showToast({ title: '已删除', icon: 'success' })
            this.loadData()
          }).catch(function () {
          })
        }
      })
    })
  },

  openPost(e) {
    wx.navigateTo({ url: '/pages/posts/detail/index?id=' + e.currentTarget.dataset.id })
  }
})
