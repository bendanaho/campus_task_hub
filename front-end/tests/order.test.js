// 订单系统单元测试（统一后的 payer/earner 模型）
// 运行：在 front-end 目录执行  npm test   （或  node --test tests/）
//
// 覆盖：数据结构、服务帖下单全流程、悬赏帖接单全流程、金额冻结/结算、
//      各种非法操作拦截、取消、自动确认、超时默认好评、我的订单筛选、大厅筛选。

const { test } = require('node:test');
const assert = require('node:assert');
const { createApp, loginAs, balanceOf } = require('./load');

// ---------- 数据结构 ----------

test('数据结构：统一为 orders 表、帖子带 publisherSide、无旧字段', function () {
    const app = createApp();
    const db = app.getDB();
    assert.ok(Array.isArray(db.orders), 'orders 应存在');
    assert.ok(!('serviceOrders' in db), '不应再有 serviceOrders');
    assert.ok(db.tasks.every(function (t) { return t.publisherSide === 'payer' || t.publisherSide === 'earner' || t.publisherSide === 'none'; }), '每个帖子都有 publisherSide');
    assert.ok(db.tasks.every(function (t) { return !('paymentStatus' in t) && !('takerId' in t) && !('type' in t); }), '帖子不应残留旧订单字段');
    assert.ok(db.reviews.every(function (r) { return 'auto' in r; }), '评价带 auto 标记');
});

// ---------- 服务帖（发布者收钱 earner）下单全流程 ----------

test('服务帖全流程：下单不扣款 → 接受冻结付款方 → 双方确认完成并结算', async function () {
    const app = createApp();
    // t18：发布者 u2 收钱(earner)，报酬 15
    await loginAs(app, '王同学'); // u3 付款方，余额 80
    assert.strictEqual(balanceOf(app, 'u3'), 80);

    const created = await app.createOrder('t18', 'chatA');
    const oid = created.order.id;
    assert.strictEqual(created.order.status, 'pending');
    assert.strictEqual(created.order.payerId, 'u3');
    assert.strictEqual(created.order.earnerId, 'u2');
    assert.strictEqual(balanceOf(app, 'u3'), 80, '下单(pending)阶段不应扣款');

    await loginAs(app, '李四'); // u2 是发布者，来接受
    const accepted = await app.acceptOrder(oid);
    assert.strictEqual(accepted.order.status, 'in_progress');
    assert.strictEqual(balanceOf(app, 'u3'), 65, '接受时冻结付款方 80-15=65');

    // earner(u2) 先确认 → 仍进行中，挂上自动确认计时
    const c1 = await app.confirmOrder(oid);
    assert.strictEqual(c1.order.status, 'in_progress');
    assert.strictEqual(c1.order.earnerConfirmed, true);
    assert.strictEqual(c1.order.payerConfirmed, false);
    assert.ok(c1.order.autoConfirmAt, '首个确认后应设置 autoConfirmAt');

    // payer(u3) 再确认 → 完成并结算给收款方 u2
    const u2Before = balanceOf(app, 'u2');
    await loginAs(app, '王同学');
    const c2 = await app.confirmOrder(oid);
    assert.strictEqual(c2.order.status, 'completed');
    assert.ok(c2.order.reviewDeadline, '完成后应设置评价窗口');
    assert.strictEqual(balanceOf(app, 'u2'), u2Before + 15, '完成后收款方 +15');
});

// ---------- 悬赏帖（发布者出钱 payer）接单全流程 ----------

test('悬赏帖全流程：接单 → 发布者接受(冻结+下架) → 完成结算给接单者', async function () {
    const app = createApp();
    // t3：发布者 u4 出钱(payer)，报酬 15，状态 open
    await loginAs(app, '张三'); // u1 接单者（收款方 earner）
    const created = await app.createOrder('t3', 'chatB');
    const oid = created.order.id;
    assert.strictEqual(created.order.payerId, 'u4', '悬赏帖：发布者是付款方');
    assert.strictEqual(created.order.earnerId, 'u1', '接单者是收款方');

    await loginAs(app, '陈同学'); // u4 发布者接受
    await app.acceptOrder(oid);
    assert.strictEqual(balanceOf(app, 'u4'), 85, '冻结发布者 100-15=85');
    assert.strictEqual(app.getTaskById('t3').status, 'closed', '悬赏帖被接受后从大厅下架');

    // 双方确认 → 完成，收款方 u1 +15
    const u1Before = balanceOf(app, 'u1');
    await app.confirmOrder(oid);          // u4(payer) 确认
    await loginAs(app, '张三');
    const done = await app.confirmOrder(oid); // u1(earner) 确认
    assert.strictEqual(done.order.status, 'completed');
    assert.strictEqual(balanceOf(app, 'u1'), u1Before + 15);
});

