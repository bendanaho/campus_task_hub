const USE_MOCK = false;
const API_BASE = 'http://localhost:8080/api';

// ==================== 真实后端响应处理 ====================

// 统一解包后端响应信封 { success, data, errorCode, message }：
// - 业务失败（success=false，HTTP 仍为 200）→ 抛 Error(message)，与 mock 分支 reject(new Error(...)) 行为一致，
//   main.js 里现成的 .catch(err => alert(err.message)) 无需任何改动即可提示后端错误。
// - HTTP 层失败（401/403/500 等，响应体可能非 JSON）→ 抛带状态码的 Error。
async function _handleRes(res) {
    // 登录态失效：Spring Security 对无效/过期 token 返回 401/403（空 body），
    // 而业务层的"禁止"是 HTTP 200 + success:false，二者可据状态码区分。
    // 常见于后端重启（内存库）后旧 token 失效——此时清掉过期登录态并引导重新登录，
    // 避免"看似已登录、实则所有数据加载失败"的困惑状态。
    if ((res.status === 401 || res.status === 403) && typeof getToken === 'function' && getToken()) {
        removeToken();
        removeCurrentUser();
        if (typeof window !== 'undefined' && window.location &&
            window.location.pathname.indexOf('login.html') < 0) {
            var page = window.location.pathname.split('/').pop() + window.location.search;
            alert('登录已失效，请重新登录。');
            window.location.href = 'login.html?redirect=' + encodeURIComponent(page);
        }
        throw new Error('登录已失效，请重新登录');
    }
    var json = null;
    try { json = await res.json(); } catch (e) { /* 空响应体或非 JSON（如 401） */ }
    if (json && json.success === false) {
        throw new Error(json.message || '操作失败');
    }
    if (!res.ok) {
        throw new Error('请求失败（HTTP ' + res.status + '），请确认已登录且后端服务已启动');
    }
    return json ? json.data : null;
}

// 后端把付款卡片(payment)存为 JSON 字符串原样返回，而 main.js 按对象读取（p.kind/p.status 等）——此处归一化。
// mock 分支本身就是对象，不受影响。
function _normalizeMessage(m) {
    if (m && typeof m.payment === 'string' && m.payment) {
        try { m.payment = JSON.parse(m.payment); } catch (e) { m.payment = null; }
    }
    return m;
}

// 保存 mock-data.js 原始同步函数的引用（供 API Mock 分支内部使用，避免与异步包装函数同名冲突）
var _mockGetDB = getDB;
var _mockSaveDB = saveDB;
var _mockGetTaskById = getTaskById;
var _mockGetUserById = getUserById;
var _mockGetUserByUsername = getUserByUsername;
var _mockGetUserByPhone = getUserByPhone;
var _mockGetUserByEmail = getUserByEmail;

// ==================== 认证 ====================

async function login(account, password) {
    if (USE_MOCK) {
        return mockLogin(account, password);
    }
    var res = await fetch(API_BASE + '/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ account: account, password: password })
    });
    var data = await _handleRes(res);
    setToken(data.token);
    setCurrentUser(data.user);
    return data;
}

async function register(data) {
    if (USE_MOCK) {
        return mockRegister(data);
    }
    var res = await fetch(API_BASE + '/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
    return _handleRes(res);
}

async function logout() {
    if (USE_MOCK) {
        removeToken();
        removeCurrentUser();
        return { success: true };
    }
    // 无论后端是否可达，本地登录状态都要清除（否则后端挂掉时无法退出登录）
    try {
        var res = await fetch(API_BASE + '/logout', {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + getToken() }
        });
        return await _handleRes(res);
    } finally {
        removeToken();
        removeCurrentUser();
    }
}

// ==================== 用户 ====================

async function getUserProfile(userId) {
    if (USE_MOCK) {
        return mockGetUserProfile(userId);
    }
    var res = await fetch(API_BASE + '/users/' + userId, {
        headers: { 'Authorization': 'Bearer ' + getToken() }
    });
    return _handleRes(res);
}

async function updatePhone(phone) {
    if (USE_MOCK) {
        return mockUpdatePhone(phone);
    }
    var res = await fetch(API_BASE + '/user/phone', {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + getToken()
        },
        body: JSON.stringify({ phone: phone })
    });
    return _handleRes(res);
}

async function updateEmail(email) {
    if (USE_MOCK) {
        return mockUpdateEmail(email);
    }
    var res = await fetch(API_BASE + '/user/email', {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + getToken()
        },
        body: JSON.stringify({ email: email })
    });
    return _handleRes(res);
}

async function submitAuth(data) {
    if (USE_MOCK) {
        return mockSubmitAuth(data);
    }
    var res = await fetch(API_BASE + '/auth', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + getToken()
        },
        body: JSON.stringify(data)
    });
    var profile = await _handleRes(res);
    // 同 mockSubmitAuth：实名成功后更新本地登录用户的 authStatus，
    // 否则本地缓存仍是 unverified，requireVerified 会继续拦刚实名的用户。
    var cur = getCurrentUser();
    if (cur) {
        cur.authStatus = (profile && profile.authStatus) || 'verified';
        setCurrentUser(cur);
    }
    return profile;
}

// 查询当前登录用户余额（实时读后端，避免本地缓存过期）→ { balance }
async function getMyBalance() {
    if (USE_MOCK) {
        return mockGetMyBalance();
    }
    var res = await fetch(API_BASE + '/user/balance', {
        headers: { 'Authorization': 'Bearer ' + getToken() }
    });
    return _handleRes(res);
}

// 充值：课设采用平台虚拟余额，此处为 mock 加钱；真实资金通道非本项目范围 → { success, balance }
async function recharge(amount) {
    if (USE_MOCK) {
        return mockRecharge(amount);
    }
    var res = await fetch(API_BASE + '/user/recharge', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + getToken()
        },
        body: JSON.stringify({ amount: amount })
    });
    return _handleRes(res);
}

// 账单：当前用户的资金流水 → { list, totalIn, totalOut }
async function getMyBills() {
    if (USE_MOCK) {
        return mockGetMyBills();
    }
    var res = await fetch(API_BASE + '/user/bills', {
        headers: { 'Authorization': 'Bearer ' + getToken() }
    });
    return _handleRes(res);
}

// ==================== 帖子（任务/服务统一为"帖子"）====================

async function getTasks(filters) {
    if (USE_MOCK) {
        return mockGetTasks(filters);
    }
    var query = new URLSearchParams(filters || {}).toString();
    var res = await fetch(API_BASE + '/posts?' + query);
    return _handleRes(res);
}

async function getTaskDetail(id) {
    if (USE_MOCK) {
        return mockGetTaskDetail(id);
    }
    var res = await fetch(API_BASE + '/posts/' + id);
    return _handleRes(res);
}

// 发布帖子（取代旧 publishTask + publishService）。data.publisherSide: 'payer'|'earner'
async function publishPost(data) {
    if (USE_MOCK) {
        return mockPublishPost(data);
    }
    var res = await fetch(API_BASE + '/posts', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + getToken()
        },
        body: JSON.stringify(data)
    });
    return _handleRes(res);
}

async function getMyPosts() {
    if (USE_MOCK) {
        return mockGetMyPosts();
    }
    var res = await fetch(API_BASE + '/posts/mine', {
        headers: { 'Authorization': 'Bearer ' + getToken() }
    });
    return _handleRes(res);
}

// ==================== 订单（统一：payer 付款方 / earner 收款方）====================

// 响应一个帖子（接单 / 下单）→ 创建 pending 订单。取代旧 takeTask + createServiceOrder
async function createOrder(postId, chatId) {
    if (USE_MOCK) {
        return mockCreateOrder(postId, chatId);
    }
    var res = await fetch(API_BASE + '/orders', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + getToken()
        },
        body: JSON.stringify({ postId: postId, chatId: chatId })
    });
    return _handleRes(res);
}

// 发布者接受订单 → in_progress，冻结付款方余额
async function acceptOrder(orderId) {
    if (USE_MOCK) {
        return mockAcceptOrder(orderId);
    }
    var res = await fetch(API_BASE + '/orders/' + orderId + '/accept', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + getToken() }
    });
    return _handleRes(res);
}

// 取消订单（仅 pending 可取消：发布者拒绝 / 响应者撤回）
async function cancelOrder(orderId) {
    if (USE_MOCK) {
        return mockCancelOrder(orderId);
    }
    var res = await fetch(API_BASE + '/orders/' + orderId + '/cancel', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + getToken() }
    });
    return _handleRes(res);
}

// 确认完成（payer/earner 任一方调用，无需传角色，由登录身份判断）。双方都确认 → completed 并结算
async function confirmOrder(orderId) {
    if (USE_MOCK) {
        return mockConfirmOrder(orderId);
    }
    var res = await fetch(API_BASE + '/orders/' + orderId + '/confirm', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + getToken() }
    });
    return _handleRes(res);
}

// 发起申诉（付款方/收款方任一方，仅 in_progress）→ disputed，资金保持冻结，等待管理员裁决
async function disputeOrder(orderId, reason) {
    if (USE_MOCK) {
        return mockDisputeOrder(orderId, reason);
    }
    var res = await fetch(API_BASE + '/orders/' + orderId + '/dispute', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + getToken()
        },
        body: JSON.stringify({ reason: reason })
    });
    return _handleRes(res);
}

