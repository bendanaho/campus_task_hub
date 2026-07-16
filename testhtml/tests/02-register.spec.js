// @ts-check
// 模块 1.2 注册（数据驱动：每个等价类 N 条，默认 50）—— TC_REG_*
// 前端校验顺序：必填 -> 手机号^1\d{10}$ -> 邮箱(可选) -> 密码>=6 -> 两次一致 -> 后端唯一性。
// 有效字段类用「填到该步合法、在后一步(两次密码不一致)安全停下」验证，不落库。
// 唯一真正落库的是「注册成功」用例，默认跳过(需 RUN_MUTATING=1)。
const { test } = require('@playwright/test');
const { attachDialogs, expectDialog, mutatingTest } = require('../helpers');
const D = require('../data');

let dlg;
test.beforeEach(async ({ page }) => {
  dlg = attachDialogs(page);
  await page.goto('/register.html');
});

async function fillReg(page, { username = '', phone = '', email = '', password = '', confirm = '' }) {
  dlg.messages.length = 0;
  await page.fill('#registerUsername', username);
  await page.fill('#registerPhone', phone);
  await page.fill('#registerEmail', email);
  await page.fill('#registerPassword', password);
  await page.fill('#registerConfirmPassword', confirm);
  await page.click('#registerForm button[type="submit"]');
}
const uname = (i) => `u_${i}_${Date.now()}`;
const VALID_PHONE = '13800138000';

/* ============ 用户名 ============ */
// 有效[创建账号]（破坏性，默认跳过）
D.uniqueCredsList().forEach((c, i) => {
  mutatingTest(test)(`TC_REG_001 用户名-有效[创建] #${i + 1} -> 注册成功`, async ({ page }) => {
    await fillReg(page, { username: c.username, phone: c.phone, email: c.email, password: c.password, confirm: c.password });
    await expectDialog(dlg, '注册成功');
  });
});
// 无效·空（含边界空串）
D.blanks().forEach((v, i) => {
  test(`TC_REG_002 用户名-无效[空] #${i + 1}: "${D.label(v)}" -> 提示补全`, async ({ page }) => {
    await fillReg(page, { username: v, phone: VALID_PHONE, password: 'pass123', confirm: 'pass123' });
    await expectDialog(dlg, '请完整填写必填信息');
  });
});
// 无效·重复（penguin 已存在，后端拦截，不落库）
D.range().forEach((i) => {
  test(`TC_REG_003 用户名-无效[重复] #${i + 1}: penguin -> 已注册`, async ({ page }) => {
    await fillReg(page, { username: 'penguin', phone: D.validPhones()[i], password: 'pass123', confirm: 'pass123' });
    await expectDialog(dlg, '已注册');
  });
});

/* ============ 手机号（含长度双边界）============ */
// 有效（安全停在密码不一致）
D.validPhones().forEach((p, i) => {
  test(`TC_REG_004 手机号-有效 #${i + 1}: ${p} -> 通过手机校验`, async ({ page }) => {
    await fillReg(page, { username: uname(i), phone: p, password: 'pass123', confirm: 'pass999' });
    await expectDialog(dlg, '两次输入的密码不一致');
  });
});
// 无效·空
D.blanks().forEach((v, i) => {
  test(`TC_REG_005 手机号-无效[空] #${i + 1} -> 提示补全`, async ({ page }) => {
    await fillReg(page, { username: uname(i), phone: v, password: 'pass123', confirm: 'pass123' });
    await expectDialog(dlg, '请完整填写必填信息');
  });
});
// 无效·10 位过短（边界）
D.shortPhones().forEach((p, i) => {
  test(`TC_REG_006 手机号-无效[10位过短] #${i + 1}: ${p} -> 格式错误`, async ({ page }) => {
    await fillReg(page, { username: uname(i), phone: p, password: 'pass123', confirm: 'pass123' });
    await expectDialog(dlg, '请输入正确的 11 位手机号');
  });
});
// 无效·12 位过长（边界）
D.longPhones().forEach((p, i) => {
  test(`TC_REG_007 手机号-无效[12位过长] #${i + 1}: ${p} -> 格式错误`, async ({ page }) => {
    await fillReg(page, { username: uname(i), phone: p, password: 'pass123', confirm: 'pass123' });
    await expectDialog(dlg, '请输入正确的 11 位手机号');
  });
});
// 无效·含字母
D.letterPhones().forEach((p, i) => {
  test(`TC_REG_008 手机号-无效[含字母] #${i + 1}: ${p} -> 格式错误`, async ({ page }) => {
    await fillReg(page, { username: uname(i), phone: p, password: 'pass123', confirm: 'pass123' });
    await expectDialog(dlg, '请输入正确的 11 位手机号');
  });
});
// 无效·首位非 1
D.firstNotOnePhones().forEach((p, i) => {
  test(`TC_REG_009 手机号-无效[首位非1] #${i + 1}: ${p} -> 格式错误`, async ({ page }) => {
    await fillReg(page, { username: uname(i), phone: p, password: 'pass123', confirm: 'pass123' });
    await expectDialog(dlg, '请输入正确的 11 位手机号');
  });
});
// 无效·含特殊符号
D.specialPhones().forEach((p, i) => {
  test(`TC_REG_010 手机号-无效[特殊符号] #${i + 1}: ${D.label(p)} -> 格式错误`, async ({ page }) => {
    await fillReg(page, { username: uname(i), phone: p, password: 'pass123', confirm: 'pass123' });
    await expectDialog(dlg, '请输入正确的 11 位手机号');
  });
});

