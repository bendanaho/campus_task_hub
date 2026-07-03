/**
 * Campus Task Hub - 核心业务规则自动化集成测试脚本
 * 负责模块：独立测试沙箱 (tests/)
 */

// 建议将此脚本挂载或引入到你的测试运行环境中
async function runCampusTaskHubTests() {
    const results = { total: 0, passed: 0, failed: [] };

    function group(name) {
        console.log(`\n=== 正在测试模块: ${name} ===`);
    }

    function expect(condition, message) {
        results.total++;
        if (condition) {
            results.passed++;
            console.log(`  [✓ PASS] ${message}`);
        } else {
            results.failed.push(message);
            console.error(`  [✗ FAIL] ${message}`);
        }
    }

    // 0. 初始化干净的沙箱环境（防止上次测试的残留数据干扰）
    localStorage.removeItem('campus_mock_db');
    if (typeof removeToken === 'function') removeToken();
    if (typeof removeCurrentUser === 'function') removeCurrentUser();
    
    // 强制触发 mock-data 重新装载初始干净数据
    const dbInstance = getDB(); 

    // ==========================================
    // 1. 身份认证与防重逻辑断言
    // ==========================================
    group("用户注册风控与防重复机制");
    const testAccount = {
        username: '测试专属学生',
        phone: '15555555555',
        email: 'sandbox@edu.cn',
        password: 'password123'
    };

    try {
        const regSuccess = await register(testAccount);
        expect(regSuccess.success === true, "使用未注册的手机号应允许正常注册成功");

        // 边界流：故意冒充相同的手机号再次发起注册请求
        await register({ username: '冒充者', phone: '15555555555', password: '999' });
        expect(false, "【严重安全漏洞】系统居然放行了重复的手机号注册！");
    } catch (err) {
        expect(err.message.includes('已注册'), `防重逻辑正常：成功拦截重复手机号注册，拦截响应为: "${err.message}"`);
    }

    // ==========================================
    // 2. 状态保持与 Token 会话鉴权
    // ==========================================
    group("登录态维护与 Session Token 验证");
    try {
        const loginRes = await login('15555555555', 'password123');
        expect(loginRes.token && isLoggedIn(), "使用正确凭证登录后，系统必须成功派发身份 Token");
        expect(getCurrentUser().username === '测试专属学生', "全局活跃上下文应正确映射当前登录人的身份信息");
    } catch (e) {
        expect(false, `登录验证异常失败: ${e.message}`);
    }

    // ==========================================
    // 3. 核心财务风控：发单“预扣款/资金冻结”断言
    // ==========================================
    group("发布需求单的预扣款与冻结机制安全测试");
    try {
        // 获取当前用户的发单前初始余额
        const beforeBalance = (await getBalance()).balance;

        const newTaskPayload = {
            title: '测试跑腿单',
            category: 'errand',
            description: '深入断言预扣款风控',
            reward: '35元', // 系统的底层逻辑会通过正则提取出数字 35
            deadline: new Date(Date.now() + 86400000).toISOString()
        };

        // 触发发单
        await publishTask(newTaskPayload);
        const afterBalance = (await getBalance()).balance;

        // 断言发单前后金额减少数额必须与悬赏赏金完全相等
        expect(beforeBalance - afterBalance === 35, `财务风控断言通过！发单前余额 ${beforeBalance}元，发单后即时冻结扣减，剩余余额 ${afterBalance}元`);
    } catch (e) {
        expect(false, `发单财务流流转失败: ${e.message}`);
    }

    // ==========================================
    // 4. IM 即时通讯：消息撤回时限阻断断言
    // ==========================================
    group("IM 即时通讯 2 分钟撤回边界时限测试");
    try {
        // Case 4.1: 测试刚发出去的消息，应该允许撤回
        const freshMsg = await sendMessage('c1', '这是一条一秒钟前刚发出的消息');
        const undoFresh = await withdrawMessage(freshMsg.id);
        expect(undoFresh.success === true, "2分钟时限内发出的即时消息应允许撤回");

        // Case 4.2: 绕过业务逻辑，直接向本地 Mock 数据库灌入一条“5分钟前”的老消息
        const db = getDB();
        const timeoutId = 'msg_timeout_sandbox_test';
        db.messages.push({
            id: timeoutId,
            chatId: 'c1',
            senderId: getCurrentUser().id,
            content: '这是一条过期老消息',
            time: new Date(Date.now() - 5 * 60 * 1000).toISOString() // 被篡改为5分钟前
        });
        saveDB(db);

        // 强行调用撤回函数，预期应被抛出异常拦截
        try {
            await withdrawMessage(timeoutId);
            expect(false, "【时限风控漏洞】系统居然允许撤回发送已超过 2 分钟的消息！");
        } catch (err) {
            expect(err.message.includes('超过2分钟'), `时限机制拦截成功！拒绝撤回老消息，安全提示: "${err.message}"`);
        }
    } catch (e) {
        expect(false, `IM 撤回链条流转失败: ${e.message}`);
    }

    // ==========================================
    // 汇总报告
    // ==========================================
    console.log(`\n=== 测试执行完毕: ${results.passed}/${results.total} 通过 ===`);
    if (results.failed.length > 0) {
        console.error("未通过的断言列表:", results.failed);
    }
}