// ==================== 管理员（role=1）====================

// 待处理争议订单列表 → [{ order, postTitle, payerName, earnerName, disputedByName }]
async function getAdminDisputes() {
    if (USE_MOCK) {
        return mockGetAdminDisputes();
    }
    var res = await fetch(API_BASE + '/admin/disputes', {
        headers: { 'Authorization': 'Bearer ' + getToken() }
    });
    return _handleRes(res);
}

// 管理员裁决争议订单。decision: 'refund'(全额退款) | 'settle'(全额结算) | 'partial'(部分结算，amountToEarner 给收款方，其余退付款方)
async function resolveDispute(orderId, decision, amountToEarner, note) {
    if (USE_MOCK) {
        return mockResolveDispute(orderId, decision, amountToEarner, note);
    }
    var res = await fetch(API_BASE + '/admin/orders/' + orderId + '/resolve', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + getToken()
        },
        body: JSON.stringify({ decision: decision, amountToEarner: amountToEarner, note: note })
    });
    return _handleRes(res);
}

// 全部订单总览（管理员）→ 结构同 getAdminDisputes
async function getAdminOrders() {
    if (USE_MOCK) {
        return mockGetAdminOrders();
    }
    var res = await fetch(API_BASE + '/admin/orders', {
        headers: { 'Authorization': 'Bearer ' + getToken() }
    });
    return _handleRes(res);
}

// 全部帖子（管理员，含已下架）
async function getAdminPosts() {
    if (USE_MOCK) {
        return mockGetAdminPosts();
    }
    var res = await fetch(API_BASE + '/admin/posts', {
        headers: { 'Authorization': 'Bearer ' + getToken() }
    });
    return _handleRes(res);
}

// 管理员下架帖子（status → closed，大厅不再显示、不可再下单）
async function adminClosePost(postId) {
    if (USE_MOCK) {
        return mockAdminClosePost(postId);
    }
    var res = await fetch(API_BASE + '/admin/posts/' + postId + '/close', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + getToken() }
    });
    return _handleRes(res);
}

// 取某会话当前订单（优先返回进行中的；否则返回最近一条）。取代旧 getActiveOrder + getOrderByChatId
async function getOrder(chatId) {
    if (USE_MOCK) {
        return mockGetOrder(chatId);
    }
    var res = await fetch(API_BASE + '/orders/by-chat?chatId=' + chatId, {
        headers: { 'Authorization': 'Bearer ' + getToken() }
    });
    return _handleRes(res);
}

async function getOrderHistory(chatId) {
    if (USE_MOCK) {
        return mockGetOrderHistory(chatId);
    }
    var res = await fetch(API_BASE + '/orders?chatId=' + chatId, {
        headers: { 'Authorization': 'Bearer ' + getToken() }
    });
    return _handleRes(res);
}

// 我的订单。moneyRole: 'payer'(我付款的) | 'earner'(我收款的) | 不传(全部)
async function getMyOrders(moneyRole) {
    if (USE_MOCK) {
        return mockGetMyOrders(moneyRole);
    }
    var query = moneyRole ? '?role=' + moneyRole : '';
    var res = await fetch(API_BASE + '/orders/mine' + query, {
        headers: { 'Authorization': 'Bearer ' + getToken() }
    });
    return _handleRes(res);
}

// ==================== 消息 ====================

async function getConversations() {
    if (USE_MOCK) {
        return mockGetConversations();
    }
    var res = await fetch(API_BASE + '/conversations', {
        headers: { 'Authorization': 'Bearer ' + getToken() }
    });
    return _handleRes(res);
}

async function getMessages(chatId) {
    if (USE_MOCK) {
        return mockGetMessages(chatId);
    }
    var res = await fetch(API_BASE + '/conversations/' + chatId + '/messages', {
        headers: { 'Authorization': 'Bearer ' + getToken() }
    });
    var list = await _handleRes(res);
    return (list || []).map(_normalizeMessage);
}

async function sendMessage(chatId, content) {
    if (USE_MOCK) {
        return mockSendMessage(chatId, content);
    }
    var res = await fetch(API_BASE + '/conversations/' + chatId + '/messages', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + getToken()
        },
        body: JSON.stringify({ content: content })
    });
    return _normalizeMessage(await _handleRes(res));
}

async function withdrawMessage(messageId) {
    if (USE_MOCK) {
        return mockWithdrawMessage(messageId);
    }
    var res = await fetch(API_BASE + '/messages/' + messageId + '/withdraw', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + getToken() }
    });
    return _normalizeMessage(await _handleRes(res));
}

// 在聊天里发起「收款(request)」或「转账(transfer)」卡片。直接支付（不走托管）：
// 转账立即扣款到账；收款为待对方支付。
async function sendPaymentCard(chatId, partnerId, kind, amount) {
    if (USE_MOCK) {
        return mockSendPaymentCard(chatId, partnerId, kind, amount);
    }
    var res = await fetch(API_BASE + '/conversations/' + chatId + '/payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + getToken() },
        body: JSON.stringify({ partnerId: partnerId, kind: kind, amount: amount })
    });
    return _normalizeMessage(await _handleRes(res));
}

// 付款方支付一张待支付的收款卡片
async function payPaymentCard(messageId) {
    if (USE_MOCK) {
        return mockPayPaymentCard(messageId);
    }
    var res = await fetch(API_BASE + '/messages/' + messageId + '/pay', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + getToken() }
    });
    return _normalizeMessage(await _handleRes(res));
}

// 发起方取消一张待支付的收款卡片
async function cancelPaymentCard(messageId) {
    if (USE_MOCK) {
        return mockCancelPaymentCard(messageId);
    }
    var res = await fetch(API_BASE + '/messages/' + messageId + '/cancel-payment', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + getToken() }
    });
    return _normalizeMessage(await _handleRes(res));
}

// 未读消息统计：{ total, byChat: { chatId: count } }
async function getUnreadCounts() {
    if (USE_MOCK) {
        return mockGetUnreadCounts();
    }
    var res = await fetch(API_BASE + '/messages/unread', {
        headers: { 'Authorization': 'Bearer ' + getToken() }
    });
    return _handleRes(res);
}

// 打开某会话后，把该会话中「别人发给我的」未读消息标记为已读
async function markMessagesRead(chatId) {
    if (USE_MOCK) {
        return mockMarkMessagesRead(chatId);
    }
    var res = await fetch(API_BASE + '/conversations/' + chatId + '/read', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + getToken() }
    });
    return _handleRes(res);
}

async function ensureConversation(data) {
    if (USE_MOCK) {
        return mockEnsureConversation(data);
    }
    var res = await fetch(API_BASE + '/conversations/ensure', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + getToken()
        },
        body: JSON.stringify(data)
    });
    return _handleRes(res);
}

// ==================== 评价 ====================

// data: { orderId, toUserId, toUserName, rating, content, images? }
async function submitReview(data) {
    if (USE_MOCK) {
        return mockSubmitReview(data);
    }
    var res = await fetch(API_BASE + '/reviews', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + getToken()
        },
        body: JSON.stringify(data)
    });
    return _handleRes(res);
}

async function getReviews(userId) {
    if (USE_MOCK) {
        return mockGetReviews(userId);
    }
    var res = await fetch(API_BASE + '/reviews?userId=' + userId);
    return _handleRes(res);
}

// 当前用户是否已对某订单评价过
async function hasReviewed(orderId) {
    if (USE_MOCK) {
        return mockHasReviewed(orderId);
    }
    var res = await fetch(API_BASE + '/reviews/has-reviewed?orderId=' + orderId, {
        headers: { 'Authorization': 'Bearer ' + getToken() }
    });
    // 后端返回 { hasReviewed: bool }，而 mock 直接返回布尔——统一解包成布尔，main.js 的 if(!reviewed) 才能正确判断
    var data = await _handleRes(res);
    if (typeof data === 'boolean') return data;
    return !!(data && data.hasReviewed);
}

// ==================== 余额 ====================

async function getBalance() {
    if (USE_MOCK) {
        return mockGetBalance();
    }
    var res = await fetch(API_BASE + '/user/balance', {
        headers: { 'Authorization': 'Bearer ' + getToken() }
    });
    return _handleRes(res);
}

// ==================== 辅助查询接口 ====================

async function fetchTaskById(id) {
    if (USE_MOCK) {
        return new Promise(function(resolve) {
            setTimeout(function() {
                resolve(_mockGetTaskById(id));
            }, 50);
        });
    }
    var res = await fetch(API_BASE + '/posts/' + id);
    return _handleRes(res);
}

async function fetchUserById(id) {
    if (USE_MOCK) {
        return new Promise(function(resolve) {
            setTimeout(function() {
                resolve(_mockGetUserById(id));
            }, 50);
        });
    }
    // 带上 token：后端 /api/users/{id} 需要登录（不在 permitAll 名单），匿名请求会被 403 拒绝
    var res = await fetch(API_BASE + '/users/' + id, {
        headers: { 'Authorization': 'Bearer ' + getToken() }
    });
    return _handleRes(res);
}

