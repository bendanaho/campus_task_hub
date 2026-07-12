/**
 * 校园互助 · 后端接口自动化测试脚本
 * ------------------------------------------------------------------
 * 无需安装任何依赖，Node 18+ 直接运行（用内置 fetch）。
 *
 * 用法：
 *   node tests/api-test.js              本地 H2 后端，跑【全部用例】（含交易写入，H2 重启即清，可反复跑）
 *   node tests/api-test.js online       线上 MySQL 后端，只跑【只读+鉴权用例】（自动跳过写入，保护演示库）
 *   node tests/api-test.js local        显式指定本地
 *
 * 账号：本地用种子 张三/李四(密码1)，线上用 xiaoming/xiaohong(密码123456)。
 * ------------------------------------------------------------------
 */

const PROFILES = {
  local: {
    base: 'http://localhost:8080',
    userA: { account: '张三', password: '1' },
    userB: { account: '李四', password: '1' },
    writable: true // H2 内存库，写入数据重启即清，可跑交易全流程
  },
  online: {
    base: 'http://182.92.133.163:8081',
    userA: { account: 'xiaoming', password: '123456' },
    userB: { account: 'xiaohong', password: '123456' },
    writable: false // MySQL 持久库，默认不跑写入用例，避免污染演示数据
  }
}

const profileName = (process.argv[2] || 'local').toLowerCase()
const P = PROFILES[profileName]
if (!P) {
  console.error('未知环境：' + profileName + '（可选 local / online）')
  process.exit(1)
}

// ---------------- 迷你测试框架 ----------------
const C = { g: '\x1b[32m', r: '\x1b[31m', y: '\x1b[33m', d: '\x1b[90m', b: '\x1b[1m', x: '\x1b[0m' }
let passed = 0, failed = 0, skipped = 0
const failures = []

async function test(name, fn) {
  try {
    await fn()
    passed++
    console.log(`  ${C.g}✓${C.x} ${name}`)
  } catch (e) {
    failed++
    failures.push({ name, msg: e.message })
    console.log(`  ${C.r}✗ ${name}${C.x}\n     ${C.r}${e.message}${C.x}`)
  }
}

function skip(name, reason) {
  skipped++
  console.log(`  ${C.y}○${C.x} ${C.d}${name}（跳过：${reason}）${C.x}`)
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg || '断言失败')
}
function assertEq(actual, expected, label) {
  if (actual !== expected) throw new Error(`${label || ''} 期望 ${JSON.stringify(expected)}，实际 ${JSON.stringify(actual)}`)
}

// ---------------- 请求封装 ----------------
async function api(path, { method = 'GET', body, token } = {}) {
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers.Authorization = 'Bearer ' + token
  const res = await fetch(P.base + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  })
  let json = null
  try { json = await res.json() } catch (e) { /* 可能是空体或非 JSON */ }
  return { status: res.status, json }
}

function chatId(postId, a, b) {
  const lo = Math.min(a, b), hi = Math.max(a, b)
  return 'c-t' + postId + '-u' + lo + '-' + hi
}

