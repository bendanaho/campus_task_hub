# 数据库迁移脚本

按 `V00X__描述.sql` 命名积累增量 DDL 变更（如 `V002__add_user_field.sql`）。

## 规则

- 每次结构变更新增一个版本脚本，**不修改已执行的历史脚本**
- 内容为 `ALTER TABLE ...` 等增量语句
- 同步修改对应 Entity 的 `@Column` 注解（详见根 `DATABASE.md` 第 10 节）
- prod 执行前先在本地 MySQL 验证

## 当前状态

`V001` 即首次建库，由 `db/schema.sql` 全量脚本承担，无需单独迁移脚本。后续变更从 `V002` 开始。