// ==================== Mock 实现 ====================

function mockLogin(account, password) {
    return new Promise(function(resolve, reject) {
        setTimeout(function() {
            var user = _mockGetUserByUsername(account) || _mockGetUserByPhone(account) || _mockGetUserByEmail(account);
            if (!user || user.password !== password) {
                reject(new Error('用户名/手机号/邮箱或密码错误'));
                return;
            }
            var token = 'mock-token-' + user.id + '-' + Date.now();
            setToken(token);
            var safeUser = {
                id: user.id,
                username: user.username,
                phone: user.phone,
                avatar: user.avatar,
                creditScore: user.creditScore,
                authStatus: user.authStatus,
                role: user.role || 0,
                bio: user.bio
            };
            setCurrentUser(safeUser);
            resolve({ user: safeUser, token: token });
        }, 200);
    });
}

function mockRegister(data) {
    return new Promise(function(resolve, reject) {
        setTimeout(function() {
            if (!data.username || !data.phone || !data.password) {
                reject(new Error('请完整填写注册信息'));
                return;
            }
            if (!/^1\d{10}$/.test(data.phone)) {
                reject(new Error('请输入正确的 11 位手机号'));
                return;
            }
            if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
                reject(new Error('请输入正确的邮箱地址'));
                return;
            }
            var db = _mockGetDB();
            for (var i = 0; i < db.users.length; i++) {
                if (db.users[i].username === data.username) {
                    reject(new Error('该用户名已注册'));
                    return;
                }
                if (db.users[i].phone === data.phone) {
                    reject(new Error('该手机号已注册'));
                    return;
                }
                if (data.email && db.users[i].email === data.email) {
                    reject(new Error('该邮箱已注册'));
                    return;
                }
            }
            var newUser = {
                id: 'u' + (db.users.length + 1) + '-' + Date.now(),
                username: data.username,
                phone: data.phone,
                email: data.email || '',
                password: data.password,
                avatar: '',
                creditScore: 5.0,
                authStatus: 'unverified',
                balance: 100,
                realName: '',
                studentId: '',
                college: '',
                className: '',
                bio: ''
            };
            db.users.push(newUser);
            _mockSaveDB(db);
            resolve({ success: true });
        }, 200);
    });
}

function mockGetUserProfile(userId) {
    return new Promise(function(resolve) {
        setTimeout(function() {
            var user = _mockGetUserById(userId);
            if (!user) {
                resolve(null);
                return;
            }
            resolve({
                id: user.id,
                username: user.username,
                phone: user.phone,
                email: user.email,
                avatar: user.avatar,
                creditScore: user.creditScore,
                authStatus: user.authStatus,
                realName: user.realName,
                studentId: user.studentId,
                college: user.college,
                className: user.className,
                bio: user.bio
            });
        }, 100);
    });
}

function mockSubmitAuth(data) {
    return new Promise(function(resolve, reject) {
        setTimeout(function() {
            var currentUser = getCurrentUser();
            if (!currentUser) {
                reject(new Error('请先登录'));
                return;
            }
            var db = _mockGetDB();
            var user = null;
            for (var i = 0; i < db.users.length; i++) {
                if (db.users[i].id === currentUser.id) {
                    user = db.users[i];
                    break;
                }
            }
            if (!user) {
                reject(new Error('用户不存在'));
                return;
            }
            user.authStatus = 'verified';
            user.realName = data.realName || '';
            user.studentId = data.studentId || '';
            user.college = data.college || '';
            user.className = data.className || '';
            _mockSaveDB(db);

            var safeUser = {
                id: user.id,
                username: user.username,
                phone: user.phone,
                avatar: user.avatar,
                creditScore: user.creditScore,
                authStatus: user.authStatus,
                role: user.role || 0,
                bio: user.bio
            };
            setCurrentUser(safeUser);
            resolve({ success: true, user: safeUser });
        }, 300);
    });
}

function mockGetMyBalance() {
    return new Promise(function(resolve, reject) {
        setTimeout(function() {
            var currentUser = getCurrentUser();
            if (!currentUser) { reject(new Error('请先登录')); return; }
            var db = _mockGetDB();
            var u = _findUserInDb(db, currentUser.id);
            resolve({ balance: u ? (u.balance || 0) : 0 });
        }, 50);
    });
}

function mockRecharge(amount) {
    return new Promise(function(resolve, reject) {
        setTimeout(function() {
            var currentUser = getCurrentUser();
            if (!currentUser) { reject(new Error('请先登录')); return; }
            var amt = Number(amount);
            if (!isFinite(amt) || amt <= 0) { reject(new Error('请输入正确的充值金额')); return; }
            if (amt > 100000) { reject(new Error('单次充值金额不能超过 100000 元')); return; }
            var db = _mockGetDB();
            var u = _findUserInDb(db, currentUser.id);
            if (!u) { reject(new Error('用户不存在')); return; }
            u.balance = (u.balance || 0) + amt;
            _addTx(db, u.id, 'in', amt, 'recharge', null, '账户充值');
            _mockSaveDB(db);
            resolve({ success: true, balance: u.balance });
        }, 100);
    });
}

function mockGetMyBills() {
    return new Promise(function(resolve, reject) {
        setTimeout(function() {
            var currentUser = getCurrentUser();
            if (!currentUser) { reject(new Error('请先登录')); return; }
            var db = _mockGetDB();
            _sweep(db); // 先跑惰性结算，保证自动确认的收入也计入账单
            var list = (db.transactions || []).filter(function(t) { return t.userId === currentUser.id; });
            list.sort(function(a, b) { return new Date(b.time) - new Date(a.time); });
            var totalIn = 0, totalOut = 0;
            list.forEach(function(t) {
                if (t.direction === 'in') totalIn += t.amount; else totalOut += t.amount;
            });
            resolve({ list: list, totalIn: totalIn, totalOut: totalOut });
        }, 100);
    });
}

// 记一笔资金流水（账单）。direction: 'in'(收入) | 'out'(支出)
function _addTx(db, userId, direction, amount, category, relatedId, note) {
    if (!db.transactions) db.transactions = [];
    db.transactions.push({
        id: 'tx-' + Date.now() + '-' + Math.floor(Math.random() * 10000),
        userId: userId,
        direction: direction,
        amount: amount,
        category: category,
        relatedId: relatedId || null,
        note: note || '',
        time: new Date().toISOString()
    });
}

// ---------- 系统消息 ----------

// 保证系统消息时间严格递增：同一操作连发多条（如接单+预付）也能按插入顺序显示
var _lastSysTime = 0;
function _sysNowIso() {
    var t = Date.now();
    if (t <= _lastSysTime) t = _lastSysTime + 1;
    _lastSysTime = t;
    return new Date(t).toISOString();
}

// 向某会话插入一条系统消息（senderId='system'，居中显示、不计未读），并同步会话预览。
function _addSystemMessage(db, chatId, content, taskId, taskTitle) {
    if (!chatId) return;
    if (!db.messages) db.messages = [];
    var now = _sysNowIso();
    db.messages.push({
        id: 'sys-' + Date.now() + '-' + Math.floor(Math.random() * 10000),
        chatId: chatId,
        senderId: 'system',
        senderName: '系统',
        receiverId: '',
        content: content,
        time: now,
        taskId: taskId || '',
        taskTitle: taskTitle || '',
        withdrawn: false,
        read: true
    });
    for (var i = 0; i < (db.conversations || []).length; i++) {
        if (db.conversations[i].id === chatId) {
            db.conversations[i].lastMessage = content;
            db.conversations[i].lastTime = now;
            db.conversations[i].lastMessageSenderId = 'system';
            break;
        }
    }
}

// ---------- 订单系统内部工具：惰性结算 ----------

// 自动确认：in_progress 且过了 autoConfirmAt 的订单自动完成并结算给收款方
function _autoConfirmSweep(db) {
    var changed = false;
    var nowMs = Date.now();
    (db.orders || []).forEach(function(o) {
        if (o.status === 'in_progress' && o.autoConfirmAt && nowMs >= new Date(o.autoConfirmAt).getTime()) {
            o.status = 'completed';
            o.payerConfirmed = true;
            o.earnerConfirmed = true;
            o.completedAt = new Date().toISOString();
            o.reviewDeadline = new Date(nowMs + AUTO_DAYS * 86400000).toISOString();
            var earner = _findUserInDb(db, o.earnerId);
            if (earner) earner.balance = (earner.balance || 0) + o.amount;
            var swPost = _findPostInDb(db, o.postId);
            if (o.amount > 0) {
                _addTx(db, o.earnerId, 'in', o.amount, 'order', o.id, '订单收入：' + (swPost ? swPost.title : '') + '（自动确认）');
            }
            _addSystemMessage(db, o.chatId, o.amount > 0
                ? ('已超时自动确认，报酬 ' + o.amount + ' 元已结算给 ' + (earner ? earner.username : '收款方'))
                : '已超时自动确认，任务完成', o.postId, swPost ? swPost.title : '');
            changed = true;
        }
    });
    return changed;
}

