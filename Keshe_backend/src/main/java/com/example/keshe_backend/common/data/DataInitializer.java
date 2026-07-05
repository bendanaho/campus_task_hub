package com.example.keshe_backend.common.data;

import com.example.keshe_backend.chat.entity.Conversation;
import com.example.keshe_backend.chat.entity.Message;
import com.example.keshe_backend.chat.repository.ConversationRepository;
import com.example.keshe_backend.chat.repository.MessageRepository;
import com.example.keshe_backend.order.entity.Order;
import com.example.keshe_backend.order.repository.OrderRepository;
import com.example.keshe_backend.review.entity.Review;
import com.example.keshe_backend.review.repository.ReviewRepository;
import com.example.keshe_backend.task.entity.Task;
import com.example.keshe_backend.task.repository.TaskRepository;
import com.example.keshe_backend.transaction.entity.Transaction;
import com.example.keshe_backend.transaction.repository.TransactionRepository;
import com.example.keshe_backend.user.entity.User;
import com.example.keshe_backend.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Profile;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * 开发环境种子数据初始化器。
 * 仅在 dev profile 下运行，数据与前端 mock-data.js 对齐。
 */
@Slf4j
@Component
@Profile("!prod")
@RequiredArgsConstructor
public class DataInitializer implements org.springframework.boot.CommandLineRunner {

    private final UserRepository userRepository;
    private final TaskRepository taskRepository;
    private final OrderRepository orderRepository;
    private final TransactionRepository transactionRepository;
    private final ConversationRepository conversationRepository;
    private final MessageRepository messageRepository;
    private final ReviewRepository reviewRepository;
    private final PasswordEncoder passwordEncoder;

    private static final int AUTO_DAYS = 2;

    // 保存创建后的实体 ID，方便引用
    private Long[] uIds = new Long[8];
    private Long[] tIds = new Long[22];

    @Override
    @Transactional
    public void run(String... args) {
        if (userRepository.count() > 0) {
            log.info("种子数据已存在，跳过初始化");
            return;
        }
        log.info("开始初始化种子数据...");

        createUsers();
        createTasks();
        createOrders();
        createTransactions();
        createConversations();
        createMessages();
        createReviews();

        log.info("种子数据初始化完成: {} 用户, {} 帖子, {} 订单, {} 流水, {} 会话, {} 消息, {} 评价",
                uIds.length, tIds.length, 6, 8, 6, 19, 2);
    }

    private void createUsers() {
        String encodedPassword = passwordEncoder.encode("1");

        uIds[0] = saveUser("张三", "13800138001", "zhangsan@example.com", encodedPassword,
                "https://picsum.photos/seed/avatar1/200/200", 4.8, "张小明",
                "2021010001", "计算机学院", "软件工程2101", "乐于助人，常在线，愿意参与校园互助任务。", new BigDecimal("85"));

        uIds[1] = saveUser("李四", "13800138002", "lisi@example.com", encodedPassword,
                "https://picsum.photos/seed/avatar2/200/200", 4.2, "李华",
                "2021020002", "经济管理学院", "金融学2102", "喜欢帮助别人，课余时间比较多。", new BigDecimal("85"));

        uIds[2] = saveUser("王同学", "13800138003", "wang@example.com", encodedPassword,
                "", 3.5, "王同学",
                "2021030003", "外国语学院", "英语2103", "新用户，正在探索平台功能。", new BigDecimal("80"));

        uIds[3] = saveUser("陈同学", "13800138004", "chen@example.com", encodedPassword,
                "https://picsum.photos/seed/avatar4/200/200", 2.8, "陈志强",
                "2021030004", "机械工程学院", "机械设计2101", "做事认真负责，但有时回复较慢。", new BigDecimal("100"));

        uIds[4] = saveUser("赵同学", "13800138005", "zhao@example.com", encodedPassword,
                "https://picsum.photos/seed/avatar5/200/200", 4.9, "赵雨薇",
                "2021040005", "设计学院", "视觉传达2103", "设计专业学生，擅长海报和PPT制作。", new BigDecimal("100"));

        uIds[5] = saveUser("刘同学", "13800138006", "liu@example.com", encodedPassword,
                "", 3.9, "刘志强",
                "2021060006", "理学院", "数学2101", "数学系学生，乐于助人。", new BigDecimal("100"));

        uIds[6] = saveUser("孙同学", "13800138007", "sun@example.com", encodedPassword,
                "https://picsum.photos/seed/avatar7/200/200", 4.6, "孙文博",
                "2021050007", "外国语学院", "英语2101", "英语口语流利，喜欢交朋友。", new BigDecimal("105"));

        uIds[7] = saveUser("周同学", "13800138008", "zhou@example.com", encodedPassword,
                "", 2.5, "周佳",
                "2021080008", "文学院", "汉语言2101", "校内打印店兼职，可以帮忙打印资料。", new BigDecimal("100"));

        // 平台管理员（role=1）：不参与交易，负责争议订单仲裁与内容管理。账号 admin / 1
        Long adminId = saveUser("admin", "13800138009", "admin@example.com", encodedPassword,
                "https://picsum.photos/seed/avatarAdmin/200/200", 5.0, "平台管理员",
                "ADMIN", "平台运营", "管理组", "平台管理员，负责争议订单仲裁与内容管理。", BigDecimal.ZERO);
        userRepository.findById(adminId).ifPresent(u -> {
            u.setRole(1);
            userRepository.save(u);
        });
    }

