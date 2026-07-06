const request = require('../utils/request')

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

module.exports = {
  list,
  detail,
  create,
  mine
}
