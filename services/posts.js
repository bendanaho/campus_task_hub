const request = require('../utils/request')

// 返回分页对象 {list, hasMore, total, page, size}（后端 dd0594e 起大厅分页）
function list(params) {
  const query = []
  const data = params || {}
  Object.keys(data).forEach(function (key) {
    if (data[key] !== undefined && data[key] !== null && data[key] !== '') {
      query.push(key + '=' + encodeURIComponent(data[key]))
    }
  })
  return request({
    url: '/api/posts' + (query.length ? '?' + query.join('&') : ''),
    method: 'GET'
  })
}

function detail(id) {
  return request({ url: '/api/posts/' + id, method: 'GET' })
}

// 按需获取某帖原图列表 [{full, thumb}]：列表/详情只下发缩略图，
// 点击缩略图放大时才单独拉原图，避免打开页面就下载数 MB 原图。
function images(id) {
  return request({ url: '/api/posts/' + id + '/images', method: 'GET', showLoading: true })
}

function create(data) {
  return request({
    url: '/api/posts',
    method: 'POST',
    data: data,
    showLoading: true
  })
}

function mine() {
  return request({ url: '/api/posts/mine', method: 'GET' })
}

// 举报帖子（登录用户，同人同帖仅一次待处理举报）
function report(id, reason) {
  return request({
    url: '/api/posts/' + id + '/report',
    method: 'POST',
    data: { reason: reason },
    showLoading: true
  })
}

// 发布者下架自己的帖子（软下架）
function closePost(id) {
  return request({ url: '/api/posts/' + id + '/close', method: 'POST', showLoading: true })
}

module.exports = {
  report,
  list,
  detail,
  images,
  create,
  mine,
  closePost
}