// 超时未评价 → 系统补 5★ 默认好评（auto:true）。仅 completed 订单；closed（争议结案）不补
function _ensureDefaultReviews(db) {
    var changed = false;
    var nowMs = Date.now();
    if (!db.reviews) db.reviews = [];
    (db.orders || []).forEach(function(o) {
        if (o.status !== 'completed') return;
        if (!o.reviewDeadline || nowMs < new Date(o.reviewDeadline).getTime()) return;
        [[o.payerId, o.earnerId], [o.earnerId, o.payerId]].forEach(function(pair) {
            var fromId = pair[0], toId = pair[1];
            var exists = db.reviews.some(function(r) { return r.orderId === o.id && r.fromUserId === fromId; });
            if (exists) return;
            var from = _mockGetUserById(fromId), to = _mockGetUserById(toId);
            db.reviews.push({
                id: 'r-auto-' + o.id + '-' + fromId,
                orderId: o.id, taskId: o.postId,
                fromUserId: fromId, fromUserName: from ? from.username : '',
                toUserId: toId, toUserName: to ? to.username : '',
                rating: 5, content: '（用户未评价，默认好评）',
                images: [], time: new Date().toISOString(), auto: true
            });
            changed = true;
        });
    });
    return changed;
}

// 读类接口统一先跑一遍惰性结算，保证看到的是结算后的最新状态
function _sweep(db) {
    var a = _autoConfirmSweep(db);
    var b = _ensureDefaultReviews(db);
    if (a || b) _mockSaveDB(db);
}

function _findActiveOrderByPost(db, postId) {
    var orders = db.orders || [];
    for (var i = orders.length - 1; i >= 0; i--) {
        var s = orders[i].status;
        if (orders[i].postId === postId && (s === 'pending' || s === 'in_progress' || s === 'disputed')) {
            return orders[i];
        }
    }
    return null;
}

function _findOrderById(db, orderId) {
    var orders = db.orders || [];
    for (var i = 0; i < orders.length; i++) {
        if (orders[i].id === orderId) return orders[i];
    }
    return null;
}

// 在「同一个 db 对象」里查用户。改余额等写操作必须用它，
// 不能用 _mockGetUserById（那会重新 getDB() 出另一个副本，改动会在 saveDB 时丢失）
function _findUserInDb(db, id) {
    for (var i = 0; i < (db.users || []).length; i++) {
        if (db.users[i].id === id) return db.users[i];
    }
    return null;
}

// 同理：要写帖子（如改 status）必须在同一个 db 里取，不能用 _mockGetTaskById
function _findPostInDb(db, id) {
    for (var i = 0; i < (db.tasks || []).length; i++) {
        if (db.tasks[i].id === id) return db.tasks[i];
    }
    return null;
}

// 是否已实名认证——发布/下单/接单/确认等写操作前置校验（未登录或未实名只能浏览）
function _isVerified(db, userId) {
    var u = _findUserInDb(db, userId);
    return !!(u && u.authStatus === 'verified');
}

// 悬赏(payer)帖过了截止时间即失效：不再展示、不可接单。服务/组队帖不设硬截止。
function _isExpired(post) {
    return !!(post && post.publisherSide === 'payer' && post.deadline &&
        new Date(post.deadline).getTime() < Date.now());
}

// ---------- 帖子 ----------

function mockGetTasks(filters) {
    return new Promise(function(resolve) {
        setTimeout(function() {
            var db = _mockGetDB();
            // 大厅只展示挂出来、且未过截止时间的帖子
            var result = db.tasks.filter(function(t) { return t.status === 'open' && !_isExpired(t); });

            if (filters) {
                // side: 'payer'(别人出钱,我能赚) | 'earner'(别人收钱,我要花钱) | 'none'(纯互助) | 'all'
                if (filters.side && filters.side !== 'all') {
                    result = result.filter(function(t) { return t.publisherSide === filters.side; });
                }
                if (filters.categories && filters.categories.length > 0) {
                    result = result.filter(function(t) { return filters.categories.indexOf(t.category) >= 0; });
                }
                if (filters.keyword) {
                    var kw = filters.keyword.toLowerCase();
                    result = result.filter(function(t) {
                        return t.title.toLowerCase().indexOf(kw) >= 0 ||
                               t.description.toLowerCase().indexOf(kw) >= 0 ||
                               t.publisherName.toLowerCase().indexOf(kw) >= 0;
                    });
                }
                if (filters.sort) {
                    switch (filters.sort) {
                        case 'time_asc':
                            result.sort(function(a, b) { return new Date(a.publishTime) - new Date(b.publishTime); });
                            break;
                        case 'time_desc':
                            result.sort(function(a, b) { return new Date(b.publishTime) - new Date(a.publishTime); });
                            break;
                        case 'reward_asc':
                            result.sort(function(a, b) { return a.rewardValue - b.rewardValue; });
                            break;
                        case 'reward_desc':
                            result.sort(function(a, b) { return b.rewardValue - a.rewardValue; });
                            break;
                        case 'credit_asc':
                            result.sort(function(a, b) { return a.publisherCredit - b.publisherCredit; });
                            break;
                        case 'credit_desc':
                            result.sort(function(a, b) { return b.publisherCredit - a.publisherCredit; });
                            break;
                        default:
                            break;
                    }
                }
            }

            resolve(result);
        }, 150);
    });
}

function mockGetTaskDetail(id) {
    return new Promise(function(resolve) {
        setTimeout(function() {
            var task = _mockGetTaskById(id);
            if (task) {
                var publisher = _mockGetUserById(task.publisherId);
                resolve({
                    task: task,
                    publisher: publisher ? {
                        id: publisher.id,
                        username: publisher.username,
                        avatar: publisher.avatar,
                        creditScore: publisher.creditScore
                    } : null
                });
            } else {
                resolve(null);
            }
        }, 100);
    });
}

function mockPublishPost(data) {
    return new Promise(function(resolve, reject) {
        setTimeout(function() {
            var currentUser = getCurrentUser();
            if (!currentUser) {
                reject(new Error('请先登录'));
                return;
            }
            var side = (data.publisherSide === 'earner' || data.publisherSide === 'none') ? data.publisherSide : 'payer';
            var db = _mockGetDB();
            if (_isAdminUser(db, currentUser.id)) {
                reject(new Error('管理员账号不参与交易'));
                return;
            }
            if (!_isVerified(db, currentUser.id)) {
                reject(new Error('请先完成实名认证后再发布'));
                return;
            }
            if (side === 'payer' && data.deadline && new Date(data.deadline).getTime() < Date.now()) {
                reject(new Error('截止时间不能早于当前时间'));
                return;
            }
            // 注：发布不再预付/冻结，冻结发生在「发布者接受订单」时
            var newPost = {
                id: 't' + (db.tasks.length + 1) + '-' + Date.now(),
                title: data.title,
                publisherSide: side,
                category: data.category,
                description: data.description,
                publisherId: currentUser.id,
                publisherName: currentUser.username,
                publisherCredit: currentUser.creditScore || 5.0,
                reward: data.reward,
                rewardValue: parseRewardValue(data.reward),
                deadline: data.deadline || new Date(Date.now() + 30 * 86400000).toISOString(),
                publishTime: new Date().toISOString(),
                status: 'open',
                contact: data.contact || '站内联系',
                images: data.images || [],
                serviceTime: data.serviceTime || ''
            };
            db.tasks.unshift(newPost);
            _mockSaveDB(db);
            resolve({ success: true, task: newPost });
        }, 200);
    });
}

function mockGetMyPosts() {
    return new Promise(function(resolve, reject) {
        setTimeout(function() {
            var currentUser = getCurrentUser();
            if (!currentUser) {
                reject(new Error('请先登录'));
                return;
            }
            var db = _mockGetDB();
            var result = db.tasks.filter(function(t) { return t.publisherId === currentUser.id; });
            resolve(result);
        }, 150);
    });
}

// ---------- 订单 ----------

