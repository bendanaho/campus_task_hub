const reviewService = require('../../../services/reviews')
const userService = require('../../../services/user')
const format = require('../../../utils/format')
const imageUtil = require('../../../utils/image')

const AVATAR_COLORS = ['#2E6BFF', '#0FB77A', '#F5570B', '#8B5CF6', '#0EA5C4', '#E1518F']

const FILTERS = [
  { value: 'all', label: '全部' },
  { value: '5', label: '5星' },
  { value: '4', label: '4星' },
  { value: 'low', label: '3星及以下' }
]

function buildStars(rating) {
  let stars = ''
  for (let i = 0; i < rating; i += 1) {
    stars += '★'
  }
  return stars || '★ ' + rating
}

function buildSummary(reviews) {
  if (!reviews.length) {
    return null
  }
  let total = 0
  let good = 0
  reviews.forEach(function (item) {
    const rating = Number(item.rating) || 0
    total += rating
    if (rating >= 4) {
      good += 1
    }
  })
  return {
    avg: (total / reviews.length).toFixed(1),
    count: reviews.length,
    goodRate: Math.round((good / reviews.length) * 100)
  }
}

Page({
  data: {
    userId: '',
    loading: true,
    hasAny: false,
    filter: 'all',
    filters: FILTERS,
    summary: null,
    creditScore: '',
    reviews: []
  },

  onLoad(options) {
    this.allReviews = []
    this.setData({ userId: options.userId || '' })
    if (options.name) {
      const name = decodeURIComponent(options.name)
      wx.setNavigationBarTitle({ title: name + ' 的评价' })
    }
    this.loadReviews()
  },

  onPullDownRefresh() {
    this.loadReviews().finally(function () {
      wx.stopPullDownRefresh()
    })
  },

  loadReviews() {
    this.setData({ loading: true })
    // 信用分与个人主页同口径：按 userId 拉后端 creditScore，与客户端现算平均分并列
    const creditTask = this.data.userId
      ? userService.getPublicProfile(this.data.userId).then((profile) => {
          this.setData({ creditScore: Number((profile && profile.creditScore) || 0).toFixed(1) })
        }).catch(function () {
        })
      : Promise.resolve()
    const reviewsTask = reviewService.list(this.data.userId).then((list) => {
      // setData 单次上限 1MB：base64 评价图限单张 150KB、全页累计 600KB，超出丢弃
      let imageBudget = 600 * 1024
      const reviews = (list || []).map(function (item) {
        const rating = Number(item.rating) || 0
        const images = (item.images || []).filter(function (img) {
          if (String(img).indexOf('data:') !== 0) {
            return true
          }
          if (img.length <= 150 * 1024 && imageBudget >= img.length) {
            imageBudget -= img.length
            return true
          }
          return false
        })
        return Object.assign({}, item, {
          images: images,
          rating: rating,
          stars: buildStars(rating),
          avatarChar: item.fromUserName ? item.fromUserName.slice(0, 1) : '同',
          avatarColor: AVATAR_COLORS[(Number(item.fromUserId) || 0) % AVATAR_COLORS.length],
          timeText: format.formatTime(item.time),
          hasContent: !!item.content,
          contentText: item.content || '用户未填写评价内容'
        })
      })
      this.allReviews = reviews
      this.setData({
        hasAny: reviews.length > 0,
        summary: buildSummary(reviews)
      })
      this.applyFilter()
    }).catch(function () {
    })
    return Promise.all([reviewsTask, creditTask]).finally(() => {
      this.setData({ loading: false })
    })
  },

  onFilterTap(e) {
    const value = e.currentTarget.dataset.value || 'all'
    if (value === this.data.filter) {
      return
    }
    this.setData({ filter: value })
    this.applyFilter()
  },

  // 从「该筛选下暂无评价」空态清空筛选，回到全部
  onShowAll() {
    if (this.data.filter === 'all') {
      return
    }
    this.setData({ filter: 'all' })
    this.applyFilter()
  },

  applyFilter() {
    const all = this.allReviews || []
    const filter = this.data.filter
    let reviews = all
    if (filter === '5') {
      reviews = all.filter(function (item) { return item.rating === 5 })
    } else if (filter === '4') {
      reviews = all.filter(function (item) { return item.rating === 4 })
    } else if (filter === 'low') {
      reviews = all.filter(function (item) { return item.rating <= 3 })
    }
    this.setData({ reviews: reviews })
  },

  previewImage(e) {
    const ds = e.currentTarget.dataset
    const item = this.data.reviews[Number(ds.rIndex)]
    if (!item || !item.images || !item.images.length) {
      return
    }
    imageUtil.preview(item.images, Number(ds.index))
  }
})
