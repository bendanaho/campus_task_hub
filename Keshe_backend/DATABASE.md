# 数据库开发指导

> 本文档面向负责数据库设计/维护的同学，目标是让数据库与当前 Spring Boot 后端**无缝衔接**：照此文档建库建表，后端在 `prod` profile（`ddl-auto=validate`）下可直接通过校验、正常读写。
>
> 后端代码位于 `src/main/java/com/example/keshe_backend/`，**实体类（Entity）是表结构的唯一真相**。任何 DDL 改动都必须与对应 Entity 保持一致，反之亦然。

---

## 1. 技术栈与数据层架构

| 项 | 内容 |
|---|---|
| 框架 | Spring Boot 4.0.6 + Spring Data JPA + Hibernate 6 |
| 语言 | Java 17 |
| dev 数据库 | H2 内存库（`MODE=MySQL` 兼容模式），`jdbc:h2:mem:campus_task_hub` |
| prod 数据库 | MySQL 8（`jdbc:mysql://.../campus_task_hub`） |
| 建表方式 | **JPA `ddl-auto` 自动建表，没有 `schema.sql` / `data.sql`** |
| 种子数据 | `common/data/DataInitializer.java`（Java 代码插入，仅 `!prod`） |

**关键认知**：本项目没有手写建表脚本，表结构完全由 Entity 注解推导。所以"数据库开发"的第一原则是——**以 Entity 为准**。

---

## 2. 环境与 Profile

有三套 profile，数据层差异如下：

| profile | 配置文件 | 数据库 | `ddl-auto` | 种子数据 | 用途 |
|---|---|---|---|---|---|
| 默认 | `application.properties` | H2 内存 | `update` | 有 | 不指定 profile 时的默认 |
| `dev` | `application-dev.yml` | H2 内存 | `update`（覆盖 show-sql） | 有 | 开发调试 |
| `local` | `application-local.yml` | H2 内存（仅覆盖密码） | `update` | 有 | 个人本地 |
| `prod` | `application-prod.yml` | **MySQL** | **`validate`** | **无** | 测试/生产服务器 |

切换方式：`./mvnw spring-boot:run -Dspring-boot.run.profiles=prod`

### ⚠️ dev 与 prod 的两个致命差异

1. **`ddl-auto` 行为不同**：dev 用 `update` 会自动建表、加新列；prod 用 `validate` **只校验不建表**——prod 的库必须事先建好，且列必须与 Entity 完全对齐，否则启动即失败。
2. **H2 的 `TEXT` ≠ MySQL 的 `TEXT`**：H2 把 `columnDefinition="TEXT"` 当作无界 CLOB（最大 2GB）；MySQL 的 `TEXT` 只有 **64KB**。图片列存的是 base64，单张原图就远超 64KB——**dev 永远测不出这个问题，上 prod 必炸**（详见第 5 节）。

---

## 3. 表结构总览

共 8 张表，全部用 `@Table(name=...)` 显式命名，列名走蛇形（`@Column(name=...)` 或驼峰自动转蛇形）。

| 表名 | Entity | 主键 | 用途 |
|---|---|---|---|
| `users` | `User` | `id` 自增 | 用户、管理员、余额、信用分 |
| `tasks` | `Task` | `id` 自增 | 互助帖（大厅核心实体） |
| `orders` | `Order` | `id` 自增 | 订单（含争议仲裁字段） |
| `transactions` | `Transaction` | `id` 自增 | 资金流水 |
| `conversations` | `Conversation` | `id` **字符串（客户端生成）** | 聊天会话 |
| `chat_messages` | `Message` | `id` 自增 | 聊天消息 |
| `reviews` | `Review` | `id` 自增 | 评价（驱动信用分计算） |
| `reports` | `Report` | `id` 自增 | 帖子举报 |

### 关系图（逻辑关联，DB 层无外键）