function mockCreateOrder(postId, chatId) {
    return new Promise(function(resolve, reject) {
        setTimeout(function() {
            var currentUser = getCurrentUser();
            if (!currentUser) {
                reject(new Error('请先登录'));
                return;
            }
            var db = _mockGetDB();
            if (_isAdminUser(db, currentUser.id)) {
                reject(new Error('管理员账号不参与交易'));
                return;
            }
            if (!_isVerified(db, currentUser.id)) {
                reject(new Error('请先完成实名认证后再操作'));
                return;
            }
            var post = _mockGetTaskById(postId);
            if (!post) {
                reject(new Error('帖子不存在'));
                return;
            }
            if (post.publisherId === currentUser.id) {
                reject(new Error('不能对自己发布的帖子下单/接单'));
                return;
            }
            if (_isExpired(post)) {
                reject(new Error('该悬赏已过截止时间，无法接单'));
                return;
            }
            // 与后端一致：已关闭的帖子（含管理员下架）不可再下单
            if (post.status === 'closed') {
                reject(new Error('该帖子已关闭，无法下单'));
                return;
            }
            // 悬赏帖(payer)一次性：同帖只允许一个未完成订单；
            // 服务帖(earner)/组队帖(none)可复用：允许多人并发下单/报名
            if (post.publisherSide === 'payer' && _findActiveOrderByPost(db, postId)) {
                reject(new Error('该帖子已有进行中的订单'));
                return;
            }
            // 角色：发布者出钱(payer)→发布者付款、响应者收款；发布者收钱(earner)→反之
            // 纯互助(none)不涉及金钱，payerId/earnerId 仅作两方槽位、金额恒为 0
            var payerId, earnerId;
            if (post.publisherSide === 'payer') {
                payerId = post.publisherId;
                earnerId = currentUser.id;
            } else {
                earnerId = post.publisherId;
                payerId = currentUser.id;
            }
            var amount = post.publisherSide === 'none' ? 0 : (post.rewardValue || parseRewardValue(post.reward));
            var order = {
                id: 'o-' + Date.now(),
                postId: postId,
                chatId: chatId,
                payerId: payerId,
                earnerId: earnerId,
                amount: amount,
                status: 'pending',
                payerConfirmed: false,
                earnerConfirmed: false,
                createdAt: new Date().toISOString(),
                acceptedAt: null,
                completedAt: null,
                autoConfirmAt: null,
                reviewDeadline: null
            };
            if (!db.orders) db.orders = [];
            db.orders.push(order);

            // 确保会话存在（响应者视角：对方=发布者）
            var convExists = (db.conversations || []).some(function(c) { return c.id === chatId; });
            if (!convExists) {
                var partner = _mockGetUserById(post.publisherId);
                if (!db.conversations) db.conversations = [];
                db.conversations.push({
                    id: chatId,
                    partnerId: post.publisherId,
                    partnerName: partner ? partner.username : '未知用户',
                    partnerAvatar: partner ? partner.avatar : '',
                    taskId: postId,
                    taskTitle: post.title,
                    lastMessage: '已发起订单，等待对方接受',
                    lastTime: new Date().toISOString()
                });
            }

            // 系统消息：响应方发起订单
            var createActor = currentUser.username;
            var createText = post.publisherSide === 'none' ? (createActor + ' 申请参加，等待发起者接受')
                : (post.publisherSide === 'earner' ? (createActor + ' 发起下单，等待对方接受')
                : (createActor + ' 申请接单，等待对方接受'));
            _addSystemMessage(db, chatId, createText, postId, post.title);

            _mockSaveDB(db);
            resolve({ success: true, order: order });
        }, 200);
    });
}

function mockAcceptOrder(orderId) {
    return new Promise(function(resolve, reject) {
        setTimeout(function() {
            var currentUser = getCurrentUser();
            if (!currentUser) {
                reject(new Error('请先登录'));
                return;
            }
            var db = _mockGetDB();
            if (!_isVerified(db, currentUser.id)) {
                reject(new Error('请先完成实名认证后再操作'));
                return;
            }
            var order = _findOrderById(db, orderId);
            if (!order) {
                reject(new Error('订单不存在'));
                return;
            }
            if (order.status !== 'pending') {
                reject(new Error('订单当前状态不可接受'));
                return;
            }
            var post = _findPostInDb(db, order.postId);
            if (!post || post.publisherId !== currentUser.id) {
                reject(new Error('只有帖子发布者可以接受订单'));
                return;
            }
            // 接受时冻结付款方余额
            var payer = _findUserInDb(db, order.payerId);
            if (!payer || (payer.balance || 0) < order.amount) {
                reject(new Error('付款方余额不足，无法开始（需要 ' + order.amount + ' 元）'));
                return;
            }
            payer.balance -= order.amount;
            if (order.amount > 0) {
                _addTx(db, order.payerId, 'out', order.amount, 'order', order.id, '订单支付：' + post.title);
            }
            order.status = 'in_progress';
            order.acceptedAt = new Date().toISOString();
            // 悬赏帖一次性：进行中即从大厅下架；服务帖可复用，保持 open
            if (post.publisherSide === 'payer') {
                post.status = 'closed';
            }
            // 系统消息：接受订单（+ 预付冻结）
            _addSystemMessage(db, order.chatId, currentUser.username + ' 接受了订单，任务开始执行', order.postId, post.title);
            if (order.amount > 0) {
                _addSystemMessage(db, order.chatId, (payer ? payer.username : '付款方') + ' 已预付报酬 ' + order.amount + ' 元（已冻结）', order.postId, post.title);
            }
            _mockSaveDB(db);
            resolve({ success: true, order: order });
        }, 200);
    });
}

function mockCancelOrder(orderId) {
    return new Promise(function(resolve, reject) {
        setTimeout(function() {
            var currentUser = getCurrentUser();
            if (!currentUser) {
                reject(new Error('请先登录'));
                return;
            }
            var db = _mockGetDB();
            if (!_isVerified(db, currentUser.id)) {
                reject(new Error('请先完成实名认证后再操作'));
                return;
            }
            var order = _findOrderById(db, orderId);
            if (!order) {
                reject(new Error('订单不存在'));
                return;
            }
            if (order.status !== 'pending') {
                reject(new Error('只有待接受的订单可以取消'));
                return;
            }
            if (currentUser.id !== order.payerId && currentUser.id !== order.earnerId) {
                reject(new Error('你不是该订单的参与者'));
                return;
            }
            order.status = 'cancelled';
            // pending 阶段未冻结资金，无需退款
            var cancelPost = _findPostInDb(db, order.postId);
            _addSystemMessage(db, order.chatId, currentUser.username + ' 取消了订单', order.postId, cancelPost ? cancelPost.title : '');
            _mockSaveDB(db);
            resolve({ success: true, order: order });
        }, 200);
    });
}

function mockConfirmOrder(orderId) {
    return new Promise(function(resolve, reject) {
        setTimeout(function() {
            var currentUser = getCurrentUser();
            if (!currentUser) {
                reject(new Error('请先登录'));
                return;
            }
            var db = _mockGetDB();
            if (!_isVerified(db, currentUser.id)) {
                reject(new Error('请先完成实名认证后再操作'));
                return;
            }
            var order = _findOrderById(db, orderId);
            if (!order) {
                reject(new Error('订单不存在'));
                return;
            }
            if (order.status !== 'in_progress') {
                reject(new Error('当前状态不可确认完成'));
                return;
            }
            if (currentUser.id === order.payerId) {
                order.payerConfirmed = true;
            } else if (currentUser.id === order.earnerId) {
                order.earnerConfirmed = true;
            } else {
                reject(new Error('你不是该订单的参与者'));
                return;
            }
            // 系统消息：确认方
            var cfPost = _findPostInDb(db, order.postId);
            var cfTitle = cfPost ? cfPost.title : '';
            _addSystemMessage(db, order.chatId, currentUser.username + ' 已确认完成', order.postId, cfTitle);
            if (order.payerConfirmed && order.earnerConfirmed) {
                // 双方都确认 → 完成并结算给收款方
                order.status = 'completed';
                order.completedAt = new Date().toISOString();
                order.reviewDeadline = new Date(Date.now() + AUTO_DAYS * 86400000).toISOString();
                var earner = _findUserInDb(db, order.earnerId);
                if (earner) earner.balance = (earner.balance || 0) + order.amount;
                if (order.amount > 0) {
                    _addTx(db, order.earnerId, 'in', order.amount, 'order', order.id, '订单收入：' + cfTitle);
                }
                // 系统消息：双方确认，结算
                _addSystemMessage(db, order.chatId, order.amount > 0
                    ? ('双方已确认，报酬 ' + order.amount + ' 元已结算给 ' + (earner ? earner.username : '收款方'))
                    : '双方已确认，任务完成', order.postId, cfTitle);
            } else if (!order.autoConfirmAt) {
                // 首个确认 → 挂上自动确认计时
                order.autoConfirmAt = new Date(Date.now() + AUTO_DAYS * 86400000).toISOString();
            }
            _mockSaveDB(db);
            resolve({ success: true, order: order });
        }, 200);
    });
}

// ---------- 争议与管理员 ----------

function _isAdminUser(db, userId) {
    var u = _findUserInDb(db, userId);
    return !!(u && u.role === 1);
}

// 发起申诉：参与者、仅 in_progress。资金保持冻结（不退不结），等待管理员裁决。
function mockDisputeOrder(orderId, reason) {
    return new Promise(function(resolve, reject) {
        setTimeout(function() {
            var currentUser = getCurrentUser();
            if (!currentUser) { reject(new Error('请先登录')); return; }
            var db = _mockGetDB();
            if (!_isVerified(db, currentUser.id)) { reject(new Error('请先完成实名认证后再操作')); return; }
            var order = _findOrderById(db, orderId);
            if (!order) { reject(new Error('订单不存在')); return; }
            if (currentUser.id !== order.payerId && currentUser.id !== order.earnerId) {
                reject(new Error('你不是该订单的参与者')); return;
            }
            if (order.status !== 'in_progress') { reject(new Error('仅进行中的订单可以申诉')); return; }
            var r = String(reason || '').trim();
            if (!r) { reject(new Error('请填写申诉理由')); return; }

            order.status = 'disputed';
            order.disputeReason = r;
            order.disputedBy = currentUser.id;
            order.disputedAt = new Date().toISOString();

            var post = _findPostInDb(db, order.postId);
            _addSystemMessage(db, order.chatId,
                currentUser.username + ' 发起了申诉：' + r + '。订单已冻结，等待管理员处理',
                order.postId, post ? post.title : '');
            _mockSaveDB(db);
            resolve({ success: true, order: order });
        }, 200);
    });
}

