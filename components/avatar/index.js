const avatarUtil = require('../../utils/avatar')
const upload = require('../../utils/upload')

Component({
  properties: {
    avatar: { type: String, value: '' },
    name: { type: String, value: '' },
    uid: { type: null, value: 0 },
    size: { type: Number, value: 86 }
  },

  data: {
    d: { kind: 'color', color: '#2E6BFF', char: '同', src: '' }
  },

  observers: {
    'avatar, name, uid': function () {
      this.refresh()
    }
  },

  lifetimes: {
    attached() {
      this.refresh()
    }
  },

  methods: {
    refresh() {
      const d = avatarUtil.resolve(this.data.avatar, this.data.name, this.data.uid)
      // 真机 <image> 直载 http/IP 常被限制：已转过本地文件的直接用本地路径，
      // 否则先渲染远程地址，同时后台预取本地文件，取到后原位替换（与聊天图片同机制）
      if (d.kind === 'image' && d.src && d.src.indexOf('http') === 0) {
        const remote = d.src
        const cached = upload.getCachedLocal(remote)
        if (cached) {
          d.src = cached
        } else {
          const self = this
          this._wantSrc = remote
          upload.toLocalFile(remote).then(function (path) {
            if (self._wantSrc === remote) {
              self.setData({ d: { kind: 'image', color: '', char: '', src: path } })
            }
          }).catch(function () {
            // 拉取失败保持现状：直载可能成功；彻底失败由 onImgError 回退首字色块
          })
        }
      } else {
        this._wantSrc = ''
      }
      this.setData({ d: d })
    },

    // 远程头像加载失败（404 / 真机域名限制等）：先回退纯色首字，
    // 后台预取若随后成功会再换回真实头像。
    onImgError() {
      this.setData({
        d: avatarUtil.resolve('', this.data.name, this.data.uid)
      })
    }
  }
})
