// 后端环境一处切换：改 ENV 一个词即可，HTTP 与 WebSocket 地址全局自动跟随。
//
//  local  —— 微信开发者工具连本机 8080（或 VSCode 端口转发）
//  lan    —— 手机真机连"你自己电脑"上跑的后端：换成电脑的局域网 IP（ipconfig 查）
//  remote —— 队友部署的线上后端：换成他给的公网地址（跨端联调、课设演示用这个）
//
// 注意：http/ws 明文地址在开发者工具和"打开调试"的真机上可用；
// 正式发布需 https/wss + 备案域名并在微信公众平台配置合法域名。
const ENV = 'remote'

const HOSTS = {
  local: 'http://localhost:8080',
  lan: 'http://192.168.1.100:8080',
  // 线上：Nginx 统一入口（/api 与 /ws 已反代，WebSocket 已验证可用）
  // 线上是 MySQL 持久库，账号 xiaoming/xiaohong/xiaowang/admin，密码均 123456
  remote: 'http://182.92.133.163:8081'
}

module.exports = {
  ENV: ENV,
  API_BASE_URL: HOSTS[ENV]
}