// 管理员订单列表公共装配：{ order, postTitle, payerName, earnerName, disputedByName }
function _adminOrderItem(db, o) {
    var post = _findPostInDb(db, o.postId);
    var payer = _findUserInDb(db, o.payerId);
    var earner = _findUserInDb(db, o.earnerId);
    var by = o.disputedBy ? _findUserInDb(db, o.disputedBy) : null;
    return {
        order: o,
        postTitle: post ? post.title : '',
        payerName: payer ? payer.username : '',
        earnerName: earner ? earner.username : '',
        disputedByName: by ? by.username : ''
    };
}

function mockGetAdminDisputes() {
    return new Promise(function(resolve, reject) {
        setTimeout(function() {
            var currentUser = getCurrentUser();
            var db = _mockGetDB();
            if (!currentUser || !_isAdminUser(db, currentUser.id)) { reject(new Error('无管理员权限')); return; }
            var list = (db.orders || []).filter(function(o) { return o.status === 'disputed'; })
                .map(function(o) { return _adminOrderItem(db, o); });
            list.sort(function(a, b) { return new Date(b.order.disputedAt || 0) - new Date(a.order.disputedAt || 0); });
            resolve(list);
        }, 100);
    });
}

// 管理员裁决：refund 全额退付款方 / settle 全额结算收款方 / partial 部分给收款方、其余退付款方。
// 结案 → closed，按裁决转账并记账单流水，聊天发系统消息。closed 订单不进入评价流程。
function mockResolveDispute(orderId, decision, amountToEarner, note) {
    return new Promise(function(resolve, reject) {
        setTimeout(function() {
            var currentUser = getCurrentUser();
            var db = _mockGetDB();
            if (!currentUser || !_isAdminUser(db, currentUser.id)) { reject(new Error('无管理员权限')); return; }
            var order = _findOrderById(db, orderId);
            if (!order) { reject(new Error('订单不存在')); return; }
            if (order.status !== 'disputed') { reject(new Error('该订单不在争议处理中')); return; }
            var noteText = String(note || '').trim();
            if (!noteText) { reject(new Error('请填写处理说明')); return; }

            var amount = order.amount || 0;
            var earnerGets;
            if (decision === 'refund') {
                earnerGets = 0;
            } else if (decision === 'settle') {
                earnerGets = amount;
            } else if (decision === 'partial') {
                earnerGets = Number(amountToEarner);
                if (!isFinite(earnerGets) || earnerGets <= 0 || earnerGets >= amount) {
                    reject(new Error('部分结算金额需大于 0 且小于订单金额 ' + amount + ' 元')); return;
                }
            } else {
                reject(new Error('无效的处理方式')); return;
            }
            var payerGets = amount - earnerGets;

            var post = _findPostInDb(db, order.postId);
            var title = post ? post.title : '';
            var payer = _findUserInDb(db, order.payerId);
            var earner = _findUserInDb(db, order.earnerId);
            if (payerGets > 0 && payer) {
                payer.balance = (payer.balance || 0) + payerGets;
                _addTx(db, order.payerId, 'in', payerGets, 'order', order.id, '仲裁退款：' + title);
            }
            if (earnerGets > 0 && earner) {
                earner.balance = (earner.balance || 0) + earnerGets;
                _addTx(db, order.earnerId, 'in', earnerGets, 'order', order.id, '订单收入（仲裁）：' + title);
            }

            order.status = 'closed';
            order.resolution = decision;
            order.resolutionAmountToEarner = earnerGets;
            order.resolutionNote = noteText;
            order.resolvedAt = new Date().toISOString();

            var text;
            if (amount <= 0) {
                text = '管理员已结案（说明：' + noteText + '）';
            } else if (decision === 'refund') {
                text = '管理员已结案：全额退款，' + amount + ' 元已退还 ' + (payer ? payer.username : '付款方') + '（说明：' + noteText + '）';
            } else if (decision === 'settle') {
                text = '管理员已结案：全额结算，' + amount + ' 元已支付给 ' + (earner ? earner.username : '收款方') + '（说明：' + noteText + '）';
            } else {
                text = '管理员已结案：部分结算，' + (earner ? earner.username : '收款方') + ' 获得 ' + earnerGets + ' 元，' +
                    (payer ? payer.username : '付款方') + ' 获退 ' + payerGets + ' 元（说明：' + noteText + '）';
            }
            _addSystemMessage(db, order.chatId, text, order.postId, title);
            _mockSaveDB(db);
            resolve({ success: true, order: order });
        }, 200);
    });
}

function mockGetAdminOrders() {
    return new Promise(function(resolve, reject) {
        setTimeout(function() {
            var currentUser = getCurrentUser();
            var db = _mockGetDB();
            if (!currentUser || !_isAdminUser(db, currentUser.id)) { reject(new Error('无管理员权限')); return; }
            _sweep(db);
            var list = (db.orders || []).map(function(o) { return _adminOrderItem(db, o); });
            list.sort(function(a, b) { return new Date(b.order.createdAt || 0) - new Date(a.order.createdAt || 0); });
            resolve(list);
        }, 100);
    });
}

function mockGetAdminPosts() {
    return new Promise(function(resolve, reject) {
        setTimeout(function() {
            var currentUser = getCurrentUser();
            var db = _mockGetDB();
            if (!currentUser || !_isAdminUser(db, currentUser.id)) { reject(new Error('无管理员权限')); return; }
            var list = (db.tasks || []).slice();
            list.sort(function(a, b) { return new Date(b.publishTime || 0) - new Date(a.publishTime || 0); });
            resolve(list);
        }, 100);
    });
}

function mockAdminClosePost(postId) {
    return new Promise(function(resolve, reject) {
        setTimeout(function() {
            var currentUser = getCurrentUser();
            var db = _mockGetDB();
            if (!currentUser || !_isAdminUser(db, currentUser.id)) { reject(new Error('无管理员权限')); return; }
            var post = _findPostInDb(db, postId);
            if (!post) { reject(new Error('帖子不存在')); return; }
            if (post.status === 'closed') { reject(new Error('该帖子已是下架/关闭状态')); return; }
            post.status = 'closed';
            _mockSaveDB(db);
            resolve({ success: true, post: post });
        }, 200);
    });
}

function mockGetOrder(chatId) {
    return new Promise(function(resolve) {
        setTimeout(function() {
            var db = _mockGetDB();
            _sweep(db);
            var orders = (db.orders || []).filter(function(o) { return o.chatId === chatId; });
            // 优先返回进行中的订单
            var active = null, latest = null;
            for (var i = 0; i < orders.length; i++) {
                var s = orders[i].status;
                if (s === 'pending' || s === 'in_progress' || s === 'disputed') active = orders[i];
                if (!latest || new Date(orders[i].createdAt) > new Date(latest.createdAt)) latest = orders[i];
            }
            resolve(active || latest || null);
        }, 100);
    });
}

function mockGetOrderHistory(chatId) {
    return new Promise(function(resolve) {
        setTimeout(function() {
            var db = _mockGetDB();
            _sweep(db);
            var result = (db.orders || []).filter(function(o) { return o.chatId === chatId; });
            result.sort(function(a, b) { return new Date(a.createdAt) - new Date(b.createdAt); });
            resolve(result);
        }, 100);
    });
}

function mockGetMyOrders(moneyRole) {
    return new Promise(function(resolve, reject) {
        setTimeout(function() {
            var currentUser = getCurrentUser();
            if (!currentUser) {
                reject(new Error('请先登录'));
                return;
            }
            var db = _mockGetDB();
            _sweep(db);
            var result = (db.orders || []).filter(function(o) {
                var isPayer = o.payerId === currentUser.id;
                var isEarner = o.earnerId === currentUser.id;
                if (!isPayer && !isEarner) return false;
                if (moneyRole === 'payer') return isPayer;
                if (moneyRole === 'earner') return isEarner;
                return true;
            }).map(function(o) {
                var post = _mockGetTaskById(o.postId);
                var myRole = o.payerId === currentUser.id ? 'payer' : 'earner';
                var partnerId = myRole === 'payer' ? o.earnerId : o.payerId;
                var partner = _mockGetUserById(partnerId);
                return {
                    order: o,
                    post: post,
                    title: post ? post.title : '未知',
                    myRole: myRole,
                    partnerId: partnerId,
                    partnerName: partner ? partner.username : '未知'
                };
            });
            result.sort(function(a, b) { return new Date(b.order.createdAt) - new Date(a.order.createdAt); });
            resolve(result);
        }, 150);
    });
}

// ---------- 消息 ----------