```
users ──< tasks (publisher_id)
users ──< orders (payer_id, earner_id)
tasks ──< orders (post_id)
tasks ──< conversations (task_id)
tasks ──< reviews (task_id)
orders ──< reviews (order_id)
users ──< transactions (user_id)
conversations ──< chat_messages (chat_id)
tasks ──< reports (post_id)
users ──< reports (reporter_id)
```

> **注意**：所有外键都是裸 `BIGINT`/`VARCHAR` 列，**数据库层没有 FOREIGN KEY 约束**，一致性靠应用层保证。是否在 DB 层加外键由数据库设计决定（见第 8 节）。

---

## 4. 各表字段说明

> 类型栏给出 **MySQL 推荐类型**；`String` 未指定 `length` 时 Hibernate 默认 `VARCHAR(255)`。`@Deprecated` 字段是旧 schema 遗留，**保留兼容、不再使用，但 prod 建表必须保留这些列**（否则 `validate` 失败）。

### 4.1 `users`
| 列 | 类型 | 约束 | 说明 |
|---|---|---|---|
| `id` | BIGINT | PK, AUTO_INCREMENT | |
| `username` | VARCHAR(50) | NOT NULL, UNIQUE | |
| `phone` | VARCHAR(20) | NOT NULL, UNIQUE | |
| `email` | VARCHAR(100) | UNIQUE | 可空 |
| `password_hash` | VARCHAR(255) | NOT NULL | BCrypt 哈希 |
| `wechat_openid` | VARCHAR(100) | UNIQUE | 预留小程序登录 |
| `wechat_unionid` | VARCHAR(100) | | 预留 |
| `avatar` | VARCHAR(255) | | 头像 URL（外链） |
| `credit_score` | DECIMAL(3,1) | NOT NULL | 信用分 0.0–10.0，默认 5.0 |
| `auth_status` | INT | NOT NULL | 0=未认证, 1=已认证 |
| `real_name` | VARCHAR(50) | | |
| `student_id` | VARCHAR(50) | | 学号 |
| `college` | VARCHAR(255) | | |
| `class_name` | VARCHAR(255) | | |
| `bio` | VARCHAR(255) | | |
| `balance` | DECIMAL(10,2) | NOT NULL | 余额，默认 0 |
| `role` | INT | NOT NULL | 0=普通用户, 1=管理员 |
| `version` | INT | | **乐观锁**（@Version） |
| `created_at` | DATETIME | | Java 层填充 |
| `updated_at` | DATETIME | | Java 层填充 |
| `deleted_at` | DATETIME | | 软删除标记 |

### 4.2 `tasks`（大厅核心，图片在这里）
| 列 | 类型 | 约束 | 说明 |
|---|---|---|---|
| `id` | BIGINT | PK, AUTO_INCREMENT | |
| `title` | VARCHAR(200) | NOT NULL | |
| `type` | INT | NOT NULL | **@Deprecated** 旧字段，固定填 0 |
| `category` | VARCHAR(50) | NOT NULL | 见下方枚举 |
| `description` | TEXT | NOT NULL | 帖子描述 |
| `publisher_id` | BIGINT | NOT NULL | → users.id |
| `publisher_name` | VARCHAR(50) | NOT NULL | 冗余快照 |
| `publisher_credit` | DECIMAL(3,1) | NOT NULL | 发布时信用分快照 |
| `reward` | VARCHAR(50) | NOT NULL | 报酬文本（如 "5元"） |
| `reward_value` | DECIMAL(10,2) | NOT NULL | 报酬数值，用于排序，默认 0 |
| `deadline` | DATETIME | | 悬赏帖截止时间 |
| `publish_time` | DATETIME | | 发布时间，Java 层填 |
| `status` | VARCHAR(10) | NOT NULL | `open` / `closed` |
| `contact` | VARCHAR(255) | | 联系方式，默认 "站内联系" |
| `images` | **LONGTEXT** | | **图片 JSON（见第 5 节）** |
| `publisher_side` | VARCHAR(10) | NOT NULL | `payer`/`earner`/`none`，默认 payer |
| `service_time` | VARCHAR(100) | | 仅 earner 用 |
| `taker_id` | BIGINT | | **@Deprecated** |
| `taker_name` | VARCHAR(255) | | **@Deprecated** |
| `payment_status` | INT | | **@Deprecated** |
| `publisher_confirmed` | INT | | **@Deprecated** |
| `taker_confirmed` | INT | | **@Deprecated** |
| `version` | INT | | **乐观锁** |
| `created_at` / `updated_at` / `deleted_at` | DATETIME | | |

