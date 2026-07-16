// @ts-check
// 模块 1.4 个人资料修改·手机号/邮箱（数据驱动：每类 N 条，默认 50）—— TC_PROF_*
// 认证态由 storageState 提供。#editPhone / #editEmail 为动态注入链接，点击弹 prompt。
// 注意：输入等于当前值或为空时代码直接 return（无提示），故不测「空」类，取值均非空且与当前不同。
// 有效(会改动 penguin 账号)默认跳过，需 RUN_MUTATING=1。
const { test } = require('@playwright/test');
const { attachDialogs, expectDialog, mutatingTest } = require('../helpers');
const D = require('../data');

let dlg;
test.beforeEach(async ({ page }) => {
  dlg = attachDialogs(page);
  await page.goto('/profile.html');
  await page.waitForSelector('#editPhone', { timeout: 15000 });
});

async function editPhone(page, v) {
  dlg.messages.length = 0;
  dlg.promptValue = v;
  await page.click('#editPhone');
}
async function editEmail(page, v) {
  dlg.messages.length = 0;
  dlg.promptValue = v;
  await page.click('#editEmail');
}

/* ============ 修改手机号 ============ */
// 有效（破坏性，默认跳过）
D.validPhones().forEach((p, i) => {
  mutatingTest(test)(`TC_PROF_001 手机号-有效 #${i + 1}: ${p} -> 修改成功`, async ({ page }) => {
    await editPhone(page, p);
    await expectDialog(dlg, '手机号修改成功');
  });
});
// 无效·含字母
D.letterPhones().forEach((p, i) => {
  test(`TC_PROF_002 手机号-无效[含字母] #${i + 1}: ${p} -> 格式错误`, async ({ page }) => {
    await editPhone(page, p);
    await expectDialog(dlg, '请输入正确的 11 位手机号');
  });
});
// 无效·10 位过短（边界）
D.shortPhones().forEach((p, i) => {
  test(`TC_PROF_003 手机号-无效[10位过短] #${i + 1}: ${p} -> 格式错误`, async ({ page }) => {
    await editPhone(page, p);
    await expectDialog(dlg, '请输入正确的 11 位手机号');
  });
});
// 无效·12 位过长（边界）
D.longPhones().forEach((p, i) => {
  test(`TC_PROF_004 手机号-无效[12位过长] #${i + 1}: ${p} -> 格式错误`, async ({ page }) => {
    await editPhone(page, p);
    await expectDialog(dlg, '请输入正确的 11 位手机号');
  });
});
// 无效·首位非 1
D.firstNotOnePhones().forEach((p, i) => {
  test(`TC_PROF_005 手机号-无效[首位非1] #${i + 1}: ${p} -> 格式错误`, async ({ page }) => {
    await editPhone(page, p);
    await expectDialog(dlg, '请输入正确的 11 位手机号');
  });
});

/* ============ 修改邮箱 ============ */
// 有效（破坏性，默认跳过）
D.validEmails().forEach((e, i) => {
  mutatingTest(test)(`TC_PROF_006 邮箱-有效 #${i + 1}: ${e} -> 修改成功`, async ({ page }) => {
    await editEmail(page, e);
    await expectDialog(dlg, '邮箱修改成功');
  });
});
// 无效·缺 @
D.noAtEmails().forEach((e, i) => {
  test(`TC_PROF_007 邮箱-无效[缺@] #${i + 1}: ${e} -> 邮箱格式错误`, async ({ page }) => {
    await editEmail(page, e);
    await expectDialog(dlg, '请输入正确的邮箱地址');
  });
});
// 无效·缺后缀点
D.noDotEmails().forEach((e, i) => {
  test(`TC_PROF_008 邮箱-无效[缺后缀点] #${i + 1}: ${e} -> 邮箱格式错误`, async ({ page }) => {
    await editEmail(page, e);
    await expectDialog(dlg, '请输入正确的邮箱地址');
  });
});
// 无效·连续 @
D.doubleAtEmails().forEach((e, i) => {
  test(`TC_PROF_009 邮箱-无效[双@] #${i + 1}: ${e} -> 邮箱格式错误`, async ({ page }) => {
    await editEmail(page, e);
    await expectDialog(dlg, '请输入正确的邮箱地址');
  });
});
