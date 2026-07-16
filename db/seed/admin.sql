-- ============================================
-- 生产环境管理员账号种子数据
-- 账号: admin  密码: 1（BCrypt 哈希）
--
-- ⚠️ password_hash 必须是明文 "1" 的 BCrypt 哈希，不能手写。
-- 获取方法（任选其一）：
--   方式A（推荐）：dev 启动后端（H2 内存库）后，访问 http://localhost:8080/h2-console
--     JDBC URL: jdbc:h2:mem:campus_task_hub  User: sa  Password: (空 或 application-local.yml 中的值)
--     执行 SELECT username, password_hash FROM users WHERE username='admin';
--     复制 password_hash 替换下方的 <填入BCrypt哈希>
--   方式B：写一次性 Java 代码调用 Spring Security 的 BCryptPasswordEncoder.encode("1") 生成
--
-- 执行：mysql -uroot -p campus_task_hub < db/seed/admin.sql
-- ============================================
USE campus_task_hub;

INSERT INTO users (
    username, phone, email, password_hash,
    avatar, credit_score, auth_status,
    real_name, student_id, college, class_name, bio,
    balance, role
) VALUES (
    'admin',
    '13800000000',
    'admin@example.com',
    '<填入BCrypt哈希>',
    NULL,
    5.0,
    1,
    '平台管理员',
    'ADMIN',
    '平台运营',
    '管理组',
    '平台管理员，负责争议订单仲裁与内容管理。',
    0.00,
    1
);