`category` 取值（来自种子数据，前端分类筛选沿用）：`errand`（跑腿）、`life-service`（生活服务）、`skill-help`（技能帮助）、`study-help`（学习帮助）、`material-share`（资料分享）、`item-trade`（物品交易）、`teamwork`（组队）、`other`。

### 4.3 `orders`
| 列 | 类型 | 约束 | 说明 |
|---|---|---|---|
| `id` | BIGINT | PK, AUTO_INCREMENT | |
| `chat_id` | VARCHAR(100) | NOT NULL | → conversations.id |
| `post_id` | BIGINT | NOT NULL | → tasks.id |
| `payer_id` | BIGINT | NOT NULL | 付款方 |
| `earner_id` | BIGINT | NOT NULL | 收款方 |
| `amount` | DECIMAL(10,2) | NOT NULL | 金额，纯互助为 0 |
| `status` | VARCHAR(20) | NOT NULL | `pending`/`in_progress`/`completed`/`cancelled`（争议态详见 OrderService） |
| `payer_confirmed` | BOOLEAN | NOT NULL | |
| `earner_confirmed` | BOOLEAN | NOT NULL | |
| `created_at` / `accepted_at` / `completed_at` | DATETIME | | |
| `auto_confirm_at` | DATETIME | | 单方确认后的自动确认时间 |
| `review_deadline` | DATETIME | | 评价截止 |
| `dispute_reason` | TEXT | | 申诉理由 |
| `disputed_by` | BIGINT | | 申诉人 userId |
| `disputed_at` | DATETIME | | |
| `resolution` | VARCHAR(20) | | `refund`/`settle`/`partial` |
| `resolution_amount_to_earner` | DECIMAL(10,2) | | 结算给收款方金额 |
| `resolution_note` | TEXT | | 管理员说明 |
| `resolved_at` | DATETIME | | |
| `version` | INT | | **乐观锁** |
| `updated_at` | DATETIME | | |

> `orders` **没有** `deleted_at`，删除靠 `status`。`BOOLEAN` 在 MySQL 用 `TINYINT(1)` 或 `BIT(1)` 均可（见第 7 节）。

### 4.4 `transactions`
| 列 | 类型 | 约束 | 说明 |
|---|---|---|---|
| `id` | BIGINT | PK, AUTO_INCREMENT | |
| `user_id` | BIGINT | NOT NULL | |
| `direction` | VARCHAR(10) | NOT NULL | `in`/`out` |
| `amount` | DECIMAL(10,2) | NOT NULL | |
| `category` | VARCHAR(20) | NOT NULL | `order`/`recharge`/`payment` |
| `related_id` | VARCHAR(100) | | 关联 ID（订单/消息），字符串 |
| `note` | VARCHAR(500) | | 默认空串 |
| `created_at` | DATETIME | | |

### 4.5 `conversations`
| 列 | 类型 | 约束 | 说明 |
|---|---|---|---|
| `id` | VARCHAR(100) | **PK（非自增，客户端生成）** | 如 "c1" |
| `user1_id` | BIGINT | NOT NULL | |
| `user2_id` | BIGINT | NOT NULL | |
| `task_id` | BIGINT | | → tasks.id |
| `task_title` | VARCHAR(200) | | 冗余 |
| `last_message` | TEXT | | |
| `last_time` | DATETIME | | |
| `last_message_sender_id` | BIGINT | | |
| `created_at` / `updated_at` | DATETIME | | |