function mockGetConversations() {
    return new Promise(function(resolve) {
        setTimeout(function() {
            var currentUser = getCurrentUser();
            if (!currentUser) {
                resolve([]);
                return;
            }
            var db = _mockGetDB();
            var result = [];

            (db.conversations || []).forEach(function(c) {
                // 汇总该会话的参与者：消息发送/接收方 + 订单双方 + 帖子发布者。
                // 帖子发布者一定是会话的一方，这样即便响应者只发了消息、还没下单
                // （消息 receiverId 为空、也无订单可查），也能定位出对方是谁。
                var participants = {};
                (db.messages || []).forEach(function(m) {
                    if (m.chatId === c.id) {
                        if (m.senderId && m.senderId !== 'system') participants[m.senderId] = true;
                        if (m.receiverId) participants[m.receiverId] = true;
                    }
                });
                (db.orders || []).forEach(function(o) {
                    if (o.chatId === c.id) {
                        if (o.payerId) participants[o.payerId] = true;
                        if (o.earnerId) participants[o.earnerId] = true;
                    }
                });
                if (c.taskId) {
                    for (var ti = 0; ti < db.tasks.length; ti++) {
                        if (db.tasks[ti].id === c.taskId) {
                            if (db.tasks[ti].publisherId) participants[db.tasks[ti].publisherId] = true;
                            break;
                        }
                    }
                }

                var isParticipant = !!participants[currentUser.id];
                var partnerId = null;
                if (isParticipant) {
                    for (var pid in participants) {
                        if (pid !== currentUser.id) { partnerId = pid; break; }
                    }
                }

                if (isParticipant && partnerId) {
                    var partner = _mockGetUserById(partnerId);
                    // 预览取该会话「实际最新一条消息」，避免会话上写死的 lastMessage 与真实消息不同步
                    var chatMsgs = (db.messages || []).filter(function(m) { return m.chatId === c.id; });
                    var lastMsg = null;
                    for (var k = 0; k < chatMsgs.length; k++) {
                        if (!lastMsg || new Date(chatMsgs[k].time) > new Date(lastMsg.time)) lastMsg = chatMsgs[k];
                    }
                    result.push({
                        id: c.id,
                        partnerId: partnerId,
                        partnerName: partner ? partner.username : '未知用户',
                        partnerAvatar: partner ? partner.avatar : '',
                        taskId: c.taskId,
                        taskTitle: c.taskTitle,
                        lastMessage: lastMsg ? lastMsg.content : c.lastMessage,
                        lastTime: lastMsg ? lastMsg.time : c.lastTime,
                        lastMessageSenderId: lastMsg ? lastMsg.senderId : (c.lastMessageSenderId || '')
                    });
                }
            });

            result.sort(function(a, b) {
                return new Date(b.lastTime) - new Date(a.lastTime);
            });

            resolve(result);
        }, 100);
    });
}

function mockGetMessages(chatId) {
    return new Promise(function(resolve) {
        setTimeout(function() {
            var db = _mockGetDB();
            var result = (db.messages || []).filter(function(m) { return m.chatId === chatId; });
            result.sort(function(a, b) { return new Date(a.time) - new Date(b.time); });
            resolve(result);
        }, 100);
    });
}

// 当前用户参与的会话 id 集合（发过/收过消息、有订单关系，或是会话所属帖子的发布者）
function _userChatIds(db, userId) {
    var ids = {};
    (db.messages || []).forEach(function(m) {
        if (m.senderId === userId || m.receiverId === userId) ids[m.chatId] = true;
    });
    (db.orders || []).forEach(function(o) {
        if (o.payerId === userId || o.earnerId === userId) ids[o.chatId] = true;
    });
    // 帖子发布者也算参与其帖子的会话——响应者未下单前，发布者靠这条被纳入
    (db.conversations || []).forEach(function(c) {
        if (!c.taskId) return;
        for (var ti = 0; ti < db.tasks.length; ti++) {
            if (db.tasks[ti].id === c.taskId) {
                if (db.tasks[ti].publisherId === userId) ids[c.id] = true;
                break;
            }
        }
    });
    return ids;
}

// 未读 = 我参与的会话里，别人(非我、非系统)发的、read===false 的消息
function mockGetUnreadCounts() {
    return new Promise(function(resolve) {
        setTimeout(function() {
            var currentUser = getCurrentUser();
            if (!currentUser) { resolve({ total: 0, byChat: {} }); return; }
            var db = _mockGetDB();
            var myChats = _userChatIds(db, currentUser.id);
            var byChat = {};
            var total = 0;
            (db.messages || []).forEach(function(m) {
                if (!myChats[m.chatId]) return;
                if (m.senderId === currentUser.id || m.senderId === 'system') return;
                if (m.read === false) {
                    byChat[m.chatId] = (byChat[m.chatId] || 0) + 1;
                    total++;
                }
            });
            resolve({ total: total, byChat: byChat });
        }, 50);
    });
}

function mockMarkMessagesRead(chatId) {
    return new Promise(function(resolve) {
        setTimeout(function() {
            var currentUser = getCurrentUser();
            if (!currentUser) { resolve({ success: true, updated: 0 }); return; }
            var db = _mockGetDB();
            var updated = 0;
            (db.messages || []).forEach(function(m) {
                if (m.chatId === chatId && m.senderId !== currentUser.id &&
                    m.senderId !== 'system' && m.read === false) {
                    m.read = true;
                    updated++;
                }
            });
            if (updated > 0) _mockSaveDB(db);
            resolve({ success: true, updated: updated });
        }, 50);
    });
}

function mockSendMessage(chatId, content) {
    return new Promise(function(resolve, reject) {
        setTimeout(function() {
            var currentUser = getCurrentUser();
            if (!currentUser) {
                reject(new Error('请先登录'));
                return;
            }
            var db = _mockGetDB();
            var newMsg = {
                id: 'm' + Date.now(),
                chatId: chatId,
                senderId: currentUser.id,
                senderName: currentUser.username,
                receiverId: '',
                content: content,
                time: new Date().toISOString(),
                taskId: '',
                taskTitle: '',
                withdrawn: false,
                read: false
            };
            if (!db.messages) db.messages = [];
            db.messages.push(newMsg);

            for (var i = 0; i < db.conversations.length; i++) {
                if (db.conversations[i].id === chatId) {
                    db.conversations[i].lastMessage = content;
                    db.conversations[i].lastTime = newMsg.time;
                    db.conversations[i].lastMessageSenderId = currentUser.id;
                    break;
                }
            }
            _mockSaveDB(db);
            resolve(newMsg);
        }, 100);
    });
}

// 直接转账：从 fromId 扣款、加到 toId（无托管）。余额不足则失败。
function _transfer(db, fromId, toId, amount) {
    var from = _findUserInDb(db, fromId);
    var to = _findUserInDb(db, toId);
    if (!from || !to) return { ok: false, error: '用户不存在' };
    if ((from.balance || 0) < amount) return { ok: false, error: '余额不足，请先充值' };
    from.balance -= amount;
    to.balance = (to.balance || 0) + amount;
    return { ok: true };
}

function _findMsgInDb(db, messageId) {
    for (var i = 0; i < (db.messages || []).length; i++) {
        if (db.messages[i].id === messageId) return db.messages[i];
    }
    return null;
}

function mockSendPaymentCard(chatId, partnerId, kind, amount) {
    return new Promise(function(resolve, reject) {
        setTimeout(function() {
            var currentUser = getCurrentUser();
            if (!currentUser) { reject(new Error('请先登录')); return; }
            var amt = Number(amount);
            if (!isFinite(amt) || amt <= 0) { reject(new Error('请输入正确的金额')); return; }
            if (amt > 100000) { reject(new Error('单笔金额不能超过 100000 元')); return; }
            if (!partnerId || partnerId === currentUser.id) { reject(new Error('无效的收付款对象')); return; }
            var db = _mockGetDB();
            if (_isAdminUser(db, currentUser.id)) { reject(new Error('管理员账号不参与交易')); return; }
            if (!_isVerified(db, currentUser.id)) { reject(new Error('请先完成实名认证后再操作')); return; }

            var payerId, receiverId, status, paidAt = null;
            if (kind === 'transfer') {
                // 我向对方转账：立即扣款到账
                payerId = currentUser.id; receiverId = partnerId;
                var r = _transfer(db, payerId, receiverId, amt);
                if (!r.ok) { reject(new Error(r.error)); return; }
                status = 'paid'; paidAt = new Date().toISOString();
            } else {
                // 我发起收款：等待对方(付款方)支付
                kind = 'request';
                payerId = partnerId; receiverId = currentUser.id;
                status = 'pending';
            }
            var content = (kind === 'request' ? '[收款] ¥' : '[转账] ¥') + amt;
            var msg = {
                id: 'm' + Date.now(),
                chatId: chatId,
                senderId: currentUser.id,
                senderName: currentUser.username,
                receiverId: partnerId,
                content: content,
                time: new Date().toISOString(),
                taskId: '', taskTitle: '',
                withdrawn: false, read: false,
                type: 'payment',
                payment: { kind: kind, amount: amt, payerId: payerId, receiverId: receiverId, status: status, paidAt: paidAt }
            };
            if (!db.messages) db.messages = [];
            db.messages.push(msg);
            for (var i = 0; i < (db.conversations || []).length; i++) {
                if (db.conversations[i].id === chatId) {
                    db.conversations[i].lastMessage = content;
                    db.conversations[i].lastTime = msg.time;
                    db.conversations[i].lastMessageSenderId = currentUser.id;
                    break;
                }
            }
            if (kind === 'transfer') {
                var pName = (_findUserInDb(db, partnerId) || {}).username || '对方';
                _addTx(db, payerId, 'out', amt, 'payment', msg.id, '转账给' + pName);
                _addTx(db, receiverId, 'in', amt, 'payment', msg.id, '收到' + currentUser.username + '的转账');
            }
            _mockSaveDB(db);
            resolve({ success: true, message: msg });
        }, 150);
    });
}

