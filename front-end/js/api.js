const USE_MOCK = true;
const API_BASE = 'http://localhost:8080/api';

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
    return res.json();
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
    return res.json();
}

async function logout() {
    if (USE_MOCK) {
        removeToken();
        removeCurrentUser();
        return { success: true };
    }
    var res = await fetch(API_BASE + '/logout', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + getToken() }
    });
    removeToken();
    removeCurrentUser();
    return res.json();
}

// ==================== 用户 ====================

async function getUserProfile(userId) {
    if (USE_MOCK) {
        return mockGetUserProfile(userId);
    }
    var res = await fetch(API_BASE + '/users/' + userId, {
        headers: { 'Authorization': 'Bearer ' + getToken() }
    });
    return res.json();
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
    return res.json();
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
    return res.json();
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
    return res.json();
}

// ==================== 帖子（任务/服务统一为"帖子"）====================

async function getTasks(filters) {
    if (USE_MOCK) {
        return mockGetTasks(filters);
    }
    var query = new URLSearchParams(filters || {}).toString();
    var res = await fetch(API_BASE + '/posts?' + query);
    return res.json();
}

async function getTaskDetail(id) {
    if (USE_MOCK) {
        return mockGetTaskDetail(id);
    }
    var res = await fetch(API_BASE + '/posts/' + id);
    return res.json();
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
    return res.json();
}

async function getMyPosts() {
    if (USE_MOCK) {
        return mockGetMyPosts();
    }
    var res = await fetch(API_BASE + '/posts/mine', {
        headers: { 'Authorization': 'Bearer ' + getToken() }
    });
    return res.json();
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
    return res.json();
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
    return res.json();
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
    return res.json();
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
    return res.json();
}

// 取某会话当前订单（优先返回进行中的；否则返回最近一条）。取代旧 getActiveOrder + getOrderByChatId
async function getOrder(chatId) {
    if (USE_MOCK) {
        return mockGetOrder(chatId);
    }
    var res = await fetch(API_BASE + '/orders/by-chat?chatId=' + chatId, {
        headers: { 'Authorization': 'Bearer ' + getToken() }
    });
    return res.json();
}

async function getOrderHistory(chatId) {
    if (USE_MOCK) {
        return mockGetOrderHistory(chatId);
    }
    var res = await fetch(API_BASE + '/orders?chatId=' + chatId, {
        headers: { 'Authorization': 'Bearer ' + getToken() }
    });
    return res.json();
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
    return res.json();
}

// ==================== 消息 ====================

async function getConversations() {
    if (USE_MOCK) {
        return mockGetConversations();
    }
    var res = await fetch(API_BASE + '/conversations', {
        headers: { 'Authorization': 'Bearer ' + getToken() }
    });
    return res.json();
}

async function getMessages(chatId) {
    if (USE_MOCK) {
        return mockGetMessages(chatId);
    }
    var res = await fetch(API_BASE + '/conversations/' + chatId + '/messages', {
        headers: { 'Authorization': 'Bearer ' + getToken() }
    });
    return res.json();
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
    return res.json();
}

async function withdrawMessage(messageId) {
    if (USE_MOCK) {
        return mockWithdrawMessage(messageId);
    }
    var res = await fetch(API_BASE + '/messages/' + messageId + '/withdraw', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + getToken() }
    });
    return res.json();
}

// 未读消息统计：{ total, byChat: { chatId: count } }
async function getUnreadCounts() {
    if (USE_MOCK) {
        return mockGetUnreadCounts();
    }
    var res = await fetch(API_BASE + '/messages/unread', {
        headers: { 'Authorization': 'Bearer ' + getToken() }
    });
    return res.json();
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
    return res.json();
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
    return res.json();
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
    return res.json();
}

async function getReviews(userId) {
    if (USE_MOCK) {
        return mockGetReviews(userId);
    }
    var res = await fetch(API_BASE + '/reviews?userId=' + userId);
    return res.json();
}

