# 校园互助平台 - Spring Boot 后端代码说明

> 基于前端 JS 伪后端（`api.js` / `mock-data.js`）逻辑完整复刻的 Spring Boot 后端，并在此基础上扩展了举报、管理员仲裁、信用分、WebSocket 通知等能力。

---

## 一、项目概览

| 项目 | 说明 |
|------|------|
| **项目名** | Keshe_backend（校园互助平台后端） |
| **框架** | Spring Boot 4.0.6 + Java 17 |
| **构建工具** | Maven（仓库自带 `mvnw`，无需全局安装） |
| **开发数据库** | H2 内存数据库（`dev` profile）/ MySQL 8（`prod` profile） |
| **API 端点** | 40+ 个 REST 接口，8 个 Controller |
| **实体** | 8 个（User / Task / Order / Review / Transaction / Conversation / Message / Report） |
| **前端对接** | campus_task_hub/front-end，`USE_MOCK = false` 即可连接 |

### 技术栈

| 技术 | 作用 |
|------|------|
| Spring WebMVC | REST 控制器 |
| Spring Data JPA (Hibernate 7.2) | ORM / 数据库操作 |
| Spring Security + JWT (jjwt 0.12.6) | 认证鉴权 |
| Spring WebSocket | 实时通知推送 |
| H2 Database | 开发环境内存数据库 |
| MySQL Connector | 生产环境数据库驱动 |
| Lombok | 简化 Java 代码 |
| BCrypt | 密码加密 |

---

## 二、运行策略（双 Profile）

| Profile | 数据库 | ddl-auto | 种子数据 | 用途 |
|---------|--------|----------|----------|------|
| 默认 / `dev` | H2 内存 | `update` | 有（DataInitializer） | 独立开发，零依赖 |
| `prod` | MySQL | `validate` | 无 | 测试/生产服务器 |

### 启动方式

```bash
# dev（H2，自带种子数据，密码均为 1）
./mvnw spring-boot:run

# prod（MySQL，需先建库，详见 db/QUICKSTART.md）
./mvnw spring-boot:run -Dspring-boot.run.profiles=prod
```

> Windows 下一键启动：双击 `backend/start-backend.bat`（prod）或 `backend/reset-db.bat`（重置库+导入演示数据）。

---

## 三、项目结构

```
src/main/java/com/example/keshe_backend/
├── KesheBackendApplication.java          # 启动入口（含 @EnableScheduling）
├── auth/                                 # 认证模块
│   ├── controller/AuthController.java    # 注册/登录/登出/微信登录
│   └── service/AuthService.java
├── user/                                 # 用户模块
│   ├── controller/UserController.java    # 资料/余额/充值/认证/账单
│   ├── entity/User.java
│   └── service/UserService.java
├── post/                                 # 帖子模块（/api/posts，主用）
│   ├── controller/PostController.java    # 列表/详情/发布/我的/撤回/举报
│   └── service/PostService.java
├── task/                                 # 旧 Task 接口（遗留，/api/tasks）
│   ├── entity/Task.java                  # 帖子实体（post 模块复用）
│   └── controller/TaskController.java
├── order/                                # 订单模块（核心状态机 + 争议仲裁）
│   ├── controller/OrderController.java   # 创建/接受/取消/申诉/确认/查询
│   ├── entity/Order.java
│   └── service/OrderService.java
├── chat/                                 # 聊天与消息模块
│   ├── controller/ChatController.java    # 消息/付款卡片/撤回/未读
│   ├── entity/{Conversation, Message}.java
│   └── service/ChatService.java
├── review/                               # 评价模块（含信用分贝叶斯计算）
│   ├── controller/ReviewController.java
│   ├── entity/Review.java
│   └── service/ReviewService.java        # recalcCreditScore
├── transaction/                          # 交易流水
│   └── entity/Transaction.java
├── report/                               # 举报模块
│   ├── entity/Report.java
│   └── service/ReportService.java
├── admin/                                # 管理员模块（争议仲裁/帖子管理/举报）
│   └── controller/AdminController.java
└── common/                               # 公共基础设施
    ├── api/{ApiResponse, ErrorCode}.java       # 统一响应 / 错误码
    ├── exception/{BusinessException, GlobalExceptionHandler}.java
    ├── security/{JwtAuthenticationFilter, JwtUtil, SecurityConfig, SecurityUtils}.java
    ├── sweep/SweepService.java                 # 定时清扫：自动确认 + 默认好评
    ├── websocket/{NotificationWSServer, WebSocketConfig}.java  # 实时通知
    ├── data/DataInitializer.java               # 种子数据（仅 !prod）
    ├── logging/{RequestLoggingInterceptor, WebMvcConfig}.java
    └── util/ImageUtil.java                     # 图片缩略图生成
```