    private Long saveUser(String username, String phone, String email, String passwordHash,
                          String avatar, double creditScore, String realName,
                          String studentId, String college, String className, String bio, BigDecimal balance) {
        User u = new User();
        u.setUsername(username);
        u.setPhone(phone);
        u.setEmail(email);
        u.setPasswordHash(passwordHash);
        u.setAvatar(avatar);
        u.setCreditScore(BigDecimal.valueOf(creditScore));
        u.setRealName(realName);
        u.setStudentId(studentId);
        u.setCollege(college);
        u.setClassName(className);
        u.setBio(bio);
        u.setBalance(balance);
        u.setAuthStatus(1); // 已认证
        u = userRepository.save(u);
        return u.getId();
    }

    private void createTasks() {
        LocalDateTime now = LocalDateTime.now();
        // t1: 帮忙取快递 (payer, closed)
        tIds[0] = saveTask("帮忙取快递", "payer", "errand",
                "从学校菜鸟驿站取一个中等大小快递，送到 3 号宿舍楼下即可。",
                uIds[0], "张三", 4.8, "5元", 5,
                now.plusDays(1), "closed", "站内联系",
                "[\"https://picsum.photos/seed/task1a/300/200\"]", null);
        // t2: 代拿外卖 (payer, closed)
        tIds[1] = saveTask("代拿外卖", "payer", "errand",
                "帮忙从东门外卖柜取餐，送到教学楼 A 区门口。",
                uIds[1], "李四", 4.2, "4元", 4,
                now.plusDays(1), "closed", "站内联系", null, null);
        // t3: 宿舍搬运行李 (payer, open)
        tIds[2] = saveTask("宿舍搬运行李", "payer", "life-service",
                "需要帮忙把两个行李箱从 1 号宿舍楼搬到 8 号宿舍楼，有电梯。",
                uIds[3], "陈同学", 2.8, "15元", 15,
                now.plusDays(2), "open", "微信联系",
                "[\"https://picsum.photos/seed/task3a/300/200\"]", null);
        // t4: 帮修电脑 (payer, open)
        tIds[3] = saveTask("帮修电脑无法联网问题", "payer", "skill-help",
                "笔记本电脑连不上校园网，想请懂电脑的同学帮忙排查一下问题。",
                uIds[2], "王同学", 3.5, "20元", 20,
                now.plusDays(1), "open", "电话联系", null, null);
        // t5: 社团海报设计 (payer, open)
        tIds[4] = saveTask("社团海报设计", "payer", "skill-help",
                "需要一张活动宣传海报，风格活泼简洁，今晚可先出草稿更好。",
                uIds[4], "赵同学", 4.9, "30元", 30,
                now.plusDays(3), "open", "QQ联系",
                "[\"https://picsum.photos/seed/task5a/300/200\",\"https://picsum.photos/seed/task5b/300/200\"]", null);
        // t6: 图书馆占座 (payer, open)
        tIds[5] = saveTask("图书馆占座", "payer", "study-help",
                "明天早上 8 点前在图书馆三楼帮忙占一个座位，靠窗优先。",
                uIds[5], "刘同学", 3.9, "3元", 3,
                now.plusDays(1), "open", "站内联系", null, null);
        // t7: 高数题目答疑 (payer, open)
        tIds[6] = saveTask("高数题目答疑", "payer", "study-help",
                "想请一位同学帮忙讲解几道高等数学极限题，线下 30 分钟左右。",
                uIds[6], "孙同学", 4.6, "10元", 10,
                now.plusDays(2), "open", "微信联系", null, null);
        // t8: 借实验课报告模板 (payer, open)
        tIds[7] = saveTask("借实验课报告模板", "payer", "material-share",
                "想找一份上学期实验课报告模板作参考，有偿求助。",
                uIds[7], "周同学", 2.5, "2元", 2,
                now.plusDays(1), "open", "站内联系", null, null);
        // t9: 求数据库课程笔记 (payer, open)
        tIds[8] = saveTask("求数据库课程笔记", "payer", "material-share",
                "想购买一份数据库原理的期中复习笔记，最好是本学期老师上课版本。",
                uIds[0], "张三", 4.8, "5元", 5,
                now.plusDays(3), "open", "QQ联系",
                "[\"https://picsum.photos/seed/task9a/300/200\"]", null);
        // t10: 转让二手台灯 (payer, open)
        tIds[9] = saveTask("转让二手台灯", "payer", "item-trade",
                "毕业清理闲置，转让一盏九成新护眼台灯，可在宿舍区当面交易。",
                uIds[1], "李四", 4.2, "25元", 25,
                now.plusDays(5), "open", "电话联系",
                "[\"https://picsum.photos/seed/task10a/300/200\",\"https://picsum.photos/seed/task10b/300/200\",\"https://picsum.photos/seed/task10c/300/200\"]", null);
        // t11: 求购二手自行车 (payer, open)
        tIds[10] = saveTask("求购二手自行车", "payer", "item-trade",
                "想收一辆能正常骑行的二手自行车，预算 150 元以内，校内面交。",
                uIds[3], "陈同学", 2.8, "面议", 0,
                now.plusDays(7), "open", "微信联系", null, null);
        // t12: 羽毛球搭子招募 (none, open)
        tIds[11] = saveTask("羽毛球搭子招募", "none", "teamwork",
                "想找一位每周二、周四晚上一起打羽毛球的搭子，水平不限。",
                uIds[4], "赵同学", 4.9, "无", 0,
                now.plusDays(30), "open", "站内联系", null, null);
        // t13: 数学建模比赛组队 (none, open)
        tIds[12] = saveTask("数学建模比赛组队", "none", "teamwork",
                "准备参加校级数学建模比赛，想找会写论文或会编程的同学组队。",
                uIds[2], "王同学", 3.5, "无", 0,
                now.plusDays(14), "open", "QQ联系", null, null);
        // t14: 失物招领信息代发布 (payer, open)
        tIds[13] = saveTask("失物招领信息代发布", "payer", "other",
                "帮忙把一则失物招领信息转发到年级群，完成后截图即可。",
                uIds[5], "刘同学", 3.9, "1元", 1,
                now.plusDays(1), "open", "站内联系", null, null);
        // t15: 可长期代取快递 (earner, open)
        tIds[14] = saveTask("可长期代取快递", "earner", "errand",
                "工作日傍晚可帮忙代取快递，覆盖西区宿舍，响应较快，支持提前联系。",
                uIds[6], "孙同学", 4.6, "3-5元/单", 4,
                now.plusDays(30), "open", "微信联系",
                "[\"https://picsum.photos/seed/task15a/300/200\"]", "工作日傍晚");
        // t16: 可代买早餐和日用品 (earner, open)
        tIds[15] = saveTask("可代买早餐和日用品", "earner", "errand",
                "早上可顺路代买早餐、矿泉水、纸巾等日用品，南区宿舍优先。",
                uIds[7], "周同学", 2.5, "2-6元/次", 4,
                now.plusDays(30), "open", "电话联系", null, "每天早上");
        // t17: 提供 PPT 美化与排版服务 (earner, open)
        tIds[16] = saveTask("提供 PPT 美化与排版服务", "earner", "skill-help",
                "可帮忙优化课程汇报 PPT、社团展示 PPT，支持简约风、学术风、活泼风。",
                uIds[0], "张三", 4.8, "20元起", 20,
                now.plusDays(30), "open", "QQ联系",
                "[\"https://picsum.photos/seed/task17a/300/200\"]", "预约协商");
        // t18: 提供基础电脑故障排查 (earner, open)
        tIds[17] = saveTask("提供基础电脑故障排查", "earner", "skill-help",
                "可协助处理系统卡顿、软件安装、打印机连接、校园网基础问题等。",
                uIds[1], "李四", 4.2, "15元起", 15,
                now.plusDays(30), "open", "微信联系", null, "预约协商");
        // t19: 高数一对一答疑辅导 (earner, open)
        tIds[18] = saveTask("高数一对一答疑辅导", "earner", "study-help",
                "可辅导极限、导数、积分等基础内容，适合期中前突击复习。",
                uIds[4], "赵同学", 4.9, "25元/小时", 25,
                now.plusDays(30), "open", "站内联系", null, "预约协商");
        // t20: 英语口语陪练 (earner, open)
        tIds[19] = saveTask("英语口语陪练", "earner", "study-help",
                "可陪练四六级口语、自我介绍、日常对话，适合基础薄弱同学。",
                uIds[3], "陈同学", 2.8, "18元/30分钟", 18,
                now.plusDays(30), "open", "电话联系",
                "[\"https://picsum.photos/seed/task20a/300/200\",\"https://picsum.photos/seed/task20b/300/200\"]", "预约协商");
        // t21: 出售整理版期中复习资料 (earner, open)
        tIds[20] = saveTask("出售整理版期中复习资料", "earner", "material-share",
                "提供数据库、数据结构、大学物理等课程的重点整理资料，可发电子版。",
                uIds[6], "孙同学", 4.6, "8元/份", 8,
                now.plusDays(30), "open", "QQ联系", null, "随时可发");
        // t22: 帮忙打印装订资料 (earner, open)
        tIds[21] = saveTask("帮忙打印装订资料", "earner", "life-service",
                "可代打印课程作业、论文、简历等，支持黑白和彩印，晚间也可联系。",
                uIds[7], "周同学", 2.5, "按页计费", 0,
                now.plusDays(30), "open", "微信联系",
                "[\"https://picsum.photos/seed/task22a/300/200\"]", "每天晚上");
    }

