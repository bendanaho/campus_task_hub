// 信用分单元测试：贝叶斯公式、种子由评价驱动、评价落地后重算
const { test } = require('node:test');
const assert = require('node:assert');
const { createApp, loginAs } = require('./load');

test('computeCreditScore：无评价=5.0，贝叶斯平滑', function () {
    const app = createApp();
    const f = app.computeCreditScore;
    assert.strictEqual(f([]), 5.0, '无评价默认 5.0');
    // 预置 C=2 条 5★：一条 1★ → (10+1)/3=3.7，不至于砸到 1
    assert.strictEqual(f([1]), 3.7);
    assert.strictEqual(f([5, 5, 5]), 5.0);
    // (10 + 5+4+4)/(2+3) = 23/5 = 4.6
    assert.strictEqual(f([5, 4, 4]), 4.6);
});

test('种子信用分由评价算出（非硬编码），分布合理', function () {
    const app = createApp();
    const db = app.getDB();
    function score(uid) { return db.users.find(u => u.id === uid).creditScore; }
    // 每个用户的信用分 = 其收到评价的贝叶斯均值
    db.users.filter(u => String(u.id)[0] === 'u' && u.role !== 1).forEach(function (u) {
        const ratings = db.reviews.filter(r => r.toUserId === u.id).map(r => r.rating);
        assert.strictEqual(u.creditScore, app.computeCreditScore(ratings), u.username + ' 信用分应由评价算出');
    });
    // 高分/低分用户区分明显
    assert.ok(score('u5') >= 4.8, '赵同学好评应高');
    assert.ok(score('u8') <= 3.2, '周同学差评应低');
});

test('提交评价后被评价者信用分立即重算', function () {
    return (async function () {
        const app = createApp();
        const db0 = app.getDB();
        const before = db0.users.find(u => u.id === 'u2').creditScore; // 4.6（5,4,4）
        assert.strictEqual(before, 4.6);

        await loginAs(app, '张三');
        await app.submitReview({ orderId: 'oX', taskId: 't1', toUserId: 'u2', toUserName: '李四', rating: 1, content: '差' });

        const after = app.getDB().users.find(u => u.id === 'u2').creditScore;
        // ratings 变 5,4,4,1 → (10+14)/6 = 4.0
        assert.strictEqual(after, 4.0, '新增 1★ 后应降到 4.0');
        assert.ok(after < before);
    })();
});

test('超时默认好评（auto 5★）也计入信用分', function () {
    return (async function () {
        const app = createApp();
        const db = app.getDB();
        // 造一个已完成、已过评价期、双方都没评价的订单，收款方是 u8（低分 3.0）
        db.orders.push({
            id: 'oAuto', postId: 't1', chatId: 'cAuto',
            payerId: 'u1', earnerId: 'u8', amount: 5,
            status: 'completed', payerConfirmed: true, earnerConfirmed: true,
            createdAt: new Date(Date.now() - 100000).toISOString(),
            acceptedAt: null, completedAt: new Date(Date.now() - 90000).toISOString(),
            autoConfirmAt: null,
            reviewDeadline: new Date(Date.now() - 1000).toISOString()  // 已过期
        });
        app.saveDB(db);
        const before = app.getDB().users.find(u => u.id === 'u8').creditScore; // 3.0

        // 触发 sweep（读接口内部会补默认好评）——需登录
        await loginAs(app, '张三');
        await app.getMyOrders();

        const after = app.getDB().users.find(u => u.id === 'u8').creditScore;
        assert.ok(after > before, 'u8 收到一条默认 5★ 后信用分应上升 (' + before + '→' + after + ')');
    })();
});
