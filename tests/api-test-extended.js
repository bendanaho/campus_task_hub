/**
 * 校园互助 · 后端接口【深度业务规则】自动化测试（扩展套件）
 * ------------------------------------------------------------------
 * 在基础 api-test.js（连通性 + happy-path）之上，补齐测试计划强调的
 * “资金冻结/结算金额精确核对、权限拦截、订单状态非法流转、未实名限制、
 *  组队帖不动资金、账单流水、多角色可见性、跨端数据一致性”等深度用例。
 *
 * 仅面向【可写】本地 H2 后端（数据重启即清，可反复跑）：
 *   node tests/api-test-extended.js            默认 local
 * ------------------------------------------------------------------
 */

const BASE = process.env.BASE || 'http://localhost:8080'

const C = { g: '\x1b[32m', r: '\x1b[31m', y: '\x1b[33m', d: '\x1b[90m', b: '\x1b[1m', x: '\x1b[0m' }
let passed = 0, failed = 0
const failures = []
const records = [] // 结构化结果，供报告引用

async function test(name, fn) {
  try {
    const detail = await fn()
    passed++
    records.push({ name, ok: true, detail: detail || '' })
    console.log(`  ${C.g}✓${C.x} ${name}${detail ? C.d + '  — ' + detail + C.x : ''}`)
  } catch (e) {
    failed++
    failures.push({ name, msg: e.message })
    records.push({ name, ok: false, detail: e.message })
    console.log(`  ${C.r}✗ ${name}${C.x}\n     ${C.r}${e.message}${C.x}`)
  }
}
function assert(cond, msg) { if (!cond) throw new Error(msg || '断言失败') }
function eq(a, b, l) { if (a !== b) throw new Error(`${l || ''} 期望 ${JSON.stringify(b)}，实际 ${JSON.stringify(a)}`) }
function near(a, b, l) { if (Math.abs(Number(a) - Number(b)) > 1e-6) throw new Error(`${l || ''} 期望 ${b}，实际 ${a}`) }

async function api(path, { method = 'GET', body, token } = {}) {
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers.Authorization = 'Bearer ' + token
  const res = await fetch(BASE + path, { method, headers, body: body ? JSON.stringify(body) : undefined })
  let json = null
  try { json = await res.json() } catch (e) {}
  return { status: res.status, json }
}
const chatId = (postId, a, b) => 'c-t' + postId + '-u' + Math.min(a, b) + '-' + Math.max(a, b)

async function login(account, password) {
  const r = await api('/api/login', { method: 'POST', body: { account, password } })
  assert(r.json && r.json.success, '登录失败 ' + account + ': ' + (r.json && r.json.message))
  return { token: r.json.data.token, id: r.json.data.user.id, name: account }
}
async function balance(u) {
  const r = await api('/api/user/balance', { token: u.token })
  assert(r.json && r.json.success, '取余额失败')
  return Number(r.json.data.balance)
}
async function ensureChat(actor, partner, postId, title) {
  return api('/api/conversations/ensure', {
    method: 'POST', token: actor.token,
    body: { chatId: chatId(postId, actor.id, partner.id), partnerId: partner.id, partnerName: partner.name, taskId: postId, taskTitle: title }
  })
}
async function publish(u, { title, side, category, reward, rewardValue }) {
  const r = await api('/api/posts', {
    method: 'POST', token: u.token,
    body: { title, publisherSide: side, category, description: '扩展自动化测试生成，可忽略',
      reward: reward, rewardValue: rewardValue, deadline: '2030-01-01T18:00:00', contact: '站内联系' }
  })
  assert(r.json && r.json.success, '发帖失败: ' + (r.json && r.json.message))
  return r.json.data.task.id
}

