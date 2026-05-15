# Campus Task Hub 校园任务平台

基于 Spring Boot + MyBatis + MySQL 的校园互助任务平台后端服务。提供用户认证、任务发布与接单、即时聊天、评价举报等完整的校园任务撮合功能。

---

## 技术栈

| 技术 | 版本/说明 |
|------|----------|
| Java | 17 |
| Spring Boot | 3.5.14 |
| Spring Security | 安全框架（JWT 认证 + BCrypt 加密） |
| MyBatis | 3.0.5（持久层框架） |
| MySQL | 8.0 |
| JWT | 0.12.6（Token 认证） |
| WebSocket | 即时聊天 |
| Lombok | 简化代码 |
| Maven | 构建工具 |

---

## 数据库设计

数据库名：`campus_task_hub`（字符集：`utf8mb4`）

共 **9 张表**，关系如下：

| 表名 | 说明 | 核心字段 |
|------|------|----------|
| `users` | 用户表 | 用户名、手机号、密码、头像、学号、学校、信用分、角色(user/admin) |
| `task_categories` | 任务分类表 | 分类名称、图标、排序 |
| `tasks` | 任务表 | 标题、描述、分类、发布者、接单者、赏金、状态、截止时间、地点 |
| `task_applications` | 任务申请表 | 任务ID、申请者、留言、申请状态 |
| `reviews` | 评价表 | 任务ID、评价者、被评价者、评分(1-5)、内容 |
| `notifications` | 消息通知表 | 接收者、类型、标题、内容、是否已读 |
| `chat_messages` | 聊天消息表 | 发送者、接收者、内容、消息类型、是否已读 |
| `reports` | 举报表 | 举报者、目标类型、目标ID、原因、处理状态 |
| `favorites` | 收藏表 | 用户ID、任务ID（联合唯一） |

### 初始数据

`schema.sql` 已预置 6 个默认任务分类：

1. 快递代取
2. 外卖代拿
3. 学习辅导
4. 跑腿代办
5. 二手交易
6. 其他

---

## 项目目录结构

```
campus_task_hub/
├── Readme.md              # 本文档
├── schema.sql             # 数据库初始化脚本
├── database/              # 后端项目根目录（Maven 项目）
│   ├── pom.xml
│   └── src/
│       └── main/
│           ├── java/com/campus/taskhub/
│           │   ├── TaskHubApplication.java      # 启动类
│           │   ├── common/                      # 通用封装（统一返回、全局异常）
│           │   ├── config/                      # 配置类（Security 等）
│           │   ├── controller/                  # 控制器层（Auth、User、Test）
│           │   ├── service/                     # 服务层接口
│           │   ├── impl/                        # 服务层实现
│           │   ├── mapper/                      # MyBatis Mapper 接口
│           │   ├── entity/                      # 实体类
│           │   └── dto/                         # 数据传输对象
│           └── resources/
│               ├── application.yml              # 主配置（无敏感信息）
│               ├── application-local.yml        # 本地开发配置（已加入 .gitignore）
│               └── mapper/                      # MyBatis XML 映射文件
```

---

## 环境准备

1. **JDK 17** 或以上
2. **Maven 3.8+**
3. **MySQL 8.0** 并确保服务已启动
4. **IDE**（推荐 IntelliJ IDEA）

---

## 快速开始

### 1. 初始化数据库

在 MySQL 中执行项目根目录下的 `schema.sql`，创建数据库和表结构：

```bash
# 方式一：命令行
mysql -u root -p < schema.sql

# 方式二：使用 MySQL 客户端工具（如 Navicat、DataGrip）导入执行
```

> 脚本会自动创建 `campus_task_hub` 数据库、9 张表及初始分类数据。

### 2. 进入后端项目目录

```bash
cd database
```

### 3. 配置本地开发环境

**重要**：`application.yml` 中的数据库密码、JWT 密钥等敏感信息已提取为环境变量，**不要**在 `application.yml` 中直接填写密码。

#### 方式 A：创建本地配置文件（推荐）

在 `database/src/main/resources/` 下创建 `application-local.yml`（该文件已被 `.gitignore` 忽略，不会提交到仓库）：

