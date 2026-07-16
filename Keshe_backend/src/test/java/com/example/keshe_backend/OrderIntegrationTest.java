package com.example.keshe_backend;

import org.junit.jupiter.api.*;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

/**
 * 订单系统集成测试 — 逐条对照前端 tests/order.test.js 的 26 个用例。
 * 使用 RestTemplate 发送真实 HTTP 请求。
 *
 * 注意：测试之间【不隔离】。请求走真实 HTTP，事务在服务端提交，测试侧无从回滚；
 * 全类共用一份 H2 种子数据，按方法名顺序执行，前一个用例的资金变动会带到后一个。
 * 因此除 test02 开头那处种子余额外，一律用"先取基准再比增量"的写法，不要断言绝对金额。
 */
@TestMethodOrder(MethodOrderer.MethodName.class)
public class OrderIntegrationTest extends BaseIntegrationTest {

    // ====================== 数据结构 ======================

    @Test
    @DisplayName("01-数据结构：统一 orders 表、帖子带 publisherSide")
    void test01_dataStructure() {
        loginAs("张三");
        var posts = dataList(apiGet("/posts"));
        assertFalse(posts.isEmpty());
        for (var p : posts) {
            String side = str(p, "publisherSide");
            assertTrue("payer".equals(side) || "earner".equals(side) || "none".equals(side),
                    "帖子 " + p.get("id") + " 缺少 publisherSide");
            assertNotNull(str(p, "status"));
        }
    }

    // ====================== 服务帖全流程（对照 JS test 2） ======================

    @Test
    @DisplayName("02-服务帖全流程：下单即冻结 → 接受 → 双方确认结算")
    void test02_servicePostFullFlow() {
        loginAs("王同学");
        assertEquals(0, myBalance().compareTo(new BigDecimal("80")));
        var frozenBefore = myFrozen();

        // 服务帖(earner)：发布者收钱，下单的人才是付款方
        var post = findPost("电脑故障排查");
        var created = data(apiPost("/orders", Map.of("postId", longId(post, "id"), "chatId", "tc-svc")));
        Long oid = longId(created, "id");
        assertEquals("pending", str(created, "status"));
        // 钱在【下单】这一刻就从可用余额挪进冻结余额，不等对方接受
        assertEquals(0, myBalance().compareTo(new BigDecimal("65")), "下单即冻结：80-15=65");
        assertEquals(0, myFrozen().compareTo(frozenBefore.add(new BigDecimal("15"))), "报酬进入冻结余额");

        loginAs("李四");
        var earnerBefore = myBalance();
        var accepted = data(apiPost("/orders/" + oid + "/accept", null));
        assertEquals("in_progress", str(accepted, "status"));

        loginAs("王同学");
        assertEquals(0, myBalance().compareTo(new BigDecimal("65")), "接受不再二次扣款");

        loginAs("李四");
        var c1 = data(apiPost("/orders/" + oid + "/confirm", null));
        assertEquals("in_progress", str(c1, "status"));
        assertTrue(bool(c1, "earnerConfirmed"));
        assertFalse(bool(c1, "payerConfirmed"));
        assertNotNull(c1.get("autoConfirmAt"), "首个确认应设 autoConfirmAt");

        loginAs("王同学");
        var c2 = data(apiPost("/orders/" + oid + "/confirm", null));
        assertEquals("completed", str(c2, "status"));
        assertNotNull(c2.get("reviewDeadline"));
        assertEquals(0, myFrozen().compareTo(frozenBefore), "完成后冻结全部释放");

        loginAs("李四");
        assertEquals(0, myBalance().compareTo(earnerBefore.add(new BigDecimal("15"))), "报酬结算给收款方");
    }

    // ====================== 悬赏帖全流程（对照 JS test 3） ======================

