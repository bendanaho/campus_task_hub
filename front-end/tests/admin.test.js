// 管理员/争议仲裁单元测试
// 运行：在 front-end 目录执行  npm test   （或  node --test tests/）
//
// 覆盖：申诉门槛（状态/参与者）、申诉后资金保持冻结、管理员权限拦截、
//      三种裁决（全额退款/全额结算/部分结算）的资金与流水、
//      disputed 不被自动确认结算、管理员下架帖子。

const { test } = require('node:test');
const assert = require('node:assert');
const { createApp, loginAs, balanceOf } = require('./load');

// 便捷：搭一个进行中的订单（t18：发布者 u2 李四收钱 earner，报酬 15；u3 王同学付款）
// 返回订单 id。完成后：王同学 u3 余额 80→65（15 冻结中）。
async function setupInProgress(app) {
    await loginAs(app, '王同学');
    const created = await app.createOrder('t18', 'chatAdm');
    await loginAs(app, '李四');
    await app.acceptOrder(created.order.id);
    return created.order.id;
}

test('申诉门槛：pending 不可申诉、非参与者不可申诉、进行中参与者可申诉且资金保持冻结', async function () {
    const app = createApp();
    await loginAs(app, '王同学');
    const created = await app.createOrder('t18', 'chatAdm');
    const oid = created.order.id;

    // pending 不可申诉
    await assert.rejects(app.disputeOrder(oid, '还没开始就想申诉'), /仅进行中/);

    await loginAs(app, '李四');
    await app.acceptOrder(oid);
    assert.strictEqual(balanceOf(app, 'u3'), 65, '接受后付款方冻结 15');

    // 非参与者不可申诉
    await loginAs(app, '张三');
    await assert.rejects(app.disputeOrder(oid, '路人插一脚'), /不是该订单的参与者/);

    // 空理由被拒
    await loginAs(app, '王同学');
    await assert.rejects(app.disputeOrder(oid, '   '), /申诉理由/);

    // 参与者申诉成功 → disputed，双方余额不动（冻结保持）
    const res = await app.disputeOrder(oid, '对方一直没有开始服务');
    assert.strictEqual(res.order.status, 'disputed');
    assert.strictEqual(res.order.disputedBy, 'u3');
    assert.ok(res.order.disputeReason.indexOf('没有开始') >= 0);
    assert.strictEqual(balanceOf(app, 'u3'), 65, '申诉后资金仍冻结，不退');
    assert.strictEqual(balanceOf(app, 'u2'), 85, '收款方李四余额不变(种子85)');

    // 聊天里有申诉系统消息
    const sys = app.getDB().messages.filter(m => m.chatId === 'chatAdm' && m.senderId === 'system');
    assert.ok(sys.some(m => m.content.indexOf('发起了申诉') >= 0), '应有申诉系统消息');
});

test('权限：非管理员不能查看争议列表/裁决/下架帖子', async function () {
    const app = createApp();
    const oid = await setupInProgress(app);
    await loginAs(app, '王同学');
    await app.disputeOrder(oid, '有分歧');

    await assert.rejects(app.getAdminDisputes(), /无管理员权限/);
    await assert.rejects(app.resolveDispute(oid, 'refund', null, '想替管理员做主'), /无管理员权限/);
    await assert.rejects(app.adminClosePost('t18'), /无管理员权限/);
});

test('裁决-全额退款：冻结金额退回付款方，订单 closed，留流水与结案字段', async function () {
    const app = createApp();
    const oid = await setupInProgress(app);
    await loginAs(app, '王同学');
    await app.disputeOrder(oid, '任务没有完成');

    await loginAs(app, 'admin');
    const disputes = await app.getAdminDisputes();
    assert.ok(disputes.some(d => d.order.id === oid), '争议列表应包含该订单');

    // 未填说明被拒
    await assert.rejects(app.resolveDispute(oid, 'refund', null, ''), /处理说明/);

    const res = await app.resolveDispute(oid, 'refund', null, '经核实任务未执行');
    assert.strictEqual(res.order.status, 'closed');
    assert.strictEqual(res.order.resolution, 'refund');
    assert.strictEqual(balanceOf(app, 'u3'), 80, '付款方全额拿回 15');
    assert.strictEqual(balanceOf(app, 'u2'), 85, '收款方不结算');

    const tx = app.getDB().transactions.filter(t => t.relatedId === oid);
    assert.ok(tx.some(t => t.userId === 'u3' && t.direction === 'in' && t.amount === 15 && /仲裁退款/.test(t.note)));

    // 结案后不能重复裁决
    await assert.rejects(app.resolveDispute(oid, 'settle', null, '再来一次'), /不在争议处理中/);
});