test('服务帖被下单后仍保持 open（可复用），不像悬赏帖那样下架', async function () {
    const app = createApp();
    await loginAs(app, '王同学');
    const created = await app.createOrder('t18', 'chatC');
    await loginAs(app, '李四');
    await app.acceptOrder(created.order.id);
    assert.strictEqual(app.getTaskById('t18').status, 'open', '服务帖接单后仍 open');
});

// ---------- 纯互助（none，不涉及金钱）全流程 ----------

test('纯互助帖全流程：报名(金额0) → 接受不冻结 → 双方确认完成不结算，帖子保持 open', async function () {
    const app = createApp();
    // t12 羽毛球搭子：发布者 u5，publisherSide=none
    await loginAs(app, '张三'); // u1 报名参加
    const u1Before = balanceOf(app, 'u1');

    const created = await app.createOrder('t12', 'chatN');
    const oid = created.order.id;
    assert.strictEqual(created.order.status, 'pending');
    assert.strictEqual(created.order.amount, 0, '纯互助订单金额恒为 0');

    await loginAs(app, '赵同学'); // u5 发布者接受
    const u5Before = balanceOf(app, 'u5');
    const accepted = await app.acceptOrder(oid);
    assert.strictEqual(accepted.order.status, 'in_progress');
    assert.strictEqual(balanceOf(app, 'u1'), u1Before, '接受时不冻结任何余额');
    assert.strictEqual(balanceOf(app, 'u5'), u5Before, '发布者余额不变');
    assert.strictEqual(app.getTaskById('t12').status, 'open', '纯互助帖被接受后仍 open，可多人报名');

    // 双方确认 → 完成，双方余额均不变
    await app.confirmOrder(oid);       // u5 确认
    await loginAs(app, '张三');
    const done = await app.confirmOrder(oid); // u1 确认
    assert.strictEqual(done.order.status, 'completed');
    assert.strictEqual(balanceOf(app, 'u1'), u1Before, '完成后无结算');
    assert.strictEqual(balanceOf(app, 'u5'), u5Before, '完成后无结算');

    // 纯互助订单同样可评价
    const r = await app.submitReview({ orderId: oid, toUserId: 'u5', toUserName: '赵同学', rating: 5, content: '很准时' });
    assert.ok(r.success, '纯互助订单可正常评价');
});

// ---------- 实名门禁 ----------

test('实名门禁：未实名不能发布/下单；完成实名认证后放行', async function () {
    const app = createApp();
    // 新注册用户默认 unverified
    await app.register({ username: '新同学', phone: '13900000000', password: '123456' });
    await loginAs(app, '新同学');

    await assert.rejects(app.publishPost({
        title: '测试帖', publisherSide: 'payer', category: 'other', description: 'x', reward: '5元'
    }), /实名认证/, '未实名不能发布');
    await assert.rejects(app.createOrder('t18', 'chatVerify'), /实名认证/, '未实名不能下单');

    // 完成实名认证后放行
    await app.submitAuth({ realName: '新同学', studentId: '2021999999', college: '计算机学院' });
    const created = await app.createOrder('t18', 'chatVerify');
    assert.strictEqual(created.order.status, 'pending', '实名后可正常下单');
});

// ---------- 余额 / 充值 ----------

test('余额查询与充值（虚拟钱包）', async function () {
    const app = createApp();
    await loginAs(app, '王同学'); // u3，种子余额 80
    assert.strictEqual((await app.getMyBalance()).balance, 80);

    const r = await app.recharge(50);
    assert.strictEqual(r.success, true);
    assert.strictEqual(r.balance, 130, '充值后余额 80+50=130');
    assert.strictEqual((await app.getMyBalance()).balance, 130, '再查一致');

    await assert.rejects(app.recharge(0), /充值金额/, '金额 0 被拒');
    await assert.rejects(app.recharge(-10), /充值金额/, '负数被拒');
    await assert.rejects(app.recharge(200000), /不能超过/, '超额被拒');
});

// ---------- 聊天收款 / 转账（直接支付） ----------

