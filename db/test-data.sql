-- ============================================
-- Campus Task Hub 演示数据脚本（仅用于 prod / MySQL 演示）
--
-- ⚠️ 使用场景说明：
--   - dev profile（默认，H2 内存库）：【不要导入本脚本】。
--     DataInitializer 已自动生成完整种子数据（8 用户/22 帖子/6 订单…，密码统一为 "1"）。
--   - prod profile（MySQL）：DataInitializer 不运行（@Profile("!prod")），库为空。
--     此时若需演示数据，才导入本脚本。
--   - 真实上线：【不要导入本脚本】，保持库为空，让用户自行注册。
--
-- 导入方式（仅在 prod 空库上）：
--   mysql -u root -p campus_task_hub < db/test-data.sql
--
-- 密码说明：4 个账号密码统一为 123456
--   下面的 bcrypt hash 均为真实可校验的哈希（$2b$10$，Spring BCryptPasswordEncoder 兼容），
--   已用 bcrypt.checkpw 验证 matches("123456", hash) == True。
--
-- 数据关系自洽性：
--   orders.post_id / payer_id / earner_id      -> tasks / users
--   reviews.order_id / task_id / from / to     -> orders / tasks / users
--   transactions.related_id                    -> orders.id（字符串）
--   conversations.task_id                      -> tasks.id
--   chat_messages.chat_id                      -> conversations.id
--   reports.post_id                            -> tasks.id
-- ============================================
SET NAMES utf8mb4;
USE campus_task_hub;

-- ============================================
-- 1. 用户测试数据（密码均为 123456）
--    手机号用 139 段，避免与 DataInitializer 的 138 段冲突（万一混用）
-- ============================================
INSERT INTO users (id, username, phone, email, password_hash, avatar, credit_score, auth_status, real_name, student_id, college, class_name, bio, balance, role, version, created_at) VALUES
(1, 'xiaoming', '13900139001', 'xiaoming@campus.edu', '$2b$10$wQY0FlPWcdAysC.bv6ND1uqe7eDoTRbGCl/E0.zVaA1xy.PvyeJTq', NULL, 4.8, 1, '张三', '2021001', '计算机学院', '计科2101', '热爱编程，乐于助人', 100.00, 0, 0, NOW()),
(2, 'xiaohong', '13900139002', 'xiaohong@campus.edu', '$2b$10$fGOFok50lnPFBCgXtyqaIO72sfnk..4P7gLUh0unEYELhS2S.qs2u', NULL, 5.0, 1, '李四', '2021002', '电子工程学院', '电信2102', '专注学习，擅长代取快递', 50.50, 0, 0, NOW()),
(3, 'xiaowang', '13900139003', 'xiaowang@campus.edu', '$2b$10$56l5q2blDgDZBxV3dW68ZeKJZrv.Jd09qV/n40rsAedzm7mRC1o0q', NULL, 3.5, 0, NULL, NULL, NULL, NULL, '新人用户', 0.00, 0, 0, NOW()),
(4, 'admin', '13900139000', 'admin@campus.edu', '$2b$10$htNZPp3uGm5LXf9It.rvC.XXltBKXJSNdIQF7PWYDR6F0TPrkbc5.', NULL, 5.0, 1, '管理员', 'A001', NULL, NULL, '系统管理员', 9999.99, 1, 0, NOW());

-- ============================================
-- 2. 帖子/任务测试数据
--    包含：payer(悬赏)、earner(服务)、none(互助) 三种类型
--    task 1 对应 order 1(completed)，故置 closed 保持业务一致
-- ============================================
INSERT INTO tasks (id, title, type, category, description, publisher_id, publisher_name, publisher_credit, reward, reward_value, deadline, status, contact, images, publisher_side, service_time, publish_time, created_at, version) VALUES
(1, '帮忙取东区食堂午饭', 0, '代取快递', '一份宫保鸡丁盖饭，送到西区宿舍5号楼302，谢谢！', 1, 'xiaoming', 4.8, '10元', 10.00, DATE_ADD(NOW(), INTERVAL 2 HOUR), 'closed', '微信13900139001', NULL, 'payer', NULL, NOW(), NOW(), 0),
(2, '代修电脑/安装系统', 0, '技术服务', '可以帮忙重装系统、安装常用软件、解决常见电脑问题，价格面议。', 2, 'xiaohong', 5.0, '30元起', 30.00, NULL, 'open', '站内联系', NULL, 'earner', '周末全天', NOW(), NOW(), 0),
(3, '组队自习微积分', 0, '组队互助', '下周期末考试，有没有一起去图书馆自习的同学？互相答疑，共同进步！', 1, 'xiaoming', 4.8, '互助', 0.00, NULL, 'open', '自习室见', NULL, 'none', NULL, NOW(), NOW(), 0),
(4, '代写Python作业', 0, '技术服务', '急！求帮忙写一份Python大作业，具体需求详谈。', 3, 'xiaowang', 3.5, '50元', 50.00, DATE_ADD(NOW(), INTERVAL 3 DAY), 'closed', '站内联系', NULL, 'payer', NULL, DATE_SUB(NOW(), INTERVAL 2 DAY), DATE_SUB(NOW(), INTERVAL 2 DAY), 0);

