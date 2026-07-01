# 校园互助平台 — Spring Boot 后端代码说明

> 基于前端 JS 伪后端（`api.js` / `mock-data.js`）逻辑完整复刻的 Spring Boot 后端。

---

## 一、项目概览

| 项目 | 说明 |
|------|------|
| **项目名** | Keshe_backend（校园互助平台后端） |
| **框架** | Spring Boot 4.0.6 + Java 17 |
| **构建工具** | Maven |
| **开发数据库** | H2 内存数据库（`dev` profile）/ MySQL（`prod` 集成时） |
| **代码行数** | ~3,500 行（68 个 Java 源文件） |
| **API 端点** | ~35 个 REST 接口 |
| **前端对接** | campus_task_hub/front-end，`USE_MOCK = false` 即可连接 |

### 技术栈

| 技术 | 作用 |
|------|------|
| Spring WebMVC | REST 控制器 |
| Spring Data JPA (Hibernate 7.2) | ORM / 数据库操作 |
| Spring Security + JWT (jjwt 0.12.6) | 认证鉴权 |
| H2 Database | 开发环境内存数据库 |
| MySQL Connector | 生产环境数据库驱动 |
| Lombok | 简化 Java 代码 |
| BCrypt | 密码加密 |

---

## 二、独立运行策略

数据库不在开发阶段负责，但后端需要独立可运行，采用 **Spring Profile 双环境**：

| Profile | 数据库 | ddl-auto | 用途 |
|---------|--------|----------|------|
| `dev` | H2 内存数据库 | `update` | 独立开发，JPA 自动建表 + 种子数据 |
| 默认（无 profile） | MySQL | `none` | 后续对接 DBA 提供的数据库 |

### 开发环境启动

```bash
cd backend/Keshe_backend
./mvnw spring-boot:run -Dspring-boot.run.profiles=dev
```

- **无需安装 MySQL**，H2 内存数据库启动即用
- **JPA 实体自动建表**，不用手动执行 SQL
- **种子数据自动灌入**，与前端 `mock-data.js` 完全对齐
- **H2 Console** 访问 `http://localhost:8080/h2-console` 查看数据库
- **所有测试账号密码均为 `1`**

---

## 三、项目结构

```
src/main/java/com/example/keshe_backend/
├── KesheBackendApplication.java          # 启动入口（含 @EnableScheduling）
├── auth/                                 # M1 认证模块
│   ├── controller/AuthController.java    # 注册/登录/登出/微信登录
│   ├── dto/{LoginRequest, LoginResponse, RegisterRequest}.java
│   └── service/AuthService.java
├── user/                                 # M2 用户模块
│   ├── controller/UserController.java    # 用户资料/余额/充值/认证/账单
│   ├── entity/User.java                  # 用户实体
│   ├── repository/UserRepository.java
│   ├── service/UserService.java
│   └── dto/{UserProfileResponse, UpdatePhoneRequest, ...}.java
├── post/                                 # M3 帖子模块（/api/posts）
│   ├── controller/PostController.java    # 帖子列表/详情/发布/我的发布
│   ├── service/PostService.java
│   └── dto/{PostDTO, PostDetailResponse, CreatePostRequest, ...}.java
├── task/                                 # 旧 Task 实体（被帖子模块复用）
│   ├── entity/Task.java                  # 已重构：+publisherSide, +serviceTime, status→String
│   ├── repository/TaskRepository.java
│   ├── service/TaskService.java          # 旧版服务（兼容保留）
│   └── dto/CreateTaskRequest.java
├── order/                                # M4 订单模块（核心状态机）
│   ├── controller/OrderController.java   # 创建/接受/取消/确认/查询
│   ├── entity/Order.java
│   ├── repository/OrderRepository.java
│   ├── service/OrderService.java         # 状态机 + 资金冻结/结算
│   └── dto/{OrderDTO, CreateOrderRequest, MyOrderResponse}.java
├── chat/                                 # M5 聊天与消息模块
│   ├── controller/ChatController.java    # 消息收发/付款卡片/撤回/未读统计
│   ├── entity/{Conversation, Message}.java
│   ├── repository/{ConversationRepository, MessageRepository}.java
│   ├── service/ChatService.java          # 核心聊天业务 + 内置 JSON 处理
│   └── dto/{ConversationDTO, MessageDTO, SendPaymentRequest, ...}.java
├── review/                               # M6 评价模块
│   ├── controller/ReviewController.java  # 提交评价/查看评价/检查已评
│   ├── entity/Review.java
│   ├── repository/ReviewRepository.java
│   ├── service/ReviewService.java
│   └── dto/{ReviewDTO, SubmitReviewRequest}.java
├── transaction/                          # 交易流水
│   ├── entity/Transaction.java
│   └── repository/TransactionRepository.java
├── common/                               # 公共基础设施
│   ├── api/{ApiResponse, ErrorCode}.java       # 统一响应格式 / 错误码枚举
│   ├── exception/{BusinessException, GlobalExceptionHandler}.java
│   ├── security/{JwtAuthenticationFilter, JwtUtil, SecurityConfig, SecurityUtils}.java
│   ├── sweep/SweepService.java                 # 懒清理：自动确认 + 默认好评
│   └── data/DataInitializer.java              # 种子数据（仅 dev 环境）
└── resources/
    ├── application.properties            # 主配置（MySQL）
    ├── application-dev.yml               # 开发环境覆盖（H2）
    └── application-local.yml             # 本地密码覆盖
```