function mockPayPaymentCard(messageId) {
    return new Promise(function(resolve, reject) {
        setTimeout(function() {
            var currentUser = getCurrentUser();
            if (!currentUser) { reject(new Error('请先登录')); return; }
            var db = _mockGetDB();
            if (!_isVerified(db, currentUser.id)) { reject(new Error('请先完成实名认证后再操作')); return; }
            var msg = _findMsgInDb(db, messageId);
            if (!msg || msg.type !== 'payment') { reject(new Error('支付单不存在')); return; }
            var p = msg.payment;
            if (p.status !== 'pending') { reject(new Error('该收款已处理')); return; }
            if (p.payerId !== currentUser.id) { reject(new Error('只有付款方可以支付')); return; }
            var r = _transfer(db, p.payerId, p.receiverId, p.amount);
            if (!r.ok) { reject(new Error(r.error)); return; }
            p.status = 'paid';
            p.paidAt = new Date().toISOString();
            var payerName = (_findUserInDb(db, p.payerId) || {}).username || '对方';
            var receiverName = (_findUserInDb(db, p.receiverId) || {}).username || '对方';
            _addTx(db, p.payerId, 'out', p.amount, 'payment', msg.id, '支付给' + receiverName + '的收款');
            _addTx(db, p.receiverId, 'in', p.amount, 'payment', msg.id, '收到' + payerName + '的付款');
            _mockSaveDB(db);
            resolve({ success: true, message: msg });
        }, 150);
    });
}

function mockCancelPaymentCard(messageId) {
    return new Promise(function(resolve, reject) {
        setTimeout(function() {
            var currentUser = getCurrentUser();
            if (!currentUser) { reject(new Error('请先登录')); return; }
            var db = _mockGetDB();
            var msg = _findMsgInDb(db, messageId);
            if (!msg || msg.type !== 'payment') { reject(new Error('支付单不存在')); return; }
            var p = msg.payment;
            if (p.status !== 'pending') { reject(new Error('该收款已处理，无法取消')); return; }
            if (msg.senderId !== currentUser.id) { reject(new Error('只有发起方可以取消')); return; }
            p.status = 'cancelled';
            _mockSaveDB(db);
            resolve({ success: true, message: msg });
        }, 150);
    });
}

function mockWithdrawMessage(messageId) {
    return new Promise(function(resolve, reject) {
        setTimeout(function() {
            var currentUser = getCurrentUser();
            if (!currentUser) {
                reject(new Error('请先登录'));
                return;
            }
            var db = _mockGetDB();
            var msg = null;
            for (var i = 0; i < db.messages.length; i++) {
                if (db.messages[i].id === messageId) {
                    msg = db.messages[i];
                    break;
                }
            }
            if (!msg) {
                reject(new Error('消息不存在'));
                return;
            }
            if (msg.senderId !== currentUser.id) {
                reject(new Error('只能撤回自己发送的消息'));
                return;
            }
            var now = new Date().getTime();
            var msgTime = new Date(msg.time).getTime();
            var diffMinutes = (now - msgTime) / 60000;
            if (diffMinutes > 2) {
                reject(new Error('已超过2分钟，无法撤回'));
                return;
            }
            msg.withdrawn = true;
            msg.originalContent = msg.content;
            msg.content = '消息已撤回';

            for (var j = 0; j < db.conversations.length; j++) {
                if (db.conversations[j].id === msg.chatId) {
                    db.conversations[j].lastMessage = '消息已撤回';
                    break;
                }
            }

            _mockSaveDB(db);
            resolve({ success: true, message: msg });
        }, 100);
    });
}

function mockEnsureConversation(data) {
    return new Promise(function(resolve) {
        setTimeout(function() {
            var db = _mockGetDB();
            var exists = false;
            for (var i = 0; i < db.conversations.length; i++) {
                if (db.conversations[i].id === data.chatId) {
                    exists = true;
                    break;
                }
            }
            if (!exists) {
                db.conversations.push({
                    id: data.chatId,
                    partnerId: data.partnerId || '',
                    partnerName: data.partnerName || '未知用户',
                    taskId: data.taskId || '',
                    taskTitle: data.taskTitle || '未知任务',
                    lastMessage: '',
                    lastTime: new Date().toISOString()
                });
                _mockSaveDB(db);
            }
            resolve({ success: true });
        }, 100);
    });
}

// ---------- 评价 ----------

function mockSubmitReview(data) {
    return new Promise(function(resolve, reject) {
        setTimeout(function() {
            var currentUser = getCurrentUser();
            if (!currentUser) {
                reject(new Error('请先登录'));
                return;
            }
            var db = _mockGetDB();
            var newReview = {
                id: 'r' + Date.now(),
                orderId: data.orderId || '',
                taskId: data.taskId || '',
                fromUserId: currentUser.id,
                fromUserName: currentUser.username,
                toUserId: data.toUserId,
                toUserName: data.toUserName,
                rating: data.rating,
                content: data.content,
                images: data.images || [],
                time: new Date().toISOString(),
                auto: false
            };
            if (!db.reviews) db.reviews = [];
            db.reviews.push(newReview);
            // 系统消息：完成评价（挂到该订单所在会话）
            var revOrder = data.orderId ? _findOrderById(db, data.orderId) : null;
            if (revOrder) {
                var revPost = _findPostInDb(db, revOrder.postId);
                _addSystemMessage(db, revOrder.chatId, currentUser.username + ' 完成了评价', revOrder.postId, revPost ? revPost.title : '');
            }
            _mockSaveDB(db);
            resolve({ success: true, review: newReview });
        }, 200);
    });
}

function mockGetReviews(userId) {
    return new Promise(function(resolve) {
        setTimeout(function() {
            var db = _mockGetDB();
            _sweep(db);
            var result = (db.reviews || []).filter(function(r) { return r.toUserId === userId; });
            resolve(result);
        }, 100);
    });
}

function mockHasReviewed(orderId) {
    return new Promise(function(resolve) {
        setTimeout(function() {
            var currentUser = getCurrentUser();
            if (!currentUser) { resolve(false); return; }
            var db = _mockGetDB();
            var result = (db.reviews || []).some(function(r) {
                return r.orderId === orderId && r.fromUserId === currentUser.id;
            });
            resolve(result);
        }, 50);
    });
}

// ---------- 余额 ----------

function mockGetBalance() {
    return new Promise(function(resolve) {
        setTimeout(function() {
            var currentUser = getCurrentUser();
            if (!currentUser) {
                resolve({ balance: 0 });
                return;
            }
            var user = _mockGetUserById(currentUser.id);
            resolve({ balance: user ? (user.balance || 0) : 0 });
        }, 100);
    });
}

function mockUpdatePhone(phone) {
    return new Promise(function(resolve, reject) {
        setTimeout(function() {
            var currentUser = getCurrentUser();
            if (!currentUser) {
                reject(new Error('请先登录'));
                return;
            }
            if (!/^1\d{10}$/.test(phone)) {
                reject(new Error('请输入正确的 11 位手机号'));
                return;
            }
            var db = _mockGetDB();
            for (var i = 0; i < db.users.length; i++) {
                if (db.users[i].phone === phone && db.users[i].id !== currentUser.id) {
                    reject(new Error('该手机号已被其他账号使用'));
                    return;
                }
            }
            var user = _findUserInDb(db, currentUser.id);
            if (user) user.phone = phone;
            _mockSaveDB(db);
            var safeUser = {
                id: user.id, username: user.username, phone: user.phone, email: user.email,
                avatar: user.avatar, creditScore: user.creditScore, authStatus: user.authStatus, bio: user.bio
            };
            setCurrentUser(safeUser);
            resolve({ success: true, user: safeUser });
        }, 200);
    });
}

function mockUpdateEmail(email) {
    return new Promise(function(resolve, reject) {
        setTimeout(function() {
            var currentUser = getCurrentUser();
            if (!currentUser) {
                reject(new Error('请先登录'));
                return;
            }
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                reject(new Error('请输入正确的邮箱地址'));
                return;
            }
            var db = _mockGetDB();
            for (var i = 0; i < db.users.length; i++) {
                if (db.users[i].email === email && db.users[i].id !== currentUser.id) {
                    reject(new Error('该邮箱已被其他账号使用'));
                    return;
                }
            }
            var user = _findUserInDb(db, currentUser.id);
            if (user) user.email = email;
            _mockSaveDB(db);
            var safeUser = {
                id: user.id, username: user.username, phone: user.phone, email: user.email,
                avatar: user.avatar, creditScore: user.creditScore, authStatus: user.authStatus, bio: user.bio
            };
            setCurrentUser(safeUser);
            resolve({ success: true, user: safeUser });
        }, 200);
    });
}