### 4.6 `chat_messages`
| 列 | 类型 | 约束 | 说明 |
|---|---|---|---|
| `id` | BIGINT | PK, AUTO_INCREMENT | |
| `chat_id` | VARCHAR(100) | NOT NULL | → conversations.id |
| `sender_id` | BIGINT | | 系统消息为 NULL |
| `sender_name` | VARCHAR(50) | | 冗余 |
| `receiver_id` | BIGINT | | |
| `content` | TEXT | NOT NULL | |
| `type` | VARCHAR(20) | NOT NULL | `text`/`system`/`payment` |
| `time` | DATETIME | NOT NULL | |
| `task_id` | **VARCHAR(50)** | | ⚠️ 这里是**字符串**，与 reviews/conversations 的 Long 类型不一致（历史遗留） |
| `task_title` | VARCHAR(200) | | 冗余 |
| `withdrawn` | BOOLEAN | NOT NULL | |
| `is_read` | BOOLEAN | NOT NULL | |
| `payment` | TEXT | | 支付 JSON（见下方） |

`payment` JSON 格式（`type=payment` 时）：
```json
{"kind":"request|transfer","amount":15,"status":"pending|paid|cancelled","payerId":1,"payerName":"...","receiverId":2,"receiverName":"...","paidAt":null}
```

### 4.7 `reviews`
| 列 | 类型 | 约束 | 说明 |
|---|---|---|---|
| `id` | BIGINT | PK, AUTO_INCREMENT | |
| `order_id` | BIGINT | | |
| `task_id` | BIGINT | | |
| `from_user_id` | BIGINT | NOT NULL | |
| `from_user_name` | VARCHAR(50) | NOT NULL | |
| `to_user_id` | BIGINT | NOT NULL | 信用分按此聚合 |
| `to_user_name` | VARCHAR(50) | NOT NULL | |
| `rating` | INT | NOT NULL | 1–5 |
| `content` | VARCHAR(500) | | |
| `images` | **LONGTEXT** | | 评价图片 JSON（同 tasks.images 格式） |
| `auto_review` | BOOLEAN | NOT NULL | 是否系统默认好评 |
| `created_at` | DATETIME | | |

> `reviews.images` 字段存在但目前后端写入逻辑未填充，保留以备扩展。建表仍按 LONGTEXT。

### 4.8 `reports`
| 列 | 类型 | 约束 | 说明 |
|---|---|---|---|
| `id` | BIGINT | PK, AUTO_INCREMENT | |
| `post_id` | BIGINT | NOT NULL | |
| `reporter_id` | BIGINT | NOT NULL | |
| `reporter_name` | VARCHAR(50) | | 快照 |
| `reason` | TEXT | NOT NULL | |
| `status` | VARCHAR(20) | NOT NULL | `pending`/`handled` |
| `created_at` | DATETIME | NOT NULL | |

---

## 5. ⚠️ 重点坑点：图片存储

> 这是最容易踩坑、且 dev 测不出来的地方。数据库开发者务必读完本节。

### 5.1 存什么、存在哪

图片存在 **`tasks.images`** 这一个 `TEXT` 列里，**不是单独的图片表**。存的内容是 **JSON 字符串**，不是文件路径、不是 OSS URL。

前端上传时把图片转成 **base64 data URL**（形如 `data:image/png;base64,iVBORw0KGgo...`）传给后端，后端把每张图加工后拼成 JSON 存库。

### 5.2 两种格式（新旧兼容）

| 格式 | 结构 | 来源 |
|---|---|---|
| **新格式** | `[{"full":"<原图dataURL>","thumb":"<缩略图dataURL>"}, ...]` | `PostService.createPost` 写入（`toImageJsonArray`） |
| **旧格式** | `["<url1>", "<url2>"]`（纯字符串数组） | 种子数据（`DataInitializer`，用的是 picsum 外链 URL） |