/* ============ 邮箱（可选）============ */
// 有效·合法邮箱（安全停在密码不一致）
D.validEmails().forEach((e, i) => {
  test(`TC_REG_011 邮箱-有效 #${i + 1}: ${e} -> 通过邮箱校验`, async ({ page }) => {
    await fillReg(page, { username: uname(i), phone: VALID_PHONE, email: e, password: 'pass123', confirm: 'pass999' });
    await expectDialog(dlg, '两次输入的密码不一致');
  });
});
// 无效·缺 @
D.noAtEmails().forEach((e, i) => {
  test(`TC_REG_012 邮箱-无效[缺@] #${i + 1}: ${e} -> 邮箱格式错误`, async ({ page }) => {
    await fillReg(page, { username: uname(i), phone: VALID_PHONE, email: e, password: 'pass123', confirm: 'pass123' });
    await expectDialog(dlg, '请输入正确的邮箱地址');
  });
});
// 无效·缺域名后缀点
D.noDotEmails().forEach((e, i) => {
  test(`TC_REG_013 邮箱-无效[缺后缀点] #${i + 1}: ${e} -> 邮箱格式错误`, async ({ page }) => {
    await fillReg(page, { username: uname(i), phone: VALID_PHONE, email: e, password: 'pass123', confirm: 'pass123' });
    await expectDialog(dlg, '请输入正确的邮箱地址');
  });
});
// 无效·连续 @
D.doubleAtEmails().forEach((e, i) => {
  test(`TC_REG_014 邮箱-无效[双@] #${i + 1}: ${e} -> 邮箱格式错误`, async ({ page }) => {
    await fillReg(page, { username: uname(i), phone: VALID_PHONE, email: e, password: 'pass123', confirm: 'pass123' });
    await expectDialog(dlg, '请输入正确的邮箱地址');
  });
});

/* ============ 密码 / 确认密码（含长度边界 5/6）============ */
// 有效·>=6（安全停在密码不一致，证明长度通过）
D.validPasswords().forEach((pw, i) => {
  test(`TC_REG_015 密码-有效[>=6] #${i + 1}: 长度${pw.length} -> 通过长度校验`, async ({ page }) => {
    await fillReg(page, { username: uname(i), phone: VALID_PHONE, password: pw, confirm: pw + 'DIFF' });
    await expectDialog(dlg, '两次输入的密码不一致');
  });
});
// 无效·<6（边界 5）
D.shortPasswords().forEach((pw, i) => {
  test(`TC_REG_016 密码-无效[<6] #${i + 1}: 长度${pw.length} -> 长度不足`, async ({ page }) => {
    await fillReg(page, { username: uname(i), phone: VALID_PHONE, password: pw, confirm: pw });
    await expectDialog(dlg, '密码长度不能少于 6 位');
  });
});
// 无效·两次不一致
D.range().forEach((i) => {
  test(`TC_REG_017 确认密码-无效[不一致] #${i + 1} -> 提示不一致`, async ({ page }) => {
    await fillReg(page, { username: uname(i), phone: VALID_PHONE, password: `pass${i}12`, confirm: `pass${i}99` });
    await expectDialog(dlg, '两次输入的密码不一致');
  });
});
// 无效·确认密码为空（命中必填）
D.range().forEach((i) => {
  test(`TC_REG_018 确认密码-无效[空] #${i + 1} -> 提示补全`, async ({ page }) => {
    await fillReg(page, { username: uname(i), phone: VALID_PHONE, password: 'pass123', confirm: '' });
    await expectDialog(dlg, '请完整填写必填信息');
  });
});
