const auth = require('../../../utils/auth')
const userService = require('../../../services/user')
const avatarUtil = require('../../../utils/avatar')
const upload = require('../../../utils/upload')

const MAX_PHOTOS = 5
const MAX_BIO = 200
const PHONE_REG = /^1\d{10}$/
const EMAIL_REG = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/

// 纯色头像模板的可访问名称（供读屏播报）
const COLOR_LABELS = {
  '#2E6BFF': '蓝色',
  '#0FB77A': '绿色',
  '#F5570B': '橙色',
  '#8B5CF6': '紫色',
  '#0EA5C4': '青色',
  '#E1518F': '粉色',
  '#F5A70B': '金色',
  '#17233D': '深蓝'
}
const SWATCHES = avatarUtil.COLORS.map(function (c) {
  return { value: c, label: COLOR_LABELS[c] || '颜色' }
})

function maskPhone(phone) {
  const p = phone ? String(phone) : ''
  if (!p) {
    return '未设置'
  }
  if (p.length < 7) {
    return p
  }
  return p.slice(0, 3) + '****' + p.slice(-4)
}

function maskEmail(email) {
  const e = email ? String(email) : ''
  if (!e) {
    return '未设置'
  }
  const at = e.indexOf('@')
  if (at <= 1) {
    return e
  }
  return e.slice(0, 1) + '***' + e.slice(at)
}

// 头像展示统一走 fullUrl；'color:xxx' 纯色模板与空值原样交给 ua-avatar。
function avatarSrc(a) {
  if (!a) {
    return ''
  }
  if (String(a).indexOf('color:') === 0) {
    return a
  }
  return upload.fullUrl(a)
}

// profilePhotos 后端存 JSON 数组字符串，需解析成数组（最多5张）；已是数组则原样收敛。
function parsePhotos(raw) {
  let arr = raw
  if (typeof raw === 'string') {
    try {
      arr = JSON.parse(raw)
    } catch (e) {
      arr = []
    }
  }
  if (!Array.isArray(arr)) {
    return []
  }
  return arr.slice(0, MAX_PHOTOS)
}