---

## 四、完整 API 端点清单

### 鉴权与权限约定

- 认证方式：JWT Bearer Token，请求头 `Authorization: Bearer <token>`。
- `JwtAuthenticationFilter` 解析 Token -> 按 `user.role` 授权：`role=0` 普通 `ROLE_USER`，`role=1` 额外 `ROLE_ADMIN`。
- 公开端点：`POST /api/login`、`POST /api/register`、`GET /api/posts/**`、`GET /api/reviews`、`/ws/**`。
- 管理员端点：`/api/admin/**` 全部需 `ROLE_ADMIN`。
- 🔒 标记 = 需实名认证（`authStatus=1`）。

### 统一响应 `ApiResponse<T>`

```json
{ "success": true, "data": <T>, "errorCode": 0, "message": "success" }
```

### 错误码表（ErrorCode）

| code | 含义 | code | 含义 |
|---|---|---|---|
| 1001 | 请求参数非法 | 3005 | 不能对自己帖子下单 |
| 1002 | 未登录/Token 过期 | 3006 | 悬赏已过截止时间 |
| 1003 | 无权访问 | 3007 | 订单状态不可操作 |
| 1004 | 资源不存在 | 3008 | 该帖已有进行中订单 |
| 1005 | 业务状态冲突 | 4001 | 超 2 分钟无法撤回 |
| 2001 | 账号或密码错误 | 4002 | 收款已处理 |
| 2002 | 用户名已注册 | 5001 | 充值金额无效 |
| 2003 | 手机号已注册 | 2005 | 请先登录 |
| 2004 | 邮箱已注册 | 2006 | 请先完成实名认证 |
| 3001 | 余额不足 | 500 | 服务器内部错误 |
| 3002 | 任务已被他人接单 | | |

### 4.1 认证（AuthController）- `/api`

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|:---:|
| POST | `/login` | 登录（用户名/手机号/邮箱 + 密码）-> JWT + 用户信息 | ✗ |
| POST | `/register` | 注册（用户名/手机号唯一，邮箱选填） | ✗ |
| POST | `/logout` | 登出（客户端丢 Token 即可） | ✓ |
| POST | `/login/wechat` | 微信登录（预留，返回 1004） | ✗ |

### 4.2 用户（UserController）- `/api`

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|:---:|
| GET | `/users/{id}` | 用户公开资料 | ✓ |
| PUT | `/user/phone` | 修改手机号 | ✓ |
| PUT | `/user/email` | 修改邮箱 | ✓ |
| POST | `/auth` | 提交实名认证（直接置 authStatus=1） | ✓ |
| GET | `/user/balance` | 查询余额 | ✓ |
| POST | `/user/recharge` | 充值（0.01~100000） | ✓ |
| GET | `/user/bills` | 账单流水（含 totalIn/totalOut） | ✓ |

### 4.3 帖子（PostController）- `/api/posts`

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|:---:|
| GET | `/api/posts?side=&categories=&keyword=&sort=&page=&size=` | 大厅（筛选/搜索/排序/分页） | ✗ |
| GET | `/api/posts/{id}` | 帖子详情 + 发布者信息 | ✗ |
| POST | `/api/posts` | 发布帖子（需认证、非管理员） | ✓🔒 |
| GET | `/api/posts/mine` | 我的发布 | ✓ |
| POST | `/api/posts/{id}/close` | 发布者撤回（软下架，取消 pending 订单） | ✓ |
| POST | `/api/posts/{id}/report` | 举报帖子（非管理员、非本人） | ✓ |