test('聊天收款：发起→对方支付，金额直接划转', async function () {
    const app = createApp();
    // u3(王同学,80) 向 u2(李四,85) 发起收款 15
    await loginAs(app, '王同学');
    const card = await app.sendPaymentCard('cPay', 'u2', 'request', 15);
    assert.strictEqual(card.message.type, 'payment');
    assert.strictEqual(card.message.payment.status, 'pending');
    assert.strictEqual(card.message.payment.payerId, 'u2', '付款方是对方');
    assert.strictEqual(card.message.payment.receiverId, 'u3', '收款方是我');
    assert.strictEqual(app.getUserById('u2').balance, 85, '未支付前不扣款');
    assert.strictEqual(app.getUserById('u3').balance, 80);

    // 收款方不能替对方支付
    await assert.rejects(app.payPaymentCard(card.message.id), /只有付款方/);

    // u2 支付 → u2 -15、u3 +15
    await loginAs(app, '李四');
    await app.payPaymentCard(card.message.id);
    assert.strictEqual(app.getUserById('u2').balance, 70);
    assert.strictEqual(app.getUserById('u3').balance, 95);
    // 重复支付被拒
    await assert.rejects(app.payPaymentCard(card.message.id), /已处理/);
});

test('聊天转账：立即扣款到账；余额不足被拒', async function () {
    const app = createApp();
    // u2(李四,85) 直接转 10 给 u3(王同学,80)
    await loginAs(app, '李四');
    const t = await app.sendPaymentCard('cPay', 'u3', 'transfer', 10);
    assert.strictEqual(t.message.payment.status, 'paid', '转账立即完成');
    assert.strictEqual(app.getUserById('u2').balance, 75);
    assert.strictEqual(app.getUserById('u3').balance, 90);
    // 余额不足
    await assert.rejects(app.sendPaymentCard('cPay', 'u3', 'transfer', 99999), /余额不足/);
});

test('聊天收付款需实名', async function () {
    const app = createApp();
    await app.register({ username: '未名', phone: '13911112222', password: '123456' });
    await loginAs(app, '未名');
    await assert.rejects(app.sendPaymentCard('cX', 'u2', 'request', 5), /实名认证/);
    await assert.rejects(app.sendPaymentCard('cX', 'u2', 'transfer', 5), /实名认证/);
});

// ---------- 非法操作拦截 ----------

test('不能对自己发布的帖子下单/接单', async function () {
    const app = createApp();
    await loginAs(app, '李四'); // u2 是 t18 的发布者
    await assert.rejects(app.createOrder('t18', 'chatX'), /不能对自己发布的帖子/);
});

test('悬赏帖：已有进行中订单时，拦截重复下单', async function () {
    const app = createApp();
    // t3：悬赏帖(payer)，发布者 u4
    await loginAs(app, '王同学');
    await app.createOrder('t3', 'chatD');     // 第一单 pending
    await loginAs(app, '张三');
    await assert.rejects(app.createOrder('t3', 'chatE'), /已有进行中的订单/);
});

test('服务帖/组队帖：允许同帖多个并发订单', async function () {
    const app = createApp();
    // 服务帖 t18(earner，发布者 u2)：两个不同用户可同时下单
    await loginAs(app, '王同学');
    const a = await app.createOrder('t18', 'chatMul1');
    await loginAs(app, '张三');
    const b = await app.createOrder('t18', 'chatMul2');
    assert.strictEqual(a.order.status, 'pending');
    assert.strictEqual(b.order.status, 'pending', '服务帖第二单不应被拦截');

    // 组队帖 t12(none，发布者 u5)：同理可多人报名
    const c = await app.createOrder('t12', 'chatMul3'); // 张三
    await loginAs(app, '王同学');
    const d = await app.createOrder('t12', 'chatMul4'); // 王同学
    assert.strictEqual(c.order.status, 'pending');
    assert.strictEqual(d.order.status, 'pending', '组队帖第二人报名不应被拦截');
});

test('接受时付款方余额不足 → 拦截，且不扣款', async function () {
    const app = createApp();
    // u1 发布一个收钱(earner)帖，报酬 999
    await loginAs(app, '张三');
    const post = await app.publishPost({
        title: '高价服务', publisherSide: 'earner', category: 'other',
        description: 'x', reward: '999元', contact: '站内联系'
    });
    const postId = post.task.id;
    // u3（余额 80）下单 → pending 可以
    await loginAs(app, '王同学');
    const created = await app.createOrder(postId, 'chatF');
    // u1 发布者接受 → 付款方 u3 余额不足
    await loginAs(app, '张三');
    await assert.rejects(app.acceptOrder(created.order.id), /余额不足/);
    assert.strictEqual(balanceOf(app, 'u3'), 80, '拦截后不应扣款');
});

