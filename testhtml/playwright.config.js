// @ts-check
const { defineConfig } = require('@playwright/test');

/**
 * 直连线上前端做数据驱动的等价类端到端测试。
 * - 前端所有校验反馈走原生 alert()/prompt()，核心断言是「捕获对话框文案」(见 helpers.js)。
 * - 每个等价类默认 50 条(可用 N_PER_CLASS 覆盖)，总量 >1000 条。
 * - 报告结果直接落在本地 e2e 目录：playwright-report/ 与 results/。
 */
module.exports = defineConfig({
  testDir: './tests',
  timeout: 30 * 1000,
  expect: { timeout: 8 * 1000 },

  // 大批量用例：开启并行以缩短总时长。无效/边界用例互不影响，可安全并行。
  fullyParallel: true,
  workers: process.env.WORKERS ? Number(process.env.WORKERS) : 4,
  retries: process.env.CI ? 1 : 0,
  forbidOnly: !!process.env.CI,

  // 结果直接保存在本地 e2e 下
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['json', { outputFile: 'results/results.json' }],
    ['junit', { outputFile: 'results/junit.xml' }],
  ],
  outputDir: 'test-results',

  use: {
    baseURL: 'http://182.92.133.163:8081',
    headless: true,
    actionTimeout: 10 * 1000,
    navigationTimeout: 15 * 1000,
    ignoreHTTPSErrors: true,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    locale: 'zh-CN',
  },

  projects: [
    // 1) 认证准备：登录一次并存盘
    { name: 'setup', testMatch: /auth\.setup\.js/ },

    // 2) 免登录模块（登录、注册）
    {
      name: 'guest',
      testMatch: [/01-login\.spec\.js/, /02-register\.spec\.js/],
      use: { browserName: 'chromium' },
    },

    // 3) 需登录模块（充值、资料、发布）——复用 storageState
    {
      name: 'authed',
      testMatch: [/03-recharge\.spec\.js/, /04-profile\.spec\.js/, /05-publish\.spec\.js/],
      use: { browserName: 'chromium', storageState: '.auth/user.json' },
      dependencies: ['setup'],
    },
  ],
});
