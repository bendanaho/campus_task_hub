# Campus Task Hub 校园互助平台 - 后端

> Spring Boot 后端，对照前端 JS 伪后端逻辑复刻，并扩展了举报、管理员仲裁、信用分、WebSocket 通知等能力。

---

## 快速启动

### 方式一：一键脚本（Windows，推荐）

```
双击 backend/reset-db.bat   →  建库 + 导入演示数据（输入 MySQL 密码）
双击 backend/start-backend.bat →  启动后端（prod/MySQL）
```

### 方式二：命令行

```bash
# dev（H2 内存库，自带种子数据，零依赖）
cd Keshe_backend
./mvnw spring-boot:run

# prod（MySQL，需先建库，详见 db/QUICKSTART.md）
./mvnw spring-boot:run -Dspring-boot.run.profiles=prod
```

启动后访问 `http://localhost:8080`。

### 测试账号

| 环境 | 账号 | 密码 | 说明 |
|------|------|------|------|
| dev（H2，DataInitializer） | 张三/李四/王同学/陈同学/赵同学/刘同学/孙同学/周同学 | `1` | 8 普通用户 + 管理员 `admin`/`1` |
| prod（MySQL，test-data.sql） | xiaoming/xiaohong/xiaowang/admin | `123456` | admin 为管理员 |

---

## 技术栈

| 技术 | 说明 |
|------|------|
| Java 17 + Spring Boot 4.0.6 | 主框架 |
| Spring Data JPA (Hibernate 7.2) | ORM |
| Spring Security + JWT (jjwt 0.12.6) | 鉴权（含管理员角色） |
| Spring WebSocket | 实时通知推送 |
| H2 | 开发环境内存数据库 |
| MySQL 8 | 生产环境（`application-prod.yml`） |
| Maven（自带 mvnw） | 构建 |

---

## 项目结构

```
Keshe_backend/
├── pom.xml
├── mvnw / mvnw.cmd                 # Maven Wrapper（无需全局装 Maven）
├── CODE_DOCUMENTATION.md           # 完整代码说明文档（API/状态机/设计决策）
├── api-test.http                   # 接口测试请求
├── src/main/java/com/example/keshe_backend/
│   ├── auth/           # 认证（登录/注册）
│   ├── user/           # 用户（资料/余额/充值/认证/账单）
│   ├── post/           # 帖子（大厅/详情/发布/撤回/举报）★主用
│   ├── task/           # 旧 Task 接口（遗留）
│   ├── order/          # 订单（状态机 + 资金冻结/结算 + 争议仲裁）
│   ├── chat/           # 聊天（消息/付款卡片/撤回/未读）
│   ├── review/         # 评价（信用分贝叶斯计算）
│   ├── transaction/    # 交易流水
│   ├── report/         # 举报
│   ├── admin/          # 管理员（争议仲裁/帖子管理/举报处理）
│   └── common/
│       ├── api/        # 统一响应 + 错误码
│       ├── exception/  # 全局异常处理
│       ├── security/   # JWT 过滤器 + SecurityConfig
│       ├── sweep/      # 自动确认 + 默认好评定时任务
│       ├── websocket/  # WebSocket 实时通知
│       ├── data/       # 种子数据初始化
│       ├── logging/    # 请求日志拦截器
│       └── util/       # 图片缩略图工具
└── src/main/resources/
    ├── application.properties    # 主配置（H2 默认）
    ├── application-dev.yml       # 开发环境
    ├── application-prod.yml      # 生产环境 MySQL（gitignore，见 .example）
    └── application-local.yml     # 本地覆盖
```

---

## API 端点

40+ 个 REST 接口，8 个 Controller，详见 [CODE_DOCUMENTATION.md](CODE_DOCUMENTATION.md)。

| 模块 | 端点示例 | 数量 |
|------|------|:--:|
| 认证 | `/api/login`, `/api/register` | 4 |
| 用户 | `/api/users/{id}`, `/api/user/balance`, `/api/auth` | 7 |
| 帖子 | `/api/posts`, `/api/posts/{id}/report`, `/api/posts/{id}/close` | 6 |
| 订单 | `/api/orders`, `/api/orders/{id}/dispute`, `/api/orders/{id}/confirm` | 8 |
| 聊天 | `/api/conversations`, `/api/messages/unread` | 10 |
| 评价 | `/api/reviews`, `/api/reviews/has-reviewed` | 3 |
| 管理员 | `/api/admin/disputes`, `/api/admin/orders/{id}/resolve`, `/api/admin/reports` | 7 |
| 任务(遗留) | `/api/tasks`, `/api/services` | 5 |

---

## 核心功能与新扩展

| 功能 | 说明 |
|------|------|
| 帖子三类型 | 悬赏(payer)/服务(earner)/互助(none)，资金流向不同 |
| 订单状态机 | pending→in_progress→completed/cancelled/disputed→closed |
| **争议仲裁** ★ | in_progress 可申诉 -> disputed -> 管理员裁决 refund/settle/partial -> closed |
| **信用分** ★ | 贝叶斯公式 `(5*2+Σ评分)/(2+n)`，每次评价后自动重算 |
| **WebSocket 通知** ★ | 新帖广播、订单/聊天变更点对点推送，`/ws/notification/{userId}` |
| **系统通知会话** ★ | 每用户专属 sys-notify 会话，帖子下架/删除通知 |
| 自动确认 | 单方确认后 2 天定时任务自动完成 |
| 默认好评 | 评价期过期为未评价方生成 5 星默认好评 |
| 聊天付款卡片 | 收款(request)/转账(transfer)，pending/paid/cancelled |
| 管理员只读取证 | 仲裁时可查任意会话聊天记录 |
| 图片缩略图 | 原图+缩略图存 LONGTEXT（prod 必需） |

★ = 较新/较复杂功能，测试重点。

---

## 测试

### 后端集成测试

```bash
cd Keshe_backend
./mvnw test     # OrderIntegrationTest，26 个用例
```

覆盖：服务帖/悬赏帖/互助全流程、实名门禁、余额充值、聊天收款/转账、账单流水、过期拦截、自交易拦截、取消规则、自动确认、默认好评、未读消息、角色筛选。

### 前端 JS 测试

```bash
cd campus_task_hub/front-end
npm test        # tests/order.test.js，26 个用例
```

---

## 数据库

### dev（默认）

H2 内存库，启动自动建表 + 种子数据（9 用户、22 帖子、6 订单等），重启清空。

### prod（MySQL）

```bash
mysql -uroot -p < db/schema.sql              # 建库建表
mysql -uroot -p campus_task_hub < db/test-data.sql   # 演示数据（可选）
./mvnw spring-boot:run -Dspring-boot.run.profiles=prod
```

详见 [db/QUICKSTART.md](db/QUICKSTART.md) 和 [DATABASE.md](Keshe_backend/DATABASE.md)。

---

## 联调前端

1. 启动后端（dev 或 prod）。
2. 前端 `campus_task_hub/front-end/js/api.js`：`USE_MOCK = false`（已设置）。
3. 用 VS Code Live Server 打开 `front-end/index.html`，或双击 `login.html`。

---

## 更多细节

- **[CODE_DOCUMENTATION.md](CODE_DOCUMENTATION.md)** - 完整 API 文档、数据模型、订单状态机、争议仲裁、信用分计算、设计决策
- **[DATABASE.md](Keshe_backend/DATABASE.md)** - 数据库设计完整说明
- **[db/QUICKSTART.md](db/QUICKSTART.md)** - MySQL 快速启动 + 测试用例
- **《部署速查单》.md** - 服务器部署