**帖子类型（publisherSide）：** `payer`（悬赏-我付钱）/ `earner`（服务-我收钱）/ `none`（纯互助-金额 0）

**排序（sort）：** `time_desc`(默认) / `time_asc` / `reward_asc` / `reward_desc` / `credit_asc` / `credit_desc`

### 4.4 订单（OrderController）- `/api/orders`【核心】

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|:---:|
| POST | `/api/orders` | 创建订单（响应帖子） | ✓🔒 |
| POST | `/api/orders/{id}/accept` | 接受订单（发布者，冻结付款方余额） | ✓🔒 |
| POST | `/api/orders/{id}/cancel` | 取消（仅 pending） | ✓🔒 |
| POST | `/api/orders/{id}/dispute` | 发起申诉（in_progress -> disputed） | ✓🔒 |
| POST | `/api/orders/{id}/confirm` | 确认完成（双方确认 + 自动确认） | ✓🔒 |
| GET | `/api/orders/by-chat?chatId=` | 按会话查活跃订单 | ✓ |
| GET | `/api/orders?chatId=` | 按会话查订单历史 | ✓ |
| GET | `/api/orders/mine?role=&keyword=&status=` | 我的订单（payer/earner 筛选） | ✓ |

### 4.5 聊天（ChatController）

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|:---:|
| GET | `/api/conversations` | 会话列表（含系统通知会话） | ✓ |
| POST | `/api/conversations/ensure` | 确保会话存在（自动创建） | ✓ |
| GET | `/api/conversations/{id}/messages` | 消息列表（管理员可只读取证） | ✓ |
| POST | `/api/conversations/{id}/messages` | 发送文本消息 | ✓ |
| POST | `/api/conversations/{id}/payment` | 发送付款卡片（收款/转账） | ✓🔒 |
| POST | `/api/conversations/{id}/read` | 标记已读 | ✓ |
| GET | `/api/messages/unread` | 未读统计 | ✓ |
| POST | `/api/messages/{id}/pay` | 支付收款卡片 | ✓🔒 |
| POST | `/api/messages/{id}/cancel-payment` | 取消收款卡片 | ✓🔒 |
| POST | `/api/messages/{id}/withdraw` | 撤回消息（2 分钟内） | ✓ |

### 4.6 评价（ReviewController）- `/api/reviews`

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|:---:|
| POST | `/api/reviews` | 提交评价（完成后重算信用分） | ✓ |
| GET | `/api/reviews?userId=` | 查看用户收到的评价 | ✗ |
| GET | `/api/reviews/has-reviewed?orderId=` | 检查是否已评价 | ✓ |

### 4.7 举报（PostController 入口 + AdminController 管理端）

举报无独立 Controller：用户举报入口在 `PostController`（`POST /api/posts/{id}/report`），管理员查看在 `AdminController`（`GET /api/admin/reports`）。

**业务规则：**
- 管理员不能举报；不能举报自己的帖。
- 同一用户对同一帖同时只保留一条 pending 举报（去重）。
- 帖子下架/删除后，该帖 pending 举报自动置 handled。

### 4.8 管理员（AdminController）- `/api/admin`【全部需 ROLE_ADMIN】

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/admin/disputes` | 待处理争议订单列表（按 disputedAt 倒序） |
| GET | `/api/admin/orders` | 全部订单列表 |
| POST | `/api/admin/orders/{id}/resolve` | 争议裁决（refund/settle/partial） |
| GET | `/api/admin/posts` | 全部帖子（含已下架/已删除） |
| POST | `/api/admin/posts/{id}/close` | 下架帖子（status=closed） |
| POST | `/api/admin/posts/{id}/delete` | 删除帖子（软删 deletedAt） |
| GET | `/api/admin/reports` | 举报列表（按帖子聚合，按次数倒序） |

**裁决请求体 `ResolveDisputeRequest`：** `{decision*("refund"/"settle"/"partial"), amountToEarner(partial 必填), note*}`

### 4.9 任务（TaskController）- `/api/tasks`【遗留接口】

旧版接口，与新 `/api/posts` 并存，不要求实名认证，部分功能已被 Post 模块取代：

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/tasks` | 任务列表 |
| GET | `/tasks/{id}` | 任务详情 |
| POST | `/tasks` | 创建任务 |
| POST | `/services` | 创建服务 |
| POST | `/tasks/{id}/take` | 接取任务（旧逻辑） |

