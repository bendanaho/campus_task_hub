// @ts-check
// 模块 1.1 登录（数据驱动：每个等价类 N 条，默认 50）—— TC_LOG_*
// 登录仅 account/password 两字段，账号通用、不做格式校验；反馈走 alert()。
const { test } = require('@playwright/test');
const { ACCOUNT, attachDialogs, expectDialog } = require('../helpers');
const D = require('../data');

let dlg;
test.beforeEach(async ({ page }) => {
  dlg = attachDialogs(page);
  await page.goto('/login.html');
});

async function submit(page, account, password) {
  dlg.messages.length = 0;
  await page.fill('#loginAccount', account);
  await page.fill('#loginPassword', password);
  await page.click('#loginForm button[type="submit"]');
}

// ---- 账号：有效等价类（正确账号+正确密码 -> 登录成功）----
D.range().forEach((i) => {
  test(`TC_LOG_001 账号-有效 #${i + 1}: penguin -> 登录成功`, async ({ page }) => {
    await submit(page, ACCOUNT.username, ACCOUNT.password);
    await expectDialog(dlg, '登录成功');
  });
});

// ---- 账号：无效·空（含边界纯空串）----
D.blanks().forEach((v, i) => {
  test(`TC_LOG_002 账号-无效[空] #${i + 1}: "${D.label(v)}" -> 提示补全`, async ({ page }) => {
    await submit(page, v, ACCOUNT.password);
    await expectDialog(dlg, '请输入用户名/手机号/邮箱和密码');
  });
});

// ---- 账号：无效·不存在 ----
D.range().forEach((i) => {
  test(`TC_LOG_003 账号-无效[不存在] #${i + 1} -> 账号或密码错误`, async ({ page }) => {
    await submit(page, `no_such_user_${i}_${Date.now()}`, ACCOUNT.password);
    await expectDialog(dlg, '或密码错误');
  });
});

// ---- 密码：有效等价类 ----
D.range().forEach((i) => {
  test(`TC_LOG_004 密码-有效 #${i + 1}: 正确密码 -> 登录成功`, async ({ page }) => {
    await submit(page, ACCOUNT.username, ACCOUNT.password);
    await expectDialog(dlg, '登录成功');
  });
});

// ---- 密码：无效·空（含边界纯空串）----
D.blanks().forEach((v, i) => {
  test(`TC_LOG_005 密码-无效[空] #${i + 1}: "${D.label(v)}" -> 提示补全`, async ({ page }) => {
    await submit(page, ACCOUNT.username, v);
    await expectDialog(dlg, '请输入用户名/手机号/邮箱和密码');
  });
});

// ---- 密码：无效·错误密码 ----
D.range().forEach((i) => {
  test(`TC_LOG_006 密码-无效[错误] #${i + 1} -> 账号或密码错误`, async ({ page }) => {
    await submit(page, ACCOUNT.username, `wrong_pw_${i}_${Date.now()}`);
    await expectDialog(dlg, '或密码错误');
  });
});
