// 测试设施：在 Node 里"复现浏览器环境"，把 js/ 下的功能代码加载进来供测试调用。
// 注意：这是测试专用代码，功能代码（js/ 目录）对它零依赖、一个字都不用改。
//
// 原理：你的代码是浏览器代码——函数都是全局函数（没有 module.exports），
// 数据存在 localStorage（Node 没有）。所以这里：
//   1. 用一个普通对象伪造 localStorage；
//   2. 用 Node 的 vm 模块开一个沙箱，把伪造的 localStorage 放进去；
//   3. 把 utils.js → mock-data.js → api.js 依次在沙箱里执行，
//      它们的全局函数就都活在这个沙箱里、共用同一个假 localStorage。
// createApp() 每次返回一个全新的、相互隔离的沙箱，保证每个测试用例从干净数据开始。

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const JS_DIR = path.join(__dirname, '..', 'js');
const FILES = ['utils.js', 'mock-data.js', 'api.js'];

function createApp() {
    // 伪造 localStorage
    const store = {};
    const localStorage = {
        getItem: function (k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
        setItem: function (k, v) { store[k] = String(v); },
        removeItem: function (k) { delete store[k]; },
        clear: function () { for (const k in store) delete store[k]; }
    };

    const sandbox = {
        console: console,
        Date: Date,
        Math: Math,
        JSON: JSON,
        setTimeout: setTimeout,
        clearTimeout: clearTimeout,
        URLSearchParams: URLSearchParams,
        localStorage: localStorage,
        // utils.js 的 getUrlParam 会读 window.location，这里给个占位
        window: { location: { search: '', pathname: '', href: '' } }
    };
    vm.createContext(sandbox);

    FILES.forEach(function (f) {
        let code = fs.readFileSync(path.join(JS_DIR, f), 'utf8');
        // 测试永远针对 mock 业务逻辑：无论 api.js 里的联调开关当前是 true 还是 false，
        // 沙箱里强制 USE_MOCK=true（沙箱没有 fetch，真实分支本来也跑不了）。
        if (f === 'api.js') {
            code = code.replace(/^const USE_MOCK = (true|false);/m, 'const USE_MOCK = true;');
        }
        vm.runInContext(code, sandbox, { filename: f });
    });

    return sandbox;
}

// 便捷登录（所有种子用户密码都是 1）
async function loginAs(app, username) {
    return app.login(username, '1');
}

// 读某用户当前余额
function balanceOf(app, userId) {
    const u = app.getUserById(userId);
    return u ? u.balance : null;
}

module.exports = { createApp, loginAs, balanceOf };