> 新业务请走 `/api/posts`，本节仅作兼容说明。

---

## 五、数据模型（8 个实体）

| 实体 | 表 | 说明 |
|------|----|------|
| `User` | `users` | 用户/管理员、余额、信用分、实名状态 |
| `Task` | `tasks` | 帖子（publisherSide/serviceTime/status） |
| `Order` | `orders` | 订单（核心状态机 + 争议仲裁字段） |
| `Review` | `reviews` | 评价（驱动信用分计算） |
| `Transaction` | `transactions` | 交易流水 |
| `Conversation` | `conversations` | 会话（id 客户端生成） |
| `Message` | `chat_messages` | 消息（text/system/payment） |
| `Report` | `reports` | 帖子举报 |

### 核心字段速查

- **User**：`id, username, phone, email, passwordHash, avatar, creditScore(默认5.0), authStatus(0/1), realName, studentId, college, className, bio, balance, role(0/1), version, deletedAt`
- **Task**：`id, title, category, description, publisherId, publisherName, publisherCredit, reward, rewardValue, deadline, publishTime, status(open/closed), contact, images(JSON), publisherSide(payer/earner/none), serviceTime, version, deletedAt`
- **Order**：`id, chatId, postId, payerId, earnerId, amount, status(pending/in_progress/completed/cancelled/disputed/closed), payerConfirmed, earnerConfirmed, createdAt, acceptedAt, completedAt, autoConfirmAt, reviewDeadline, disputeReason, disputedBy, disputedAt, resolution(refund/settle/partial), resolutionAmountToEarner, resolutionNote, resolvedAt, version`
- **Review**：`id, orderId, taskId, fromUserId, fromUserName, toUserId, toUserName, rating(1-5), content, images(JSON), autoReview, createdAt`
- **Message**：`id, chatId, senderId(系统消息null/系统通知0), senderName, receiverId, content, type(text/system/payment), time, taskId, taskTitle, withdrawn, read, payment(JSON)`
- **Report**：`id, postId, reporterId, reporterName, reason, status(pending/handled), createdAt`

> 完整字段/类型/约束详见 `DATABASE.md`。

---

## 六、核心业务逻辑

### 6.1 订单状态机

```
          ┌─accept(发布者)─► in_progress ──双方confirm──► completed ──(评价期)──► (默认好评)
          │                    │   │
pending ──┤                    │   └─dispute(任一方)─► disputed ──admin resolve──► closed
          │                    │
          └─cancel(任一方)─► cancelled
          │
          └─发布者撤回帖子─► cancelled
```

状态值：`pending` / `in_progress` / `completed` / `cancelled` / `disputed` / `closed`

**关键规则：**
1. **创建订单**：不能接自己帖（3005）；悬赏帖过截止时间不可接（3006）；悬赏帖同时只能一个活跃订单（3008）；服务帖/互助帖允许多订单。
2. **接受订单**（仅发布者）：金额>0 冻结付款方余额（记 out 流水）；悬赏帖置 closed（防重复接单），服务帖保持 open。
3. **取消**：仅 pending，无资金变动。
4. **确认完成**：单方确认设 `autoConfirmAt=now+2天`；双方确认 -> completed，结算给收款方（记 in 流水），设 `reviewDeadline=now+2天`。
5. **申诉**：仅 in_progress，资金冻结不退不结，等管理员裁决。
6. **closed 订单不可评价**（与 completed 区别）。