**一张图存两份**：`full` 是原图 data URL，`thumb` 是缩略图 data URL。需求是"列表用缩略图省流量、详情/大图用原图"。

读取端（`PostDTO.parseImages`）做了**向后兼容**：遇到旧格式的纯字符串，自动当作 `full = thumb = 该字符串`。所以旧帖/种子数据不会崩，但**不会真的有缩略图**（列表和详情都用同一个 URL）。

### 5.3 缩略图怎么生成

`common/util/ImageUtil.toFullAndThumb(dataUrl)`：
1. 用正则 `^data:image/(\w+);base64,(.*)$` 匹配 data URL；
2. Base64 解码 → `ImageIO.read` 还原成 `BufferedImage`；
3. 按最大宽度 **400px** 等比缩放，统一转 **JPEG** 输出；
4. 重新 Base64 编码成 `data:image/jpeg;base64,...`；
5. **生成失败时回退：`thumb = full`**（保证可用，但失去缩略图意义）。

### 5.4 数据库视角的三个坑

**坑 1：MySQL `TEXT` 只有 64KB，base64 原图必然溢出。**
- 一张几百 KB 的原图，base64 后膨胀约 33%，再叠加缩略图，单条 `images` 轻松上 MB。
- H2 的 `TEXT` 是无界 CLOB，dev 永远正常；MySQL `TEXT` 上限 64KB，prod 写入会被截断或报错。
- **对策**：prod 建表时把 `tasks.images`、`reviews.images` 设为 **`LONGTEXT`**（最大 4GB）。`chat_messages.payment`、`tasks.description`、`reports.reason`、`orders.dispute_reason`、`orders.resolution_note`、`conversations.last_message`、`chat_messages.content` 这些 TEXT 列存的是文本/小 JSON，`TEXT` 一般够，但保守可统一用 `MEDIUMTEXT`（16MB）。

**坑 2：缩略图生成依赖服务器 JDK 的 `ImageIO` 支持的格式。**
- JDK 内置 `ImageIO` 只支持 PNG/JPEG/GIF/BMP。若用户上传 **WebP/HEIC**，`ImageIO.read` 返回 `null` → 缩略图生成失败 → 回退 `thumb=full`（列表仍加载原图，没省流量，但不报错）。
- 这不是数据库问题，但数据库同学要知道：**`thumb` 字段可能等于 `full`**，设计容量、做迁移时按"两份原图大小"预留空间更稳妥。