    @Test
    @DisplayName("03-悬赏帖全流程：发布即冻结 → 接单 → 接受后下架 → 完成结算")
    void test03_bountyPostFullFlow() {
        // 必须通过 API 真发一个悬赏帖：种子帖是直接写库造的、没有对应的冻结记录，
        // 拿它跑完整流程既测不到"发布冻结"，结算时还会把发布者的冻结余额扣成负数。
        loginAs("张三");
        var payerBalBefore = myBalance();
        var payerFrozenBefore = myFrozen();
        var pub = data(apiPost("/posts", Map.of(
                "title", "测试悬赏搬行李", "publisherSide", "payer", "category", "life-service",
                "description", "把行李从 1 号楼搬到 8 号楼", "reward", "15元", "rewardValue", 15)));
        Long postId = longId((Map) pub.get("task"), "id");
        // 悬赏帖(payer)：发布者出钱，报酬在【发布】这一刻就冻结做担保
        assertEquals(0, myBalance().compareTo(payerBalBefore.subtract(new BigDecimal("15"))), "发布悬赏即冻结报酬");
        assertEquals(0, myFrozen().compareTo(payerFrozenBefore.add(new BigDecimal("15"))), "报酬进入冻结余额");

        // 接单方是收款方，下单不冻他的钱（报酬已冻在帖子上）
        loginAs("王同学");
        var earnerBalBefore = myBalance();
        var created = data(apiPost("/orders", Map.of("postId", postId, "chatId", "tc-bounty")));
        Long oid = longId(created, "id");
        assertEquals("pending", str(created, "status"));
        assertEquals(0, myBalance().compareTo(earnerBalBefore), "接单方是收款方，下单不扣款");

        loginAs("张三");
        data(apiPost("/orders/" + oid + "/accept", null));
        var detail = data(apiGet("/posts/" + postId));
        assertEquals("closed", str((Map) detail.get("task"), "status"), "悬赏帖接受后下架");

        data(apiPost("/orders/" + oid + "/confirm", null));
        loginAs("王同学");
        var done = data(apiPost("/orders/" + oid + "/confirm", null));
        assertEquals("completed", str(done, "status"));
        assertEquals(0, myBalance().compareTo(earnerBalBefore.add(new BigDecimal("15"))), "报酬结算给收款方");

        loginAs("张三");
        assertEquals(0, myFrozen().compareTo(payerFrozenBefore), "发布者冻结已释放");
    }

    @Test
    @DisplayName("04-服务帖被下单后仍保持 open（可复用）")
    void test04_servicePostStaysOpen() {
        loginAs("王同学");
        var post = findPost("电脑故障排查");
        var created = data(apiPost("/orders", Map.of("postId", longId(post, "id"), "chatId", "tc-reuse")));
        loginAs("李四");
        data(apiPost("/orders/" + longId(created, "id") + "/accept", null));

        var detail = data(apiGet("/posts/" + longId(post, "id")));
        assertEquals("open", str((Map) detail.get("task"), "status"), "服务帖接受后仍 open");
    }

    // ====================== 纯互助全流程（对照 JS test 5） ======================

    @Test
    @DisplayName("05-纯互助帖全流程：金额0 → 不冻结 → 不结算 → open")
    void test05_mutualHelpFullFlow() {
        loginAs("张三");
        var post = findPost("羽毛球搭子招募"); // t12, none
        var created = data(apiPost("/orders", Map.of("postId", longId(post, "id"), "chatId", "tc-none")));
        Long oid = longId(created, "id");
        assertEquals(0, toBigDecimal(created.get("amount")).compareTo(BigDecimal.ZERO));

        loginAs("赵同学");
        data(apiPost("/orders/" + oid + "/accept", null));

        var detail = data(apiGet("/posts/" + longId(post, "id")));
        assertEquals("open", str((Map) detail.get("task"), "status"));

        data(apiPost("/orders/" + oid + "/confirm", null));
        loginAs("张三");
        var done = data(apiPost("/orders/" + oid + "/confirm", null));
        assertEquals("completed", str(done, "status"));
    }

    // ====================== 实名门禁（对照 JS test 6） ======================

