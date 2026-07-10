-- ============================================
-- Campus Task Hub 建表脚本（生产基准 DDL）
-- 数据库: campus_task_hub  字符集: utf8mb4
--
-- 与后端 JPA 实体严格对齐（详见仓库根 DATABASE.md）：
--   - dev  用 H2 内存库 + ddl-auto=update 自动建表（不读本脚本）
--   - prod 用 MySQL    + ddl-auto=validate 只校验不建表
-- 故本脚本的列名/类型必须与 Entity 一致，否则 prod 启动 validate 失败。
--
-- 说明：
--  1) 实体使用裸 Long 外键（无 @ManyToOne），Hibernate 不生成外键约束；
--     且「系统通知」会话使用 user2_id=0 / sender_id=0 作为哨兵（无对应用户行），
--     因此本脚本【不声明 FOREIGN KEY】，与后端实际行为一致。
--  2) conversations.id 为字符串（如 c1、sys-notify-8），非自增。
--  3) 图片列 images 用 LONGTEXT：存 base64 图片 JSON，单张原图远超 TEXT 的 64KB 上限。
--  4) credit_score / publisher_credit 用 DECIMAL(3,1)：信用分 0.0–5.0，1 位小数。
-- ============================================
SET NAMES utf8mb4;

CREATE DATABASE IF NOT EXISTS campus_task_hub
    DEFAULT CHARACTER SET utf8mb4
    DEFAULT COLLATE utf8mb4_unicode_ci;
USE campus_task_hub;

-- -------------------------------------------
-- 1. 用户表  (entity: User)
-- -------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(50) NOT NULL UNIQUE COMMENT '用户名',
    phone VARCHAR(20) NOT NULL UNIQUE COMMENT '手机号',
    email VARCHAR(100) DEFAULT NULL UNIQUE COMMENT '邮箱（可空；空邮箱存 NULL 以避免唯一约束冲突）',
    password_hash VARCHAR(255) NOT NULL COMMENT '加密后的密码',
    wechat_openid VARCHAR(100) DEFAULT NULL UNIQUE COMMENT '微信OpenID（预留）',
    wechat_unionid VARCHAR(100) DEFAULT NULL COMMENT '微信UnionID（预留）',
    avatar VARCHAR(255) DEFAULT NULL COMMENT '头像地址',
    credit_score DECIMAL(3,1) NOT NULL DEFAULT 5.0 COMMENT '信用分 0.0-5.0',
    auth_status INT NOT NULL DEFAULT 0 COMMENT '实名认证 0=未认证 1=已认证',
    real_name VARCHAR(50) DEFAULT NULL COMMENT '真实姓名',
    student_id VARCHAR(50) DEFAULT NULL COMMENT '学号',
    college VARCHAR(255) DEFAULT NULL COMMENT '学院',
    class_name VARCHAR(255) DEFAULT NULL COMMENT '班级',
    bio VARCHAR(255) DEFAULT NULL COMMENT '个人简介',
    balance DECIMAL(10,2) NOT NULL DEFAULT 0.00 COMMENT '账户余额',
    role INT NOT NULL DEFAULT 0 COMMENT '角色 0=普通用户 1=管理员',
    version INT DEFAULT NULL COMMENT '乐观锁版本号',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT NULL,
    deleted_at DATETIME DEFAULT NULL COMMENT '软删除时间'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户表';

