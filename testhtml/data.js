// @ts-check
/**
 * 等价类数据生成器：为每个等价类产出 N 个「同属该类、但取值不同」的输入样本。
 * 每类默认 50 个（可用环境变量 N_PER_CLASS 覆盖，便于快速冒烟）。
 * 生成器都把「边界值」放在数组第 0 位，保证每类至少含一个边界用例。
 */

const N = Math.max(1, Number(process.env.N_PER_CLASS || 50));

const pad = (num, len) => String(Math.abs(num)).padStart(len, '0').slice(-len);
const range = (n = N) => Array.from({ length: n }, (_, i) => i);

// 展示用：把不可见字符转成可读标签，供测试标题使用
function label(v) {
  if (v === '') return '<空串>';
  const s = String(v)
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t')
    .replace(/　/g, '<全角空格>');
  return s.length > 24 ? s.slice(0, 24) + '…' : s;
}

/* ============ 通用：空白/空输入类（trim 后皆为空，属同一等价类）============ */
function blanks(n = N) {
  const units = ['', ' ', '\t', '\n', '\r', '　', '  ', ' \t ', '\t\t', '   ', '\n ', ' 　'];
  const out = range(n).map((i) => units[i % units.length].repeat(1 + (i % 3)));
  out[0] = ''; // 边界：纯空串
  return out;
}

/* ============ 手机号相关等价类 ============ */
// 有效：^1\d{10}$（11 位，1 开头）
function validPhones(n = N) {
  return range(n).map((i) => '1' + pad(3000000000 + i * 7, 10));
}
// 无效·长度过短（10 位，边界）
function shortPhones(n = N) {
  const out = range(n).map((i) => '1' + pad(300000000 + i * 3, 9)); // 1+9=10 位
  return out;
}
// 无效·长度过长（12 位，边界）
function longPhones(n = N) {
  return range(n).map((i) => '1' + pad(30000000000 + i * 13, 11)); // 1+11=12 位
}
// 无效·含字母
function letterPhones(n = N) {
  const letters = 'abcdefghijklmnopqrstuvwxyz';
  return range(n).map((i) => {
    const base = ('1' + pad(3000000000 + i, 10)).split('');
    const pos = 1 + (i % 9); // 不动首位
    base[pos] = letters[i % letters.length];
    return base.join('');
  });
}
// 无效·首位非 1（11 位，但以 2~9 开头）
function firstNotOnePhones(n = N) {
  return range(n).map((i) => String(2 + (i % 8)) + pad(3000000000 + i, 10));
}
// 无效·含特殊符号
function specialPhones(n = N) {
  const specials = '#@$%&*!?.-_ /+';
  return range(n).map((i) => {
    const base = ('1' + pad(3000000000 + i, 10)).split('');
    base[2 + (i % 8)] = specials[i % specials.length];
    return base.join('');
  });
}

/* ============ 邮箱相关等价类 ============ */
// 有效
function validEmails(n = N) {
  const doms = ['edu.cn', 'tongji.edu.cn', 'example.com', 'qq.com', '163.com'];
  return range(n).map((i) => `user${i}@mail${i}.${doms[i % doms.length]}`);
}
// 无效·缺 @
function noAtEmails(n = N) {
  return range(n).map((i) => `user${i}.mail${i}.example.com`);
}
// 无效·有 @ 但无域名后缀点
function noDotEmails(n = N) {
  return range(n).map((i) => `user${i}@examplemail${i}`);
}
// 无效·连续 @（结构非法）
function doubleAtEmails(n = N) {
  return range(n).map((i) => `a${i}@@b${i}.com`);
}

/* ============ 密码相关等价类 ============ */
// 有效·长度 >=6（含边界 6；覆盖 6~20）
function validPasswords(n = N) {
  const out = range(n).map((i) => {
    const len = 6 + (i % 15); // 6~20
    return ('Pw' + i).padEnd(len, 'x').slice(0, len);
  });
  out[0] = 'abc123'; // 边界：正好 6 位
  return out;
}
// 无效·长度 <6（含边界 5；覆盖 1~5）
function shortPasswords(n = N) {
  const out = range(n).map((i) => {
    const len = 1 + (i % 5); // 1~5
    return ('a' + i).slice(0, len).padEnd(len, 'z');
  });
  out[0] = 'abcde'; // 边界：正好 5 位（差 1 位）
  return out;
}

/* ============ 充值金额相关等价类 ============ */
// 无效·<=0（含边界 0）
function zeroOrNegative(n = N) {
  const out = range(n).map((i) => String(-(i + 1)));
  out[0] = '0';        // 边界：0
  out[1] = '-0.01';    // 边界：刚小于 0
  return out;
}
// 无效·非数字（Number() 得 NaN）
function nonNumbers(n = N) {
  const bases = ['abc', '10元', '5o', '$$$', '一百', '12,345', 'NaN', '1e', '++5', '  x  ', '10 20', '#100'];
  return range(n).map((i) => bases[i % bases.length] + (i >= bases.length ? i : ''));
}
// 无效·超过上限 100000（含边界 100000.01；均保留 <=2 位小数，命中「不能超过」）
function overLimitAmounts(n = N) {
  const out = range(n).map((i) => String(100001 + i * 137));
  out[0] = '100000.01'; // 边界：刚超上限
  return out;
}
// 无效·小数位 >2（在合法金额区间内，命中「两位小数」）
function tooManyDecimals(n = N) {
  const out = range(n).map((i) => {
    const intPart = 1 + (i % 9000);
    const frac = String(101 + i).slice(0, 3).padStart(3, '0'); // 3 位小数
    return `${intPart}.${frac}`;
  });
  out[0] = '0.011'; // 边界：最小金额附近的 3 位小数
  return out;
}
// 有效·普通金额（0.01 < x < 100000，<=2 位小数）——破坏性：真实充值
function validAmounts(n = N) {
  const out = range(n).map((i) => String((1 + i) + (i % 2 ? '.50' : '')));
  out[0] = '0.01';   // 边界：下限
  out[1] = '100000'; // 边界：上限
  return out;
}

/* ============ 唯一注册资料（用于会落库的「注册成功」破坏性用例）============ */
let seq = 0;
function uniqueCredsList(n = N) {
  return range(n).map(() => {
    seq += 1;
    const stamp = String(Date.now()) + seq;
    return {
      username: 'pwtest_' + stamp,
      phone: '1' + pad(3900000000 + seq, 10),
      email: 'pwtest_' + stamp + '@test.edu.cn',
      password: 'pass123',
    };
  });
}

module.exports = {
  N,
  label,
  range,
  blanks,
  validPhones,
  shortPhones,
  longPhones,
  letterPhones,
  firstNotOnePhones,
  specialPhones,
  validEmails,
  noAtEmails,
  noDotEmails,
  doubleAtEmails,
  validPasswords,
  shortPasswords,
  zeroOrNegative,
  nonNumbers,
  overLimitAmounts,
  tooManyDecimals,
  validAmounts,
  uniqueCredsList,
};
