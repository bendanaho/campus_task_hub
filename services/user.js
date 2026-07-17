const request = require('../utils/request')

function getProfile(id) {
  return request({ url: '/api/users/' + id, method: 'GET' })
}

// 查看他人主页：后端 /api/users/{id} 现只允许查自己（查他人返回"无权查看他人完整资料"），
// 看别人要走公开资料接口（含 username/avatar/bio/creditScore/展示照片等公开字段）。
function getPublicProfile(id) {
  return request({ url: '/api/users/' + id + '/profile', method: 'GET' })
}

// 改资料：头像/简介/展示照片，三者均可缺省（缺省或 null 表示不改）。
// avatar 是 URL 字符串，profilePhotos 是 URL 数组（最多5张）。
function updateProfile(data) {
  return request({
    url: '/api/user/profile',
    method: 'PUT',
    data: data
  })
}

function updatePhone(phone) {
  return request({
    url: '/api/user/phone',
    method: 'PUT',
    data: { phone: phone },
    showLoading: true
  })
}

// 换邮箱一律验当前密码（邮箱是找回密码的凭据，后端强制要求）
function updateEmail(email, currentPassword) {
  return request({
    url: '/api/user/email',
    method: 'PUT',
    data: { email: email, currentPassword: currentPassword },
    showLoading: true
  })
}

function submitAuth(data) {
  return request({
    url: '/api/auth',
    method: 'POST',
    data: data,
    showLoading: true
  })
}

function getBalance() {
  return request({ url: '/api/user/balance', method: 'GET' })
}

function recharge(amount) {
  return request({
    url: '/api/user/recharge',
    method: 'POST',
    data: { amount: amount },
    showLoading: true
  })
}

function getBills() {
  return request({ url: '/api/user/bills', method: 'GET' })
}

// 修改密码：入参 {oldPassword, newPassword, confirmPassword}，后端校验旧密码正确后更新。
// 注意：后端目前尚未实现 PUT /api/user/password，需队友补齐该端点后此接口方可生效。
function changePassword(data) {
  return request({
    url: '/api/user/password',
    method: 'PUT',
    data: data,
    showLoading: true
  })
}

module.exports = {
  getProfile,
  getPublicProfile,
  updateProfile,
  updatePhone,
  updateEmail,
  submitAuth,
  getBalance,
  recharge,
  getBills,
  changePassword
}