### 6.2 争议仲裁【新功能】

1. in_progress 订单任一方 `disputeOrder` -> `disputed`，资金冻结。
2. 管理员 `GET /api/admin/disputes` 看待处理争议。
3. 管理员可 `GET /api/conversations/{id}/messages` **只读查看双方聊天记录取证**（管理员跳过参与者校验）。
4. 管理员 `POST /api/admin/orders/{id}/resolve` 裁决：
   - `refund`：全额退付款方（earnerGets=0）
   - `settle`：全额结算收款方（earnerGets=全额）
   - `partial`：部分结算，amountToEarner 须 >0 且 <订单金额，余款退付款方
5. 裁决后转账 + 记双方流水 + `status=closed` + 系统消息 + WebSocket 通知双方。

### 6.3 聊天付款卡片

**转账（transfer）：** 发送者即时扣款 -> 接收者，`status=paid`，一步完成。

**收款请求（request）：** 发送者创建 pending 卡片 -> 对方 `pay` 扣款转账 -> `status=paid`；发送者可 `cancel` -> `status=cancelled`。

付款卡片 JSON：`{kind, amount, status, payerId, payerName, receiverId, receiverName, paidAt}`

### 6.4 信用分贝叶斯计算【新功能】

`ReviewService.recalcCreditScore(userId)`，每次评价后自动重算：

```
score = (PRIOR * C + Σratings) / (C + n)
```
- `C = 2`（先验权重），`PRIOR = 5.0`（先验评分），`n` = 收到评价数。
- 结果限 [0, 5]，保留 1 位小数（HALF_UP）。
- 无评价时 score = 5.0；与前端 `utils.computeCreditScore` 同公式。
- 默认好评（5 星）也触发重算。

### 6.5 自动确认 + 默认好评（SweepService）

`@Scheduled(fixedDelay = 300000)` 每 5 分钟执行 + 业务方法按需触发：

| 任务 | 逻辑 |
|------|------|
| **autoConfirmSweep** | `in_progress` 且 `autoConfirmAt < now` 的订单 -> 自动 completed + 结算 |
| **ensureDefaultReviews** | `completed` 且 `reviewDeadline < now` 的订单 -> 为未评价方生成 5 星默认好评（autoReview=true） |

### 6.6 WebSocket 实时通知【新功能】

- 连接路径：`/ws/notification/{userId}`
- **全站广播**：`NEW_TASK`（新帖）、`TASK_TAKEN`（悬赏帖被接）
- **点对点**：`PERSONAL_NOTICE`（订单状态变更）、`CHAT_UPDATE`（聊天刷新）
- 用户不在线时跳过推送（前端自行刷页面）。

### 6.7 系统通知会话【新功能】

- 每用户专属会话 `sys-notify-<userId>`，对方固定"系统通知"（partnerId=0）。
- 用于帖子被下架/删除等平台通知，`senderId=0`（计入未读）。
- 与订单系统消息（`senderId=null`，不计未读）区分。

### 6.8 安全检查

| 检查项 | 说明 |
|--------|------|
| 参与者验证 | 会话操作验证当前用户是会话参与者 |
| 订单所有权 | 订单查询验证用户是 payer 或 earner |
| 评价权限 | 订单 completed、用户是参与者、被评者是另一方、未重复 |
| toUserName | 从 DB 取真实用户名，不信任客户端 |
| 实名门禁 | 发帖/订单/付款操作均要求 authStatus=1 |
| 管理员隔离 | role=1 不能发帖/接单/付款/举报 |
| JSON 转义 | 图片 JSON 手拼时完整转义控制字符 |

### 6.9 图片处理

- 发帖时每张原图经 `ImageUtil.toFullAndThumb` 生成缩略图（最大宽 400px，转 JPEG），存为 `[{full, thumb}]` JSON。
- 读取时兼容新格式（对象数组）和旧格式（纯字符串数组）。
- **dev 测不出的问题**：MySQL `TEXT` 只有 64KB，base64 原图会溢出，prod 必须用 `LONGTEXT`（已在 schema.sql 处理）。