    private Long saveTask(String title, String publisherSide, String category,
                          String description, Long publisherId, String publisherName,
                          double publisherCredit, String reward, int rewardValue,
                          LocalDateTime deadline, String status, String contact,
                          String images, String serviceTime) {
        Task t = new Task();
        t.setTitle(title);
        t.setPublisherSide(publisherSide);
        t.setCategory(category);
        t.setDescription(description);
        t.setPublisherId(publisherId);
        t.setPublisherName(publisherName);
        t.setPublisherCredit(BigDecimal.valueOf(publisherCredit));
        t.setReward(reward);
        t.setRewardValue(BigDecimal.valueOf(rewardValue));
        t.setDeadline(deadline);
        t.setStatus(status);
        t.setContact(contact);
        t.setImages(images);
        t.setServiceTime(serviceTime);
        t.setType(0); // 旧字段兼容
        t = taskRepository.save(t);
        return t.getId();
    }

    private void createOrders() {
        LocalDateTime now = LocalDateTime.now();
        int autoDays = AUTO_DAYS;

        // o1: 悬赏帖 t1，publisher=u1→payer，u2=earner，in_progress
        saveOrder(tIds[0], "c1", uIds[0], uIds[1], new BigDecimal("5"),
                "in_progress", false, false,
                now.minusHours(3), now.minusHours(2).minusMinutes(30), null, null, null);

        // o2: 悬赏帖 t2，publisher=u2→payer，u1=earner，completed
        saveOrder(tIds[1], "c2", uIds[1], uIds[0], new BigDecimal("4"),
                "completed", true, true,
                now.minusHours(10), now.minusHours(9), now.minusHours(8), null,
                now.minusHours(8).plusDays(autoDays));

        // o3: 服务帖 t15，publisher=u7→earner，u1=payer，completed
        saveOrder(tIds[14], "c3", uIds[0], uIds[6], new BigDecimal("5"),
                "completed", true, true,
                now.minusHours(50), now.minusHours(49), now.minusHours(24), null,
                now.minusHours(24).plusDays(autoDays));

        // o4: 服务帖 t16，publisher=u8→earner，u1=payer，in_progress
        saveOrder(tIds[15], "c4", uIds[0], uIds[7], new BigDecimal("10"),
                "in_progress", false, false,
                now.minusHours(12), now.minusHours(11), null, null, null);

        // o5: 服务帖 t17，publisher=u1→earner，u3=payer，pending
        saveOrder(tIds[16], "c5", uIds[2], uIds[0], new BigDecimal("20"),
                "pending", false, false,
                now.minusHours(2), null, null, null, null);

        // o6: 服务帖 t19，publisher=u5→earner，u2=payer，in_progress，auto-confirm pending
        saveOrder(tIds[18], "c6", uIds[1], uIds[4], new BigDecimal("15"),
                "in_progress", true, false,
                now.minusHours(36), now.minusHours(35), null,
                now.minusDays(2), null);
    }

