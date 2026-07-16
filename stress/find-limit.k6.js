// @ts-nocheck
/**
 * 校园互助平台 · 服务器极限压测（k6）
 * 目标机：http://182.92.133.163:8081（阿里云 2 核 2GiB）
 *
 * 思路：阶梯式加压。每个「档位」用恒定到达率(constant-arrival-rate, 开放模型)压 STEP_SEC 秒，
 *       并打上标签 {rps:xxxx}。汇总里逐档列出 p95/p99 延迟、错误率、实际达成吞吐、超时丢弃数。
 *       —— 当某一档 p95 陡增、错误率上升、或实际吞吐追不上目标(出现 dropped_iterations)，
 *          该档的目标 RPS 就是当前场景下服务器的极限。
 *
 * 场景(环境变量 SCENARIO)：
 *   static  GET /                       —— Nginx 静态/网络上限（响应最小）
 *   read    GET /api/posts             —— DB 读 + 145KB JSON 序列化/传输
 *   login   POST /api/login            —— bcrypt 校验，CPU 密集，最能压垮 2 核（默认）
 *   browse  混合(60%静态/30%读/10%登录) —— 贴近真实用户
 *
 * 可调环境变量：
 *   SCENARIO=login|read|static|browse
 *   RATES=5,10,20,40,80        自定义阶梯(逗号分隔的目标 RPS)，覆盖默认
 *   STEP_SEC=30                每档持续秒数
 *   BASE=http://182.92.133.163:8081
 */
import http from 'k6/http';
import { check } from 'k6';

const BASE = __ENV.BASE || 'http://182.92.133.163:8081';
const SCEN = (__ENV.SCENARIO || 'login').toLowerCase();
const STEP_SEC = Number(__ENV.STEP_SEC || 30);
const GAP_SEC = 5; // 档位之间留 5s 让服务器喘息，避免上一档余波干扰下一档

// 每个场景的默认加压阶梯（依据单请求基线：静态~85ms / 读~240ms / 登录~230ms 设定）
const LADDERS = {
  static: [100, 200, 400, 600, 800, 1000, 1200],
  read: [10, 25, 50, 75, 100, 150, 200],
  login: [5, 10, 20, 30, 40, 60, 80],
  browse: [20, 40, 60, 80, 120, 160, 200],
};
const RATES = (__ENV.RATES ? __ENV.RATES.split(',') : LADDERS[SCEN] || LADDERS.browse).map(Number);

const tag = (r) => String(r).padStart(4, '0');

// 动态生成「阶梯」场景与逐档阈值
const scenarios = {};
const thresholds = {
  // 全局兜底阈值：整体错误率与 p95（仅作参考，不代表逐档）
  http_req_failed: ['rate<0.05'],
};
let start = 0;
for (const r of RATES) {
  const tg = tag(r);
  scenarios['r' + tg] = {
    executor: 'constant-arrival-rate',
    rate: r,
    timeUnit: '1s',
    duration: STEP_SEC + 's',
    preAllocatedVUs: Math.min(600, Math.max(20, r * 3)),
    maxVUs: Math.min(2000, Math.max(50, r * 20)),
    startTime: start + 's',
    exec: 'hit',
    tags: { rps: tg },
  };
  // 为每档建立子指标（同时作为“是否劣化”的判定线）
  thresholds[`http_req_duration{rps:${tg}}`] = [{ threshold: 'p(95)<1500', abortOnFail: false }];
  thresholds[`http_req_failed{rps:${tg}}`] = [{ threshold: 'rate<0.02', abortOnFail: false }];
  thresholds[`http_reqs{rps:${tg}}`] = ['count>=0']; // 仅为暴露逐档计数
  start += STEP_SEC + GAP_SEC;
}

export const options = {
  scenarios,
  thresholds,
  // 输出更干净的摘要
  summaryTrendStats: ['avg', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],
  discardResponseBodies: SCEN === 'static' || SCEN === 'read', // 大响应不留 body，减轻客户端内存
};

function doLogin() {
  return http.post(
    `${BASE}/api/login`,
    JSON.stringify({ account: 'penguin', password: 'pass123' }),
    { headers: { 'Content-Type': 'application/json' }, tags: { ep: 'login' } }
  );
}
function doRead() {
  return http.get(`${BASE}/api/posts?page=1&size=10`, { tags: { ep: 'read' } });
}
function doStatic() {
  return http.get(`${BASE}/`, { tags: { ep: 'static' } });
}

export function hit() {
  let res;
  if (SCEN === 'static') res = doStatic();
  else if (SCEN === 'read') res = doRead();
  else if (SCEN === 'login') res = doLogin();
  else {
    // browse：加权随机
    const x = Math.random();
    res = x < 0.6 ? doStatic() : x < 0.9 ? doRead() : doLogin();
  }
  check(res, { 'status 2xx': (r) => r.status >= 200 && r.status < 300 });
}

// ---- 汇总：写 JSON 到本地 + 打印逐档表格 ----
function num(v, d = 0) {
  return v === undefined || v === null ? '-' : Number(v).toFixed(d);
}
export function handleSummary(data) {
  const m = data.metrics;
  const lines = [];
  lines.push('');
  lines.push(`===== 压测汇总  场景=${SCEN}  每档=${STEP_SEC}s  目标机=${BASE} =====`);
  lines.push('目标RPS | 实际RPS | 成功率 | p95(ms) | p99(ms) | 最大(ms)');
  lines.push('--------|---------|--------|---------|---------|--------');
  for (const r of RATES) {
    const tg = tag(r);
    const dur = m[`http_req_duration{rps:${tg}}`];
    const fail = m[`http_req_failed{rps:${tg}}`];
    const reqs = m[`http_reqs{rps:${tg}}`];
    const actual = reqs ? reqs.values.count / STEP_SEC : undefined;
    const okRate = fail ? (1 - fail.values.rate) * 100 : undefined;
    lines.push(
      `${String(r).padStart(7)} | ${num(actual, 1).padStart(7)} | ${num(okRate, 1).padStart(5)}% | ` +
        `${num(dur && dur.values['p(95)']).padStart(7)} | ${num(dur && dur.values['p(99)']).padStart(7)} | ` +
        `${num(dur && dur.values.max).padStart(6)}`
    );
  }
  lines.push('--------');
  const dropped = m.dropped_iterations ? m.dropped_iterations.values.count : 0;
  lines.push(`整体：请求数=${num(m.http_reqs && m.http_reqs.values.count)}  ` +
    `整体错误率=${num(m.http_req_failed && m.http_req_failed.values.rate * 100, 2)}%  ` +
    `超时丢弃(dropped_iterations)=${dropped}`);
  lines.push('判读：某档「实际RPS 明显低于 目标RPS」或「p95 陡增/成功率下降」→ 上一档即为极限。');
  lines.push(`dropped_iterations>0 说明该到达率下服务器已无法及时消化请求（饱和）。`);
  lines.push('');

  const text = lines.join('\n');
  const out = {};
  out['stdout'] = text; // 控制台打印
  out[`summary_${SCEN}.json`] = JSON.stringify(data, null, 2); // 机读结果，存到 perf/ 本地
  return out;
}
