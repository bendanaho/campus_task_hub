// 通用图片上传：把本地临时文件传到后端 /api/upload（文件存储），返回可访问 URL（/uploads/xxx）。
// 用于头像、个人展示照片、聊天图片等——图片走文件存储、URL 入库，不再塞 base64。
const config = require('../config/index')
const auth = require('./auth')

// 上传单张图片，resolve 后端返回的 URL（形如 /uploads/xxx.jpg）
function uploadImage(filePath) {
  return new Promise(function (resolve, reject) {
    if (!filePath) {
      reject(new Error('无文件'))
      return
    }
    const token = auth.getToken()
    wx.uploadFile({
      url: config.API_BASE_URL + '/api/upload',
      filePath: filePath,
      name: 'file',
      header: token ? { Authorization: 'Bearer ' + token } : {},
      success: function (res) {
        let body = null
        try { body = JSON.parse(res.data) } catch (e) { body = null }
        if (res.statusCode === 200 && body && body.success && body.data && body.data.url) {
          resolve(body.data.url)
        } else {
          const msg = (body && body.message) || '图片上传失败'
          wx.showToast({ title: msg, icon: 'none' })
          reject(new Error(msg))
        }
      },
      fail: function (err) {
        wx.showToast({ title: '图片上传失败，请重试', icon: 'none' })
        reject(err)
      }
    })
  })
}

// 顺序上传多张，resolve URL 数组（任一失败则整体 reject）
function uploadImages(filePaths) {
  const paths = filePaths || []
  return paths.reduce(function (chain, p) {
    return chain.then(function (acc) {
      return uploadImage(p).then(function (url) {
        return acc.concat([url])
      })
    })
  }, Promise.resolve([]))
}

// 把后端返回的相对图片路径（/uploads/xxx）补成完整 URL 供 <image src> 使用；
// 已是 http(s)/data: 的原样返回，空值返回空串。
function fullUrl(u) {
  if (!u) {
    return ''
  }
  if (/^https?:\/\//.test(u) || String(u).indexOf('data:') === 0) {
    return u
  }
  return config.API_BASE_URL + u
}

// ---- 真机兜底：<image> 直载 http/IP 资源在真机会被限制（开发者工具不校验），
// 但 wx.request 与业务 API 走同一通道、真机可用。失败时用它拉字节写成本地
// 临时文件再显示。同 URL 只拉一次（模块级缓存，会话内复用）。----
const localCache = {}

function hashOf(s) {
  var h = 5381
  for (var i = 0; i < s.length; i++) {
    h = ((h << 5) + h + s.charCodeAt(i)) | 0
  }
  return (h >>> 0).toString(36)
}

function extOf(u) {
  const m = /\.(png|jpg|jpeg|gif|webp)(\?|$)/i.exec(u || '')
  return m ? m[1].toLowerCase() : 'jpg'
}

// 已转过的本地路径（同步查缓存，供列表渲染直接用）
function getCachedLocal(url) {
  return localCache[url] || ''
}

// 进行中的拉取去重：同 URL 并发只发一次请求（轮询刷新时避免重复拉）
const inflight = {}

function toLocalFile(url) {
  if (!url) {
    return Promise.reject(new Error('no url'))
  }
  if (localCache[url]) {
    return Promise.resolve(localCache[url])
  }
  if (inflight[url]) {
    return inflight[url]
  }
  const p = new Promise(function (resolve, reject) {
    wx.request({
      url: url,
      responseType: 'arraybuffer',
      success: function (res) {
        if (res.statusCode !== 200 || !res.data || !res.data.byteLength) {
          reject(new Error('bad response ' + res.statusCode))
          return
        }
        try {
          const fs = wx.getFileSystemManager()
          const path = wx.env.USER_DATA_PATH + '/chatimg-' + hashOf(url) + '.' + extOf(url)
          fs.writeFile({
            filePath: path,
            data: res.data,
            success: function () {
              localCache[url] = path
              resolve(path)
            },
            fail: reject
          })
        } catch (e) {
          reject(e)
        }
      },
      fail: reject
    })
  })
  inflight[url] = p
  p.then(function () {
    delete inflight[url]
  }, function () {
    delete inflight[url]
  })
  return p
}

module.exports = {
  uploadImage,
  uploadImages,
  fullUrl,
  getCachedLocal,
  toLocalFile
}
