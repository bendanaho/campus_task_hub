-- ============================================
-- Campus Task Hub 建表脚本
-- 数据库: campus_task_hub
-- 字符集: utf8mb4
-- ============================================
-- 设置客户端字符集
SET NAMES utf8mb4;
SET CHARACTER SET utf8mb4;
-- 建库时强制指定字符集
CREATE DATABASE IF NOT EXISTS campus_task_hub
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;
USE campus_task_hub;
CREATE DATABASE IF NOT EXISTS campus_task_hub
    DEFAULT CHARACTER SET utf8mb4
    DEFAULT COLLATE utf8mb4_general_ci;

USE campus_task_hub;

-- -------------------------------------------
-- 1. 用户表
-- -------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(50) NOT NULL UNIQUE COMMENT '用户名',
    phone VARCHAR(20) NOT NULL UNIQUE COMMENT '手机号',
    email VARCHAR(100) DEFAULT NULL UNIQUE COMMENT '邮箱',
    password_hash VARCHAR(255) NOT NULL COMMENT '加密后的密码',
    wechat_openid VARCHAR(100) DEFAULT NULL UNIQUE COMMENT '微信OpenID（NFR6预留）',
    wechat_unionid VARCHAR(100) DEFAULT NULL COMMENT '微信UnionID（NFR6预留）',
    avatar_url VARCHAR(500) DEFAULT NULL COMMENT '头像地址',
    real_name VARCHAR(50) DEFAULT NULL COMMENT '真实姓名',
    student_id VARCHAR(50) DEFAULT NULL COMMENT '学号',
    school VARCHAR(100) DEFAULT NULL COMMENT '学校',
    college VARCHAR(100) DEFAULT NULL COMMENT '学院',
    class_name VARCHAR(100) DEFAULT NULL COMMENT '班级',
    bio VARCHAR(500) DEFAULT NULL COMMENT '个人简介',
    balance DECIMAL(10,2) DEFAULT 0.00 COMMENT '账户余额',
    credit_score INT DEFAULT 100 COMMENT '信用分',
    auth_status TINYINT DEFAULT 0 COMMENT '实名认证状态 0=未认证 1=已认证',
    role ENUM('user','admin') DEFAULT 'user' COMMENT '角色',
    version INT DEFAULT 0 COMMENT '乐观锁版本号',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at DATETIME DEFAULT NULL COMMENT '软删除时间'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户表';