    @Test
    @DisplayName("06-实名门禁：未实名不能发布/下单；实名后放行")
    void test06_authGate() {
        // 注册未认证用户
        rest.exchange(base() + "/register", org.springframework.http.HttpMethod.POST,
                new org.springframework.http.HttpEntity<>(Map.of("username", "新同学", "phone", "13900000000", "password", "1"), jsonHeaders()), Map.class);
        loginAs("新同学");

        assertFail(apiPost("/posts", Map.of(
                "title", "测试", "publisherSide", "payer", "category", "other",
                "description", "x", "reward", "5元")), "实名");

        var post = findPost("电脑故障排查");
        assertFail(apiPost("/orders", Map.of("postId", longId(post, "id"), "chatId", "tc-verify")), "实名");

        data(apiPost("/auth", Map.of(
                "realName", "新同学", "studentId", "2021999999", "college", "计算机学院")));

        // 新注册用户余额为 0，而下单即冻结会先卡在余额不足。本用例考察的是实名门禁，
        // 先充值把无关的余额因素排除掉，确保放行与否只取决于实名状态。
        data(apiPost("/user/recharge", Map.of("amount", 100)));

        var created = data(apiPost("/orders", Map.of("postId", longId(post, "id"), "chatId", "tc-verify-ok")));
        assertEquals("pending", str(created, "status"));
    }

    // ====================== 余额与充值（对照 JS test 7） ======================

    @Test
    @DisplayName("07-余额查询与充值")
    void test07_balanceAndRecharge() {
        loginAs("王同学");
        var balBefore = myBalance();
        assertTrue(balBefore.compareTo(BigDecimal.ZERO) > 0, "应有正余额");

        var r = data(apiPost("/user/recharge", Map.of("amount", 50)));
        var balAfter = myBalance();
        assertTrue(balAfter.compareTo(balBefore) > 0, "充值后余额应增加");

        assertFail(apiPost("/user/recharge", Map.of("amount", 0)), "充值金额");
        assertFail(apiPost("/user/recharge", Map.of("amount", 200000)), "不能超过");
    }

    // ====================== 聊天收款/转账（对照 JS test 8-9） ======================

    @Test
    @DisplayName("08-聊天收款：发起→对方支付，金额划转")
    void test08_chatPaymentRequest() {
        loginAs("王同学");
        var post = findPost("电脑故障排查");
        Long partnerId = longId(post, "publisherId"); // 李四

        data(apiPost("/conversations/ensure", Map.of("chatId", "tc-pay-req", "partnerId", partnerId)));

        var balBefore = myBalance();
        var card = data(apiPost("/conversations/tc-pay-req/payment",
                Map.of("partnerId", partnerId, "kind", "request", "amount", 15)));
        assertEquals("payment", str(card, "type"));
        assertEquals(balBefore, myBalance(), "收款请求不扣款");

        // 收款方不能支付
        assertFail(apiPost("/messages/" + longId(card, "id") + "/pay", null), "只有付款方");

        loginAs("李四");
        var payerBalBefore = myBalance();
        data(apiPost("/messages/" + longId(card, "id") + "/pay", null));
        assertTrue(myBalance().compareTo(payerBalBefore) < 0, "付款方余额减少");

        loginAs("王同学");
        assertTrue(myBalance().compareTo(balBefore) > 0, "收款方余额增加");

        loginAs("李四");
        assertFail(apiPost("/messages/" + longId(card, "id") + "/pay", null), "已处理");
    }

    @Test
    @DisplayName("09-聊天转账：立即扣款到账；余额不足被拒")
    void test09_chatTransfer() {
        loginAs("李四");
        Long partnerId = 3L; // 王同学
        data(apiPost("/conversations/ensure", Map.of("chatId", "tc-transfer", "partnerId", partnerId)));

        var balBefore = myBalance();
        data(apiPost("/conversations/tc-transfer/payment",
                Map.of("partnerId", partnerId, "kind", "transfer", "amount", 10)));
        assertTrue(myBalance().compareTo(balBefore) < 0, "转出方余额减少");

        loginAs("王同学");
        assertTrue(myBalance().compareTo(BigDecimal.ZERO) > 0, "收款方应有余额");

        loginAs("李四");
        assertFail(apiPost("/conversations/tc-transfer/payment",
                Map.of("partnerId", partnerId, "kind", "transfer", "amount", 99999)), "余额不足");
    }

