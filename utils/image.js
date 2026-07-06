// 图片选取/预览封装。
// 后端没有文件上传接口，图片以 base64 data URL 字符串放在帖子/评价的 images 数组里传输。
const fs = wx.getFileSystemManager()

const MAX_SIZE = 800 * 1024 // 单张压缩后超过 800KB 拒收，避免请求体过大

const EXT_MIME = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp'
}

function extOf(path) {
  const m = /\.(\w+)$/.exec(path || '')
  return m ? m[1].toLowerCase() : 'jpg'
}

// 选图并转成 data URL 数组；用户取消返回 []
function chooseImages(count) {
  return new Promise(function (resolve, reject) {
    wx.chooseMedia({
      count: count,
      mediaType: ['image'],
      sizeType: ['compressed'],
      success(res) {
        try {
          const list = []
          let skipped = 0
          ;(res.tempFiles || []).forEach(function (f) {
            if (f.size > MAX_SIZE) {
              skipped += 1
              return
            }
            const base64 = fs.readFileSync(f.tempFilePath, 'base64')
            const mime = EXT_MIME[extOf(f.tempFilePath)] || 'image/jpeg'
            list.push('data:' + mime + ';base64,' + base64)
          })
          if (skipped > 0) {
            wx.showToast({ title: skipped + ' 张图片过大已跳过', icon: 'none' })
          }
          resolve(list)
        } catch (e) {
          reject(e)
        }
      },
      fail(err) {
        if (err && /cancel/i.test(err.errMsg || '')) {
          resolve([])
        } else {
          reject(err)
        }
      }
    })
  })
}

// base64 data URL 写成临时文件，wx.previewImage 不支持直接预览 data URL
function toTempFile(dataUrl, index) {
  const m = /^data:image\/(\w+);base64,(.+)$/.exec(dataUrl)
  if (!m) {
    return dataUrl // http(s) 链接原样返回
  }
  const ext = m[1] === 'jpeg' ? 'jpg' : m[1]
  const path = wx.env.USER_DATA_PATH + '/preview-' + index + '.' + ext
  fs.writeFileSync(path, m[2], 'base64')
  return path
}

// 预览第 index 张图，images 里 data URL 和普通链接可以混用
function preview(images, index) {
  const list = images || []
  if (!list.length) {
    return
  }
  try {
    const urls = list.map(function (img, i) {
      return toTempFile(img, i)
    })
    wx.previewImage({
      urls: urls,
      current: urls[index] || urls[0]
    })
  } catch (e) {
    wx.showToast({ title: '图片预览失败', icon: 'none' })
  }
}

module.exports = {
  chooseImages,
  preview
}
