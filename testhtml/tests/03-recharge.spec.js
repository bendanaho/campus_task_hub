// @ts-check
// 模块 1.5 钱包充值（数据驱动：每个等价类 N 条，默认 50）—— TC_WAL_*
// 认证态由 storageState 提供（见 auth.setup.js），无需每条登录。
// #rechargeBtn 为个人中心动态注入的链接，点击弹 prompt；前端只校验「有限数字且>0」，
// 小数位/上限由后端返回。有效(真实充值)默认跳过，需 RUN_MUTATING=1。
const { test } = require('@playwright/test');
const { attachDialogs, expectDialog, mutatingTest } = require('../helpers');
const D = require('../data');

let dlg;
test.beforeEach(async ({ page }) => {
  dlg = attachDialogs(page);
  await page.goto('/profile.html');
  await page.waitForSelector('#rechargeBtn', { timeout: 15000 });
});

async function recharge(page, amount) {
  dlg.messages.length = 0;
  dlg.promptValue = amount;
  await page.click('#rechargeBtn');
}

// 有效·普通/边界（破坏性：真实增加余额，默认跳过；含 0.01 与 100000 两边界）
D.validAmounts().forEach((a, i) => {
  mutatingTest(test)(`TC_WAL_001 金额-有效 #${i + 1}: ${a} -> 充值成功`, async ({ page }) => {
    await recharge(page, a);
    await expectDialog(dlg, '充值成功');
  });
});

// 无效·<=0（含边界 0）
D.zeroOrNegative().forEach((a, i) => {
  test(`TC_WAL_004 金额-无效[<=0] #${i + 1}: ${a} -> 请输入正确的充值金额`, async ({ page }) => {
    await recharge(page, a);
    await expectDialog(dlg, '请输入正确的充值金额');
  });
});

// 无效·非数字
D.nonNumbers().forEach((a, i) => {
  test(`TC_WAL_006 金额-无效[非数字] #${i + 1}: ${D.label(a)} -> 请输入正确的充值金额`, async ({ page }) => {
    await recharge(page, a);
    await expectDialog(dlg, '请输入正确的充值金额');
  });
});

// 无效·超上限（含边界 100000.01；后端拦截，不改余额）
D.overLimitAmounts().forEach((a, i) => {
  test(`TC_WAL_005 金额-无效[超上限] #${i + 1}: ${a} -> 不能超过上限`, async ({ page }) => {
    await recharge(page, a);
    await expectDialog(dlg, '不能超过');
  });
});

// 无效·小数位>2（后端拦截，不改余额）
D.tooManyDecimals().forEach((a, i) => {
  test(`TC_WAL_007 金额-无效[小数位过多] #${i + 1}: ${a} -> 最多两位小数`, async ({ page }) => {
    await recharge(page, a);
    await expectDialog(dlg, '两位小数');
  });
});
