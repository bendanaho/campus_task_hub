# Campus Task Hub 校园互助平台 — 后端

> 完整 Spring Boot 后端，对照前端 JS 伪后端逻辑逐模块复刻。

---

## 快速启动

```bash
cd Keshe_backend
./mvnw spring-boot:run
```

无需 MySQL，H2 内存数据库自动建表 + 种子数据。启动后访问 `http://localhost:8080`。

**测试账号**（密码均为 `1`）：张三、李四、王同学、陈同学、赵同学、刘同学、孙同学、周同学

---

## 技术栈

| 技术 | 说明 |
|------|------|
| Java 17 + Spring Boot 4.0.6 | 主框架 |
| Spring Data JPA (Hibernate 7.2) | ORM |
| Spring Security + JWT (jjwt 0.12.6) | 鉴权 |
| H2 | 开发环境内存数据库 |
| MySQL | 生产环境（`application-prod.yml`） |
| Maven | 构建 |

---

## 项目结构

```
Keshe_backend/
├── pom.xml
├── Readme.md                          ← 你在这
├── CODE_DOCUMENTATION.md              ← 完整代码说明文档
├── api-test.http                      ← 28 个接口测试请求
├── src/main/java/com/example/keshe_backend/
│   ├── KesheBackendApplication.java
│   ├── auth/           # 认证模块（登录/注册）
│   ├── user/           # 用户模块（资料/余额/充值/认证/账单）
│   ├── post/           # 帖子模块（大厅/详情/发布/我的）
│   ├── task/           # Task 实体（被 post 模块复用）
│   ├── order/          # 订单模块（状态机 + 资金冻结/结算）
│   ├── chat/           # 聊天模块（消息/付款卡片/撤回/未读）
│   ├── review/         # 评价模块（提交/查看/默认好评）
│   ├── transaction/    # 交易流水
│   └── common/         # 基础设施
│       ├── api/        # 统一响应 + 错误码
│       ├── exception/  # 全局异常处理
│       ├── security/   # JWT 过滤器 + SecurityConfig + 工具类
│       ├── sweep/      # 自动确认 + 默认好评定时任务
│       ├── data/       # 种子数据初始化
│       └── logging/    # 请求日志拦截器
├── src/main/resources/
│   ├── application.properties    # 主配置（H2 默认）
│   ├── application-dev.yml       # 开发环境额外配置
│   ├── application-prod.yml      # 生产环境 MySQL 配置
│   └── application-local.yml     # 本地密码覆盖
└── src/test/java/com/example/keshe_backend/
    ├── BaseIntegrationTest.java       # 测试基类
    └── OrderIntegrationTest.java      # 26 个集成测试
```

---

## API 端点

~35 个 REST 接口，详见 [CODE_DOCUMENTATION.md](Keshe_backend/CODE_DOCUMENTATION.md)。

| 模块 | 端点示例 | 数量 |
|------|------|:--:|
| 认证 | `/api/login`, `/api/register` | 3 |
| 用户 | `/api/users/{id}`, `/api/user/balance`, `/api/auth` | 7 |
| 帖子 | `/api/posts?side=&keyword=&sort=`, `/api/posts/mine` | 4 |
| 订单 | `/api/orders`, `/api/orders/mine?role=` | 7 |
| 聊天 | `/api/conversations`, `/api/messages/unread` | 11 |
| 评价 | `/api/reviews`, `/api/reviews/has-reviewed` | 3 |

---

## 测试

### 后端集成测试（验证 Spring Boot）

```bash
cd Keshe_backend
./mvnw test
```

```
测试文件:
  src/test/java/com/example/keshe_backend/
  ├── BaseIntegrationTest.java      # RestTemplate + 登录/断言工具
  └── OrderIntegrationTest.java     # 26 个用例，对应前端 JS 测试
```

26 个用例覆盖：服务帖/悬赏帖/纯互助全流程、实名门禁、余额充值、聊天收款/转账、账单流水、过期拦截、自交易拦截、取消规则、自动确认、默认好评、未读消息、角色筛选。

### 前端 JS 测试（验证原型逻辑，不走网络）

```bash
cd campus_task_hub/front-end
npm test
```

```
测试文件:
  front-end/tests/
  ├── load.js           # 沙箱加载器
  └── order.test.js     # 26 个用例（node --test）
```

---

## 数据库

### 开发环境（默认）

H2 内存数据库，启动自动建表 + 灌入种子数据（8 用户、22 帖子、6 订单等）。重启后数据不保留。

若要保留数据，改为文件模式（修改 `application.properties`）：

```properties
spring.datasource.url=jdbc:h2:file:./data/campus_task_hub;MODE=MySQL
```

### 生产环境

```bash
./mvnw spring-boot:run -Dspring-boot.run.profiles=prod
```

使用 `application-prod.yml` 中的 MySQL 配置，需先修改密码和 SSL 设置。

---

## 日志

后端静默运行，只显示请求日志：

```
✓ POST /api/login 匿名 → 200 (47ms)
✓ GET  /api/posts  张三 → 200 (5ms)
✗ POST /api/orders 匿名 → 403 (3ms)
```

---

## 联调前端

1. 启动后端：`./mvnw spring-boot:run`
2. 用 VS Code Live Server 打开 `campus_task_hub/front-end/index.html`
3. `front-end/js/api.js` 中 `USE_MOCK = false`（已设置）

---

## 更多细节

参见 **[CODE_DOCUMENTATION.md](Keshe_backend/CODE_DOCUMENTATION.md)**，包含：

- 完整 API 文档（请求/响应格式）
- 数据模型（7 个实体）
- 订单状态机详解
- 种子数据清单
- 关键设计决策
- 后续集成 MySQL 步骤