-- ============================================
-- 3. 会话测试数据
--    包含：普通对话、系统通知会话（user2_id=0 哨兵）
-- ============================================
INSERT INTO conversations (id, user1_id, user2_id, task_id, task_title, last_message, last_time, last_message_sender_id, created_at) VALUES
('c-t1-u2', 1, 2, 1, '帮忙取东区食堂午饭', '好的，我现在就去取', NOW(), 2, NOW()),
('c-t2-u1', 2, 1, 2, '代修电脑/安装系统', '你好，我的电脑开不了机了', NOW(), 1, NOW()),
('sys-notify-1', 1, 0, NULL, NULL, '您的订单已完成', NOW(), 0, NOW()),
('sys-notify-2', 2, 0, NULL, NULL, '收到新的评价', NOW(), 0, NOW());

-- ============================================
-- 4. 聊天消息测试数据
--    type: text / system / payment
-- ============================================
INSERT INTO chat_messages (chat_id, sender_id, sender_name, receiver_id, content, type, time, task_id, task_title, is_read, payment) VALUES
('c-t1-u2', 1, 'xiaoming', 2, '你好，能帮忙取下外卖吗？', 'text', DATE_SUB(NOW(), INTERVAL 30 MINUTE), '1', '帮忙取东区食堂午饭', 1, NULL),
('c-t1-u2', 2, 'xiaohong', 1, '可以的，现在有空', 'text', DATE_SUB(NOW(), INTERVAL 25 MINUTE), '1', '帮忙取东区食堂午饭', 1, NULL),
('c-t1-u2', 1, 'xiaoming', 2, '太感谢了，这是10块钱', 'payment', DATE_SUB(NOW(), INTERVAL 20 MINUTE), '1', '帮忙取东区食堂午饭', 1, '{"kind":"transfer","amount":10,"status":"paid","payerId":1,"payerName":"xiaoming","receiverId":2,"receiverName":"xiaohong"}'),
('c-t1-u2', 2, 'xiaohong', 1, '好的，我现在就去取', 'text', DATE_SUB(NOW(), INTERVAL 15 MINUTE), '1', '帮忙取东区食堂午饭', 0, NULL),
('c-t2-u1', 1, 'xiaoming', 2, '你好，我的电脑开不了机了', 'text', DATE_SUB(NOW(), INTERVAL 2 HOUR), '2', '代修电脑/安装系统', 1, NULL),
('sys-notify-1', 0, '系统通知', 1, '您的订单 #1 已完成，记得给对方评价哦！', 'system', DATE_SUB(NOW(), INTERVAL 1 HOUR), NULL, NULL, 1, NULL);

-- ============================================
-- 5. 订单测试数据
--    包含：in_progress、completed 两种状态
-- ============================================
INSERT INTO orders (id, chat_id, post_id, payer_id, earner_id, amount, status, payer_confirmed, earner_confirmed, created_at, accepted_at, completed_at, auto_confirm_at, review_deadline, version) VALUES
(1, 'c-t1-u2', 1, 1, 2, 10.00, 'completed', 1, 1, DATE_SUB(NOW(), INTERVAL 2 HOUR), DATE_SUB(NOW(), INTERVAL 1 HOUR), DATE_SUB(NOW(), INTERVAL 30 MINUTE), DATE_ADD(NOW(), INTERVAL 1 DAY), DATE_ADD(NOW(), INTERVAL 7 DAY), 0),
(2, 'c-t2-u1', 2, 1, 2, 30.00, 'in_progress', 0, 0, DATE_SUB(NOW(), INTERVAL 1 HOUR), NOW(), NULL, NULL, NULL, 0);

-- ============================================
-- 6. 评价测试数据
-- ============================================
INSERT INTO reviews (order_id, task_id, from_user_id, from_user_name, to_user_id, to_user_name, rating, content, images, auto_review, created_at) VALUES
(1, 1, 1, 'xiaoming', 2, 'xiaohong', 5, '非常感谢！速度很快，服务态度也很好！', NULL, 0, NOW()),
(1, 1, 2, 'xiaohong', 1, 'xiaoming', 5, '爽快的雇主，付款很快！', NULL, 0, NOW());

-- ============================================
-- 7. 交易流水测试数据
-- ============================================
INSERT INTO transactions (user_id, direction, amount, category, related_id, note, created_at) VALUES
(1, 'in', 100.00, 'recharge', NULL, '账户充值', DATE_SUB(NOW(), INTERVAL 1 DAY)),
(1, 'out', 10.00, 'order', '1', '订单 #1 付款', DATE_SUB(NOW(), INTERVAL 2 HOUR)),
(2, 'in', 10.00, 'order', '1', '订单 #1 收款', DATE_SUB(NOW(), INTERVAL 2 HOUR)),
(2, 'in', 50.50, 'recharge', NULL, '账户充值', DATE_SUB(NOW(), INTERVAL 3 DAY));

-- ============================================
-- 8. 举报测试数据
-- ============================================
INSERT INTO reports (post_id, reporter_id, reporter_name, reason, status, created_at) VALUES
(4, 1, 'xiaoming', '发布违规内容，涉嫌学术不端', 'handled', DATE_SUB(NOW(), INTERVAL 2 DAY));

-- ============================================
-- 导入后验证：各表数据量
--   users=4  tasks=4  conversations=4  chat_messages=6
--   orders=2  reviews=2  transactions=4  reports=1
-- ============================================