    private void saveOrder(Long postId, String chatId, Long payerId, Long earnerId,
                           BigDecimal amount, String status, boolean payerConfirmed, boolean earnerConfirmed,
                           LocalDateTime createdAt, LocalDateTime acceptedAt, LocalDateTime completedAt,
                           LocalDateTime autoConfirmAt, LocalDateTime reviewDeadline) {
        Order o = new Order();
        o.setPostId(postId);
        o.setChatId(chatId);
        o.setPayerId(payerId);
        o.setEarnerId(earnerId);
        o.setAmount(amount);
        o.setStatus(status);
        o.setPayerConfirmed(payerConfirmed);
        o.setEarnerConfirmed(earnerConfirmed);
        o.setCreatedAt(createdAt);
        o.setAcceptedAt(acceptedAt);
        o.setCompletedAt(completedAt);
        o.setAutoConfirmAt(autoConfirmAt);
        o.setReviewDeadline(reviewDeadline);
        orderRepository.save(o);
    }

    private void createTransactions() {
        LocalDateTime now = LocalDateTime.now();
        // tx1: u1 支付 o1 (帮忙取快递)
        saveTransaction(uIds[0], "out", new BigDecimal("5"), "order", "1", "订单支付：帮忙取快递", now.minusHours(2).minusMinutes(30));
        // tx2: u1 收到 o2 (代拿外卖)
        saveTransaction(uIds[0], "in", new BigDecimal("4"), "order", "2", "订单收入：代拿外卖", now.minusHours(8));
        // tx3: u2 支付 o2
        saveTransaction(uIds[1], "out", new BigDecimal("4"), "order", "2", "订单支付：代拿外卖", now.minusHours(9));
        // tx4: u1 支付 o3 (可长期代取快递)
        saveTransaction(uIds[0], "out", new BigDecimal("5"), "order", "3", "订单支付：可长期代取快递", now.minusHours(49));
        // tx5: u7 收到 o3
        saveTransaction(uIds[6], "in", new BigDecimal("5"), "order", "3", "订单收入：可长期代取快递", now.minusHours(24));
        // tx6: u1 支付 o4 (可代买早餐和日用品)
        saveTransaction(uIds[0], "out", new BigDecimal("10"), "order", "4", "订单支付：可代买早餐和日用品", now.minusHours(11));
        // tx7: u2 支付 o6 (高数一对一答疑辅导)
        saveTransaction(uIds[1], "out", new BigDecimal("15"), "order", "6", "订单支付：高数一对一答疑辅导", now.minusHours(35));
        // tx8: u1 充值
        saveTransaction(uIds[0], "in", new BigDecimal("50"), "recharge", null, "账户充值", now.minusHours(52));
    }

