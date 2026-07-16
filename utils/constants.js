const sideOptions = [
  { label: '全部', value: 'all' },
  { label: '悬赏', value: 'payer' },
  { label: '服务', value: 'earner' },
  { label: '互助', value: 'none' }
]

// 与大厅筛选/卡片标签同一套叫法（悬赏/服务/互助），括号补方向说明，避免新用户对不上号
const publishSideOptions = [
  { label: '悬赏 · 我出钱找人帮忙', value: 'payer' },
  { label: '服务 · 我提供服务收钱', value: 'earner' },
  { label: '互助 · 不涉及费用', value: 'none' }
]

const sortOptions = [
  { label: '最新发布', value: 'time_desc' },
  { label: '最早发布', value: 'time_asc' },
  { label: '金额从低到高', value: 'reward_asc' },
  { label: '金额从高到低', value: 'reward_desc' },
  { label: '信用从高到低', value: 'credit_desc' }
]

const categoryOptions = [
  { label: '跑腿代办', value: 'errand' },
  { label: '学习互助', value: 'study-help' },
  { label: '技能互助', value: 'skill-help' },
  { label: '资料分享', value: 'material-share' },
  { label: '二手交易', value: 'item-trade' },
  { label: '组队搭子', value: 'teamwork' },
  { label: '生活服务', value: 'life-service' },
  { label: '其他', value: 'other' }
]

module.exports = {
  sideOptions,
  publishSideOptions,
  sortOptions,
  categoryOptions
}