**坑 3：JSON 是手写拼接/解析的，不是用 Jackson。**
- 写入：`PostService.toImageJsonArray` 用 `StringBuilder` 手拼，`esc()` 转义引号/反斜杠/控制字符。
- 读取：`PostDTO.parseImages` 手写字符状态机解析（因为编译 classpath 没引入 jackson-databind）。
- **含义**：数据库里直接看到的 `images` 是合法 JSON，但**不要**在后端之外用非标准方式改写它——如果手动 SQL 修改 `images`，务必保证是合法的 `[{"full":"...","thumb":"..."}]` 格式，且字符串内的 `"`/`\`/控制字符正确转义，否则后端解析会出错或丢图。

### 5.5 给数据库同学的图片存储结论

```sql
-- prod 建表时，图片列必须升级：
images LONGTEXT NULL        -- tasks.images / reviews.images
```

如果要做数据迁移（把旧格式 `["url"]` 升级为新格式 `[{full,thumb}]`），**不要在 SQL 里转**——base64 缩略图必须由 `ImageUtil` 生成。正确做法是写一次性 Java 迁移脚本调用 `ImageUtil.toFullAndThumb`，或让后端补一个迁移接口。

---

## 6. ⚠️ ddl-auto 的局限与迁移

### 6.1 `update` 能做什么、不能做什么

`ddl-auto=update`（dev）能：
- 新增表
- 新增列

`ddl-auto=update` **不能**：
- **修改已有列的类型**（如 `TEXT` → `LONGTEXT`、`VARCHAR(50)` → `VARCHAR(200)`）——不会生效
- **删除列**（所以 `@Deprecated` 的 `taker_id` 等列永远留在表里）
- **删除表**

### 6.2 prod 用 `validate`，必须手动建表

`validate` 只校验"Entity 声明的列在数据库里是否存在、类型是否大致兼容"，**不会建表、不会改表**。prod 启动前数据库必须已建好。

### 6.3 改列类型的正确流程

以"`tasks.images` 从 TEXT 改 LONGTEXT"为例：
1. 数据库同学在 MySQL 执行 `ALTER TABLE tasks MODIFY COLUMN images LONGTEXT NULL;`
2. 同步把 Entity 注解改成 `@Column(columnDefinition = "LONGTEXT")`（这样 dev 的 H2 也用 LONGTEXT，且 prod validate 一致）。
3. **不要指望 `ddl-auto=update` 帮你改类型**。

### 6.4 推荐的 prod 建表基准 DDL 获取方式

与其手写 DDL 担心类型对不上，最稳妥的做法：
1. 在一个**临时 MySQL 库**上，把 `application-tempp.properties` 设成 `spring.jpa.hibernate.ddl-auto=create` + MySQL方言；
2. 启动一次后端，让 Hibernate 自动生成全部表；
3. `mysqldump --no-data` 导出 DDL，以此作为 prod 建表基准；
4. 在基准上**把 `images` 列改为 `LONGTEXT`**，其余按需加索引。

这样能 100% 保证 `validate` 通过。

---

## 7. 通用约定（务必遵守）

### 7.1 命名
- 表名/列名：**蛇形**（`snake_case`），如 `publisher_id`、`created_at`。
- Java 字段：驼峰，Hibernate 自动转换（或在 `@Column(name=...)` 显式指定）。
- 数据库新建对象必须沿用此命名。

### 7.2 时间戳：Java 层填充，DB 无 DEFAULT
所有 `created_at` / `updated_at` / `publish_time` 由 Entity 的 `@PrePersist` / `@PreUpdate` 在 Java 层赋值，**数据库列没有 `DEFAULT CURRENT_TIMESTAMP`**。
- 含义：如果用**裸 SQL 插入数据**（绕过 JPA），必须手动给这些时间列赋值，否则可能违反 `NOT NULL`（如 `reports.created_at NOT NULL`、`chat_messages.time NOT NULL`）。
- 若希望 DB 层也有默认值，可建表时加 `DEFAULT CURRENT_TIMESTAMP`，但**别和 Java 层重复填充冲突**——目前 Java 层一定会填，DB 默认值只是兜底。

### 7.3 乐观锁 `@Version`
`users` / `tasks` / `orders` 有 `version INT` 列（`@Version`），JPA 更新时自动 +1 并校验。
- 用裸 SQL 改这三张表的数据时，**`version` 不会自增**。一般无妨（JPA 下次读到当前 version 继续用），但**不要手动把 `version` 改成 NULL 或乱值**，否则后续 JPA 更新会抛 `OptimisticLockException`。
- 给这三张表加列时，`version` 列必须保留且允许 NULL（首次插入前为 null，JPA 会处理）。

### 7.4 软删除 vs 状态
- `users` / `tasks`：用 `deleted_at IS NULL` 判断未删除（软删）。
- `tasks` 还有 `status`：`open`（大厅可见）/ `closed`（管理员下架）。**大厅查询条件是 `deleted_at IS NULL AND status = 'open'`**（见 `PostService.listPosts` 的 Specification）。
- `orders`：无 `deleted_at`，靠 `status` 生命周期。
- 直接 SQL 查询/清理时，记得带上这些条件，否则会查到已删/已下架数据。

### 7.5 金额与精度
`BigDecimal` 列（`balance`/`amount`/`reward_value`/`credit_score`/`publisher_credit`/`resolution_amount_to_earner`）在 MySQL 用 `DECIMAL`。Hibernate 默认 `DECIMAL(38,2)`。
- `validate` **不校验精度细节**，所以精度可自定义。建议：金额类 `DECIMAL(10,2)`，信用分 `DECIMAL(3,1)`（0.0–10.0，一位小数）。
- **不要用浮点 `FLOAT`/`DOUBLE` 存金额**，会有精度丢失。

### 7.6 BOOLEAN 列
Hibernate 对 MySQL 把 `Boolean` 映射成 `BIT(1)`（不同版本/驱动也可能用 `TINYINT(1)`）。建表时 `BOOLEAN`（MySQL 内部即 `TINYINT(1)`）或 `BIT(1)` 都能通过 `validate`。统一用 `BOOLEAN` 可读性更好。

### 7.7 无外键约束
所有关联都是裸列，DB 层无 FK。如果数据库设计要加外键：
- 注意 `users`/`tasks` 是软删除（`deleted_at`），加 FK 后**不能物理删**，否则子表孤儿。
- `conversations.id` 是客户端生成的字符串，`orders.chat_id` 引用它——加 FK 要保证会话先于订单创建。
- 加 FK 会牺牲写入灵活性，建议**仅加索引不加约束**（见第 8 节）。

---

## 8. 索引建议

基于后端实际查询模式（见各 Service 的 Specification / Repository 方法）：

| 表 | 建议索引 | 依据 |
|---|---|---|
| `tasks` | `(status, deleted_at, publish_time)`、`(publisher_side)`、`(category)`、`(publisher_id)` | 大厅列表：`deleted_at IS NULL AND status='open'` + side/category 过滤 + publish_time 排序 |
| `orders` | `(payer_id, status)`、`(earner_id, status)`、`(post_id)`、`(chat_id)` | "我的订单"按 payer/earner + status 检索 |
| `transactions` | `(user_id, created_at)` | 用户账单按时间倒序 |
| `chat_messages` | `(chat_id, time)` | 会话内消息分页 |
| `conversations` | `(user1_id)`、`(user2_id)` | 用户会话列表 |
| `reviews` | `(to_user_id)` | 信用分按被评价者聚合 |
| `reports` | `(post_id, status)` | 管理员按帖子查 pending 举报 |

---

## 9. 数据初始化

### 9.1 dev/local（H2）
`DataInitializer`（`@Profile("!prod")`）在启动时注入种子数据：8 个普通用户 + 1 个管理员（admin/1）、22 个帖子、6 个订单、8 条流水、6 个会话、19 条消息、若干评价。
- 幂等：开头检查 `userRepository.count() > 0` 则跳过，**不会重复注入**。
- 但 H2 是内存库，**每次重启都清空重建**，所以每次启动都会重新注入。

### 9.2 prod
`@Profile("!prod")` 保证 `DataInitializer` 在 prod **不运行**——prod 库**没有任何种子数据**，需要自行准备（至少要有一个管理员账号，否则无法登录管理端）。

建议 prod 初始化最小数据：
```sql
-- 密码哈希需用后端 BCrypt 算出（明文 "1" 的哈希），不要手写
INSERT INTO users (username, phone, email, password_hash, credit_score, auth_status, role, balance, created_at, updated_at)
VALUES ('admin', '13800000000', 'admin@example.com', '<BCrypt哈希>', 5.0, 1, 1, 0, NOW(), NOW());
```
> `password_hash` 必须是 BCrypt 哈希。最简单：先在 dev 注册一个账号，从 H2 console 复制其 `password_hash`，或写个临时接口生成。

### 9.3 种子数据里的图片是外链
`DataInitializer` 里 `images` 用的是 `https://picsum.photos/...` 外链（旧格式）。prod 部署后若服务器无外网或 picsum 被墙，这些种子帖的图显示不出来——属于正常现象，不影响功能。