    private void saveTransaction(Long userId, String direction, BigDecimal amount,
                                 String category, String relatedId, String note, LocalDateTime time) {
        Transaction tx = new Transaction();
        tx.setUserId(userId);
        tx.setDirection(direction);
        tx.setAmount(amount);
        tx.setCategory(category);
        tx.setRelatedId(relatedId);
        tx.setNote(note);
        tx.setCreatedAt(time);
        transactionRepository.save(tx);
    }

    private void createConversations() {
        LocalDateTime now = LocalDateTime.now();
        // c1: u1↔u2 关于 t1(帮忙取快递)
        saveConversation("c1", uIds[0], uIds[1], tIds[0], "帮忙取快递",
                "好的，我 10 分钟后到宿舍楼下。", now.minusHours(2), uIds[1]);
        // c2: u1↔u2 关于 t2(代拿外卖)
        saveConversation("c2", uIds[0], uIds[1], tIds[1], "代拿外卖",
                "双方已确认任务完成，款项已结算", now.minusHours(8), null);
        // c3: u1↔u7 关于 t15(可长期代取快递)
        saveConversation("c3", uIds[0], uIds[6], tIds[14], "可长期代取快递",
                "服务已完成，款项已结算", now.minusHours(24), null);
        // c4: u1↔u8 关于 t16(可代买早餐和日用品)
        saveConversation("c4", uIds[0], uIds[7], tIds[15], "可代买早餐和日用品",
                "周同学已同意接单，服务开始执行", now.minusHours(11), null);
        // c5: u3↔u1 关于 t17(提供 PPT 美化与排版服务)
        saveConversation("c5", uIds[2], uIds[0], tIds[16], "提供 PPT 美化与排版服务",
                "消费者已申请服务，等待服务提供者确认", now.minusHours(2), null);
        // c6: u2↔u5 关于 t19(高数一对一答疑辅导)
        saveConversation("c6", uIds[1], uIds[4], tIds[18], "高数一对一答疑辅导",
                "李四已确认服务完成，等待提供者确认（2天后自动确认）", now.minusHours(10), null);
    }

