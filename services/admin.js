// 管理员接口（后端 /api/admin/** 要求 role=1）
const request = require('../utils/request')

function listDisputes() {
  return request({ url: '/api/admin/disputes', method: 'GET' })
}

// decision: refund 全额退款付款方 / settle 全额结算收款方 / partial 部分结算
function resolveDispute(id, data) {
  return request({
    url: '/api/admin/orders/' + id + '/resolve',
    method: 'POST',
    data: data,
    showLoading: true
  })
}

function listReports() {
  return request({ url: '/api/admin/reports', method: 'GET' })
}

// 帖子管理：拉取全部帖子 List<PostDTO>（含 id/title/category/publisherSide/publisherName/status/reward 等）
function listAllPosts() {
  return request({ url: '/api/admin/posts', method: 'GET' })
}

function closePost(id, reason) {
  return request({
    url: '/api/admin/posts/' + id + '/close',
    method: 'POST',
    data: { reason: reason || '' },
    showLoading: true
  })
}

function deletePost(id, reason) {
  return request({
    url: '/api/admin/posts/' + id + '/delete',
    method: 'POST',
    data: { reason: reason || '' },
    showLoading: true
  })
}

module.exports = {
  listDisputes,
  resolveDispute,
  listReports,
  listAllPosts,
  closePost,
  deletePost
}