---

## 10. 数据库开发规范

### 10.1 加新表
1. 后端新建 Entity（`@Entity @Table(name="xxx")`），字段加 `@Column`；
2. dev 启动（`ddl-auto=update`）自动建出 H2 表，验证字段；
3. prod 手写对应 `CREATE TABLE` DDL（参考第 6.4 节导出基准）；
4. DDL 与 Entity 必须一致。

### 10.2 加新列
1. Entity 加字段；
2. dev 自动加列；
3. prod 执行 `ALTER TABLE ... ADD COLUMN ...`。
- 新列尽量允许 NULL 或给默认值，避免与存量数据冲突。
- 注意 `@PrePersist` 里给新字段兜底赋值。

### 10.3 改列类型/长度
**`ddl-auto=update` 不改类型**。流程：
1. prod 执行 `ALTER TABLE ... MODIFY COLUMN ...`；
2. 同步改 Entity 的 `@Column(columnDefinition=...)` / `length`；
3. 验证 prod `validate` 通过。

### 10.4 删列
Hibernate 不会删列。若确需删：
1. 确认无代码引用（包括 `@Deprecated` 的）；
2. prod `ALTER TABLE ... DROP COLUMN ...`；
3. 从 Entity 删字段；
4. **谨慎**：`validate` 模式下，Entity 没有但 DB 有的列不报错（多余列被忽略），但 Entity 有而 DB 没有的列会报错。所以删 DB 列前先删 Entity 字段。