---

## 四、完整 API 端点清单

### 4.1 认证（AuthController）

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|:---:|
| POST | `/login` | 登录（用户名/手机号/邮箱 + 密码）→ 返回 JWT + 用户信息 | ✗ |
| POST | `/register` | 注册 | ✗ |
| POST | `/logout` | 登出 | ✗ |

### 4.2 用户（UserController）

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|:---:|
| GET | `/api/users/{id}` | 获取用户公开资料 | ✓ |
| PUT | `/api/user/phone` | 修改手机号 | ✓ |
| PUT | `/api/user/email` | 修改邮箱 | ✓ |
| POST | `/api/auth` | 提交实名认证（姓名+学号+学院+班级） | ✓ |
| GET | `/api/user/balance` | 查询余额 | ✓ |
| POST | `/api/user/recharge` | 充值（0.01 ~ 100,000） | ✓ |
| GET | `/api/user/bills` | 账单流水（含 totalIn / totalOut） | ✓ |

### 4.3 帖子（PostController）— `/api/posts`

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|:---:|
| GET | `/api/posts?side=&categories=&keyword=&sort=` | 帖子大厅（支持筛选/搜索/排序） | ✗ |
| GET | `/api/posts/{id}` | 帖子详情 + 发布者信息 | ✗ |
| POST | `/api/posts` | 发布帖子（需实名认证） | ✓ |
| GET | `/api/posts/mine` | 我的发布 | ✓ |

**排序参数 (sort)：** `time_desc`（默认）/ `time_asc` / `reward_asc` / `reward_desc` / `credit_asc` / `credit_desc`

**帖子类型 (publisherSide)：**

| 类型 | 含义 | 资金流向 |
|------|------|----------|
| `payer` | 悬赏帖——我付钱找人帮忙 | 发布者付款给接单者 |
| `earner` | 服务帖——我提供服务收钱 | 接单者付款给发布者 |
| `none` | 纯互助——无金钱往来 | 金额为 0 |

### 4.4 订单（OrderController）— `/api/orders`

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|:---:|
| POST | `/api/orders` | 创建订单（响应帖子） | ✓🔒 |
| POST | `/api/orders/{id}/accept` | 接受订单（冻结付款方余额） | ✓🔒 |
| POST | `/api/orders/{id}/cancel` | 取消订单（仅 pending 状态） | ✓🔒 |
| POST | `/api/orders/{id}/confirm` | 确认完成 | ✓🔒 |
| GET | `/api/orders/by-chat?chatId=` | 按会话查活跃订单 | ✓ |
| GET | `/api/orders?chatId=` | 按会话查订单历史 | ✓ |
| GET | `/api/orders/mine?role=` | 我的订单（payer/earner 筛选） | ✓ |

> 🔒 = 需要实名认证（authStatus == 1）

### 4.5 聊天（ChatController）

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|:---:|
| GET | `/api/conversations` | 会话列表（含未读标记） | ✓ |
| POST | `/api/conversations/ensure` | 确保会话存在（自动创建） | ✓ |
| GET | `/api/conversations/{id}/messages` | 消息列表 | ✓ |
| POST | `/api/conversations/{id}/messages` | 发送文本消息 | ✓ |
| POST | `/api/conversations/{id}/read` | 标记已读 | ✓ |
| POST | `/api/conversations/{id}/payment` | 发送付款卡片（收款/转账） | ✓🔒 |
| GET | `/api/messages/unread` | 未读消息统计 | ✓ |
| POST | `/api/messages/{id}/pay` | 支付收款请求 | ✓🔒 |
| POST | `/api/messages/{id}/cancel-payment` | 取消收款请求 | ✓🔒 |
| POST | `/api/messages/{id}/withdraw` | 撤回消息（2 分钟内） | ✓ |

### 4.6 评价（ReviewController）— `/api/reviews`

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|:---:|
| POST | `/api/reviews` | 提交评价 | ✓ |
| GET | `/api/reviews?userId=` | 查看用户评价列表 | ✗ |
| GET | `/api/reviews/has-reviewed?orderId=` | 检查当前用户是否已评价 | ✓ |

