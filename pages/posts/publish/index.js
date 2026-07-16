const postService = require('../../../services/posts')
const auth = require('../../../utils/auth')
const badge = require('../../../utils/badge')
const constants = require('../../../utils/constants')
const format = require('../../../utils/format')
const imageUtil = require('../../../utils/image')
const userService = require('../../../services/user')

const DRAFT_KEY = 'campus_pub_draft'

function pad2(n) {
  return n < 10 ? '0' + n : '' + n
}

// 计算截止时间默认值：18:00 若已早于当前时刻则顺延到「当前+2小时」的整点，
// 跨天时退到今天 23:59，避免当天发布时默认值直接被「需晚于当前时间」拦下
function computeDefaultTime(now) {
  const nowMin = now.getHours() * 60 + now.getMinutes()
  if (18 * 60 > nowMin) {
    return '18:00'
  }
  const target = new Date(now.getTime() + 2 * 60 * 60 * 1000)
  if (target.getDate() !== now.getDate()) {
    return '23:59'
  }
  return pad2(target.getHours()) + ':00'
}

const MAX_IMAGES = 3
const MAX_TITLE_LEN = 30
const MAX_DESC_LEN = 500
const MAX_REWARD = 100000
const REWARD_PATTERN = /^\d+(\.\d{1,2})?$/

