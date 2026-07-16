/**
 * 小程序端 · 后端等价类边界【在线取证】探针
 * ------------------------------------------------------------------
 * 目标：针对小程序真实连接的线上后端 http://182.92.133.163:8081，
 * 复核 Web 端报告发现的后端校验缺口在【当前线上】是否仍然存在，
 * 并为小程序端测试报告采集“后端表现”列的真实证据。
 *
 * 取证原则（保护队友的线上 MySQL 演示库）：
 *   - 无效用例一律【期望被拒】；被拒即不落库，无污染。
 *   - 需鉴权的写用例统一走一个带标记的一次性探针账号（zt_mp_probe_*），
 *     不动 xiaoming/xiaohong/admin 等演示账号的资料。
 *   - 不批量发帖/下单污染大厅；订单类只做“越权/自接单/未实名”等被拒探测。
 *
 * 运行：node tests/mp-equiv-probe.js
 * ------------------------------------------------------------------
 */
const B = 'http://182.92.133.163:8081'
const results = []

async function api(p, { method = 'GET', body, token } = {}) {
  const h = { 'Content-Type': 'application/json' }
  if (token) h.Authorization = 'Bearer ' + token
  const r = await fetch(B + p, { method, headers: h, body: body ? JSON.stringify(body) : undefined })
  let j = null
  try { j = await r.json() } catch (e) {}
  return { status: r.status, j }
}
// 无效用例：后端“拦截”= 业务 success=false 或 4xx；否则视为“绕过”
function rejected(r) {
  return r.status === 400 || r.status === 401 || r.status === 403 || (r.j && r.j.success === false)
}
function rec(tc, point, r, expectReject = true) {
  const blocked = rejected(r)
  const msg = (r.j && (r.j.message || (r.j.data === false ? 'success=false' : ''))) || ('HTTP ' + r.status)
  const backend = blocked ? ('后端拦截（' + msg + '）') : ('后端放行（success=true, HTTP ' + r.status + '）')
  const pass = expectReject ? blocked : (r.j && r.j.success === true)
  results.push({ tc, point, backend, pass })
  console.log((pass ? '  ✓ ' : '  ✗ ') + tc + '  ' + point + '  → ' + backend)
  return r
}
async function login(account, password) {
  const r = await api('/api/login', { method: 'POST', body: { account, password } })
  return r.j && r.j.success ? { token: r.j.data.token, id: r.j.data.user.id, user: r.j.data.user } : null
}
function randPhone() {
  let s = ''
  for (let i = 0; i < 9; i++) s += Math.floor(Math.random() * 10)
  return '1' + (Math.floor(Math.random() * 7) + 3) + s
}
async function register(over) {
  const username = 'zt_mp_' + Date.now().toString().slice(-8) + Math.floor(Math.random() * 90 + 10)
  const body = Object.assign({ username, phone: randPhone(), email: '', password: 'pass123', confirmPassword: 'pass123' }, over)
  const resp = await api('/api/register', { method: 'POST', body })
  return { resp, username: body.username, password: body.password }
}