// ---------- 取消 ----------

test('pending 订单可取消；in_progress 不可取消', async function () {
    const app = createApp();
    await loginAs(app, '王同学');
    const created = await app.createOrder('t18', 'chatG');
    const oid = created.order.id;
    const cancelled = await app.cancelOrder(oid);
    assert.strictEqual(cancelled.order.status, 'cancelled');

    // 再来一单，进行中后不可取消
    const c2 = await app.createOrder('t18', 'chatH');
    await loginAs(app, '李四');
    await app.acceptOrder(c2.order.id);
    await assert.rejects(app.cancelOrder(c2.order.id), /只有待接受的订单可以取消/);
});

// ---------- 自动确认 ----------

test('autoConfirmAt 到点 → 读取时自动完成并结算', async function () {
    const app = createApp();
    await loginAs(app, '王同学');
    const created = await app.createOrder('t18', 'chatI');
    const oid = created.order.id;
    await loginAs(app, '李四');
    await app.acceptOrder(oid);
    await app.confirmOrder(oid); // earner 单方确认 → 设 autoConfirmAt

    // 人为把 autoConfirmAt 改到过去
    const db = app.getDB();
    db.orders.find(function (o) { return o.id === oid; }).autoConfirmAt = new Date(Date.now() - 1000).toISOString();
    app.saveDB(db);

    const u2Before = balanceOf(app, 'u2');
    const ord = await app.getOrder('chatI'); // 读取触发 sweep
    assert.strictEqual(ord.status, 'completed', '应自动完成');
    assert.strictEqual(balanceOf(app, 'u2'), u2Before + 15, '自动完成也结算给收款方');
});

// ---------- 超时默认好评 ----------

test('completed 订单超过评价窗口未评 → 双方各补一条 5★ 默认好评(auto)', async function () {
    const app = createApp();
    await loginAs(app, '王同学');
    const created = await app.createOrder('t18', 'chatJ');
    const oid = created.order.id;
    await loginAs(app, '李四');
    await app.acceptOrder(oid);
    await app.confirmOrder(oid);
    await loginAs(app, '王同学');
    await app.confirmOrder(oid); // 完成

    // 把评价窗口改到过去
    let db = app.getDB();
    db.orders.find(function (o) { return o.id === oid; }).reviewDeadline = new Date(Date.now() - 1000).toISOString();
    app.saveDB(db);

    const toU2 = (await app.getReviews('u2')).filter(function (r) { return r.orderId === oid; });
    const toU3 = (await app.getReviews('u3')).filter(function (r) { return r.orderId === oid; });
    assert.strictEqual(toU2.length, 1, '收款方收到 1 条默认好评');
    assert.strictEqual(toU3.length, 1, '付款方收到 1 条默认好评');
    assert.strictEqual(toU2[0].rating, 5);
    assert.strictEqual(toU2[0].auto, true);

    // 再读一次不应重复补
    const again = (await app.getReviews('u2')).filter(function (r) { return r.orderId === oid; });
    assert.strictEqual(again.length, 1, '默认好评不应重复生成');
});

test('已有真实评价的一方不被默认好评覆盖', async function () {
    const app = createApp();
    await loginAs(app, '王同学');
    const created = await app.createOrder('t18', 'chatK');
    const oid = created.order.id;
    await loginAs(app, '李四');
    await app.acceptOrder(oid);
    await app.confirmOrder(oid);
    await loginAs(app, '王同学');
    await app.confirmOrder(oid);

    // u3 给 u2 留真实评价
    await app.submitReview({ orderId: oid, toUserId: 'u2', toUserName: '李四', rating: 4, content: '不错' });

    let db = app.getDB();
    db.orders.find(function (o) { return o.id === oid; }).reviewDeadline = new Date(Date.now() - 1000).toISOString();
    app.saveDB(db);

    const toU2 = (await app.getReviews('u2')).filter(function (r) { return r.orderId === oid; });
    assert.strictEqual(toU2.length, 1, 'u2 只有那条真实评价，不被自动补');
    assert.strictEqual(toU2[0].auto, false);
    assert.strictEqual(toU2[0].rating, 4);
    // u2 没给 u3 评，u3 应被自动补
    const toU3 = (await app.getReviews('u3')).filter(function (r) { return r.orderId === oid; });
    assert.strictEqual(toU3.length, 1);
    assert.strictEqual(toU3[0].auto, true);
});