-- -------------------------------------------
-- 2. 任务分类表
-- -------------------------------------------
CREATE TABLE IF NOT EXISTS task_categories (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(50) NOT NULL UNIQUE COMMENT '分类名称',
    icon VARCHAR(255) DEFAULT NULL COMMENT '图标',
    sort_order INT DEFAULT 0 COMMENT '排序',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='任务分类表';

-- -------------------------------------------
-- 3. 任务表
-- -------------------------------------------
CREATE TABLE IF NOT EXISTS tasks (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    title VARCHAR(200) NOT NULL COMMENT '任务标题',
    description TEXT COMMENT '任务描述',
    category_id BIGINT NOT NULL COMMENT '分类ID',
    publisher_id BIGINT NOT NULL COMMENT '发布者ID',
    assignee_id BIGINT DEFAULT NULL COMMENT '接单者ID',
    reward DECIMAL(10,2) NOT NULL COMMENT '赏金',
    status ENUM('open','in_progress','completed','cancelled','expired') DEFAULT 'open' COMMENT '任务状态',
    deadline DATETIME DEFAULT NULL COMMENT '截止时间',
    location VARCHAR(255) DEFAULT NULL COMMENT '地点',
    images JSON DEFAULT NULL COMMENT '图片列表',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at DATETIME DEFAULT NULL,
    FOREIGN KEY (category_id) REFERENCES task_categories(id),
    FOREIGN KEY (publisher_id) REFERENCES users(id),
    FOREIGN KEY (assignee_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='任务表';

-- -------------------------------------------
-- 4. 任务申请表
-- -------------------------------------------
CREATE TABLE IF NOT EXISTS task_applications (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    task_id BIGINT NOT NULL COMMENT '任务ID',
    applicant_id BIGINT NOT NULL COMMENT '申请者ID',
    message VARCHAR(500) DEFAULT NULL COMMENT '申请留言',
    status ENUM('pending','accepted','rejected') DEFAULT 'pending' COMMENT '申请状态',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (task_id) REFERENCES tasks(id),
    FOREIGN KEY (applicant_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='任务申请表';

-- -------------------------------------------
-- 5. 评价表
-- -------------------------------------------
CREATE TABLE IF NOT EXISTS reviews (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    task_id BIGINT NOT NULL COMMENT '任务ID',
    reviewer_id BIGINT NOT NULL COMMENT '评价者ID',
    reviewee_id BIGINT NOT NULL COMMENT '被评价者ID',
    rating TINYINT NOT NULL COMMENT '评分1-5',
    content VARCHAR(500) DEFAULT NULL COMMENT '评价内容',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (task_id) REFERENCES tasks(id),
    FOREIGN KEY (reviewer_id) REFERENCES users(id),
    FOREIGN KEY (reviewee_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='评价表';

-- -------------------------------------------
-- 6. 消息通知表
-- -------------------------------------------
CREATE TABLE IF NOT EXISTS notifications (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT NOT NULL COMMENT '接收者ID',
    type ENUM('system','task','chat') DEFAULT 'system' COMMENT '消息类型',
    title VARCHAR(200) NOT NULL COMMENT '标题',
    content TEXT COMMENT '内容',
    is_read TINYINT DEFAULT 0 COMMENT '是否已读',
    related_id BIGINT DEFAULT NULL COMMENT '关联ID',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='消息通知表';

-- -------------------------------------------
-- 7. 聊天消息表
-- -------------------------------------------
CREATE TABLE IF NOT EXISTS chat_messages (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    sender_id BIGINT NOT NULL COMMENT '发送者ID',
    receiver_id BIGINT NOT NULL COMMENT '接收者ID',
    content TEXT NOT NULL COMMENT '消息内容',
    msg_type ENUM('text','image','file') DEFAULT 'text' COMMENT '消息类型',
    is_read TINYINT DEFAULT 0 COMMENT '是否已读',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (sender_id) REFERENCES users(id),
    FOREIGN KEY (receiver_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='聊天消息表';

-- -------------------------------------------
-- 8. 举报表
-- -------------------------------------------
CREATE TABLE IF NOT EXISTS reports (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    reporter_id BIGINT NOT NULL COMMENT '举报者ID',
    target_type ENUM('task','user','message') NOT NULL COMMENT '举报对象类型',
    target_id BIGINT NOT NULL COMMENT '举报对象ID',
    reason VARCHAR(500) NOT NULL COMMENT '举报原因',
    status ENUM('pending','resolved','dismissed') DEFAULT 'pending' COMMENT '处理状态',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (reporter_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='举报表';

-- -------------------------------------------
-- 9. 收藏表
-- -------------------------------------------
CREATE TABLE IF NOT EXISTS favorites (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT NOT NULL COMMENT '用户ID',
    task_id BIGINT NOT NULL COMMENT '任务ID',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_user_task (user_id, task_id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (task_id) REFERENCES tasks(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='收藏表';

-- -------------------------------------------
-- 初始数据：任务分类
-- -------------------------------------------
INSERT INTO task_categories (name, icon, sort_order) VALUES
    ('快递代取', 'package', 1),
    ('外卖代拿', 'food', 2),
    ('学习辅导', 'book', 3),
    ('跑腿代办', 'run', 4),
    ('二手交易', 'trade', 5),
    ('其他', 'other', 99)
ON DUPLICATE KEY UPDATE name = VALUES(name);