---

## 五、数据模型

### 5.1 实体一览

| 实体 | 对应表 | 说明 |
|------|--------|------|
| `User` | `users` | 用户（含余额、信用分、实名认证状态） |
| `Task` | `tasks` | 帖子（重构后：+publisherSide, +serviceTime, status→String） |
| `Order` | `orders` | 订单（核心状态机） |
| `Transaction` | `transactions` | 交易流水（每笔资金变动均有记录） |
| `Conversation` | `conversations` | 会话（id 为客户端生成的 chatId） |
| `Message` | `chat_messages` | 消息（支持 text/system/payment 三种类型） |
| `Review` | `reviews` | 评价（支持 auto 默认好评标记） |

### 5.2 数据库表结构（由 JPA 实体定义）

**users 表关键字段：**
`id`, `username`, `phone`, `email`, `password_hash`, `avatar`, `real_name`, `student_id`, `college`, `class_name`, `bio`, `balance`, `credit_score`, `auth_status`(0/1), `role`, `version`(乐观锁)

**tasks 表关键字段：**
`id`, `title`, `publisher_side`(payer/earner/none), `category`, `description`, `publisher_id`, `publisher_name`, `publisher_credit`, `reward`, `reward_value`, `deadline`, `publish_time`, `status`(open/closed), `contact`, `images`(JSON), `service_time`

**orders 表关键字段：**
`id`, `chat_id`, `post_id`, `payer_id`, `earner_id`, `amount`, `status`(pending/in_progress/completed/cancelled), `payer_confirmed`, `earner_confirmed`, `created_at`, `accepted_at`, `completed_at`, `auto_confirm_at`, `review_deadline`, `version`

**chat_messages 表关键字段：**
`id`, `chat_id`, `sender_id`, `sender_name`, `receiver_id`, `content`, `type`(text/system/payment), `time`, `task_id`, `task_title`, `withdrawn`, `is_read`, `payment`(JSON)

**transactions 表关键字段：**
`id`, `user_id`, `direction`(in/out), `amount`, `category`(order/recharge/payment), `related_id`, `note`, `created_at`

**reviews 表关键字段：**
`id`, `order_id`, `task_id`, `from_user_id`, `from_user_name`, `to_user_id`, `to_user_name`, `rating`(1-5), `content`, `images`(JSON), `auto_review`(0/1), `created_at`

---

## 六、核心业务逻辑

### 6.1 订单状态机

```
                   ┌──────────────────────────────┐
                   │                              │
                   ▼                              │
创建响应  ──▶  pending  ──accept──▶  in_progress  ──both confirm──▶  completed
                                     │    │
                                     │    └──auto confirm (超时)──▶  completed
                                     │
                              cancel │
                                     ▼
                                 cancelled
```

**规则：**

1. **创建订单 (createOrder)**
   - 不能对自己发布的帖子下单（自交易拦截）
   - 悬赏帖（payer）过截止时间不可下单
   - 悬赏帖同时只能有一个活跃订单（pending/in_progress）
   - 服务帖（earner）和纯互助帖（none）允许多订单并发
   - 确定 payer/earner 角色：payer 帖→发布者付款、响应者收款；earner 帖→响应者付款、发布者收款

2. **接受订单 (acceptOrder)**——仅帖子发布者可操作
   - 检查订单状态为 pending
   - 检查付款方余额充足
   - **冻结资金**：从付款方余额扣款 → 创建 transaction(out) 记录
   - 状态 → in_progress
   - 悬赏帖（payer）自动关闭（status → closed），防止重复接单
   - 服务帖保持 open，允许多人并发下单

3. **取消订单 (cancelOrder)**——付款方或收款方均可操作
   - 仅 pending 状态可取消
   - 状态 → cancelled（此时资金尚未冻结，无需退款）

4. **确认完成 (confirmOrder)**
   - 仅 in_progress 状态可操作
   - 设置 payerConfirmed 或 earnerConfirmed
   - **单方确认**：设置 autoConfirmAt = now + 2 天
   - **双方确认**：状态 → completed → **结算**：资金转入收款方余额 → 创建 transaction(in) 记录 → 设置 reviewDeadline = now + 2 天

### 6.2 聊天支付卡片

**转账 (transfer)：**
```
发送者 ──立即扣款──▶ 接收者（即时到账，无需确认）
双方各产生一条 transaction 记录
```

**收款请求 (request)：**
```
发送者 ──创建待付款卡片──▶ 对方
对方 ──pay──▶ 扣对方款 → 转给发送者
对方 ──cancel──▶ 卡片取消（仅发送者可取消）
双方各产生一条 transaction 记录（仅在支付后）
```

