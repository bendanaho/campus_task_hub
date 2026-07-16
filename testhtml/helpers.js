// @ts-check
const { expect } = require('@playwright/test');

/** 提供的合法测试账号（已实名认证 verified、普通用户 role=0） */
const ACCOUNT = { username: 'penguin', password: 'pass123' };

/**
 * 是否执行“会真实改动服务端数据”的用例（有效等价类里的成功提交路径）：
 *   - 注册成功（创建新账号）
 *   - 充值成功（增加虚拟余额）
 *   - 发布任务成功（新建帖子 + 冻结余额）
 *   - 修改手机号/邮箱成功（改动 penguin 账号本身）
 * 默认关闭，避免污染线上数据；如需完整跑（与纯人工手测完全一致），设置环境变量 RUN_MUTATING=1。
 *   PowerShell:  $env:RUN_MUTATING=1; npx playwright test
 *   bash:        RUN_MUTATING=1 npx playwright test
 */
const RUN_MUTATING = process.env.RUN_MUTATING === '1';

/** 有条件执行：默认跳过“会改动服务端数据”的有效路径用例 */
const mutatingTest = (test) => (RUN_MUTATING ? test : test.skip);

/**
 * 给页面挂一个对话框录制器：记录所有 alert/prompt/confirm 文案并自动应答。
 *  - prompt 用 state.promptValue 作为输入值（每个用例点击前设置）
 *  - alert/confirm 直接 accept
 * 返回的 state.messages 累积所有文案；每个用例点击前记得 state.messages.length = 0 清空。
 * @param {import('@playwright/test').Page} page
 */
function attachDialogs(page) {
  const state = { messages: /** @type {string[]} */ ([]), promptValue: '' };
  page.on('dialog', async (dialog) => {
    state.messages.push(dialog.message());
    try {
      if (dialog.type() === 'prompt') {
        await dialog.accept(String(state.promptValue));
      } else {
        await dialog.accept();
      }
    } catch (_) {
      /* 对话框可能已被其它处理器关闭，忽略 */
    }
  });
  return state;
}

/**
 * 轮询等待并断言最近的对话框文案“包含”期望片段（用 contains 更抗后端文案微调）。
 * @param {{messages: string[]}} state
 * @param {string} expected
 */
async function expectDialog(state, expected, timeout = 8000) {
  await expect
    .poll(() => state.messages.join(' || '), { timeout })
    .toContain(expected);
}

/** 断言在给定时间内“没有出现”某条文案（用于验证有效等价类未被误拦截） */
async function expectNoDialog(state, notExpected, wait = 1500) {
  await new Promise((r) => setTimeout(r, wait));
  expect(state.messages.join(' || ')).not.toContain(notExpected);
}

/**
 * 通过 UI 登录 penguin，与人工手测一致：填表 -> 提交 -> 经过“登录成功。”弹窗 -> 跳转。
 * @param {import('@playwright/test').Page} page
 * @param {{messages: string[], promptValue: string}} state 已 attachDialogs 的录制器
 */
async function uiLogin(page, state, acc = ACCOUNT) {
  state.messages.length = 0;
  await page.goto('/login.html');
  await page.fill('#loginAccount', acc.username);
  await page.fill('#loginPassword', acc.password);
  await page.click('#loginForm button[type="submit"]');
  // 登录成功后会离开 login.html（跳到 index.html 或 redirect 目标）
  await page
    .waitForURL((url) => !url.pathname.endsWith('login.html'), { timeout: 15000 })
    .catch(() => {});
  await expectDialog(state, '登录成功');
}

/** 生成唯一的注册资料，避免“创建新账号”用例重复冲突 */
function uniqueCreds() {
  const stamp = String(Date.now());
  return {
    username: 'pwtest_' + stamp,
    // 1 开头的 11 位，取时间戳后 10 位
    phone: '1' + stamp.slice(-10),
    email: 'pwtest_' + stamp + '@test.edu.cn',
    password: 'pass123',
  };
}

module.exports = {
  ACCOUNT,
  RUN_MUTATING,
  mutatingTest,
  attachDialogs,
  expectDialog,
  expectNoDialog,
  uiLogin,
  uniqueCreds,
};