    // ====================== 账单（对照 JS test 11） ======================

    @Test
    @DisplayName("10-账单：充值产生收入流水")
    void test10_bills() {
        loginAs("王同学");
        var before = (Map<String, Object>) data(apiGet("/user/bills"));
        List<Map<String, Object>> beforeList = (List) before.get("list");

        data(apiPost("/user/recharge", Map.of("amount", 100)));

        var bills = (Map<String, Object>) data(apiGet("/user/bills"));
        List<Map<String, Object>> list = (List) bills.get("list");
        assertTrue(list.size() >= beforeList.size(), "充值后应有新流水");
    }

    // ====================== 过期悬赏 ======================

    @Test
    @DisplayName("11-悬赏帖大厅仅显示 open 且不过期的")
    void test11_expiredBounty() {
        var payerSide = dataList(apiGet("/posts?side=payer"));
        assertFalse(payerSide.isEmpty());
        for (var p : payerSide) {
            assertEquals("open", str(p, "status"));
        }
    }

    @Test
    @DisplayName("12-发布悬赏截止时间早于当前时间被拒")
    void test12_publishExpiredBounty() {
        loginAs("张三");
        assertFail(apiPost("/posts", Map.of(
                "title", "过期悬赏", "publisherSide", "payer", "category", "other",
                "description", "x", "reward", "5元", "deadline", "2020-01-01T00:00:00")), "截止时间");
    }

    // ====================== 非法操作拦截（对照 JS test 14-18） ======================

    @Test
    @DisplayName("13-不能对自己发布的帖子下单")
    void test13_selfDealing() {
        loginAs("李四");
        var post = findPost("电脑故障排查");
        assertFail(apiPost("/orders", Map.of("postId", longId(post, "id"), "chatId", "tc-self")), "不能对自己");
    }

    @Test
    @DisplayName("14-悬赏帖已有进行中订单时拦截重复下单")
    void test14_duplicateBountyOrder() {
        loginAs("王同学");
        var post = findPost("图书馆占座"); // t6, payer, 发布者是刘同学(u6)
        data(apiPost("/orders", Map.of("postId", longId(post, "id"), "chatId", "tc-dup-1")));
        loginAs("张三");
        assertFail(apiPost("/orders", Map.of("postId", longId(post, "id"), "chatId", "tc-dup-2")), "已有");
    }

    @Test
    @DisplayName("15-服务帖允许同帖多个并发订单")
    void test15_serviceMultiOrder() {
        loginAs("王同学");
        var post = findPost("电脑故障排查");
        var a = data(apiPost("/orders", Map.of("postId", longId(post, "id"), "chatId", "tc-multi-1")));
        loginAs("张三");
        var b = data(apiPost("/orders", Map.of("postId", longId(post, "id"), "chatId", "tc-multi-2")));
        assertEquals("pending", str(a, "status"));
        assertEquals("pending", str(b, "status"), "服务帖第二单不应拦截");
    }

    @Test
    @DisplayName("16-下单时付款方余额不足被当场拦截且不扣款")
    void test16_insufficientBalance() {
        loginAs("张三");
        var pub = data(apiPost("/posts", Map.of(
                "title", "高价服务", "publisherSide", "earner", "category", "other",
                "description", "x", "reward", "99999元", "rewardValue", 99999)));
        Long postId = longId((Map) pub.get("task"), "id");

        // 余额不足必须拦在【下单】这一刻、报在下单方自己这侧。
        // 旧实现放行下单、等对方点"接受"时才 hold 失败：那段等待期里这笔钱仍可被花掉，
        // 且错误最终暴露在无辜的卖家那侧。
        loginAs("王同学");
        var balBefore = myBalance();
        var frozenBefore = myFrozen();
        assertFail(apiPost("/orders", Map.of("postId", postId, "chatId", "tc-nobal")), "余额不足");
        assertEquals(0, myBalance().compareTo(balBefore), "拦截后不扣款");
        assertEquals(0, myFrozen().compareTo(frozenBefore), "拦截后不冻结");
    }