### 10.5 迁移脚本管理
项目目前**没有迁移工具**（无 Flyway/Liquibase）。建议数据库同学：
- 在仓库建 `db/migrations/` 目录，按 `V001__init.sql`、`V002__images_longtext.sql` 命名积累 DDL；
- 每次 prod 结构变更写一个新版本脚本，团队评审后执行；
- 长远可引入 Flyway（Spring Boot 原生支持），把 `ddl-auto` 设为 `validate`，由 Flyway 管理全部 schema。

---

## 11. 检查清单（prod 上线前）

- [ ] MySQL 库 `campus_task_hub` 已创建，字符集 `utf8mb4`、排序规则 `utf8mb4_unicode_ci`
- [ ] 8 张表全部建好，列名/类型与本文档一致
- [ ] `tasks.images`、`reviews.images` 为 **LONGTEXT**（不是 TEXT）
- [ ] `@Deprecated` 废弃列（`tasks.type`/`taker_id`/`taker_name`/`payment_status`/`publisher_confirmed`/`taker_confirmed`）已保留
- [ ] `users`/`tasks`/`orders` 有 `version` 列
- [ ] `conversations.id` 为 `VARCHAR(100)` 主键、非自增
- [ ] 第 8 节建议的索引已加
- [ ] 至少一个管理员账号已插入（`role=1`）
- [ ] `application-prod.yml` 数据源 URL/用户名/密码已改为实际值，`useSSL=true`
- [ ] 用 `--spring.profiles.active=prod` 启动，`validate` 不报错
- [ ] 用一个带图帖子测试发布+详情+大厅列表，确认图片正常（验证 LONGTEXT 生效）

---

## 附：相关代码位置速查

| 关注点 | 文件 |
|---|---|
| 表结构定义 | `src/main/java/com/example/keshe_backend/*/entity/*.java` |
| 图片写入（拼 JSON） | `post/service/PostService.java` → `toImageJsonArray` / `esc` |
| 图片读取（解析 JSON） | `post/dto/PostDTO.java` → `parseImages` / `ImageItem` |
| 缩略图生成 | `common/util/ImageUtil.java` → `toFullAndThumb` |
| 种子数据 | `common/data/DataInitializer.java` |
| 大厅查询条件 | `post/service/PostService.java` → `listPosts`（Specification） |
| 数据源/DDL 配置 | `src/main/resources/application*.properties` / `*.yml` |