    private void saveConversation(String id, Long user1Id, Long user2Id, Long taskId,
                                  String taskTitle, String lastMessage, LocalDateTime lastTime,
                                  Long lastMessageSenderId) {
        Conversation c = new Conversation();
        c.setId(id);
        c.setUser1Id(user1Id);
        c.setUser2Id(user2Id);
        c.setTaskId(taskId);
        c.setTaskTitle(taskTitle);
        c.setLastMessage(lastMessage);
        c.setLastTime(lastTime);
        c.setLastMessageSenderId(lastMessageSenderId);
        conversationRepository.save(c);
    }

    private void createMessages() {
        LocalDateTime now = LocalDateTime.now();
        // m1: c1, u2→u1
        saveMessage("c1", uIds[1], "李四", uIds[0], "好的，我 10 分钟后到宿舍楼下。",
                "text", now.minusHours(2), "t1", "帮忙取快递", false, false, null);
        // m2: c1, u1→u2
        saveMessage("c1", uIds[0], "张三", uIds[1], "好的，我在楼下等你，穿蓝色外套。",
                "text", now.minusHours(1).minusMinutes(48), "t1", "帮忙取快递", false, false, null);
        // m3: c2, u2→u1
        saveMessage("c2", uIds[1], "李四", uIds[0], "辛苦了，到了给我发消息就行。",
                "text", now.minusHours(8).minusMinutes(30), "t2", "代拿外卖", false, false, null);
        // m4: c1, system→ 李四已接单
        saveMessage("c1", null, "系统", null, "李四已接单",
                "system", now.minusHours(3), "t1", "帮忙取快递", false, false, null);
        // m5: c1, system→ 张三已预付报酬
        saveMessage("c1", null, "系统", null, "张三已预付报酬 5 元，任务开始执行",
                "system", now.minusHours(2).minusMinutes(30), "t1", "帮忙取快递", false, false, null);
        // m6: c2, system→ 张三已接单
        saveMessage("c2", null, "系统", null, "张三已接单",
                "system", now.minusHours(10), "t2", "代拿外卖", false, false, null);
        // m7: c2, system→ 李四已预付报酬
        saveMessage("c2", null, "系统", null, "李四已预付报酬 4 元，任务开始执行",
                "system", now.minusHours(9), "t2", "代拿外卖", false, false, null);
        // m8: c2, system→ 双方已确认
        saveMessage("c2", null, "系统", null, "双方已确认任务完成，款项已结算",
                "system", now.minusHours(8), "t2", "代拿外卖", false, false, null);
        // m9: c3, u1→u7
        saveMessage("c3", uIds[0], "张三", uIds[6], "帮我取个快递，菜鸟驿站的",
                "text", now.minusHours(50), "t15", "可长期代取快递", false, false, null);
        // m10: c3, u7→u1
        saveMessage("c3", uIds[6], "孙同学", uIds[0], "好的，晚上 7 点送到你宿舍",
                "text", now.minusHours(49), "t15", "可长期代取快递", false, false, null);
        // m11: c3, system→
        saveMessage("c3", null, "系统", null, "服务已完成，款项已结算",
                "system", now.minusHours(24), "t15", "可长期代取快递", false, false, null);
        // m12: c4, u1→u8
        saveMessage("c4", uIds[0], "张三", uIds[7], "明天早上帮我带一份豆浆",
                "text", now.minusHours(12), "t16", "可代买早餐和日用品", false, false, null);
        // m13: c4, system→
        saveMessage("c4", null, "系统", null, "周同学已同意接单，服务开始执行",
                "system", now.minusHours(11), "t16", "可代买早餐和日用品", false, false, null);
        // m14: c5, system→
        saveMessage("c5", null, "系统", null, "消费者已申请服务，等待服务提供者确认",
                "system", now.minusHours(2), "t17", "提供 PPT 美化与排版服务", false, false, null);
        // m15: c6, u2→u5
        saveMessage("c6", uIds[1], "李四", uIds[4], "高数答疑可以今晚开始吗？",
                "text", now.minusHours(20), "t19", "高数一对一答疑辅导", false, false, null);
        // m16: c6, system→
        saveMessage("c6", null, "系统", null, "赵同学已同意接单，服务开始执行",
                "system", now.minusHours(19), "t19", "高数一对一答疑辅导", false, false, null);
        // m17: c6, system→
        saveMessage("c6", null, "系统", null, "李四已确认服务完成，等待提供者确认（2天后自动确认）",
                "system", now.minusHours(10), "t19", "高数一对一答疑辅导", false, false, null);
        // m18: c1, u2→u1, 未读演示
        saveMessage("c1", uIds[1], "李四", uIds[0], "快递到了，你现在方便下来拿吗？",
                "text", now.minusMinutes(18), "t1", "帮忙取快递", false, true, null);
        // m19: c3, u7→u1, 未读演示
        saveMessage("c3", uIds[6], "孙同学", uIds[0], "下次的快递也照旧放前台哈～",
                "text", now.minusMinutes(36), "t15", "可长期代取快递", false, true, null);
    }

