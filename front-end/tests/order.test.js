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
    assert.ok(db.tasks.every(function (t) { return t.publisherSide === 'payer' || t.publisherSide === 'earner'; }), '每个帖子都有 publisherSide');
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

// ---------- 非法操作拦截 ----------

test('不能对自己发布的帖子下单/接单', async function () {
    const app = createApp();
    await loginAs(app, '李四'); // u2 是 t18 的发布者
    await assert.rejects(app.createOrder('t18', 'chatX'), /不能对自己发布的帖子/);
});

test('同一帖子已有进行中订单时，拦截重复下单', async function () {
    const app = createApp();
    await loginAs(app, '王同学');
    await app.createOrder('t18', 'chatD');     // 第一单 pending
    await loginAs(app, '张三');
    await assert.rejects(app.createOrder('t18', 'chatE'), /已有进行中的订单/);
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
    const all = await app.getTasks({});
    assert.ok(payerSide.every(function (t) { return t.publisherSide === 'payer' && t.status === 'open'; }));
    assert.ok(earnerSide.every(function (t) { return t.publisherSide === 'earner' && t.status === 'open'; }));
    assert.strictEqual(all.length, payerSide.length + earnerSide.length, '全部=两类之和（均为 open）');
});