// ---------------- 用例 ----------------
async function run() {
  console.log(`\n${C.b}后端接口自动化测试${C.x}  环境=${profileName}  ${P.base}\n`)

  let tokenA = '', tokenB = '', uidA = 0, uidB = 0

  // ===== 一、鉴权 =====
  console.log(`${C.b}[一] 鉴权${C.x}`)
  await test('登录成功返回 token 与用户信息', async () => {
    const r = await api('/api/login', { method: 'POST', body: P.userA })
    assertEq(r.json && r.json.success, true, 'success')
    assert(r.json.data.token, '应返回 token')
    assert(r.json.data.user && r.json.data.user.id, '应返回 user.id')
    tokenA = r.json.data.token
    uidA = r.json.data.user.id
  })
  await test('第二个账号也能登录', async () => {
    const r = await api('/api/login', { method: 'POST', body: P.userB })
    assertEq(r.json && r.json.success, true, 'success')
    tokenB = r.json.data.token
    uidB = r.json.data.user.id
    assert(uidA !== uidB, '两个账号 id 应不同')
  })
  await test('错误密码被拒绝', async () => {
    const r = await api('/api/login', { method: 'POST', body: { account: P.userA.account, password: 'wrong_pwd' } })
    assertEq(r.json && r.json.success, false, '错误密码应 success=false')
  })
  await test('无 token 访问受保护接口被拒（HTTP 401/403 或业务错误）', async () => {
    const r = await api('/api/user/balance')
    const rejected = r.status === 401 || r.status === 403 || (r.json && r.json.success === false)
    assert(rejected, '未带 token 不应返回成功，实际 status=' + r.status)
  })
  await test('带 token 访问受保护接口成功', async () => {
    const r = await api('/api/user/balance', { token: tokenA })
    assertEq(r.json && r.json.success, true, 'success')
    assert(typeof r.json.data.balance !== 'undefined', '应返回 balance')
  })

  // ===== 二、帖子大厅 =====
  console.log(`\n${C.b}[二] 帖子大厅${C.x}`)
  let samplePostId = 0
  await test('大厅列表返回分页结构 {list,hasMore,total}', async () => {
    const r = await api('/api/posts?page=0&size=5')
    assertEq(r.json && r.json.success, true, 'success')
    const d = r.json.data
    assert(Array.isArray(d.list), 'data.list 应为数组')
    assert(typeof d.hasMore === 'boolean', 'data.hasMore 应为布尔')
    assert(typeof d.total === 'number', 'data.total 应为数字')
    if (d.list.length) samplePostId = d.list[0].id
  })
  await test('帖子详情返回 {task, publisher}', async () => {
    assert(samplePostId, '需先取到一个帖子 id')
    const r = await api('/api/posts/' + samplePostId)
    assertEq(r.json && r.json.success, true, 'success')
    assert(r.json.data.task && r.json.data.task.id, '应含 task')
    assert(r.json.data.publisher, '应含 publisher')
  })
  await test('分类筛选只返回该分类', async () => {
    const r = await api('/api/posts?categories=errand&page=0&size=20')
    assertEq(r.json && r.json.success, true, 'success')
    const bad = (r.json.data.list || []).filter(p => p.category !== 'errand')
    assertEq(bad.length, 0, '筛选 errand 却混入其它分类')
  })

  // ===== 三、用户与钱包 =====
  console.log(`\n${C.b}[三] 用户与钱包${C.x}`)
  await test('用户资料接口返回公开字段', async () => {
    const r = await api('/api/users/' + uidA, { token: tokenA })
    assertEq(r.json && r.json.success, true, 'success')
    assert(r.json.data.username, '应返回 username')
    assert(typeof r.json.data.creditScore !== 'undefined', '应返回 creditScore')
  })
  await test('账单接口返回 list 与收支合计', async () => {
    const r = await api('/api/user/bills', { token: tokenA })
    assertEq(r.json && r.json.success, true, 'success')
    assert(Array.isArray(r.json.data.list), 'data.list 应为数组')
    assert(typeof r.json.data.totalIn !== 'undefined', '应返回 totalIn')
  })
  await test('未读消息统计返回 total 与 byChat', async () => {
    const r = await api('/api/messages/unread', { token: tokenA })
    assertEq(r.json && r.json.success, true, 'success')
    assert(typeof r.json.data.total === 'number', 'total 应为数字')
    assert(r.json.data.byChat && typeof r.json.data.byChat === 'object', 'byChat 应为对象')
  })

  // ===== 四、会话与消息 =====
  console.log(`\n${C.b}[四] 会话与消息${C.x}`)
  await test('会话列表可获取', async () => {
    const r = await api('/api/conversations', { token: tokenA })
    assertEq(r.json && r.json.success, true, 'success')
    assert(Array.isArray(r.json.data), 'data 应为数组')
  })

  // ===== 五、交易全流程（仅可写环境）=====
  console.log(`\n${C.b}[五] 交易全流程（发布→下单→接受→双方确认→评价）${C.x}`)
  if (!P.writable) {
    skip('发布悬赏帖', '线上持久库，避免污染演示数据')
    skip('响应并创建订单', '同上')
    skip('接受订单（冻结资金）', '同上')
    skip('双方确认完成（结算）', '同上')
    skip('提交评价', '同上')
    skip('不能对自己的帖子下单', '同上')
  } else {
    let postId = 0, orderId = 0
    const cid = () => chatId(postId, uidA, uidB)

    await test('张三发布 ¥1 悬赏帖', async () => {
      const r = await api('/api/posts', {
        method: 'POST', token: tokenA,
        body: {
          title: '[自动化测试] 帮取快递', publisherSide: 'payer', category: 'errand',
          description: '接口自动化测试生成，可忽略', reward: '1元', rewardValue: 1,
          deadline: '2030-01-01T18:00:00', contact: '站内联系'
        }
      })
      assertEq(r.json && r.json.success, true, r.json && r.json.message)
      postId = r.json.data.task.id
      assert(postId, '应返回新帖 id')
    })
    await test('不能对自己发布的帖子下单（错误分支）', async () => {
      const r = await api('/api/orders', { method: 'POST', token: tokenA, body: { postId, chatId: cid() } })
      assertEq(r.json && r.json.success, false, '对自己帖子下单应被拒')
    })
    await test('李四确保会话存在', async () => {
      const r = await api('/api/conversations/ensure', {
        method: 'POST', token: tokenB,
        body: { chatId: cid(), partnerId: uidA, partnerName: P.userA.account, taskId: postId, taskTitle: '测试' }
      })
      assertEq(r.json && r.json.success, true, r.json && r.json.message)
    })
    await test('李四响应并创建订单（pending）', async () => {
      const r = await api('/api/orders', { method: 'POST', token: tokenB, body: { postId, chatId: cid() } })
      assertEq(r.json && r.json.success, true, r.json && r.json.message)
      orderId = r.json.data.id
      assertEq(r.json.data.status, 'pending', '新订单状态')
    })
    await test('张三接受订单（→ in_progress，冻结资金）', async () => {
      const r = await api('/api/orders/' + orderId + '/accept', { method: 'POST', token: tokenA })
      assertEq(r.json && r.json.success, true, r.json && r.json.message)
      assertEq(r.json.data.status, 'in_progress', '接受后状态')
    })
    await test('李四确认完成（单方，仍 in_progress）', async () => {
      const r = await api('/api/orders/' + orderId + '/confirm', { method: 'POST', token: tokenB })
      assertEq(r.json && r.json.success, true, r.json && r.json.message)
      assertEq(r.json.data.status, 'in_progress', '单方确认后仍进行中')
    })
    await test('张三确认完成（双方，→ completed，结算）', async () => {
      const r = await api('/api/orders/' + orderId + '/confirm', { method: 'POST', token: tokenA })
      assertEq(r.json && r.json.success, true, r.json && r.json.message)
      assertEq(r.json.data.status, 'completed', '双方确认后完成')
    })
    await test('张三评价李四', async () => {
      const r = await api('/api/reviews', {
        method: 'POST', token: tokenA,
        body: { orderId, toUserId: uidB, toUserName: P.userB.account, rating: 5, content: '自动化测试好评' }
      })
      assertEq(r.json && r.json.success, true, r.json && r.json.message)
    })
    await test('重复评价同一订单被拒', async () => {
      const r = await api('/api/reviews', {
        method: 'POST', token: tokenA,
        body: { orderId, toUserId: uidB, toUserName: P.userB.account, rating: 4, content: '重复' }
      })
      assertEq(r.json && r.json.success, false, '重复评价应被拒')
    })
  }

  // ===== 汇总 =====
  const total = passed + failed + skipped
  console.log(`\n${C.b}────────── 测试汇总 ──────────${C.x}`)
  console.log(`  共 ${total} 项：${C.g}通过 ${passed}${C.x} / ${C.r}失败 ${failed}${C.x} / ${C.y}跳过 ${skipped}${C.x}`)
  if (failures.length) {
    console.log(`\n${C.r}失败明细：${C.x}`)
    failures.forEach(f => console.log(`  · ${f.name}\n      ${f.msg}`))
  }
  console.log('')
  process.exit(failed > 0 ? 1 : 0)
}

run().catch(e => {
  console.error(`\n${C.r}测试无法执行：${e.message}${C.x}`)
  console.error(`${C.d}请确认后端已启动，且地址正确：${P.base}${C.x}\n`)
  process.exit(1)
})