    private void saveMessage(String chatId, Long senderId, String senderName, Long receiverId,
                             String content, String type, LocalDateTime time,
                             String taskId, String taskTitle,
                             boolean withdrawn, boolean isRead, String payment) {
        Message m = new Message();
        m.setChatId(chatId);
        m.setSenderId(senderId);
        m.setSenderName(senderName);
        m.setReceiverId(receiverId);
        m.setContent(content);
        m.setType(type);
        m.setTime(time);
        m.setTaskId(taskId);
        m.setTaskTitle(taskTitle);
        m.setWithdrawn(withdrawn);
        m.setRead(isRead);
        m.setPayment(payment);
        messageRepository.save(m);
    }

    private void createReviews() {
        LocalDateTime now = LocalDateTime.now();
        // r1: u1→u2 关于 t1
        saveReview(uIds[0], "张三", uIds[1], "李四", tIds[0], 1L, 5, "非常准时，服务态度很好！", false,
                now.minusHours(24));
        // r2: u1→u7 关于 t15
        saveReview(uIds[0], "张三", uIds[6], "孙同学", tIds[14], 3L, 5, "取快递很及时，下次还会找他！", false,
                now.minusHours(23));
    }

    private void saveReview(Long fromUserId, String fromUserName, Long toUserId, String toUserName,
                            Long taskId, Long orderId, int rating, String content, boolean auto,
                            LocalDateTime time) {
        Review r = new Review();
        r.setFromUserId(fromUserId);
        r.setFromUserName(fromUserName);
        r.setToUserId(toUserId);
        r.setToUserName(toUserName);
        r.setTaskId(taskId);
        r.setOrderId(orderId);
        r.setRating(rating);
        r.setContent(content);
        r.setAutoReview(auto);
        r.setCreatedAt(time);
        reviewRepository.save(r);
    }
}