Page({
  data: {
    phoneMasked: '',
    emailMasked: '',
    phone: '',
    email: '',
    emailPwd: '',
    verified: false,
    submitting: false,
    username: '',
    uid: 0,
    avatarValue: '',
    avatarSrc: '',
    hasCustomAvatar: false,
    swatches: SWATCHES,
    bio: '',
    bioLen: 0,
    bioDirty: false,
    bioSaving: false,
    maxBio: MAX_BIO,
    photos: [],
    photosShow: [],
    photosUploading: false,
    maxPhotos: MAX_PHOTOS,
    // 修改密码：独立字段，避免与上方资料表单的 data 混用
    oldPwd: '',
    newPwd: '',
    newPwd2: '',
    submittingPwd: false,
    pwdVisible: false
  },

  onShow() {
    if (!auth.requireLogin()) {
      return
    }
    const user = auth.getUser() || {}
    const my = avatarUtil.getMyAvatar()
    const raw = my || user.avatar || ''
    const bio = user.bio || ''
    const photos = parsePhotos(user.profilePhotos)
    this.setData({
      phoneMasked: maskPhone(user.phone),
      emailMasked: maskEmail(user.email),
      verified: user.authStatus === 'verified',
      username: user.username || '',
      uid: user.id || 0,
      avatarValue: raw,
      avatarSrc: avatarSrc(raw),
      hasCustomAvatar: !!my,
      bio: bio,
      bioLen: bio.length,
      bioDirty: false,
      photos: photos,
      photosShow: photos.map(upload.fullUrl)
    })
    this.prefetchPhotosShow()
    this.loadProfile()
  },

  // 拉取最新资料（头像/简介/展示照片），本地缓存可能落后于服务端。
  // 尊重正在进行的编辑：简介被改过(bioDirty)或照片上传中时不覆盖，避免打断用户。
  loadProfile() {
    const uid = this.data.uid
    if (!uid) {
      return
    }
    const self = this
    userService.getProfile(uid).then(function (p) {
      auth.updateUser(p)
      const my = avatarUtil.getMyAvatar()
      const raw = my || p.avatar || ''
      const patch = {
        avatarValue: raw,
        avatarSrc: avatarSrc(raw),
        hasCustomAvatar: !!my
      }
      if (!self.data.bioDirty) {
        patch.bio = p.bio || ''
        patch.bioLen = (p.bio || '').length
      }
      if (!self.data.photosUploading) {
        const photos = parsePhotos(p.profilePhotos)
        patch.photos = photos
        patch.photosShow = photos.map(upload.fullUrl)
      }
      self.setData(patch)
      self.prefetchPhotosShow()
    }).catch(function () {
    })
  },

  // 展示照片是 http 远程地址时预取为本地文件后原位替换（真机 <image> 直载受限）
  prefetchPhotosShow() {
    const self = this
    ;(this.data.photosShow || []).forEach(function (url, idx) {
      if (!url || String(url).indexOf('http') !== 0) {
        return
      }
      upload.toLocalFile(url).then(function (path) {
        const cur = self.data.photosShow || []
        if (cur[idx] === url) {
          self.setData({ ['photosShow[' + idx + ']']: path })
        }
      }).catch(function () {})
    })
  },

  // 上传头像：选图 → 上传取回 URL → 提交后端 → 本地更新（清掉本机覆盖，显示后端图）
  pickAvatarImage() {
    const self = this
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sizeType: ['compressed'],
      success: function (res) {
        const file = (res.tempFiles || [])[0]
        if (!file || !file.tempFilePath) {
          return
        }
        wx.showLoading({ title: '上传中', mask: true })
        upload.uploadImage(file.tempFilePath).then(function (url) {
          return userService.updateProfile({ avatar: url }).then(function () {
            return url
          })
        }).then(function (url) {
          wx.hideLoading()
          avatarUtil.setMyAvatar('')
          const user = Object.assign({}, auth.getUser() || {}, { avatar: url })
          auth.updateUser(user)
          self.setData({ avatarValue: url, avatarSrc: avatarSrc(url), hasCustomAvatar: false })
          wx.showToast({ title: '头像已更新', icon: 'success' })
        }).catch(function () {
          // 关遮罩后补一条兜底提示，避免失败 toast 被 loading 遮罩顶掉
          wx.hideLoading()
          wx.showToast({ title: '头像上传失败，请重试', icon: 'none' })
        })
      },
      fail: function () {}
    })
  },

  pickColor(e) {
    const value = 'color:' + e.currentTarget.dataset.color
    avatarUtil.setMyAvatar(value)
    this.setData({ avatarValue: value, avatarSrc: value, hasCustomAvatar: true })
  },

  resetAvatar() {
    avatarUtil.setMyAvatar('')
    const user = auth.getUser() || {}
    const raw = user.avatar || ''
    this.setData({ avatarValue: raw, avatarSrc: avatarSrc(raw), hasCustomAvatar: false })
  },

  onInput(e) {
    const key = e.currentTarget.dataset.key
    this.setData({
      [key]: e.detail.value
    })
  },

  save() {
    if (this.data.submitting) {
      return
    }
    const phone = (this.data.phone || '').trim()
    const email = (this.data.email || '').trim()
    if (!phone && !email) {
      // 头像改动已即时保存；无联系方式改动时优雅返回，不再误报「请输入手机/邮箱」
      wx.navigateBack()
      return
    }
    if (phone && !PHONE_REG.test(phone)) {
      wx.showToast({ title: '手机号格式不正确', icon: 'none' })
      return
    }
    if (email && !EMAIL_REG.test(email)) {
      wx.showToast({ title: '邮箱格式不正确', icon: 'none' })
      return
    }
    // 换邮箱后端强制验当前密码（邮箱是找回密码的凭据）
    const emailPwd = this.data.emailPwd || ''
    if (email && !emailPwd) {
      wx.showToast({ title: '修改邮箱需输入当前密码', icon: 'none' })
      return
    }
    this.setData({ submitting: true })
    const self = this
    // 每个子步骤独立成败：成功者就地更新掩码/清空对应输入框，失败者不影响另一个
    const result = { phoneTried: !!phone, emailTried: !!email, phoneOk: false, emailOk: false }

    let chain = Promise.resolve()
    if (phone) {
      chain = chain.then(function () {
        return userService.updatePhone(phone).then(function (profile) {
          auth.updateUser(profile)
          const user = auth.getUser() || {}
          self.setData({ phone: '', phoneMasked: maskPhone(user.phone) })
          result.phoneOk = true
        }).catch(function () {
          // 具体错误由 request.js 弹出；此处仅记录失败，保留输入框内容以便重试
        })
      })
    }
    if (email) {
      chain = chain.then(function () {
        return userService.updateEmail(email, emailPwd).then(function (profile) {
          auth.updateUser(profile)
          const user = auth.getUser() || {}
          self.setData({ email: '', emailPwd: '', emailMasked: maskEmail(user.email) })
          result.emailOk = true
        }).catch(function () {
        })
      })
    }
    chain.then(function () {
      self.setData({ submitting: false })
      self.reportResult(result)
    })
  },

  reportResult(r) {
    const okList = []
    const failList = []
    if (r.phoneTried) {
      (r.phoneOk ? okList : failList).push('手机')
    }
    if (r.emailTried) {
      (r.emailOk ? okList : failList).push('邮箱')
    }
    if (failList.length === 0) {
      // 全部成功
      wx.showToast({ title: okList.join('、') + '已更新', icon: 'success' })
      setTimeout(function () {
        wx.navigateBack()
      }, 700)
      return
    }
    // 部分成功：明确区分哪个成功哪个失败，避免用户误判整单失败
    if (okList.length > 0) {
      wx.showToast({ title: okList.join('、') + '已更新，' + failList.join('、') + '更新失败', icon: 'none' })
      return
    }
    // 全部失败：具体原因（如「该手机号已被占用」）已由 request.js 针对失败请求弹出，
    // 这里不再用汇总 toast 覆盖它，避免用户看不到真实失败原因。
  },

  onBioInput(e) {
    const v = e.detail.value || ''
    this.setData({ bio: v, bioLen: v.length, bioDirty: true })
  },

  saveBio() {
    if (this.data.bioSaving) {
      return
    }
    const bio = this.data.bio || ''
    if (bio.length > MAX_BIO) {
      wx.showToast({ title: '简介不超过' + MAX_BIO + '字', icon: 'none' })
      return
    }
    const self = this
    this.setData({ bioSaving: true })
    wx.showLoading({ title: '保存中', mask: true })
    userService.updateProfile({ bio: bio }).then(function () {
      wx.hideLoading()
      const user = Object.assign({}, auth.getUser() || {}, { bio: bio })
      auth.updateUser(user)
      self.setData({ bioSaving: false, bioDirty: false })
      wx.showToast({ title: '简介已保存', icon: 'success' })
    }).catch(function () {
      wx.hideLoading()
      self.setData({ bioSaving: false })
    })
  },

  // 展示照片：多选 → 逐张上传 → 合并后提交后端（最多5张）
  addPhotos() {
    const self = this
    const remain = MAX_PHOTOS - this.data.photos.length
    if (remain <= 0) {
      wx.showToast({ title: '最多' + MAX_PHOTOS + '张', icon: 'none' })
      return
    }
    wx.chooseMedia({
      count: remain,
      mediaType: ['image'],
      sizeType: ['compressed'],
      success: function (res) {
        const files = (res.tempFiles || []).map(function (f) {
          return f.tempFilePath
        }).filter(Boolean)
        if (!files.length) {
          return
        }
        self.setData({ photosUploading: true })
        wx.showLoading({ title: '上传中', mask: true })
        upload.uploadImages(files).then(function (urls) {
          const next = self.data.photos.concat(urls).slice(0, MAX_PHOTOS)
          return userService.updateProfile({ profilePhotos: next }).then(function () {
            return next
          })
        }).then(function (next) {
          wx.hideLoading()
          self.persistPhotos(next)
          self.setData({ photosUploading: false })
          wx.showToast({ title: '已上传', icon: 'success' })
        }).catch(function () {
          // 关遮罩后补一条兜底提示，避免失败 toast 被 loading 遮罩顶掉
          wx.hideLoading()
          self.setData({ photosUploading: false })
          wx.showToast({ title: '照片上传失败，请重试', icon: 'none' })
        })
      },
      fail: function () {}
    })
  },

  removePhoto(e) {
    const idx = e.currentTarget.dataset.index
    const next = this.data.photos.slice()
    if (idx < 0 || idx >= next.length) {
      return
    }
    next.splice(idx, 1)
    const self = this
    wx.showLoading({ title: '保存中', mask: true })
    userService.updateProfile({ profilePhotos: next }).then(function () {
      wx.hideLoading()
      self.persistPhotos(next)
      wx.showToast({ title: '已删除', icon: 'success' })
    }).catch(function () {
      wx.hideLoading()
    })
  },

  previewPhoto(e) {
    const idx = e.currentTarget.dataset.index
    const urls = this.data.photosShow
    if (!urls.length) {
      return
    }
    wx.previewImage({ urls: urls, current: urls[idx] || urls[0] })
  },

  // 统一收敛：更新本地缓存（与后端一致存 JSON 字符串）并刷新展示数组
  persistPhotos(list) {
    const photos = (list || []).slice(0, MAX_PHOTOS)
    const user = Object.assign({}, auth.getUser() || {}, { profilePhotos: JSON.stringify(photos) })
    auth.updateUser(user)
    this.setData({
      photos: photos,
      photosShow: photos.map(upload.fullUrl)
    })
  },

  goVerify() {
    wx.navigateTo({ url: '/pages/user/verify/index' })
  },

  togglePwdVisible() {
    this.setData({ pwdVisible: !this.data.pwdVisible })
  },

  // 修改密码：客户端先做非空 / 长度 / 一致性 / 新旧不同校验，通过后再请求后端。
  // 失败提示统一由 request.js 弹出，这里不再重复弹窗。
  changePassword() {
    if (this.data.submittingPwd) {
      return
    }
    const oldPwd = this.data.oldPwd || ''
    const newPwd = this.data.newPwd || ''
    const newPwd2 = this.data.newPwd2 || ''
    if (!oldPwd) {
      wx.showToast({ title: '请输入旧密码', icon: 'none' })
      return
    }
    if (newPwd.length < 6) {
      wx.showToast({ title: '新密码至少6位', icon: 'none' })
      return
    }
    if (newPwd !== newPwd2) {
      wx.showToast({ title: '两次输入的新密码不一致', icon: 'none' })
      return
    }
    if (newPwd === oldPwd) {
      wx.showToast({ title: '新密码不能与旧密码相同', icon: 'none' })
      return
    }
    const self = this
    this.setData({ submittingPwd: true })
    userService.changePassword({
      oldPassword: oldPwd,
      newPassword: newPwd,
      confirmPassword: newPwd2
    }).then(function () {
      self.setData({ submittingPwd: false, oldPwd: '', newPwd: '', newPwd2: '' })
      wx.showToast({ title: '密码已修改', icon: 'success' })
    }).catch(function () {
      // 失败原因由 request.js 统一提示
      self.setData({ submittingPwd: false })
    })
  }
})