-- -------------------------------------------
-- 2. 帖子/任务表  (entity: Task)
--    publisher_side: payer 悬赏求助 / earner 提供服务 / none 组队互助
--    status: open 上架 / closed 下架关闭；deleted_at 非空=已删除
--    images 用 LONGTEXT：存 base64 图片 JSON，单张原图远超 TEXT 的 64KB 上限
-- -------------------------------------------
CREATE TABLE IF NOT EXISTS tasks (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    title VARCHAR(200) NOT NULL COMMENT '标题',
    type INT NOT NULL DEFAULT 0 COMMENT '旧字段兼容',
    category VARCHAR(50) NOT NULL COMMENT '分类',
    description TEXT NOT NULL COMMENT '描述',
    publisher_id BIGINT NOT NULL COMMENT '发布者ID',
    publisher_name VARCHAR(50) NOT NULL COMMENT '发布者用户名（冗余）',
    publisher_credit DECIMAL(3,1) NOT NULL DEFAULT 0.0 COMMENT '发布时信用分快照',
    reward VARCHAR(50) NOT NULL COMMENT '报酬描述（如：10元、面议）',
    reward_value DECIMAL(10,2) NOT NULL DEFAULT 0.00 COMMENT '报酬数值（冻结/结算用）',
    deadline DATETIME DEFAULT NULL COMMENT '截止时间（悬赏帖）',
    publish_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '发布时间',
    status VARCHAR(10) NOT NULL COMMENT '状态 open/closed',
    contact VARCHAR(255) DEFAULT '站内联系' COMMENT '联系方式',
    images LONGTEXT DEFAULT NULL COMMENT '图片列表(JSON字符串，base64，须用LONGTEXT)',
    publisher_side VARCHAR(10) NOT NULL DEFAULT 'payer' COMMENT 'payer/earner/none',
    service_time VARCHAR(100) DEFAULT NULL COMMENT '服务时间（服务帖）',
    taker_id BIGINT DEFAULT NULL COMMENT '旧字段兼容',
    taker_name VARCHAR(255) DEFAULT NULL COMMENT '旧字段兼容',
    payment_status INT DEFAULT NULL COMMENT '旧字段兼容',
    publisher_confirmed INT DEFAULT NULL COMMENT '旧字段兼容',
    taker_confirmed INT DEFAULT NULL COMMENT '旧字段兼容',
    version INT DEFAULT NULL COMMENT '乐观锁版本号',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT NULL,
    deleted_at DATETIME DEFAULT NULL COMMENT '软删除时间（管理员删除）',
    KEY idx_tasks_publisher (publisher_id),
    KEY idx_tasks_hall (status, deleted_at, publish_time) COMMENT '大厅列表主查询',
    KEY idx_tasks_side (publisher_side),
    KEY idx_tasks_category (category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='帖子/任务表';

-- -------------------------------------------
-- 3. 订单表  (entity: Order)
--    status: pending 待接受 / in_progress 进行中 / completed 已完成 /
--            cancelled 已取消 / disputed 争议中 / closed 已结案
-- -------------------------------------------
CREATE TABLE IF NOT EXISTS orders (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    chat_id VARCHAR(100) NOT NULL COMMENT '所属会话ID',
    post_id BIGINT NOT NULL COMMENT '帖子ID',
    payer_id BIGINT NOT NULL COMMENT '付款方ID',
    earner_id BIGINT NOT NULL COMMENT '收款方ID',
    amount DECIMAL(10,2) NOT NULL DEFAULT 0.00 COMMENT '金额',
    status VARCHAR(20) NOT NULL DEFAULT 'pending' COMMENT '订单状态',
    payer_confirmed TINYINT(1) NOT NULL DEFAULT 0 COMMENT '付款方已确认',
    earner_confirmed TINYINT(1) NOT NULL DEFAULT 0 COMMENT '收款方已确认',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    accepted_at DATETIME DEFAULT NULL COMMENT '接受时间',
    completed_at DATETIME DEFAULT NULL COMMENT '完成时间',
    auto_confirm_at DATETIME DEFAULT NULL COMMENT '自动确认时间',
    review_deadline DATETIME DEFAULT NULL COMMENT '评价截止时间',
    dispute_reason TEXT DEFAULT NULL COMMENT '申诉理由',
    disputed_by BIGINT DEFAULT NULL COMMENT '申诉发起人ID',
    disputed_at DATETIME DEFAULT NULL COMMENT '申诉时间',
    resolution VARCHAR(20) DEFAULT NULL COMMENT '裁决 refund/settle/partial',
    resolution_amount_to_earner DECIMAL(10,2) DEFAULT NULL COMMENT '结算给收款方金额',
    resolution_note TEXT DEFAULT NULL COMMENT '管理员处理说明',
    resolved_at DATETIME DEFAULT NULL COMMENT '结案时间',
    version INT DEFAULT NULL COMMENT '乐观锁版本号',
    updated_at DATETIME DEFAULT NULL,
    KEY idx_orders_chat (chat_id),
    KEY idx_orders_post (post_id),
    KEY idx_orders_payer_status (payer_id, status) COMMENT '我的订单（付款方+状态）',
    KEY idx_orders_earner_status (earner_id, status) COMMENT '我的订单（收款方+状态）',
    KEY idx_orders_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='订单表';

-- -------------------------------------------
-- 4. 评价表  (entity: Review)
--    images 用 LONGTEXT（同 tasks.images）
-- -------------------------------------------
CREATE TABLE IF NOT EXISTS reviews (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    order_id BIGINT DEFAULT NULL COMMENT '订单ID',
    task_id BIGINT DEFAULT NULL COMMENT '帖子ID',
    from_user_id BIGINT NOT NULL COMMENT '评价者ID',
    from_user_name VARCHAR(50) NOT NULL COMMENT '评价者用户名',
    to_user_id BIGINT NOT NULL COMMENT '被评价者ID',
    to_user_name VARCHAR(50) NOT NULL COMMENT '被评价者用户名',
    rating INT NOT NULL COMMENT '评分 1-5',
    content VARCHAR(500) DEFAULT NULL COMMENT '评价内容',
    images LONGTEXT DEFAULT NULL COMMENT '图片(JSON字符串，base64，须用LONGTEXT)',
    auto_review TINYINT(1) NOT NULL DEFAULT 0 COMMENT '是否系统默认好评',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    KEY idx_reviews_to_user (to_user_id) COMMENT '信用分按被评价者聚合',
    KEY idx_reviews_order (order_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='评价表';

-- -------------------------------------------
-- 5. 交易流水表  (entity: Transaction)
-- -------------------------------------------
CREATE TABLE IF NOT EXISTS transactions (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT NOT NULL COMMENT '用户ID',
    direction VARCHAR(10) NOT NULL COMMENT '方向 in 收入 / out 支出',
    amount DECIMAL(10,2) NOT NULL COMMENT '金额',
    category VARCHAR(20) NOT NULL COMMENT '类别 recharge/order 等',
    related_id VARCHAR(100) DEFAULT NULL COMMENT '关联ID（如订单ID）',
    note VARCHAR(500) DEFAULT '' COMMENT '备注',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    KEY idx_tx_user_time (user_id, created_at) COMMENT '用户账单按时间倒序'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='交易流水表';

-- -------------------------------------------
-- 6. 会话表  (entity: Conversation)
--    id 为字符串：普通会话 c1；系统通知 sys-notify-<userId>
--    系统通知会话 user2_id=0（哨兵，无对应用户）
-- -------------------------------------------
CREATE TABLE IF NOT EXISTS conversations (
    id VARCHAR(100) PRIMARY KEY COMMENT '会话ID（字符串）',
    user1_id BIGINT NOT NULL COMMENT '用户1 ID',
    user2_id BIGINT NOT NULL COMMENT '用户2 ID（系统通知为 0）',
    task_id BIGINT DEFAULT NULL COMMENT '关联帖子ID',
    task_title VARCHAR(200) DEFAULT NULL COMMENT '帖子标题（冗余）',
    last_message TEXT DEFAULT NULL COMMENT '最后一条消息内容',
    last_time DATETIME DEFAULT NULL COMMENT '最后消息时间',
    last_message_sender_id BIGINT DEFAULT NULL COMMENT '最后消息发送者ID',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT NULL,
    KEY idx_conv_user1 (user1_id),
    KEY idx_conv_user2 (user2_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='会话表';

-- -------------------------------------------
-- 7. 聊天/系统消息表  (entity: Message，表名 chat_messages)
--    type: text 普通 / system 系统消息（含系统通知，居中显示）/ payment 付款卡片
--    sender_id 可空：订单系统消息为 NULL；系统通知为 0（哨兵）
-- -------------------------------------------
CREATE TABLE IF NOT EXISTS chat_messages (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    chat_id VARCHAR(100) NOT NULL COMMENT '所属会话ID',
    sender_id BIGINT DEFAULT NULL COMMENT '发送者ID（系统消息NULL / 系统通知0）',
    sender_name VARCHAR(50) DEFAULT NULL COMMENT '发送者名（冗余）',
    receiver_id BIGINT DEFAULT NULL COMMENT '接收者ID',
    content TEXT NOT NULL COMMENT '消息内容',
    type VARCHAR(20) NOT NULL DEFAULT 'text' COMMENT '类型 text/system/payment',
    time DATETIME NOT NULL COMMENT '发送时间',
    task_id VARCHAR(50) DEFAULT NULL COMMENT '关联帖子ID（字符串，历史遗留）',
    task_title VARCHAR(200) DEFAULT NULL COMMENT '帖子标题',
    withdrawn TINYINT(1) NOT NULL DEFAULT 0 COMMENT '是否已撤回',
    is_read TINYINT(1) NOT NULL DEFAULT 0 COMMENT '是否已读',
    payment TEXT DEFAULT NULL COMMENT '付款卡片信息(JSON，type=payment 时)',
    KEY idx_msg_chat_time (chat_id, time) COMMENT '会话内消息分页',
    KEY idx_msg_receiver (receiver_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='聊天/系统消息表';

-- -------------------------------------------
-- 8. 举报表  (entity: Report)
-- -------------------------------------------
CREATE TABLE IF NOT EXISTS reports (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    post_id BIGINT NOT NULL COMMENT '被举报帖子ID',
    reporter_id BIGINT NOT NULL COMMENT '举报者ID',
    reporter_name VARCHAR(50) DEFAULT NULL COMMENT '举报者用户名（快照）',
    reason TEXT NOT NULL COMMENT '举报理由',
    status VARCHAR(20) NOT NULL DEFAULT 'pending' COMMENT 'pending 待处理 / handled 已处理',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_reports_post_status (post_id, status) COMMENT '管理员按帖子查 pending 举报'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='举报表';