async function run() {
  console.log(`\n${C.b}后端深度业务规则测试${C.x}  ${BASE}\n`)

  const A = await login('张三', '1')   // 发布者/付款方
  const B = await login('李四', '1')   // 接单者/收款方
  const D = await login('刘同学', '1') // 第三方（非订单参与者）

  // ===== 场景一：悬赏帖资金闭环 —— 精确核对冻结/结算金额 =====
  console.log(`${C.b}[场景一] 悬赏帖资金闭环（冻结与结算金额精确核对）${C.x}`)
  {
    const REWARD = 7
    const a0 = await balance(A), b0 = await balance(B)
    const postId = await publish(A, { title: '[扩展] 悬赏¥7取快递', side: 'payer', category: 'errand', reward: '7元', rewardValue: REWARD })
    await ensureChat(B, A, postId, '悬赏¥7')
    const co = await api('/api/orders', { method: 'POST', token: B.token, body: { postId, chatId: chatId(postId, A.id, B.id) } })
    assert(co.json && co.json.success, '下单失败')
    const orderId = co.json.data.id
    eq(co.json.data.status, 'pending', '新订单状态')
    near(co.json.data.amount, REWARD, '订单金额=帖子报酬')

    await test('接受订单后：付款方(张三)余额精确 −报酬（冻结）', async () => {
      const r = await api('/api/orders/' + orderId + '/accept', { method: 'POST', token: A.token })
      assert(r.json.success, r.json.message); eq(r.json.data.status, 'in_progress', '状态')
      const a1 = await balance(A)
      near(a1, a0 - REWARD, '张三余额')
      return `¥${a0}→¥${a1}（冻结${REWARD}）`
    })
    await test('冻结阶段：收款方(李四)余额不变', async () => {
      near(await balance(B), b0, '李四余额'); return `保持 ¥${b0}`
    })
    await test('双方确认完成后：收款方(李四)余额精确 +报酬（结算）', async () => {
      await api('/api/orders/' + orderId + '/confirm', { method: 'POST', token: B.token })
      const r = await api('/api/orders/' + orderId + '/confirm', { method: 'POST', token: A.token })
      eq(r.json.data.status, 'completed', '状态')
      const b1 = await balance(B)
      near(b1, b0 + REWARD, '李四余额')
      return `¥${b0}→¥${b1}（结算${REWARD}）`
    })
    await test('结算后：付款方(张三)不再退款，净支出=报酬', async () => {
      near(await balance(A), a0 - REWARD, '张三终余额'); return `净支出 ¥${REWARD}`
    })
    await test('账单流水：收款方生成一笔 in/order 金额=报酬', async () => {
      const r = await api('/api/user/bills', { token: B.token })
      const hit = (r.json.data.list || []).find(t => String(t.relatedId) === String(orderId) && t.direction === 'in')
      assert(hit, '未找到该订单的入账流水')
      near(hit.amount, REWARD, '流水金额')
      return `direction=in, amount=¥${hit.amount}, category=${hit.category}`
    })
    await test('订单在双方“我的订单”均可见', async () => {
      const ra = await api('/api/orders/mine', { token: A.token })
      const rb = await api('/api/orders/mine', { token: B.token })
      const oid = o => (o.order && o.order.id) != null ? o.order.id : o.id
      const inA = (ra.json.data || []).some(o => oid(o) === orderId)
      const inB = (rb.json.data || []).some(o => oid(o) === orderId)
      assert(inA && inB, '双方订单列表都应包含该订单')
      return '发布方/接单方各自可见'
    })
    await test('跨端一致性：帖子详情可被任意端读到同一条数据', async () => {
      const r = await api('/api/posts/' + postId)
      assert(r.json.success && r.json.data.task.id === postId, '详情应返回同一帖子')
      return `postId=${postId} 详情可读`
    })
    await test('重复评价同一订单被拒', async () => {
      await api('/api/reviews', { method: 'POST', token: A.token, body: { orderId, toUserId: B.id, toUserName: B.name, rating: 5, content: '好评' } })
      const dup = await api('/api/reviews', { method: 'POST', token: A.token, body: { orderId, toUserId: B.id, toUserName: B.name, rating: 4, content: '重复' } })
      eq(dup.json.success, false, '重复评价应被拒'); return '第二次评价被拦截'
    })
  }

  // ===== 场景二：服务帖 + 余额不足拦截 =====
  console.log(`\n${C.b}[场景二] 服务帖下单方付款 + 余额不足拦截${C.x}`)
  {
    const BIG = 999999
    const postId = await publish(A, { title: '[扩展] 天价服务', side: 'earner', category: 'service', reward: '巨额', rewardValue: BIG })
    await ensureChat(B, A, postId, '天价服务')
    const co = await api('/api/orders', { method: 'POST', token: B.token, body: { postId, chatId: chatId(postId, A.id, B.id) } })
    const orderId = co.json.data.id
    const b0 = await balance(B)
    await test('余额不足时接受订单失败（BALANCE_NOT_ENOUGH）', async () => {
      const r = await api('/api/orders/' + orderId + '/accept', { method: 'POST', token: A.token })
      eq(r.json.success, false, '应因余额不足失败'); return r.json.message || '被拒'
    })
    await test('接受失败后：付款方余额未被扣减', async () => {
      near(await balance(B), b0, '李四余额'); return `保持 ¥${b0}`
    })
  }

  // ===== 场景三：组队/纯互助帖不产生任何资金流动 =====
  console.log(`\n${C.b}[场景三] 组队互助帖（无偿）不冻结、不结算${C.x}`)
  {
    const a0 = await balance(A), b0 = await balance(B)
    const postId = await publish(A, { title: '[扩展] 组队自习', side: 'none', category: 'team', reward: '无偿', rewardValue: 0 })
    await ensureChat(B, A, postId, '组队自习')
    const co = await api('/api/orders', { method: 'POST', token: B.token, body: { postId, chatId: chatId(postId, A.id, B.id) } })
    const orderId = co.json.data.id
    near(co.json.data.amount, 0, '组队订单金额应为0')
    await test('接受→双方确认全程，双方余额均不变', async () => {
      await api('/api/orders/' + orderId + '/accept', { method: 'POST', token: A.token })
      await api('/api/orders/' + orderId + '/confirm', { method: 'POST', token: B.token })
      const r = await api('/api/orders/' + orderId + '/confirm', { method: 'POST', token: A.token })
      eq(r.json.data.status, 'completed', '状态')
      near(await balance(A), a0, '张三余额'); near(await balance(B), b0, '李四余额')
      return `双方均保持（A ¥${a0} / B ¥${b0}）`
    })
  }

  // ===== 场景四：权限与订单状态非法流转 =====
  console.log(`\n${C.b}[场景四] 权限拦截与非法状态流转${C.x}`)
  {
    const postId = await publish(A, { title: '[扩展] 权限测试帖', side: 'payer', category: 'errand', reward: '3元', rewardValue: 3 })
    await ensureChat(B, A, postId, '权限测试')
    const orderId = (await api('/api/orders', { method: 'POST', token: B.token, body: { postId, chatId: chatId(postId, A.id, B.id) } })).json.data.id

    await test('非发布者(王五)不能接受订单（FORBIDDEN）', async () => {
      const r = await api('/api/orders/' + orderId + '/accept', { method: 'POST', token: D.token })
      eq(r.json.success, false, '第三方接受应被拒'); return r.json.message || '被拒'
    })
    await test('非参与者(王五)不能取消订单', async () => {
      const r = await api('/api/orders/' + orderId + '/cancel', { method: 'POST', token: D.token })
      eq(r.json.success, false, '第三方取消应被拒'); return r.json.message || '被拒'
    })
    await test('发布者正常接受订单（→ in_progress）', async () => {
      const r = await api('/api/orders/' + orderId + '/accept', { method: 'POST', token: A.token })
      eq(r.json.data.status, 'in_progress', '状态'); return 'in_progress'
    })
    await test('重复接受同一订单被拒（非法状态流转）', async () => {
      const r = await api('/api/orders/' + orderId + '/accept', { method: 'POST', token: A.token })
      eq(r.json.success, false, '重复接受应被拒'); return r.json.message || '被拒'
    })
    await test('进行中订单不能被取消（cancel 仅限 pending）', async () => {
      const r = await api('/api/orders/' + orderId + '/cancel', { method: 'POST', token: A.token })
      eq(r.json.success, false, '进行中取消应被拒'); return r.json.message || '被拒'
    })
    await test('完成后重复确认被拒（不会重复打款）', async () => {
      await api('/api/orders/' + orderId + '/confirm', { method: 'POST', token: B.token })
      await api('/api/orders/' + orderId + '/confirm', { method: 'POST', token: A.token }) // completed
      const again = await api('/api/orders/' + orderId + '/confirm', { method: 'POST', token: A.token })
      eq(again.json.success, false, '完成后再确认应被拒'); return again.json.message || '被拒'
    })
  }

  // ===== 场景五：待接受订单可取消（取消前无冻结，余额不动） =====
  console.log(`\n${C.b}[场景五] 待接受订单取消${C.x}`)
  {
    const a0 = await balance(A), b0 = await balance(B)
    const postId = await publish(A, { title: '[扩展] 可取消帖', side: 'payer', category: 'errand', reward: '5元', rewardValue: 5 })
    await ensureChat(B, A, postId, '可取消')
    const orderId = (await api('/api/orders', { method: 'POST', token: B.token, body: { postId, chatId: chatId(postId, A.id, B.id) } })).json.data.id
    await test('接单者可取消待接受订单（→ cancelled）', async () => {
      const r = await api('/api/orders/' + orderId + '/cancel', { method: 'POST', token: B.token })
      eq(r.json.data.status, 'cancelled', '状态'); return 'cancelled'
    })
    await test('取消后双方余额不变（冻结发生在接受，取消早于冻结）', async () => {
      near(await balance(A), a0, '张三'); near(await balance(B), b0, '李四'); return `A ¥${a0} / B ¥${b0}`
    })
    await test('已取消订单不能再被接受', async () => {
      const r = await api('/api/orders/' + orderId + '/accept', { method: 'POST', token: A.token })
      eq(r.json.success, false, '取消后接受应被拒'); return r.json.message || '被拒'
    })
  }

  // ===== 场景六：未实名认证限制 + 参数校验 =====
  console.log(`\n${C.b}[场景六] 未实名限制与鉴权/参数校验${C.x}`)
  {
    const uname = '扩展未实名' + (A.id) // 结合已登录 id 增加唯一性
    await api('/api/register', { method: 'POST', body: { username: uname, phone: '139' + String(10000000 + (A.id * 7 + 13)), password: '1' } })
    let U = null
    try { U = await login(uname, '1') } catch (e) {}
    const postId = (await api('/api/posts?page=0&size=1')).json.data.list[0].id
    await test('新注册用户默认 authStatus=unverified', async () => {
      const r = await api('/api/login', { method: 'POST', body: { account: uname, password: '1' } })
      eq(r.json.data.user.authStatus, 'unverified', 'authStatus'); return 'unverified'
    })
    await test('未实名用户不能创建订单（VERIFICATION_REQUIRED）', async () => {
      assert(U, '未实名用户应能登录')
      const r = await api('/api/orders', { method: 'POST', token: U.token, body: { postId, chatId: 'c-x' } })
      eq(r.json.success, false, '未实名下单应被拒'); return r.json.message || '被拒'
    })
    await test('无 token 访问受保护接口被拒', async () => {
      const r = await api('/api/user/bills')
      const rejected = r.status === 401 || r.status === 403 || (r.json && r.json.success === false)
      assert(rejected, '未带 token 不应成功'); return 'status=' + r.status
    })
    await test('错误密码登录被拒', async () => {
      const r = await api('/api/login', { method: 'POST', body: { account: '张三', password: 'x' } })
      eq(r.json.success, false, '错误密码应被拒'); return '被拒'
    })
    await test('普通用户访问管理员接口被拒（越权拦截）', async () => {
      const r = await api('/api/admin/reports', { token: A.token })
      const rejected = r.status === 401 || r.status === 403 || (r.json && r.json.success === false)
      assert(rejected, '普通用户不应能访问管理员接口，实际 status=' + r.status)
      return 'status=' + r.status
    })
  }

  console.log(`\n${C.b}────────── 深度测试汇总 ──────────${C.x}`)
  console.log(`  ${C.g}通过 ${passed}${C.x} / ${C.r}失败 ${failed}${C.x}  （共 ${passed + failed} 项）`)
  if (failures.length) { console.log(`\n${C.r}失败明细：${C.x}`); failures.forEach(f => console.log(`  · ${f.name}: ${f.msg}`)) }

  // 结构化结果落盘，供生成报告使用
  const fs = require('fs')
  fs.writeFileSync(__dirname + '/extended-results.json', JSON.stringify({ passed, failed, records }, null, 2))
  console.log('')
  process.exit(failed > 0 ? 1 : 0)
}
run().catch(e => { console.error(`\n${C.r}测试无法执行：${e.message}${C.x}\n`); process.exit(1) })
