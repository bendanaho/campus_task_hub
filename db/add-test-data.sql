-- ============================================
-- 额外测试数据：带图片的任务（演示用）
--
-- 使用场景：在已导入 schema.sql + test-data.sql 的 prod/MySQL 库上追加。
-- 导入方式：
--   mysql -uroot -p campus_task_hub < db/add-test-data.sql
--
-- 内容：10 个新任务，7 个带图片（picsum 外链），3 个无图。
--   - 图片为 picsum.photos 外链，需浏览器能联网访问；
--   - 前端 img 带 onerror 兜底，加载失败自动隐藏，不影响功能。
--   - 如需离线/确保显示，可把 images 换成 base64 内嵌图。
--
-- 发布者复用 test-data.sql 的 3 个用户：
--   1=xiaoming(4.8) 2=xiaohong(5.0) 3=xiaowang(3.5)
-- ============================================
SET NAMES utf8mb4;
USE campus_task_hub;

INSERT INTO tasks (title, type, category, description, publisher_id, publisher_name, publisher_credit, reward, reward_value, deadline, status, contact, images, publisher_side, service_time, publish_time, created_at) VALUES
('帮忙搬宿舍行李', 0, '生活服务', '要从1号楼搬到8号楼，两个行李箱加几个纸箱，有电梯，约需1小时，酬谢30元。', 1, 'xiaoming', 4.8, '30元', 30.00, DATE_ADD(NOW(), INTERVAL 2 DAY), 'open', '微信13900139001', '["https://picsum.photos/seed/move1/400/300","https://picsum.photos/seed/move2/400/300"]', 'payer', NULL, NOW(), NOW()),

('二手自行车转让', 0, '物品交易', '毕业转让一辆九成新山地车，骑行顺畅，带车锁和车筐，校内当面交易，150元。', 2, 'xiaohong', 5.0, '150元', 150.00, DATE_ADD(NOW(), INTERVAL 7 DAY), 'open', '电话联系', '["https://picsum.photos/seed/bike1/400/300","https://picsum.photos/seed/bike2/400/300","https://picsum.photos/seed/bike3/400/300"]', 'payer', NULL, NOW(), NOW()),

('提供PS修图与海报设计服务', 0, '技术服务', '可做证件照精修、活动海报、社团宣传图，价格视复杂度而定，出图快，可线上沟通。', 1, 'xiaoming', 4.8, '20元起', 20.00, NULL, 'open', 'QQ联系', '["https://picsum.photos/seed/ps1/400/300","https://picsum.photos/seed/ps2/400/300"]', 'earner', '全天可约', NOW(), NOW()),

('找羽毛球搭子', 0, '组队互助', '每周二四晚上体育馆打球，水平中等，找个搭子一起，AA场地费，长期固定。', 3, 'xiaowang', 3.5, '互助', 0.00, NULL, 'open', '站内联系', NULL, 'none', NULL, NOW(), NOW()),

('代取菜鸟驿站快递', 0, '代取快递', '一个中等包裹，从菜鸟驿站取了送到西区5号楼302，今天下午方便的同学来。', 1, 'xiaoming', 4.8, '5元', 5.00, DATE_ADD(NOW(), INTERVAL 1 DAY), 'open', '微信13900139001', '["https://picsum.photos/seed/kuaidi1/400/300"]', 'payer', NULL, NOW(), NOW()),

('高数期末突击辅导', 0, '学习辅导', '期末复习，求高数极限、导数、积分部分一对一讲解2小时，线下图书馆，可约。', 2, 'xiaohong', 5.0, '40元/小时', 40.00, DATE_ADD(NOW(), INTERVAL 5 DAY), 'open', '站内联系', NULL, 'earner', '考前一周', NOW(), NOW()),

('二手教材出售', 0, '物品交易', '大三专业课教材一套（数据库、数据结构、操作系统），八成新有笔记，打包25元。', 3, 'xiaowang', 3.5, '25元', 25.00, DATE_ADD(NOW(), INTERVAL 10 DAY), 'open', 'QQ联系', '["https://picsum.photos/seed/book1/400/300","https://picsum.photos/seed/book2/400/300"]', 'payer', NULL, NOW(), NOW()),

('提供毕业照拍摄服务', 0, '技术服务', '摄影爱好者，可帮拍毕业季单人/合照，送精修9张，校内取景，50元起。', 1, 'xiaoming', 4.8, '50元起', 50.00, NULL, 'open', '微信13900139001', '["https://picsum.photos/seed/photo1/400/300","https://picsum.photos/seed/photo2/400/300"]', 'earner', '毕业季全天', NOW(), NOW()),

('求购二手护眼台灯', 0, '物品交易', '想收一个能用的二手护眼台灯，亮度可调，预算30以内，宿舍自取。', 2, 'xiaohong', 5.0, '30元', 30.00, DATE_ADD(NOW(), INTERVAL 7 DAY), 'open', '电话联系', '["https://picsum.photos/seed/lamp1/400/300"]', 'payer', NULL, NOW(), NOW()),

('英语四六级口语陪练', 0, '学习辅导', '陪练自我介绍、日常对话、口语考试模拟，发音标准，30分钟一节，线上或线下。', 3, 'xiaowang', 3.5, '15元/30分钟', 15.00, NULL, 'open', '站内联系', NULL, 'earner', '每晚8-10点', NOW(), NOW());

-- 验证
SELECT id, title, publisher_side, category, IF(images IS NULL, '无图', CONCAT('带图(', JSON_LENGTH(images), '张)')) AS img FROM tasks WHERE id > 4 ORDER BY id;
