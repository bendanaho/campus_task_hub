// @ts-check
// 全局认证：登录一次 penguin，把登录态(localStorage 的 token/user)存到 .auth/user.json，
// 供 authed 项目(充值/资料/发布)复用，避免上千条用例每条都重新登录。
const { test: setup } = require('@playwright/test');
const { ACCOUNT, attachDialogs, expectDialog } = require('../helpers');

const authFile = '.auth/user.json';

setup('authenticate', async ({ page }) => {
  const dlg = attachDialogs(page);
  await page.goto('/login.html');
  await page.fill('#loginAccount', ACCOUNT.username);
  await page.fill('#loginPassword', ACCOUNT.password);
  await page.click('#loginForm button[type="submit"]');
  await page.waitForURL((url) => !url.pathname.endsWith('login.html'), { timeout: 15000 }).catch(() => {});
  await expectDialog(dlg, '登录成功');
  await page.context().storageState({ path: authFile });
});
