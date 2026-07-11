const settings = require('../../../utils/settings')

const FONT_OPTIONS = [
  { label: '小', value: 'small' },
  { label: '标准', value: 'std' },
  { label: '大', value: 'large' }
]

Page({
  data: {
    fontOptions: FONT_OPTIONS,
    fontSize: 'std',
    badgeEnabled: true,
    autoRead: true
  },

  onShow() {
    const s = settings.getSettings()
    this.setData({
      fontSize: s.fontSize,
      badgeEnabled: s.badgeEnabled,
      autoRead: s.autoRead
    })
  },

  onFontTap(e) {
    const value = e.currentTarget.dataset.value
    settings.setSetting('fontSize', value)
    this.setData({ fontSize: value })
  },

  onBadgeChange(e) {
    settings.setSetting('badgeEnabled', !!e.detail.value)
    this.setData({ badgeEnabled: !!e.detail.value })
  },

  onAutoReadChange(e) {
    settings.setSetting('autoRead', !!e.detail.value)
    this.setData({ autoRead: !!e.detail.value })
  }
})
