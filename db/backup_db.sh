#!/bin/bash
#
# 校园互助平台 —— 数据库每日全量备份
#
# 部署位置：/root/campus/backup_db.sh   由 crontab 每日 03:00 调用
# 凭据来源：/root/.my.cnf（权限 600，仅 root 可读）——脚本内不出现明文密码。
#           这台服务器与其他项目共用 root，命令行里带 -p<密码> 会明文出现在 ps
#           输出中，任何同机用户都能看到，故一律走配置文件。
#
# 恢复方法：
#   zcat /root/campus/backups/campus_task_hub_2026-07-16_030000.sql.gz | mysql campus_task_hub
#   （按时间点恢复见文末 PITR 说明）
#
set -uo pipefail

DB=campus_task_hub
BACKUP_DIR=/root/campus/backups
KEEP_DAYS=7                       # 保留最近 7 天，滚动删除更早的
TS=$(date +%F_%H%M%S)
OUT="$BACKUP_DIR/${DB}_${TS}.sql.gz"
LOG_PREFIX="[$(date '+%F %T')]"

mkdir -p "$BACKUP_DIR"

# --single-transaction：InnoDB 一致性快照，全程不锁表，线上读写不受影响
# --routines --triggers：存储过程/触发器一并导出
# --quick：逐行取，不把整表读进内存
if ! mysqldump --single-transaction --routines --triggers --quick "$DB" | gzip > "$OUT"; then
    echo "$LOG_PREFIX 备份失败：mysqldump 出错" >&2
    rm -f "$OUT"
    exit 1
fi

# 校验完整性：gzip 自检 + 必须有 mysqldump 的结束标记。
# 不校验的话，磁盘满/中途被杀会留下一个"看着像备份"的半截文件，
# 等真要恢复时才发现用不了 —— 那时已经晚了。
if ! gzip -t "$OUT" 2>/dev/null; then
    echo "$LOG_PREFIX 备份失败：gzip 文件损坏，已删除 $OUT" >&2
    rm -f "$OUT"
    exit 1
fi
if ! zcat "$OUT" | tail -5 | grep -q "Dump completed"; then
    echo "$LOG_PREFIX 备份失败：导出未正常结束（无 Dump completed 标记），已删除 $OUT" >&2
    rm -f "$OUT"
    exit 1
fi

# 滚动清理：只删本脚本自己产生的文件（限定文件名前缀 + maxdepth 1），
# 避免误伤同目录下的手工备份或别人的文件
find "$BACKUP_DIR" -maxdepth 1 -type f -name "${DB}_*.sql.gz" -mtime +${KEEP_DAYS} -delete

COUNT=$(find "$BACKUP_DIR" -maxdepth 1 -type f -name "${DB}_*.sql.gz" | wc -l)
echo "$LOG_PREFIX 备份成功：$OUT ($(du -h "$OUT" | cut -f1))，现存 ${COUNT} 份"

# ---------------------------------------------------------------------------
# 关于「异地副本」
#   本机只有一块盘（vda），且无对象存储凭据，服务器侧无法做到真正的异地副本。
#   目前所有备份都在同一块盘上 —— 磁盘损坏即全部丢失。可选补强：
#     1) 配好 OSS 后在此处追加：ossutil cp "$OUT" oss://<bucket>/campus/
#     2) 定期从本地机器拉走：
#        scp root@182.92.133.163:/root/campus/backups/*.sql.gz ./
#
# 关于 PITR（按时间点恢复）
#   本机 MySQL 已开启 binlog（log_bin=ON），故「最近一次全量备份 + binlog 重放」可行：
#     zcat <备份>.sql.gz | mysql campus_task_hub
#     mysqlbinlog --start-datetime="..." --stop-datetime="..." <binlog文件> | mysql campus_task_hub
# ---------------------------------------------------------------------------
