# 数据库脚本目录

本目录存放 `campus_task_hub` 的数据库 DDL 与种子数据脚本，与后端 `Keshe_backend` 同仓库（`back-end` 分支）同步演进。表结构的唯一真相是后端 Entity，详见仓库根 `DATABASE.md`。

## 目录结构

```
db/
  schema.sql          全量建表脚本（首次建库直接执行，幂等）
  migrations/         增量结构变更脚本（V00X__描述.sql 命名积累）
  seed/               种子数据
    admin.sql         生产环境管理员账号（首次部署执行）
```

## 核心原则

**Entity 是表结构的唯一真相**。任何 DDL 改动必须与对应 Entity 同步：

- 加列：Entity 加字段 + `migrations/` 加 `ALTER TABLE ... ADD COLUMN`
- 改类型：Entity 改 `@Column(columnDefinition=...)` + `migrations/` 加 `ALTER TABLE ... MODIFY COLUMN`
- prod 用 `ddl-auto=validate` 只校验不建表，列名/类型不一致会启动失败

## 首次建库（本地 MySQL）

```bash
# 1. 建库 + 建表（schema.sql 含 CREATE DATABASE IF NOT EXISTS，幂等）
mysql -uroot -p < db/schema.sql

# 2. 验证表结构（确认 images 是 longtext、credit_score 是 decimal(3,1)）
mysql -uroot -p campus_task_hub -e "SHOW TABLES; SHOW COLUMNS FROM tasks WHERE Field='images';"

# 3. 插入管理员（先编辑 seed/admin.sql 填入 BCrypt 哈希）
mysql -uroot -p campus_task_hub < db/seed/admin.sql
```

## 与 dev（H2）的关系

dev 用 H2 内存库 + `ddl-auto=update` 自动建表，**不读本目录脚本**。本目录仅服务于 prod（MySQL）。两边的表结构通过对齐 Entity 保持一致。

## prod 启动验证

```bash
./mvnw spring-boot:run -Dspring-boot.run.profiles=prod
```

启动日志无 `Schema-validation` 报错即通过。注意：`application-prod.yml` 默认 `useSSL=true&requireSSL=true`，本地 MySQL 若未配 SSL 需临时改为 `useSSL=false`，否则连不上。

## 后续结构变更

每次 prod 结构变更，在 `migrations/` 下新增 `V00X__描述.sql`（如 `V002__add_user_field.sql`），内容为 `ALTER TABLE ...`。团队评审后执行，并同步改 Entity。长远可引入 Flyway 统一管理。