    // ====================== 取消（对照 JS test 19） ======================

    @Test
    @DisplayName("17-pending 可取消；in_progress 不可取消")
    void test17_cancelOrderRules() {
        loginAs("王同学");
        var post = findPost("电脑故障排查");
        var created = data(apiPost("/orders", Map.of("postId", longId(post, "id"), "chatId", "tc-cancel")));
        Long oid = longId(created, "id");

        assertEquals("cancelled", str(data(apiPost("/orders/" + oid + "/cancel", null)), "status"));

        var c2 = data(apiPost("/orders", Map.of("postId", longId(post, "id"), "chatId", "tc-cancel-2")));
        loginAs("李四");
        data(apiPost("/orders/" + longId(c2, "id") + "/accept", null));
        assertFail(apiPost("/orders/" + longId(c2, "id") + "/cancel", null), "状态不可操作");
    }

    // ====================== 自动确认（对照 JS test 20） ======================

    @Test
    @DisplayName("18-单方确认后 autoConfirmAt 已设置")
    void test18_autoConfirmFieldSet() {
        loginAs("王同学");
        var post = findPost("电脑故障排查");
        var created = data(apiPost("/orders", Map.of("postId", longId(post, "id"), "chatId", "tc-auto")));
        Long oid = longId(created, "id");

        loginAs("李四");
        data(apiPost("/orders/" + oid + "/accept", null));
        var confirmed = data(apiPost("/orders/" + oid + "/confirm", null));
        assertNotNull(confirmed.get("autoConfirmAt"), "单方确认后应设 autoConfirmAt");
    }

    // ====================== 评价（对照 JS test 21-22） ======================

    @Test
    @DisplayName("19-已完成订单可正常评价")
    void test19_reviewBasic() {
        loginAs("王同学");
        var post = findPost("电脑故障排查");
        var created = data(apiPost("/orders", Map.of("postId", longId(post, "id"), "chatId", "tc-review")));
        Long oid = longId(created, "id");

        loginAs("李四");
        data(apiPost("/orders/" + oid + "/accept", null));
        data(apiPost("/orders/" + oid + "/confirm", null));
        loginAs("王同学");
        data(apiPost("/orders/" + oid + "/confirm", null));

        var review = data(apiPost("/reviews", Map.of(
                "orderId", oid, "toUserId", 2L, "toUserName", "李四", "rating", 4, "content", "不错")));
        assertEquals(4, review.get("rating"));

        assertTrue(bool(data(apiGet("/reviews/has-reviewed?orderId=" + oid)), "hasReviewed"));
    }

    @Test
    @DisplayName("20-不能对同一订单重复评价")
    void test20_duplicateReviewRejected() {
        loginAs("王同学");
        var post = findPost("电脑故障排查");
        var created = data(apiPost("/orders", Map.of("postId", longId(post, "id"), "chatId", "tc-dup-rv")));
        Long oid = longId(created, "id");

        loginAs("李四");
        data(apiPost("/orders/" + oid + "/accept", null));
        data(apiPost("/orders/" + oid + "/confirm", null));
        loginAs("王同学");
        data(apiPost("/orders/" + oid + "/confirm", null));

        data(apiPost("/reviews", Map.of(
                "orderId", oid, "toUserId", 2L, "toUserName", "李四", "rating", 5, "content", "好")));
        assertFail(apiPost("/reviews", Map.of(
                "orderId", oid, "toUserId", 2L, "toUserName", "李四", "rating", 5, "content", "又")), "已评价");
    }