```yaml
spring:
  datasource:
    username: campus_user      # 你的本地数据库用户名
    password: your_password    # 你的本地数据库密码

jwt:
  secret: your_jwt_secret_key  # 本地开发用的 JWT 密钥（长度建议 ≥32 字符）
```

#### 方式 B：使用环境变量

在 IDEA 的 **Run/Debug Configurations → Environment variables** 中添加：

```
DB_USERNAME=campus_user;DB_PASSWORD=your_password;JWT_SECRET=your_jwt_secret_key
```

### 4. 启动项目

#### 方式 A：IDEA 中启动（推荐）

1. 打开 `database` 文件夹作为 Maven 项目
2. 等待 Maven 依赖下载完成
3. 打开 `TaskHubApplication.java`
4. 点击运行按钮（确保 **Active profiles** 设置为 `local`，若使用方式 A 配置）

#### 方式 B：命令行启动

```bash
# 先编译打包
mvn clean package -DskipTests

# 本地环境启动（激活 local 配置）
java -jar -Dspring.profiles.active=local target/task-hub-0.0.1-SNAPSHOT.jar

# 或通过 Maven 插件启动
mvn spring-boot:run -Dspring-boot.run.profiles=local
```

### 5. 验证启动

项目默认运行在 **8080** 端口，接口统一前缀为 `/api`。

访问健康检查接口：

```bash
curl http://localhost:8080/api/test
```

若返回：

```json
{
  "code": 200,
  "message": "success",
  "data": "后端项目启动成功"
}
```

表示服务启动成功。

---

## 配置说明

### `application.yml`（仓库版本）

- 存放**通用、非敏感**配置
- 数据库连接 URL、用户名、密码、JWT 密钥等均使用 `${}` 环境变量占位
- **生产环境**通过服务器环境变量注入真实值

### `application-local.yml`（本地开发）

- 存放**本地开发**用的真实数据库密码和 JWT 密钥
- 已加入 `.gitignore`，**不会被提交到 Git**
- 每个开发人员自行维护，互不影响

### 常用环境变量

| 变量名 | 说明 | 示例 |
|--------|------|------|
| `DB_URL` | 数据库连接地址（带参数） | `jdbc:mysql://localhost:3306/campus_task_hub?...` |
| `DB_USERNAME` | 数据库用户名 | `campus_user` |
| `DB_PASSWORD` | 数据库密码 | `your_password` |
| `JWT_SECRET` | JWT 签名密钥 | `CampusTaskHubSecretKeyForJWT2025VeryLongSecureKey` |

---

## API 基础信息

- **Base URL**：`http://localhost:8080/api`
- **统一返回格式**：

```json
{
  "code": 200,
  "message": "success",
  "data": {}
}
```

- **认证方式**：登录后获取 JWT Token，在请求头中携带：`Authorization: Bearer <token>`

---

## 开发注意事项

1. **不要提交本地配置**：`application-local.yml` 已加入 `.gitignore，请勿手动将其加入 Git。
2. **密码加密**：用户密码在存入数据库前已通过 `BCryptPasswordEncoder` 加密，数据库中存储的是哈希值。
3. **Mapper 扫描**：启动类已配置 `@MapperScan("com.campus.taskhub.mapper")`，新增 Mapper 接口时无需额外注解。
4. **MyBatis XML**：SQL 映射文件统一放在 `src/main/resources/mapper/` 目录下。
5. **时区设置**：数据库连接已指定 `serverTimezone=Asia/Shanghai`，Jackson 序列化也统一为 `Asia/Shanghai` 时区。

---

## 技术问题排查

| 问题 | 解决方案 |
|------|----------|
| 启动报错 `Access denied for user` | 检查 `application-local.yml` 中的数据库用户名和密码是否正确 |
| 启动报错 `Unknown database` | 先执行 `schema.sql` 初始化数据库 |
| 接口返回 401/403 | 检查是否携带了有效的 JWT Token，或 Security 配置是否放行了该接口 |
| Maven 依赖下载慢 | 更换 Maven 镜像源（如阿里云镜像） |

---

## 相关文档

- [Spring Boot 官方文档](https://spring.io/projects/spring-boot)
- [MyBatis Spring Boot Starter](https://mybatis.org/spring-boot-starter/)
- [Spring Security 参考文档](https://docs.spring.io/spring-security/reference/)