Page({
  data: {
    loggedIn: false,
    verified: false,
    sideIndex: 0,
    categoryIndex: 0,
    sides: constants.publishSideOptions,
    categories: constants.categoryOptions,
    title: '',
    description: '',
    rewardValue: '',
    contact: '站内联系',
    serviceTime: '',
    date: '',
    time: '18:00',
    images: [],
    maxImages: MAX_IMAGES,
    submitting: false,
    todayDate: '',
    nowTime: '',
    balanceNum: null,
    balanceWarn: '',
    freezeHint: ''
  },

  onLoad() {
    this.setData({ date: format.todayDate(), todayDate: format.todayDate() })
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 2 })
    }
    badge.refreshUnread(this)
    const now = new Date()
    this.setData({
      loggedIn: auth.isLoggedIn(),
      verified: auth.isVerified(),
      todayDate: format.todayDate(),
      nowTime: pad2(now.getHours()) + ':' + pad2(now.getMinutes())
    })
    this.refreshDefaultTime()
    this.restoreDraft()
    this.loadBalanceForWarn()
  },

  // 用户未手动改动前，让截止时间默认值随当前时刻校正
  refreshDefaultTime() {
    if (this.userSetTime) {
      return
    }
    const t = computeDefaultTime(new Date())
    if (t !== this.data.time) {
      this.setData({ time: t })
    }
  },

  // ---- 草稿：填写内容防抖暂存，回来自动恢复；"再发一单"也走这里 ----
  restoreDraft() {
    const draft = wx.getStorageSync(DRAFT_KEY)
    if (!draft || !draft.ts || draft.ts === this.appliedTs) {
      return
    }
    this.appliedTs = draft.ts
    const sideIndex = Math.max(0, this.data.sides.findIndex(function (o) { return o.value === draft.sideValue }))
    const catIndex = Math.max(0, this.data.categories.findIndex(function (o) { return o.value === draft.categoryValue }))
    this.setData({
      title: draft.title || '',
      description: draft.description || '',
      rewardValue: draft.rewardValue || '',
      contact: draft.contact || '站内联系',
      serviceTime: draft.serviceTime || '',
      sideIndex: sideIndex,
      categoryIndex: catIndex
    })
    this.updateBalanceWarn()
    wx.showToast({
      title: draft.source === 'repost' ? '已带入该单内容' : '已恢复上次草稿',
      icon: 'none'
    })
  },

  scheduleDraftSave() {
    if (this.draftTimer) {
      clearTimeout(this.draftTimer)
    }
    this.draftTimer = setTimeout(() => {
      if (!this.data.title && !this.data.description) {
        return
      }
      const ts = Date.now()
      this.appliedTs = ts
      wx.setStorageSync(DRAFT_KEY, {
        source: 'auto',
        ts: ts,
        title: this.data.title,
        description: this.data.description,
        rewardValue: this.data.rewardValue,
        contact: this.data.contact,
        serviceTime: this.data.serviceTime,
        sideValue: this.data.sides[this.data.sideIndex].value,
        categoryValue: this.data.categories[this.data.categoryIndex].value
      })
    }, 500)
  },

  // ---- 悬赏余额预警 ----
  loadBalanceForWarn() {
    if (!auth.isLoggedIn()) {
      return
    }
    userService.getBalance().then((data) => {
      this.setData({ balanceNum: Number(data.balance || 0) })
      this.updateBalanceWarn()
    }).catch(function () {
    })
  },

  updateBalanceWarn() {
    const side = this.data.sides[this.data.sideIndex].value
    const value = Number(this.data.rewardValue || 0)
    const balance = this.data.balanceNum
    // 悬赏发布即冻结担保：常驻预览让新用户明白"为什么发求助要有余额"
    const isReward = side === 'payer' && value > 0
    const freezeHint = isReward
      ? '发布后将从余额冻结 ¥' + value.toFixed(2) + ' 作为担保，完成后支付给接单同学'
      : ''
    const warn = isReward && balance !== null && value > balance
      ? '可用余额 ¥' + balance.toFixed(2) + ' 不足，无法发布；余额为虚拟货币，充值不花真钱'
      : ''
    if (warn !== this.data.balanceWarn || freezeHint !== this.data.freezeHint) {
      this.setData({ balanceWarn: warn, freezeHint: freezeHint })
    }
  },

  goWallet() {
    wx.navigateTo({ url: '/pages/wallet/index/index' })
  },

  onInput(e) {
    const key = e.currentTarget.dataset.key
    this.setData({
      [key]: e.detail.value
    })
    if (key === 'rewardValue') {
      this.updateBalanceWarn()
    }
    this.scheduleDraftSave()
  },

  onSideChange(e) {
    this.setData({ sideIndex: Number(e.detail.value) })
    this.updateBalanceWarn()
    this.scheduleDraftSave()
  },

  onCategoryChange(e) {
    this.setData({ categoryIndex: Number(e.detail.value) })
    this.scheduleDraftSave()
  },

  onDateChange(e) {
    this.setData({ date: e.detail.value })
    this.scheduleDraftSave()
  },

  onTimeChange(e) {
    this.userSetTime = true
    this.setData({ time: e.detail.value })
    this.scheduleDraftSave()
  },

  goLogin() {
    auth.goLogin()
  },

  goVerify() {
    wx.navigateTo({ url: '/pages/user/verify/index' })
  },

  addImage() {
    const remain = MAX_IMAGES - this.data.images.length
    if (remain <= 0) {
      return
    }
    imageUtil.chooseImages(remain).then((list) => {
      if (list.length) {
        // 性能注意（spec 修复5）：list 为 base64 data URL（单张上限 800KB），
        // 直接进 setData 时多张接近上限会逼近微信 setData 单次 1MB 硬限，
        // 有「data too large」告警/渲染卡顿风险。理想做法是缩略图路径进 setData、
        // base64 挂实例属性 submit 时再组装；此处受限于 utils/image 现有能力（无独立
        // 缩略图/本地路径产物），暂维持原状不破坏，待 image.js 支持后再改。
        this.setData({ images: this.data.images.concat(list) })
      }
    }).catch(function () {
      wx.showToast({ title: '选图失败', icon: 'none' })
    })
  },

  removeImage(e) {
    const index = Number(e.currentTarget.dataset.index)
    const images = this.data.images.slice()
    images.splice(index, 1)
    this.setData({ images: images })
  },

  previewImage(e) {
    imageUtil.preview(this.data.images, Number(e.currentTarget.dataset.index))
  },

  submit() {
    if (this.data.submitting) {
      return
    }
    if (!auth.requireVerified()) {
      return
    }
    const side = this.data.sides[this.data.sideIndex].value
    const category = this.data.categories[this.data.categoryIndex].value
    const rewardNumber = Number(this.data.rewardValue || 0)

    if (!this.data.title || !this.data.description) {
      wx.showToast({ title: '请填写标题和描述', icon: 'none' })
      return
    }

    if (this.data.title.length > MAX_TITLE_LEN) {
      wx.showToast({ title: '标题不能超过 ' + MAX_TITLE_LEN + ' 字', icon: 'none' })
      return
    }

    if (this.data.description.length > MAX_DESC_LEN) {
      wx.showToast({ title: '描述不能超过 ' + MAX_DESC_LEN + ' 字', icon: 'none' })
      return
    }

    if (side !== 'none' && this.data.rewardValue !== '') {
      if (!REWARD_PATTERN.test(this.data.rewardValue) || rewardNumber < 0 || rewardNumber > MAX_REWARD) {
        wx.showToast({ title: '金额需为 0-100000 的数字，最多两位小数', icon: 'none' })
        return
      }
    }

    const rewardText = side === 'none'
      ? '无偿互助'
      : (rewardNumber > 0 ? rewardNumber.toFixed(2) + '元' : '面议')

    const payload = {
      title: this.data.title,
      publisherSide: side,
      category: category,
      description: this.data.description,
      reward: rewardText,
      rewardValue: side === 'none' ? 0 : rewardNumber,
      images: this.data.images,
      contact: this.data.contact || '站内联系'
    }

    if (side === 'payer') {
      const deadline = new Date(this.data.date + 'T' + this.data.time + ':00')
      if (!(deadline.getTime() > Date.now())) {
        wx.showToast({ title: '截止时间需晚于当前时间', icon: 'none' })
        return
      }
      payload.deadline = this.data.date + 'T' + this.data.time + ':00'
    }

    if (side === 'earner') {
      payload.serviceTime = this.data.serviceTime
    }

    this.setData({ submitting: true })
    postService.create(payload).then((data) => {
      const task = data && data.task ? data.task : null
      const go = function () {
        if (task && task.id) {
          wx.navigateTo({ url: '/pages/posts/detail/index?id=' + task.id })
        } else {
          wx.switchTab({ url: '/pages/posts/list/index' })
        }
      }
      wx.removeStorageSync(DRAFT_KEY)
      this.appliedTs = null
      this.setData({ title: '', description: '', rewardValue: '', serviceTime: '', images: [] })
      // 首次发布弹一次性引导，之后只 toast
      if (!wx.getStorageSync('campus_pub_guide_shown')) {
        wx.setStorageSync('campus_pub_guide_shown', 1)
        wx.showModal({
          title: '发布成功',
          content: '可以随时在「我的 → 我的发布」里查看和管理你发布的任务',
          showCancel: false,
          confirmText: '知道了',
          complete: go
        })
      } else {
        wx.showToast({ title: '发布成功', icon: 'success' })
        setTimeout(go, 600)
      }
    }).catch(function () {
    }).finally(() => {
      this.setData({ submitting: false })
    })
  }
})
