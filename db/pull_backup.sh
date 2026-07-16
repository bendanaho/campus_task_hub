#!/bin/bash
#
# 校园互助平台 —— 把服务器上的数据库备份拉到本地（异地副本）
#
# 为什么需要：服务器只有一块盘，所有备份都在上面，磁盘损坏即全部丢失。
#             拉到本地这台机器才算真正的"异地"。
#
# 认证：使用 ~/.ssh/campus_backup 专用密钥，无需密码。
#       该密钥在服务器上被 authorized_keys 的 command= 限制死，只能读取备份、
#       拿不到 shell（试图执行任何命令都只会返回备份数据）。
#
# 定期执行：由 Windows 计划任务每日 03:30 调用（服务器 03:00 备份完之后）。
#           手工执行也可以，直接跑这个脚本即可。
#
set -uo pipefail

HOST=root@182.92.133.163
KEY="$HOME/.ssh/campus_backup"
DEST_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
KEEP_DAYS=14                      # 本地留得比服务器(7天)久一些，多一层保险
TS=$(date +%F_%H%M%S)
OUT="$DEST_DIR/campus_task_hub_${TS}.sql.gz"
LOG="$DEST_DIR/pull.log"

log() { echo "[$(date '+%F %T')] $*" | tee -a "$LOG"; }

SSHOPT="-i $KEY -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null"
SSHOPT="$SSHOPT -o ConnectTimeout=30 -o IdentitiesOnly=yes -o BatchMode=yes"

# 服务器侧 authorized_keys 已把这把密钥锁定到 pull_backup.sh，
# 所以这里不用（也不能）指定命令，连上去就会吐出最新的那份备份。
if ! ssh $SSHOPT "$HOST" > "$OUT" 2>>"$LOG"; then
    log "拉取失败：SSH 连接或远端脚本出错"
    rm -f "$OUT"
    exit 1
fi

# 和服务器端同样的两道校验：光看文件大小不算数，
# 半截的 gz 平时看着正常，等真要恢复时才发现用不了。
if ! gzip -t "$OUT" 2>/dev/null; then
    log "拉取失败：gz 文件损坏，已删除 $(basename "$OUT")"
    rm -f "$OUT"
    exit 1
fi
if ! zcat "$OUT" | tail -5 | grep -q "Dump completed"; then
    log "拉取失败：备份内容不完整（无 Dump completed 标记），已删除 $(basename "$OUT")"
    rm -f "$OUT"
    exit 1
fi

# 与上一份内容相同则不重复留（服务器每天只备份一次，多跑几次不该堆一堆一样的文件）
PREV=$(ls -t "$DEST_DIR"/campus_task_hub_*.sql.gz 2>/dev/null | sed -n 2p)
if [ -n "$PREV" ] && cmp -s <(zcat "$OUT") <(zcat "$PREV"); then
    rm -f "$OUT"
    log "内容与上一份相同，跳过（服务器尚未产生新备份）"
    exit 0
fi

# 滚动清理：只删本脚本自己拉下来的文件
find "$DEST_DIR" -maxdepth 1 -type f -name "campus_task_hub_*.sql.gz" -mtime +${KEEP_DAYS} -delete

COUNT=$(find "$DEST_DIR" -maxdepth 1 -type f -name "campus_task_hub_*.sql.gz" | wc -l)
log "拉取成功：$(basename "$OUT") ($(du -h "$OUT" | cut -f1))，本地现存 ${COUNT} 份"
