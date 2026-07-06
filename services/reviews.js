const request = require('../utils/request')

function list(userId) {
  return request({
    url: '/api/reviews?userId=' + encodeURIComponent(userId),
    method: 'GET'
  })
}

function submit(data) {
  return request({
    url: '/api/reviews',
    method: 'POST',
    data: data,
    showLoading: true
  })
}

function hasReviewed(orderId) {
  return request({
    url: '/api/reviews/has-reviewed?orderId=' + encodeURIComponent(orderId),
    method: 'GET'
  })
}

module.exports = {
  list,
  submit,
  hasReviewed
}