test('裁决-全额结算：冻结金额支付给收款方', async function () {
    const app = createApp();
    const oid = await setupInProgress(app);
    await loginAs(app, '李四');
    await app.disputeOrder(oid, '我已完成但对方不确认');

    await loginAs(app, 'admin');
    await app.resolveDispute(oid, 'settle', null, '经核实服务已完成');
    assert.strictEqual(balanceOf(app, 'u2'), 100, '收款方拿到 15');
    assert.strictEqual(balanceOf(app, 'u3'), 65, '付款方不退款');

    const tx = app.getDB().transactions.filter(t => t.relatedId === oid);
    assert.ok(tx.some(t => t.userId === 'u2' && t.direction === 'in' && t.amount === 15 && /仲裁/.test(t.note)));
});

test('裁决-部分结算：金额校验 + 收款方得 x、付款方退 amount-x', async function () {
    const app = createApp();
    const oid = await setupInProgress(app);
    await loginAs(app, '王同学');
    await app.disputeOrder(oid, '只做了一部分');

    await loginAs(app, 'admin');
    // 非法金额：0、等于全额、超额
    await assert.rejects(app.resolveDispute(oid, 'partial', 0, '零元'), /大于 0 且小于/);
    await assert.rejects(app.resolveDispute(oid, 'partial', 15, '全额请用 settle'), /大于 0 且小于/);
    await assert.rejects(app.resolveDispute(oid, 'partial', 99, '超额'), /大于 0 且小于/);

    const res = await app.resolveDispute(oid, 'partial', 6, '完成过半，按比例结算');
    assert.strictEqual(res.order.status, 'closed');
    assert.strictEqual(res.order.resolutionAmountToEarner, 6);
    assert.strictEqual(balanceOf(app, 'u2'), 91, '收款方 +6');
    assert.strictEqual(balanceOf(app, 'u3'), 74, '付款方退回 9（65+9）');

    // 系统消息包含双向金额
    const sys = app.getDB().messages.filter(m => m.chatId === 'chatAdm' && m.senderId === 'system');
    assert.ok(sys.some(m => /部分结算/.test(m.content) && /6 元/.test(m.content) && /9 元/.test(m.content)));
});

test('disputed 订单不会被自动确认 sweep 结算', async function () {
    const app = createApp();
    const oid = await setupInProgress(app);
    await loginAs(app, '王同学');
    await app.disputeOrder(oid, '有分歧');

    // 人为把自动确认时间设到过去，再触发读接口（内部跑 _sweep）
    const db = app.getDB();
    const order = db.orders.find(o => o.id === oid);
    order.autoConfirmAt = new Date(Date.now() - 86400000).toISOString();
    app.saveDB(db);

    await app.getMyOrders();
    const after = app.getDB().orders.find(o => o.id === oid);
    assert.strictEqual(after.status, 'disputed', 'sweep 不应动 disputed 订单');
    assert.strictEqual(balanceOf(app, 'u2'), 85, '不应给收款方结算');
});

test('管理员下架帖子：大厅不再显示、不可再下单', async function () {
    const app = createApp();
    await loginAs(app, 'admin');
    const before = await app.getTasks({});
    assert.ok(before.some(t => t.id === 't18'), '下架前大厅可见 t18');

    await app.adminClosePost('t18');
    const after = await app.getTasks({});
    assert.ok(!after.some(t => t.id === 't18'), '下架后大厅不可见');

    await loginAs(app, '王同学');
    await assert.rejects(app.createOrder('t18', 'chatX'), /已关闭/);

    // 重复下架被拒
    await loginAs(app, 'admin');
    await assert.rejects(app.adminClosePost('t18'), /已是下架/);
});

test('登录返回带 role：admin=1、普通用户=0', async function () {
    const app = createApp();
    const adm = await loginAs(app, 'admin');
    assert.strictEqual(adm.user.role, 1);
    const usr = await loginAs(app, '张三');
    assert.strictEqual(usr.user.role, 0);
});
