const settings = require('../../../utils/settings')
const theme = require('../../../utils/theme')

const FONT_OPTIONS = [
  { label: '小', value: 'small' },
  { label: '标准', value: 'std' },
  { label: '大', value: 'large' }
]

// switch 是原生组件，color 只能收颜色值不能用 CSS 变量；
// 这里按当前主题取与 app.wxss 里 --brand 同值的品牌色，保证深色/主题态一致。
const BRAND_COLORS = {
  dark: '#5B8CFF',
  b1: '#2E6BFF',
  b2: '#DB8D33',
  b3: '#2FA574',
  b4: '#3D8BE8',
  b5: '#E2699A'
}

function brandColorOf(t) {
  if (t.mode === 'dark') {
    return BRAND_COLORS.dark
  }
  return BRAND_COLORS[t.bg] || BRAND_COLORS.b1
}

Page({
  data: {
    fontOptions: FONT_OPTIONS,
    fontSize: 'std',
    badgeEnabled: true,
    autoRead: true,
    interactionEnabled: true,
    brandColor: BRAND_COLORS.b1
  },

  onShow() {
    const s = settings.getSettings()
    this.setData({
      fontSize: s.fontSize,
      badgeEnabled: s.badgeEnabled,
      autoRead: s.autoRead,
      interactionEnabled: s.interactionEnabled,
      brandColor: brandColorOf(theme.get())
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
  },

  onInteractionChange(e) {
    settings.setSetting('interactionEnabled', !!e.detail.value)
    this.setData({ interactionEnabled: !!e.detail.value })
  }
})
