# Campus Task Hub - MySQL 快速启动指南

## 前置条件

- MySQL 8.0+ 已安装并运行
- Maven 3.8+
- JDK 17+

---

## 快速启动步骤

### 1. 创建数据库

```bash
# 方式一：使用 schema.sql 脚本（推荐）
mysql -u root -p < db/schema.sql

# 方式二：手动创建
mysql -u root -p
```
```sql
CREATE DATABASE campus_task_hub DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### 2. 配置数据库连接

复制模板配置文件：

```bash
cd Keshe_backend
cp src/main/resources/application-prod.yml.example src/main/resources/application-prod.yml
```

编辑 `application-prod.yml`，修改数据库密码：

```yaml
spring:
  datasource:
    url: jdbc:mysql://localhost:3306/campus_task_hub?useUnicode=true&serverTimezone=Asia/Shanghai&useSSL=false&allowPublicKeyRetrieval=true&characterEncoding=utf8
    driver-class-name: com.mysql.cj.jdbc.Driver
    username: root
    password: 你的MySQL密码  # 修改这里！
  jpa:
    hibernate:
      ddl-auto: validate  # 生产环境只校验，不自动建表
    properties:
      hibernate:
        dialect: org.hibernate.dialect.MySQLDialect
```

### 3. （可选）导入测试数据

```bash
mysql -u root -p campus_task_hub < db/test-data.sql
```

测试账号（密码均为 `123456`）：
- `xiaoming` / `123456` - 普通用户
- `xiaohong` / `123456` - 普通用户
- `xiaowang` / `123456` - 未认证用户
- `admin` / `123456` - 管理员

### 4. 启动后端服务

```bash
cd Keshe_backend
mvn spring-boot:run -Dspring-boot.run.profiles=prod
```

服务启动后访问：`http://localhost:8080`

---

## 完整测试用例

### 测试用例 1: 用户注册与登录

**目标**：验证用户注册、登录功能正常

| 步骤 | 操作 | 预期结果 |
|------|------|----------|
| 1 | POST `/api/auth/register` <br> `{"username":"testuser","phone":"13900139000","password":"123456"}` | 返回 200，包含 token |
| 2 | POST `/api/auth/login` <br> `{"username":"testuser","password":"123456"}` | 返回 200，包含新 token |
| 3 | GET `/api/users/profile` (携带 token) | 返回用户信息 |

**数据库验证**：
```sql
SELECT * FROM users WHERE username = 'testuser';
```

---

### 测试用例 2: 发布悬赏任务

**目标**：验证任务发布、展示功能

| 步骤 | 操作 | 预期结果 |
|------|------|----------|
| 1 | POST `/api/tasks` <br> `{"title":"代取快递","category":"代取快递","description":"送到宿舍","publisherSide":"payer","reward":"5元","rewardValue":5}` | 返回 200，任务创建成功 |
| 2 | GET `/api/tasks/hall` | 列表包含新发布的任务 |

**数据库验证**：
```sql
SELECT * FROM tasks WHERE title = '代取快递';
```

---

### 测试用例 3: 聊天与订单完整流程

**目标**：验证会话创建、消息发送、订单创建全流程

```
┌─────────────┐                    ┌─────────────┐
│   User A    │                    │   User B    │
│  (悬赏者)   │                    │  (接单者)   │
└──────┬──────┘                    └──────┬──────┘
       │                                  │
       │  1. 创建会话                     │
       │─────────────────────────────────>│
       │                                  │
       │  2. 发送消息                     │
       │─────────────────────────────────>│
       │                                  │
       │  3. 回复消息                     │
       │<─────────────────────────────────│
       │                                  │
       │  4. 创建订单                     │
       │─────────────────────────────────>│
       │                                  │
       │  5. 确认订单                     │
       │<─────────────────────────────────│
       │                                  │
       │  6. 完成订单                     │
       │─────────────────────────────────>│
       │                                  │
       │  7. 互相评价                     │
       │<────────────────────────────────>│
```

**具体操作**：

| 步骤 | 操作 |
|------|------|
| 1 | User A: POST `/api/chats/ensure` → 创建会话 |
| 2 | User A: POST `/api/chats/{chatId}/messages` → 发送消息 |
| 3 | User B: POST `/api/chats/{chatId}/messages` → 回复消息 |
| 4 | User A: POST `/api/orders` → 创建订单 |
| 5 | User B: POST `/api/orders/{id}/accept` → 接受订单 |
| 6 | User A: POST `/api/orders/{id}/confirm-payer` → 确认完成 |
| 7 | User B: POST `/api/orders/{id}/confirm-earner` → 确认完成 |
| 8 | Both: POST `/api/reviews` → 互相评价 |