// 当前用户是否已对某订单评价过
async function hasReviewed(orderId) {
    if (USE_MOCK) {
        return mockHasReviewed(orderId);
    }
    var res = await fetch(API_BASE + '/reviews/has-reviewed?orderId=' + orderId, {
        headers: { 'Authorization': 'Bearer ' + getToken() }
    });
    return res.json();
}

// ==================== 余额 ====================

async function getBalance() {
    if (USE_MOCK) {
        return mockGetBalance();
    }
    var res = await fetch(API_BASE + '/user/balance', {
        headers: { 'Authorization': 'Bearer ' + getToken() }
    });
    return res.json();
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
    return res.json();
}

async function fetchUserById(id) {
    if (USE_MOCK) {
        return new Promise(function(resolve) {
            setTimeout(function() {
                resolve(_mockGetUserById(id));
            }, 50);
        });
    }
    var res = await fetch(API_BASE + '/users/' + id);
    return res.json();
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
                bio: user.bio
            };
            setCurrentUser(safeUser);
            resolve({ success: true, user: safeUser });
        }, 300);
    });
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

// ---------- 帖子 ----------

function mockGetTasks(filters) {
    return new Promise(function(resolve) {
        setTimeout(function() {
            var db = _mockGetDB();
            // 大厅只展示挂出来的帖子
            var result = db.tasks.filter(function(t) { return t.status === 'open'; });

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
            var post = _mockGetTaskById(postId);
            if (!post) {
                reject(new Error('帖子不存在'));
                return;
            }
            if (post.publisherId === currentUser.id) {
                reject(new Error('不能对自己发布的帖子下单/接单'));
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
            order.status = 'in_progress';
            order.acceptedAt = new Date().toISOString();
            // 悬赏帖一次性：进行中即从大厅下架；服务帖可复用，保持 open
            if (post.publisherSide === 'payer') {
                post.status = 'closed';
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
            if (order.payerConfirmed && order.earnerConfirmed) {
                // 双方都确认 → 完成并结算给收款方
                order.status = 'completed';
                order.completedAt = new Date().toISOString();
                order.reviewDeadline = new Date(Date.now() + AUTO_DAYS * 86400000).toISOString();
                var earner = _findUserInDb(db, order.earnerId);
                if (earner) earner.balance = (earner.balance || 0) + order.amount;
            } else if (!order.autoConfirmAt) {
                // 首个确认 → 挂上自动确认计时
                order.autoConfirmAt = new Date(Date.now() + AUTO_DAYS * 86400000).toISOString();
            }
            _mockSaveDB(db);
            resolve({ success: true, order: order });
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
                var partnerId = null;
                var isParticipant = false;

                // 方法1：通过消息记录确定参与者
                var msgParticipants = {};
                (db.messages || []).forEach(function(m) {
                    if (m.chatId === c.id) {
                        if (m.senderId && m.senderId !== 'system') msgParticipants[m.senderId] = true;
                        if (m.receiverId) msgParticipants[m.receiverId] = true;
                    }
                });
                if (msgParticipants[currentUser.id]) {
                    isParticipant = true;
                    for (var pid in msgParticipants) {
                        if (pid !== currentUser.id) {
                            partnerId = pid;
                            break;
                        }
                    }
                }

                // 方法2：通过订单关系确定参与者（已建交易但未发消息）
                if (!partnerId) {
                    var orders = db.orders || [];
                    for (var i = 0; i < orders.length; i++) {
                        if (orders[i].chatId === c.id) {
                            if (currentUser.id === orders[i].payerId) {
                                partnerId = orders[i].earnerId;
                                isParticipant = true;
                            } else if (currentUser.id === orders[i].earnerId) {
                                partnerId = orders[i].payerId;
                                isParticipant = true;
                            }
                            break;
                        }
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

// 当前用户参与的会话 id 集合（发过/收过消息，或有订单关系）
function _userChatIds(db, userId) {
    var ids = {};
    (db.messages || []).forEach(function(m) {
        if (m.senderId === userId || m.receiverId === userId) ids[m.chatId] = true;
    });
    (db.orders || []).forEach(function(o) {
        if (o.payerId === userId || o.earnerId === userId) ids[o.chatId] = true;
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
