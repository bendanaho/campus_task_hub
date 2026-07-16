# 服务器极限压测（k6）

对自有阿里云服务器（**2 核 2GiB**，http://182.92.133.163:8081）做阶梯加压，找到吞吐极限。

## 为什么用 k6

- 单文件二进制，**不需要 Node**；脚本用 JS 写。
- 开放模型（constant-arrival-rate）：按目标 RPS 发压，不受服务器变慢影响，才能真正压出「膝点」。

## 安装（Windows，任选其一）

```powershell
winget install k6                      # 有 winget
choco install k6                       # 有 Chocolatey
scoop install k6                       # 有 Scoop
```
或直接下载：https://github.com/grafana/k6/releases 里的 `k6-vX-windows-amd64.zip`，
解压把 `k6.exe` 放到 PATH（或就放在本 `perf/` 目录里，用 `.\k6.exe` 调用）。

验证：`k6 version`

## 运行

```powershell
cd campus_task_hub-front-end-redesign/front-end/perf

# 默认 login 场景（bcrypt，最能压垮 2 核）——逐档 5→10→20→30→40→60→80 RPS
k6 run find-limit.k6.js

# 其它场景
$env:SCENARIO="static"; k6 run find-limit.k6.js   # Nginx 静态上限
$env:SCENARIO="read";   k6 run find-limit.k6.js   # DB 读 + 145KB 大响应
$env:SCENARIO="browse"; k6 run find-limit.k6.js   # 真实混合流量

# 自定义阶梯与每档时长
$env:SCENARIO="login"; $env:RATES="10,20,30,50,80,120"; $env:STEP_SEC="45"; k6 run find-limit.k6.js

# 同时导出时间序列（便于画曲线）
k6 run --out json=raw_login.json find-limit.k6.js
```

> 建议先跑一档小的确认联通：`$env:RATES="5"; $env:STEP_SEC="10"; k6 run find-limit.k6.js`

## 结果保存位置（本地 perf/）

- 控制台会打印**逐档表格**（目标RPS / 实际RPS / 成功率 / p95 / p99 / 最大延迟）。
- `perf/summary_<场景>.json` —— 完整机读结果（每次运行覆盖）。
- 加 `--out json=raw_xxx.json` 可另存逐请求时间序列。

## 怎么判读「极限」

看逐档表格，出现下列任一信号，**上一档的目标 RPS 就是极限**：

1. **实际RPS 追不上 目标RPS**（例如目标 60、实际只有 42）——服务器消化不过来。
2. **p95/p99 延迟陡增**（从几百 ms 跳到 1~数秒）。
3. **成功率下降**（开始出现 5xx / 超时 / 连接被拒）。
4. 汇总行 **`dropped_iterations > 0`**——k6 因响应太慢来不及发压，明确的饱和信号。

2 核 2GiB 上，一般 `login`（bcrypt）会最先到顶，是鉴权吞吐的真实天花板；`static` 最高。

## 重要注意事项

- **这是破坏性测试**：加压期间服务器可能变慢甚至短时无响应。请在**低峰期**跑，避免影响真实用户。跑完 k6 停止后会自动恢复。
- **客户端别成为瓶颈**：`read` 场景响应 145KB，从离服务器远/带宽小的机器压，先到顶的可能是**你本地的下行带宽**而不是服务器。想量纯服务器能力，优先用 `login`（响应仅 ~370B）与 `static`；若要最准，建议在**同区域再开一台阿里云 ECS** 上跑 k6。
- **数据副作用**：`login` 只读校验，不写库，安全；`static`/`read` 皆只读。本压测**不含**注册/发帖/充值等写操作，不会污染数据。
- **可能触发云安全策略**：阿里云的安全组/DDoS 基础防护/限流可能在高并发时介入，表现为连接被拒——那是防护层而非应用极限，需要的话在控制台确认。

## 建议的一次完整流程

```powershell
cd perf
$env:RATES="5"; $env:STEP_SEC="10"; k6 run find-limit.k6.js          # 1) 冒烟联通
Remove-Item Env:RATES; Remove-Item Env:STEP_SEC
$env:SCENARIO="static"; k6 run find-limit.k6.js                      # 2) 静态上限（基准）
$env:SCENARIO="login";  k6 run find-limit.k6.js                      # 3) 鉴权极限（CPU）
$env:SCENARIO="read";   k6 run find-limit.k6.js                      # 4) 读接口极限
$env:SCENARIO="browse"; k6 run find-limit.k6.js                      # 5) 混合真实流量
```
拿到各场景 `summary_*.json` 与控制台表格即可得出：静态/读/鉴权/混合 四条极限线。