**数据库验证**：
```sql
-- 验证订单状态
SELECT * FROM orders WHERE id = ?;

-- 验证交易流水
SELECT * FROM transactions WHERE related_id = '?';

-- 验证评价
SELECT * FROM reviews WHERE order_id = ?;
```

---

### 测试用例 4: 充值与余额

**目标**：验证充值功能和余额变化

| 步骤 | 操作 | 预期结果 |
|------|------|----------|
| 1 | GET `/api/users/balance` | 查看当前余额 |
| 2 | POST `/api/users/recharge` <br> `{"amount":100}` | 充值 100 元 |
| 3 | GET `/api/users/balance` | 余额增加 100 |

**数据库验证**：
```sql
SELECT balance FROM users WHERE id = ?;
SELECT * FROM transactions WHERE user_id = ? AND category = 'recharge';
```

---

### 测试用例 5: 举报与管理员处理

**目标**：验证举报流程和管理员功能

| 步骤 | 操作 | 预期结果 |
|------|------|----------|
| 1 | 普通用户: POST `/api/reports` → 举报帖子 | 返回 200 |
| 2 | 管理员: GET `/api/admin/reports` | 看到待处理举报 |
| 3 | 管理员: POST `/api/admin/posts/{id}/remove` → 下架帖子 | 帖子状态变为 closed |

**数据库验证**：
```sql
SELECT * FROM reports WHERE status = 'pending';
SELECT * FROM tasks WHERE id = ? AND status = 'closed';
```

---

### 测试用例 6: 图片上传（LONGTEXT 验证）

**目标**：验证 LONGTEXT 类型可存储大图片

```bash
# 注意：实际项目中建议使用对象存储，此处仅测试数据库字段
# 单张 base64 图片可能超过 64KB，TEXT 不够用，必须用 LONGTEXT
```

**数据库验证**：
```sql
SELECT 
    table_name, 
    column_name, 
    column_type 
FROM information_schema.columns 
WHERE table_schema = 'campus_task_hub' 
  AND column_name = 'images';
-- 预期结果：column_type 为 'longtext'
```

---

## 常见问题

### Q: 启动报错 `Public Key Retrieval is not allowed`

**A**: 检查 JDBC URL 确保包含 `allowPublicKeyRetrieval=true`

```yaml
url: jdbc:mysql://localhost:3306/campus_task_hub?useUnicode=true&serverTimezone=Asia/Shanghai&useSSL=false&allowPublicKeyRetrieval=true&characterEncoding=utf8
```

### Q: 启动报错 `Schema-validation: missing table`

**A**: `ddl-auto: validate` 模式下，表必须存在。执行：
```bash
mysql -u root -p < db/schema.sql
```

### Q: 如何切换回 H2 内存数据库开发？

**A**: 使用默认 profile（不指定 prod）：
```bash
mvn spring-boot:run
```

---

## 快速验证查询

启动成功后，在 MySQL 中执行以下查询确认数据正常：

```sql
-- 查看各表数据量
SELECT 
    'users' AS table_name, COUNT(*) AS count FROM users
UNION ALL SELECT 'tasks', COUNT(*) FROM tasks
UNION ALL SELECT 'orders', COUNT(*) FROM orders
UNION ALL SELECT 'reviews', COUNT(*) FROM reviews
UNION ALL SELECT 'conversations', COUNT(*) FROM conversations
UNION ALL SELECT 'chat_messages', COUNT(*) FROM chat_messages
UNION ALL SELECT 'transactions', COUNT(*) FROM transactions
UNION ALL SELECT 'reports', COUNT(*) FROM reports;
```

---

## 清理测试数据

```sql
-- 仅保留表结构，清空数据
USE campus_task_hub;
SET FOREIGN_KEY_CHECKS = 0;
TRUNCATE TABLE reports;
TRUNCATE TABLE chat_messages;
TRUNCATE TABLE conversations;
TRUNCATE TABLE transactions;
TRUNCATE TABLE reviews;
TRUNCATE TABLE orders;
TRUNCATE TABLE tasks;
TRUNCATE TABLE users;
SET FOREIGN_KEY_CHECKS = 1;
```

或删除整个数据库重新创建：
```sql
DROP DATABASE IF EXISTS campus_task_hub;
SOURCE db/schema.sql;
```
