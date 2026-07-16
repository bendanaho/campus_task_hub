// @ts-check
// 模块 2.1 发布任务·必填项（数据驱动：每类 N 条，默认 50）—— TC_TASK_*
// 认证态由 storageState 提供（penguin 已实名）。payer 帖校验顺序：标题->分类->描述->截止->报酬。
// 每类用「变化其它字段取值」生成 N 个同类样本。有效(真实发帖+冻结余额)默认跳过，需 RUN_MUTATING=1。
const { test } = require('@playwright/test');
const { attachDialogs, expectDialog, mutatingTest } = require('../helpers');
const D = require('../data');

let dlg;
test.beforeEach(async ({ page }) => {
  dlg = attachDialogs(page);
  await page.goto('/publish-task.html');
  await page.waitForSelector('.btn-publish', { timeout: 15000 });
  await page.check('input[name="publisherSide"][value="payer"]'); // 出钱悬赏：截止时间与报酬必填
});

const CATS = ['errand', 'life-service', 'skill-help', 'study-help', 'material-share', 'item-trade', 'other'];
const clickPublish = (page) => { dlg.messages.length = 0; return page.click('.btn-publish'); };

// 有效[创建帖子]（破坏性，默认跳过）
D.range().forEach((i) => {
  mutatingTest(test)(`TC_TASK_003 必填-有效[创建] #${i + 1} -> 发布成功`, async ({ page }) => {
    await page.fill('#postTitle', `自动化测试任务#${i + 1}`);
    await page.selectOption('#postCategory', CATS[i % CATS.length]);
    await page.fill('#postDesc', `这是第 ${i + 1} 条自动化测试的任务描述，内容足够详细。`);
    await page.fill('#postDeadline', '2030-12-31T10:00');
    await page.fill('#postReward', '1元');
    await clickPublish(page);
    await expectDialog(dlg, '发布成功');
  });
});

// 无效·标题为空（含边界：纯空白标题）
D.blanks().forEach((v, i) => {
  test(`TC_TASK_004 标题-无效[空] #${i + 1} -> 请填写标题`, async ({ page }) => {
    await page.fill('#postTitle', v);
    await page.selectOption('#postCategory', CATS[i % CATS.length]);
    await page.fill('#postDesc', `描述占位 ${i}`);
    await clickPublish(page);
    await expectDialog(dlg, '请填写标题');
  });
});

// 无效·未选分类（标题已填，分类保持默认占位项）
D.range().forEach((i) => {
  test(`TC_TASK_006 分类-无效[未选] #${i + 1} -> 请选择分类`, async ({ page }) => {
    await page.fill('#postTitle', `标题占位 ${i}`);
    // 不选择分类
    await page.fill('#postDesc', `描述占位 ${i}`);
    await clickPublish(page);
    await expectDialog(dlg, '请选择分类');
  });
});

// 无效·描述为空
D.blanks().forEach((v, i) => {
  test(`TC_TASK_009 描述-无效[空] #${i + 1} -> 请填写描述`, async ({ page }) => {
    await page.fill('#postTitle', `标题占位 ${i}`);
    await page.selectOption('#postCategory', CATS[i % CATS.length]);
    await page.fill('#postDesc', v);
    await clickPublish(page);
    await expectDialog(dlg, '请填写描述');
  });
});

// 无效·payer 截止时间为空
D.range().forEach((i) => {
  test(`TC_TASK_014 截止时间-无效[空] #${i + 1} -> 请选择截止时间`, async ({ page }) => {
    await page.fill('#postTitle', `标题占位 ${i}`);
    await page.selectOption('#postCategory', CATS[i % CATS.length]);
    await page.fill('#postDesc', `描述占位 ${i} 内容足够长。`);
    await page.fill('#postDeadline', '');
    await clickPublish(page);
    await expectDialog(dlg, '请选择截止时间');
  });
});

// 无效·报酬为空
D.blanks().forEach((v, i) => {
  test(`TC_TASK_012 报酬-无效[空] #${i + 1} -> 请填写报酬金额`, async ({ page }) => {
    await page.fill('#postTitle', `标题占位 ${i}`);
    await page.selectOption('#postCategory', CATS[i % CATS.length]);
    await page.fill('#postDesc', `描述占位 ${i} 内容足够长。`);
    await page.fill('#postDeadline', '2030-12-31T10:00');
    await page.fill('#postReward', v);
    await clickPublish(page);
    await expectDialog(dlg, '请填写报酬金额');
  });
});