### 6.3 懒清理机制（SweepService）

复制 JS 端 `_sweep()` 逻辑，通过两种方式触发：

| 触发方式 | 频率 | 说明 |
|---------|------|------|
| `@Scheduled(fixedDelay = 300000)` | 每 5 分钟 | 定时自动执行 |
| 业务方法显式调用 | 按需 | getMyOrders / getBills / getReviews 等方法中 |

**自动确认 (autoConfirmSweep)：**
- 查找所有 `in_progress` 且 `autoConfirmAt < now` 的订单
- 自动设置为双方确认完成 + 结算资金

**默认好评 (ensureDefaultReviews)：**
- 查找所有 `completed` 且 `reviewDeadline < now` 的订单
- 对未评价的一方插入 5 星默认评价（`auto=true`，内容："用户未评价，默认好评"）
- 已有真实评价的不覆盖

### 6.4 安全检查

| 检查项 | 说明 |
|--------|------|
| **参与者验证** | 会话操作（getMessages/sendMessage/sendPaymentCard/markRead）验证当前用户是会话参与者 |
| **订单所有权** | 订单查询（getActiveOrder/getOrderHistory）验证用户是 payer 或 earner |
| **评价权限** | 提交评价验证：订单存在且 completed，用户是订单参与者，被评者是订单另一方，未重复评价 |
| **toUserName** | 从数据库获取被评价者真实用户名，不信任客户端提交的值 |
| **JSON 转义** | 所有 JSON 序列化完整处理控制字符（`"`, `\`, `\n`, `\r`, `\t` 等） |

---

## 七、种子数据

开发环境下启动时自动初始化，与前端 `mock-data.js` 一致：

| 数据类型 | 数量 | 说明 |
|---------|:---:|------|
| 用户 | 8 | 张三、李四、王同学、陈同学、赵同学、刘同学、孙同学、周同学 |
| 帖子 | 22 | 悬赏帖(t1-t14)、服务帖(t15-t22)、纯互助帖(t12-t13) |
| 订单 | 6 | 覆盖 pending(1)、in_progress(3)、completed(2) 各状态 |
| 交易流水 | 8 | 覆盖 order(7)、recharge(1) |
| 会话 | 6 | 覆盖不同任务类型 |
| 消息 | 19 | 含 text(13)、system(6)，含 2 条未读演示消息 |
| 评价 | 2 | 真实评价，非自动生成 |

**所有用户密码均为 `1`**，`authStatus=1`（已认证）。

---

## 八、关键设计决策

| 决策 | 原因 |
|------|------|
| Task.status 从 Integer 改为 String | 对齐 JS 端 "open"/"closed" 语义，订单状态由 Order 独立管理 |
| conversations.id 用 VARCHAR(100) | JS 端使用客户端生成的 chatId（如 `c-t12-u3`），不适用自增 BIGINT |
| 分类存英文字符串 key | 对齐前端 `errand`/`life-service` 等键值，不从 task_categories 表查 |
| 不依赖 Jackson | 避免额外依赖，使用内置方法安全构建 JSON |
| sweeper 懒清理 | 完全对齐 JS 端的 `_sweep()` 设计——在读操作前触发，不依赖外部调度器 |
| H2 MODE=MySQL | 开发环境模拟 MySQL 语法，降低后续迁移风险 |

---

## 九、验证方式

### 独立运行验证

```bash
# 1. 启动
cd backend/Keshe_backend
./mvnw spring-boot:run -Dspring-boot.run.profiles=dev

# 2. 测试登录
curl -X POST http://localhost:8080/login \
  -H "Content-Type: application/json" \
  -d '{"account":"张三","password":"1"}'
# 返回: {"success":true,"data":{"user":{...},"token":"eyJ..."}}

# 3. 查看 H2 数据库
# 浏览器打开 http://localhost:8080/h2-console
# JDBC URL: jdbc:h2:mem:campus_task_hub

# 4. 前端联调
# 修改 campus_task_hub/front-end/js/api.js:
# const USE_MOCK = false;
# 用 Live Server 打开 index.html → 自动连接 8080 端口
```

### 接口测试（api-test.http）

编辑 `Keshe_backend/api-test.http`，配合 VS Code REST Client 插件逐接口测试。

---

## 十、后续集成 MySQL

当数据库团队提供 MySQL 后，切换方式：

1. **去掉 dev profile** 或切换到默认 profile
2. 确认 `application.properties` 中 MySQL 连接信息正确
3. 设置 `spring.jpa.hibernate.ddl-auto=validate`（校验而非修改表结构）
4. 由 DBA 根据 JPA 实体生成建表 SQL，执行建表
5. 移除或禁用 `DataInitializer`（`@Profile("dev")` 已自动排除）
