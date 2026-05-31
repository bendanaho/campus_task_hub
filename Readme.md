# Campus Task Hub 校园任务平台

基于 Spring Boot + JPA 的校园互助任务平台后端服务。

---

## 技术栈

| 技术 | 说明 |
|------|------|
| Java | 17 |
| Spring Boot | 4.0.6 |
| Spring Data JPA | ORM 框架 |
| Spring Security | 安全框架（预留 JWT 认证） |
| Hibernate | 7.2.12 |
| MySQL | 8.0 |
| JWT | jjwt 0.12.6 |
| Lombok | 简化代码 |
| Maven | 构建工具 |

---

## 数据库设计

数据库名：`campus_task_hub`（字符集：`utf8mb4`）

共 **10 张表**：

| 表名 | 说明 |
|------|------|
| `users` | 用户表 |
| `task_categories` | 任务分类表 |
| `tasks` | 任务表（同时存储需求任务和服务单） |
| `reviews` | 评价表 |
| `service_orders` | 服务订单表 |
| `conversations` | 会话表 |
| `messages` | 消息表 |
| `notifications` | 通知表 |
| `reports` | 举报表 |
| `favorites` | 收藏表 |

---

## 模块划分

| 模块 | 说明 | 进度 |
|------|------|------|
| M1 用户认证与授权 | 注册、登录、实名认证、余额查询 | 注册/登录可用 |
| M2 任务发布与接单 | 任务发布、接单、确认完成 | 部分可用 |
| M3 服务与交易 | 服务单、订单、资金流转 | 待实现 |
| M4 聊天消息 | 会话、消息收发、撤回 | 待实现 |
| M6 评价与信誉 | 评价提交、信誉管理 | 待实现 |

> API 测试文件：`Keshe_backend/api-test.http`（28 个接口）

---

## 快速开始

### 1. 初始化数据库

```bash
mysql -u root -p < schema.sql
```

### 2. 配置数据库连接

复制配置模板并填入你的数据库信息：

```bash
cd Keshe_backend/src/main/resources
cp application.properties.example application.properties
```

编辑 `application.properties`，修改以下两项：

```properties
spring.datasource.password=你的数据库密码
jwt.secret=你的JWT密钥（至少32个字符）
```

> `application.properties` 已加入 `.gitignore`，不会被提交到仓库。

### 3. 启动项目

```bash
cd Keshe_backend
mvn spring-boot:run
```

项目运行在 **8080** 端口。

### 4. 验证

```bash
curl -X POST http://localhost:8080/register \
  -H "Content-Type: application/json" \
  -d '{"username":"test","phone":"13800138000","email":"test@test.com","password":"Test@123456"}'
```

---

## 当前接口

| 接口 | 方法 | 状态 |
|------|------|------|
| `/register` | POST | ✅ |
| `/login` | POST | ✅ |
| `/logout` | POST | ✅（空壳） |
| `/login/wechat` | POST | ⚠️ 预留 |
| `/tasks` | GET | ✅ |
| `/tasks/{id}` | GET | ✅ |
| `/tasks` | POST | ✅ |
| `/services` | POST | ✅ |
| `/tasks/{id}/take` | POST | ✅ |

其余接口参见 `Keshe_backend/api-test.http`。

---

## 注意事项

- 用户密码使用 BCrypt 加密存储
- JWT 认证框架已搭建，Security 配置尚未启用
- 发布任务/接单目前硬编码了用户 ID，待对接真实认证