async function run() {
  console.log('\n小程序端·线上后端等价类取证  ' + B + '\n')

  // ========== 一、登录/鉴权（只读安全） ==========
  console.log('[一] 登录与鉴权')
  const xm = await login('xiaoming', '123456')   // 已实名
  const xh = await login('xiaohong', '123456')   // 已实名
  rec('TC_LOG_008', '有效标准登录', await api('/api/login', { method: 'POST', body: { account: 'xiaoming', password: '123456' } }), false)
  rec('TC_LOG_012', '错误密码登录', await api('/api/login', { method: 'POST', body: { account: 'xiaoming', password: 'wrong_pwd_x' } }))
  rec('TC_AUTH_NOTOKEN', '无 token 访问受保护接口', await api('/api/user/balance'))
  rec('TC_ADM_PRIV', '普通用户越权访问管理员接口', await api('/api/admin/reports', { token: xm.token }))

  // ========== 二、注册等价类（无效→期望被拒；被拒即不落库） ==========
  console.log('\n[二] 注册模块')
  rec('TC_REG_002', '两次密码不一致', (await register({ password: 'pass123', confirmPassword: 'pass456' })).resp)
  rec('TC_REG_003', '确认密码为空/缺失', (await register({ confirmPassword: undefined })).resp)
  rec('TC_REG_005', '昵称超长(35字)', (await register({ username: 'z'.repeat(35) })).resp)
  rec('TC_REG_006', '昵称含敏感词', (await register({ username: '习近平fuck傻逼x' })).resp)

  // ========== 三、一次性探针账号：资料/钱包/认证边界 ==========
  console.log('\n[三] 个人资料 / 钱包 / 校园认证（探针账号）')
  const reg = await register({})
  let probe = null
  if (reg.resp.j && reg.resp.j.success) {
    // 注册即登录则直接拿 token，否则再登录
    const u = reg.resp.j.data
    probe = (u && u.token) ? { token: u.token, id: u.user && u.user.id, user: u.user } : await login(reg.username, reg.password)
  }
  if (!probe) { console.log('  ! 探针账号创建失败，跳过资料/钱包用例'); }
  else {
    // 邮箱
    rec('TC_PROF_002', '邮箱缺少 @', await api('/api/user/email', { method: 'PUT', token: probe.token, body: { email: 'studenttongji.edu.cn' } }))
    rec('TC_PROF_003', '邮箱缺少域名后缀(student@tongji)', await api('/api/user/email', { method: 'PUT', token: probe.token, body: { email: 'student@tongji' } }))
    rec('TC_PROF_004', '邮箱空值保存', await api('/api/user/email', { method: 'PUT', token: probe.token, body: { email: '' } }))
    // 钱包充值
    rec('TC_WAL_003', '充值负数金额(-20)', await api('/api/user/recharge', { method: 'POST', token: probe.token, body: { amount: -20 } }))
    rec('TC_WAL_004', '充值非数字字符串', await api('/api/user/recharge', { method: 'POST', token: probe.token, body: { amount: 'abc' } }))
    rec('TC_WAL_005', '充值超大金额(99999999)', await api('/api/user/recharge', { method: 'POST', token: probe.token, body: { amount: 99999999 } }))
    rec('TC_WAL_006', '充值小数位过多(10.123)', await api('/api/user/recharge', { method: 'POST', token: probe.token, body: { amount: 10.123 } }))
    // 校园认证
    rec('TC_AUTH_002', '学号为空提交', await api('/api/auth', { method: 'POST', token: probe.token, body: { realName: '张三', studentId: '', college: '计算机学院' } }))
    rec('TC_AUTH_003', '学号超长(35位)', await api('/api/auth', { method: 'POST', token: probe.token, body: { realName: '张三', studentId: 'A'.repeat(35), college: '计算机学院' } }))
  }

  // ========== 四、订单/权限（只读/被拒探测，不污染大厅） ==========
  console.log('\n[四] 订单与权限')
  // 找一条 xiaoming 发布的帖用于自接单探测
  const hall = await api('/api/posts?page=0&size=30')
  const posts = (hall.j && hall.j.data && hall.j.data.list) || []
  const xmPost = posts.find(p => String(p.publisherId || (p.publisher && p.publisher.id)) === String(xm.id)) || posts[0]
  const anyPost = posts[0]
  if (xmPost) {
    const cid = 'c-t' + xmPost.id + '-u' + Math.min(xm.id, xh.id) + '-' + Math.max(xm.id, xh.id)
    rec('TC_ORD_002', '发布者对自己帖子下单(自接单)', await api('/api/orders', { method: 'POST', token: xm.token, body: { postId: xmPost.id, chatId: cid } }))
  }
  if (anyPost && probe) {
    rec('TC_ORD_003', '未实名账户下单', await api('/api/orders', { method: 'POST', token: probe.token, body: { postId: anyPost.id, chatId: 'c-probe' } }))
  }
  // 越权：非参与者取消/接受一个不存在或他人的订单 → 期望被拒
  rec('TC_ORD_FORBID', '越权接受不存在/他人订单(id=999999)', await api('/api/orders/999999/accept', { method: 'POST', token: xh.token }))
  rec('TC_DIS_003', '越权对他人订单发起申诉(id=999999)', await api('/api/orders/999999/dispute', { method: 'POST', token: xh.token, body: { reason: '拼接他人订单ID' } }))

  // ========== 五、举报（空原因→期望被拒；小程序举报为纯原因文本，无分类单选） ==========
  console.log('\n[五] 举报模块')
  if (anyPost) {
    rec('TC_REP_002', '举报原因为空提交', await api('/api/posts/' + anyPost.id + '/report', { method: 'POST', token: xm.token, body: { reason: '' } }))
  }

  // ========== 六、大厅乱码检索（有效等价类→期望正常空集） ==========
  console.log('\n[六] 大厅检索')
  const g = await api('/api/posts?keyword=zzxqwjunk9999&page=0&size=5')
  results.push({ tc: 'TC_HALL_003', point: '大厅乱码无结果检索', backend: (g.j && g.j.success) ? ('后端正常返回空集(list=' + ((g.j.data && g.j.data.list && g.j.data.list.length) || 0) + ', HTTP 200)') : ('后端异常(HTTP ' + g.status + ')'), pass: !!(g.j && g.j.success) })
  console.log('  ' + ((g.j && g.j.success) ? '✓ ' : '✗ ') + 'TC_HALL_003 → ' + results[results.length - 1].backend)

  // ========== 汇总落盘 ==========
  const pass = results.filter(r => r.pass).length
  console.log('\n────────── 取证汇总 ──────────')
  console.log('  共 ' + results.length + ' 项：后端符合预期 ' + pass + ' / 需关注 ' + (results.length - pass))
  require('fs').writeFileSync(__dirname + '/mp-equiv-results.json', JSON.stringify({ base: B, pass, total: results.length, results }, null, 2))
  console.log('  结果已写入 tests/mp-equiv-results.json\n')
}
run().catch(e => { console.error('探针无法执行：' + e.message); process.exit(1) })