---

## 七、种子数据（dev 环境）

`DataInitializer`（`@Profile("!prod")`）启动时注入，与前端 `mock-data.js` 对齐：

| 数据 | 数量 | 说明 |
|------|:---:|------|
| 用户 | 9 | 张三/李四/王同学/陈同学/赵同学/刘同学/孙同学/周同学 + 管理员 admin（role=1） |
| 帖子 | 22 | 悬赏/服务/互助三种，覆盖各分类，含 closed 和 open |
| 订单 | 6 | pending(1)/in_progress(3)/completed(2)，含可触发自动确认的过期订单 |
| 交易流水 | 8 | 订单支付/收入/充值 |
| 会话 | 6 | c1~c6，覆盖不同任务类型 |
| 消息 | 19 | text/system，含未读演示 |
| 评价 | 多条 | 1~5 星，初始化后统一 recalcCreditScore 重算信用分 |

- 所有用户密码均为 `1`（BCrypt 加密）。
- 管理员：`admin` / `1`（手机 13800138009）。
- prod 环境无种子数据，可用 `db/test-data.sql` 导入演示数据（账号 xiaoming/xiaohong/xiaowang/admin，密码 `123456`）。

---

## 八、关键设计决策

| 决策 | 原因 |
|------|------|
| Task.status 用 String | 对齐前端 "open"/"closed" 语义 |
| conversations.id 用 VARCHAR | 前端用客户端生成的 chatId（如 c1、sys-notify-8） |
| 订单加 disputed/closed 状态 | 支持争议仲裁流程 |
| 信用分贝叶斯公式 | 小样本时用先验平滑，避免 1 条评价定生死 |
| WebSocket 通知 | 聊天/订单状态变更实时推送 |
| sweeper 懒清理 + 定时 | 对齐前端 `_sweep()`，读操作前触发 + 每 5 分钟兜底 |
| 管理员只读取证 | 仲裁时管理员可查任意会话，跳过参与者校验 |
| 图片 LONGTEXT | base64 原图超 64KB，MySQL TEXT 装不下 |

---

## 九、验证方式

### 独立运行（dev）

```bash
cd backend/Keshe_backend
./mvnw spring-boot:run
# 测试登录
curl -X POST http://localhost:8080/api/login \
  -H "Content-Type: application/json" \
  -d '{"account":"张三","password":"1"}'
# H2 Console: http://localhost:8080/h2-console (JDBC URL: jdbc:h2:mem:campus_task_hub)
```

### prod（MySQL）

```bash
# 1. 建库 + 导演示数据
mysql -uroot -p < db/schema.sql
mysql -uroot -p campus_task_hub < db/test-data.sql
# 2. 启动（或双击 start-backend.bat）
./mvnw spring-boot:run -Dspring-boot.run.profiles=prod
# 登录（演示账号密码 123456）
curl -X POST http://localhost:8080/api/login \
  -H "Content-Type: application/json" \
  -d '{"account":"xiaoming","password":"123456"}'
```

### 集成测试

```bash
cd backend/Keshe_backend
./mvnw test     # OrderIntegrationTest 26 个用例
```

---

## 十、前后端联调

1. 启动后端（dev 或 prod）。
2. 前端 `js/api.js`：`USE_MOCK = false`（已设置），`API_BASE = 'http://localhost:8080/api'`。
3. 用 VS Code Live Server 打开 `front-end/index.html`，或直接双击 `login.html`。
4. WebSocket：前端 `main.js` 中 `new WebSocket('ws://localhost:8080/ws/notification/' + userId)`。

> 部署到服务器时改为同源相对路径，详见《部署速查单》.md。

---

## 附：相关文档

- `DATABASE.md` - 数据库设计完整说明（8 表字段/类型/坑点）
- `db/QUICKSTART.md` - MySQL 快速启动 + 测试用例
- `db/README.md` - 数据库脚本目录说明
- 《部署速查单》.md - 服务器部署
- `front-end/README.md` - 前端说明