// ---------- 未读消息 ----------

test('未读消息：统计、进入会话后清零、新消息对收件方计未读', async function () {
    const app = createApp();
    await loginAs(app, '张三'); // u1：种子里 c1(李四)、c3(孙同学)各一条未读
    let u = await app.getUnreadCounts();
    assert.strictEqual(u.total, 2, '张三初始 2 条未读');
    assert.strictEqual(u.byChat['c1'], 1);
    assert.strictEqual(u.byChat['c3'], 1);

    // 打开 c1 → 该会话未读清零，总数减少
    await app.markMessagesRead('c1');
    u = await app.getUnreadCounts();
    assert.strictEqual(u.total, 1, '读掉 c1 后剩 1 条');
    assert.ok(!u.byChat['c1'], 'c1 不再有未读');
    assert.strictEqual(u.byChat['c3'], 1);

    // 张三在 c1 发消息 → 对收件方李四(u2)计为未读
    await app.sendMessage('c1', '好的，我马上下来');
    await loginAs(app, '李四'); // u2
    const u2 = await app.getUnreadCounts();
    assert.strictEqual(u2.byChat['c1'], 1, '李四在 c1 收到张三的新消息，计 1 条未读');
});

test('未下单也能建会话：只发消息，双方消息中心都能看到（未读归发布者）', async function () {
    const app = createApp();
    // t12 组队帖，发布者 u5(赵同学)；u3(王同学) 进聊天只发消息、不下单
    await loginAs(app, '王同学'); // u3
    await app.ensureConversation({ chatId: 'c-t12-u3', partnerId: 'u5', partnerName: '赵同学', taskId: 't12', taskTitle: '羽毛球搭子招募' });
    await app.sendMessage('c-t12-u3', '你好，这个羽毛球搭子还招吗？');

    assert.ok(!(app.getDB().orders || []).some(function (o) { return o.chatId === 'c-t12-u3'; }), '未创建订单');

    // 响应者(u3)能看到会话，对方识别为发布者 u5
    let convs = await app.getConversations();
    const asResponder = convs.find(function (c) { return c.id === 'c-t12-u3'; });
    assert.ok(asResponder, '响应者消息中心应能看到该会话');
    assert.strictEqual(asResponder.partnerId, 'u5');

    // 发布者(u5)也能看到，对方识别为 u3，且该消息计为未读
    await loginAs(app, '赵同学'); // u5
    convs = await app.getConversations();
    const asPublisher = convs.find(function (c) { return c.id === 'c-t12-u3'; });
    assert.ok(asPublisher, '发布者消息中心也应能看到该会话');
    assert.strictEqual(asPublisher.partnerId, 'u3');
    const unread = await app.getUnreadCounts();
    assert.strictEqual(unread.byChat['c-t12-u3'], 1, '发布者对该会话应有 1 条未读');
});

// ---------- 我的订单 / 大厅筛选 ----------

test('getMyOrders 按付款/收款角色筛选', async function () {
    const app = createApp();
    await loginAs(app, '张三'); // u1：种子中作为 payer 有 o1/o3/o4，作为 earner 有 o2/o5
    const asPayer = await app.getMyOrders('payer');
    const asEarner = await app.getMyOrders('earner');
    const all = await app.getMyOrders();
    assert.strictEqual(asPayer.length, 3);
    assert.strictEqual(asEarner.length, 2);
    assert.strictEqual(all.length, 5);
    assert.ok(asPayer.every(function (r) { return r.myRole === 'payer'; }));
});

test('getTasks 按 publisherSide 筛选且只返回 open 帖子', async function () {
    const app = createApp();
    const payerSide = await app.getTasks({ side: 'payer' });
    const earnerSide = await app.getTasks({ side: 'earner' });
    const noneSide = await app.getTasks({ side: 'none' });
    const all = await app.getTasks({});
    assert.ok(payerSide.every(function (t) { return t.publisherSide === 'payer' && t.status === 'open'; }));
    assert.ok(earnerSide.every(function (t) { return t.publisherSide === 'earner' && t.status === 'open'; }));
    assert.ok(noneSide.every(function (t) { return t.publisherSide === 'none' && t.status === 'open'; }));
    assert.strictEqual(all.length, payerSide.length + earnerSide.length + noneSide.length, '全部=三类之和（均为 open）');
});