    // ====================== 未读消息（对照 JS test 23-24） ======================

    @Test
    @DisplayName("21-未读消息统计返回正常")
    void test21_unreadCounts() {
        loginAs("张三");
        var unread = data(apiGet("/messages/unread"));
        assertNotNull(unread.get("total"));
    }

    @Test
    @DisplayName("22-发消息后双方会话可见")
    void test22_messageConversation() {
        loginAs("王同学");
        var post = findPost("羽毛球搭子招募");
        Long partnerId = longId(post, "publisherId");

        data(apiPost("/conversations/ensure", Map.of(
                "chatId", "tc-msg-only", "partnerId", partnerId,
                "taskId", longId(post, "id"), "taskTitle", str(post, "title"))));

        data(apiPost("/conversations/tc-msg-only/messages", Map.of("content", "你好")));

        var convs = dataList(apiGet("/conversations"));
        assertFalse(convs.isEmpty(), "应有会话");
    }

    // ====================== 我的订单 / 大厅筛选（对照 JS test 25-26） ======================

    @Test
    @DisplayName("23-getMyOrders 按 payer/earner 角色筛选")
    void test23_myOrdersFilter() {
        loginAs("张三");
        var asPayer = dataList(apiGet("/orders/mine?role=payer"));
        var asEarner = dataList(apiGet("/orders/mine?role=earner"));
        var all = dataList(apiGet("/orders/mine"));
        assertTrue(all.size() >= asPayer.size() && all.size() >= asEarner.size());
    }

    @Test
    @DisplayName("24-getPosts 按 publisherSide 筛选且只返回 open")
    void test24_postsFilter() {
        // size=100：末尾要比对"三类之和 == 全部"，四个查询都必须取到全量而非首页 10 条
        var payerSide = dataList(apiGet("/posts?side=payer&size=100"));
        var earnerSide = dataList(apiGet("/posts?side=earner&size=100"));
        var noneSide = dataList(apiGet("/posts?side=none&size=100"));
        var all = dataList(apiGet("/posts?size=100"));

        for (var p : payerSide) { assertEquals("payer", str(p, "publisherSide")); assertEquals("open", str(p, "status")); }
        for (var p : earnerSide) { assertEquals("earner", str(p, "publisherSide")); assertEquals("open", str(p, "status")); }
        for (var p : noneSide) { assertEquals("none", str(p, "publisherSide")); assertEquals("open", str(p, "status")); }
        assertEquals(all.size(), payerSide.size() + earnerSide.size() + noneSide.size());
    }

    // ====================== 登录/公开端点 ======================

    @Test
    @DisplayName("25-登录返回 token 且 authStatus 为 verified 字符串")
    void test25_loginReturnsVerifiedString() {
        loginAs("张三");
        assertNotNull(currentToken);

        var profile = data(apiGet("/users/1"));
        assertEquals("verified", str(profile, "authStatus"), "应为字符串 'verified'");
    }

    @Test
    @DisplayName("26-公开端点不登录也可访问")
    void test26_publicEndpoints() {
        currentToken = null;
        var resp = apiGet("/posts");
        assertFalse(dataList(resp).isEmpty());
    }

    // ====================== 辅助 ======================

    private Map<String, Object> findPost(String keyword) {
        // 公开端点，不需要 token，但不清空 currentToken
        String saved = currentToken;
        currentToken = null;
        // size=100：大厅默认每页 10 条，兜底的全量查询必须显式放大页长，否则种子帖子会被分页截断
        var posts = dataList(apiGet("/posts?size=100&keyword=" + keyword));
        if (posts.isEmpty()) posts = dataList(apiGet("/posts?size=100"));
        currentToken = saved; // 恢复
        return posts.stream().filter(p -> str(p, "title").contains(keyword))
                .findFirst().orElseThrow(() -> new RuntimeException("找不到帖子: " + keyword));
    }
}
