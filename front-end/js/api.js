const USE_MOCK = true;
const API_BASE = 'http://localhost:8080/api';

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

// ==================== 任务 ====================

async function getTasks(filters) {
    if (USE_MOCK) {
        return mockGetTasks(filters);
    }
    var query = new URLSearchParams(filters || {}).toString();
    var res = await fetch(API_BASE + '/tasks?' + query);
    return res.json();
}

async function getTaskDetail(id) {
    if (USE_MOCK) {
        return mockGetTaskDetail(id);
    }
    var res = await fetch(API_BASE + '/tasks/' + id);
    return res.json();
}

async function publishTask(data) {
    if (USE_MOCK) {
        return mockPublishTask(data);
    }
    var res = await fetch(API_BASE + '/tasks', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + getToken()
        },
        body: JSON.stringify(data)
    });
    return res.json();
}

async function publishService(data) {
    if (USE_MOCK) {
        return mockPublishService(data);
    }
    var res = await fetch(API_BASE + '/services', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + getToken()
        },
        body: JSON.stringify(data)
    });
    return res.json();
}

async function takeTask(id) {
    if (USE_MOCK) {
        return mockTakeTask(id);
    }
    var res = await fetch(API_BASE + '/tasks/' + id + '/take', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + getToken() }
    });
    return res.json();
}

async function getMyTasks() {
    if (USE_MOCK) {
        return mockGetMyTasks();
    }
    var res = await fetch(API_BASE + '/tasks/my-taken', {
        headers: { 'Authorization': 'Bearer ' + getToken() }
    });
    return res.json();
}

async function getMyPublishedTasks() {
    if (USE_MOCK) {
        return mockGetMyPublishedTasks();
    }
    var res = await fetch(API_BASE + '/tasks/my-published', {
        headers: { 'Authorization': 'Bearer ' + getToken() }
    });
    return res.json();
}

async function getMyServiceOrders() {
    if (USE_MOCK) {
        return mockGetMyServiceOrders();
    }
    var res = await fetch(API_BASE + '/service-orders/my', {
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

// ==================== Mock 实现 ====================

function mockLogin(account, password) {
    return new Promise(function(resolve, reject) {
        setTimeout(function() {
            var user = getUserByUsername(account) || getUserByPhone(account) || getUserByEmail(account);
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
            var db = getDB();
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
                realName: '',
                studentId: '',
                college: '',
                className: '',
                bio: ''
            };
            db.users.push(newUser);
            saveDB(db);
            resolve({ success: true });
        }, 200);
    });
}

function mockGetUserProfile(userId) {
    return new Promise(function(resolve) {
        setTimeout(function() {
            var user = getUserById(userId);
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
            var db = getDB();
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
            saveDB(db);

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

function mockGetTasks(filters) {
    return new Promise(function(resolve) {
        setTimeout(function() {
            var db = getDB();
            var result = db.tasks.slice();

            if (filters) {
                if (filters.type && filters.type !== 'all') {
                    result = result.filter(function(t) { return t.type === filters.type; });
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
            var task = getTaskById(id);
            if (task) {
                var publisher = getUserById(task.publisherId);
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

function mockPublishTask(data) {
    return new Promise(function(resolve, reject) {
        setTimeout(function() {
            var currentUser = getCurrentUser();
            if (!currentUser) {
                reject(new Error('请先登录'));
                return;
            }
            var db = getDB();
            var amount = parseRewardValue(data.reward);
            var user = getUserById(currentUser.id);
            if (!user || (user.balance || 0) < amount) {
                reject(new Error('余额不足，无法发布任务（需要预付报酬 ' + amount + ' 元）'));
                return;
            }
            user.balance -= amount;
            var newTask = {
                id: 't' + (db.tasks.length + 1) + '-' + Date.now(),
                title: data.title,
                type: 'demand',
                category: data.category,
                description: data.description,
                publisherId: currentUser.id,
                publisherName: currentUser.username,
                publisherCredit: currentUser.creditScore || 5.0,
                reward: data.reward,
                rewardValue: amount,
                deadline: data.deadline,
                publishTime: new Date().toISOString(),
                status: 'pending',
                contact: data.contact || '站内联系',
                images: data.images || [],
                paymentStatus: 'frozen',
                publisherConfirmed: false,
                takerConfirmed: false
            };
            db.tasks.unshift(newTask);
            saveDB(db);
            resolve({ success: true, task: newTask });
        }, 200);
    });
}

function mockPublishService(data) {
    return new Promise(function(resolve, reject) {
        setTimeout(function() {
            var currentUser = getCurrentUser();
            if (!currentUser) {
                reject(new Error('请先登录'));
                return;
            }
            var db = getDB();
            var newTask = {
                id: 't' + (db.tasks.length + 1) + '-' + Date.now(),
                title: data.title,
                type: 'service',
                category: data.category,
                description: data.description,
                publisherId: currentUser.id,
                publisherName: currentUser.username,
                publisherCredit: currentUser.creditScore || 5.0,
                reward: data.reward,
                rewardValue: parseRewardValue(data.reward),
                deadline: data.deadline || new Date(Date.now() + 30 * 86400000).toISOString(),
                publishTime: new Date().toISOString(),
                status: 'available',
                contact: data.contact || '站内联系',
                images: data.images || []
            };
            db.tasks.unshift(newTask);
            saveDB(db);
            resolve({ success: true, task: newTask });
        }, 200);
    });
}

function mockTakeTask(id) {
    return new Promise(function(resolve, reject) {
        setTimeout(function() {
            var currentUser = getCurrentUser();
            if (!currentUser) {
                reject(new Error('请先登录'));
                return;
            }
            var db = getDB();
            var task = null;
            for (var i = 0; i < db.tasks.length; i++) {
                if (db.tasks[i].id === id) {
                    task = db.tasks[i];
                    break;
                }
            }
            if (!task) {
                reject(new Error('任务不存在'));
                return;
            }
            if (task.paymentStatus !== 'frozen') {
                reject(new Error('任务尚未预付报酬，无法接单'));
                return;
            }
            task.status = 'in_progress';
            task.takerId = currentUser.id;
            task.takerName = currentUser.username;
            saveDB(db);
            resolve({ success: true, task: task });
        }, 200);
    });
}

function mockGetMyTasks() {
    return new Promise(function(resolve, reject) {
        setTimeout(function() {
            var currentUser = getCurrentUser();
            if (!currentUser) {
                reject(new Error('请先登录'));
                return;
            }
            var db = getDB();
            var result = db.tasks.filter(function(t) { return t.takerId === currentUser.id; });
            resolve(result);
        }, 150);
    });
}

function mockGetMyPublishedTasks() {
    return new Promise(function(resolve, reject) {
        setTimeout(function() {
            var currentUser = getCurrentUser();
            if (!currentUser) {
                reject(new Error('请先登录'));
                return;
            }
            var db = getDB();
            var result = db.tasks.filter(function(t) { return t.publisherId === currentUser.id; });
            resolve(result);
        }, 150);
    });
}

function mockGetMyServiceOrders() {
    return new Promise(function(resolve, reject) {
        setTimeout(function() {
            var currentUser = getCurrentUser();
            if (!currentUser) {
                reject(new Error('请先登录'));
                return;
            }
            var db = getDB();
            var result = (db.serviceOrders || []).filter(function(o) {
                return o.consumerId === currentUser.id;
            });
            resolve(result);
        }, 150);
    });
}

function mockGetConversations() {
    return new Promise(function(resolve) {
        setTimeout(function() {
            var currentUser = getCurrentUser();
            if (!currentUser) {
                resolve([]);
                return;
            }
            var db = getDB();
            var result = [];

            (db.conversations || []).forEach(function(c) {
                var partnerId = null;
                var isParticipant = false;
                var task = c.taskId ? getTaskById(c.taskId) : null;

                // 方法1：通过消息记录确定参与者（支持"发了消息但尚未建立交易"的场景）
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

                // 方法2：通过交易关系确定参与者（支持"已建立交易但尚未发消息"的场景）
                if (!partnerId && task) {
                    if (task.type === 'demand') {
                        if (task.takerId && currentUser.id === task.publisherId) {
                            partnerId = task.takerId;
                            isParticipant = true;
                        } else if (currentUser.id === task.takerId) {
                            partnerId = task.publisherId;
                            isParticipant = true;
                        }
                    } else if (task.type === 'service') {
                        var orders = db.serviceOrders || [];
                        for (var i = 0; i < orders.length; i++) {
                            if (orders[i].chatId === c.id) {
                                if (currentUser.id === orders[i].consumerId) {
                                    partnerId = orders[i].providerId;
                                    isParticipant = true;
                                } else if (currentUser.id === orders[i].providerId) {
                                    partnerId = orders[i].consumerId;
                                    isParticipant = true;
                                }
                                break;
                            }
                        }
                    }
                }

                if (isParticipant && partnerId) {
                    var partner = getUserById(partnerId);
                    result.push({
                        id: c.id,
                        partnerId: partnerId,
                        partnerName: partner ? partner.username : '未知用户',
                        partnerAvatar: partner ? partner.avatar : '',
                        taskId: c.taskId,
                        taskTitle: c.taskTitle,
                        lastMessage: c.lastMessage,
                        lastTime: c.lastTime,
                        lastMessageSenderId: c.lastMessageSenderId || ''
                    });
                }
            });

            // 按最后消息时间倒序排列
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
            var db = getDB();
            var result = (db.messages || []).filter(function(m) { return m.chatId === chatId; });
            result.sort(function(a, b) { return new Date(a.time) - new Date(b.time); });
            resolve(result);
        }, 100);
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
            var db = getDB();
            var newMsg = {
                id: 'm' + Date.now(),
                chatId: chatId,
                senderId: currentUser.id,
                senderName: currentUser.username,
                receiverId: '',
                content: content,
                time: new Date().toISOString(),
                taskId: '',
                taskTitle: ''
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
            saveDB(db);
            resolve(newMsg);
        }, 100);
    });
}

function mockSubmitReview(data) {
    return new Promise(function(resolve, reject) {
        setTimeout(function() {
            var currentUser = getCurrentUser();
            if (!currentUser) {
                reject(new Error('请先登录'));
                return;
            }
            var db = getDB();
            var newReview = {
                id: 'r' + Date.now(),
                taskId: data.taskId,
                fromUserId: currentUser.id,
                fromUserName: currentUser.username,
                toUserId: data.toUserId,
                toUserName: data.toUserName,
                rating: data.rating,
                content: data.content,
                images: data.images || [],
                time: new Date().toISOString()
            };
            if (!db.reviews) db.reviews = [];
            db.reviews.push(newReview);
            saveDB(db);
            resolve({ success: true, review: newReview });
        }, 200);
    });
}

function mockGetReviews(userId) {
    return new Promise(function(resolve) {
        setTimeout(function() {
            var db = getDB();
            var result = (db.reviews || []).filter(function(r) { return r.toUserId === userId; });
            resolve(result);
        }, 100);
    });
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

function mockGetBalance() {
    return new Promise(function(resolve) {
        setTimeout(function() {
            var currentUser = getCurrentUser();
            if (!currentUser) {
                resolve({ balance: 0 });
                return;
            }
            var user = getUserById(currentUser.id);
            resolve({ balance: user ? (user.balance || 0) : 0 });
        }, 100);
    });
}

// ==================== 服务订单 ====================

async function createServiceOrder(serviceId, chatId) {
    if (USE_MOCK) {
        return mockCreateServiceOrder(serviceId, chatId);
    }
    var res = await fetch(API_BASE + '/service-orders', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + getToken()
        },
        body: JSON.stringify({ serviceId: serviceId, chatId: chatId })
    });
    return res.json();
}

async function confirmServiceOrder(orderId, role) {
    if (USE_MOCK) {
        return mockConfirmServiceOrder(orderId, role);
    }
    var res = await fetch(API_BASE + '/service-orders/' + orderId + '/confirm', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + getToken()
        },
        body: JSON.stringify({ role: role })
    });
    return res.json();
}

async function getActiveOrder(chatId) {
    if (USE_MOCK) {
        return mockGetActiveOrder(chatId);
    }
    var res = await fetch(API_BASE + '/service-orders/active?chatId=' + chatId, {
        headers: { 'Authorization': 'Bearer ' + getToken() }
    });
    return res.json();
}

async function getOrderHistory(chatId) {
    if (USE_MOCK) {
        return mockGetOrderHistory(chatId);
    }
    var res = await fetch(API_BASE + '/service-orders?chatId=' + chatId, {
        headers: { 'Authorization': 'Bearer ' + getToken() }
    });
    return res.json();
}

// ==================== 任务完成确认 ====================

async function confirmTaskComplete(taskId, role) {
    if (USE_MOCK) {
        return mockConfirmTaskComplete(taskId, role);
    }
    var res = await fetch(API_BASE + '/tasks/' + taskId + '/complete', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + getToken()
        },
        body: JSON.stringify({ role: role })
    });
    return res.json();
}

// ==================== Mock 实现 ====================

function mockCreateServiceOrder(serviceId, chatId) {
    return new Promise(function(resolve, reject) {
        setTimeout(function() {
            var currentUser = getCurrentUser();
            if (!currentUser) {
                reject(new Error('请先登录'));
                return;
            }
            var db = getDB();
            var service = getTaskById(serviceId);
            if (!service) {
                reject(new Error('服务不存在'));
                return;
            }
            var activeOrder = null;
            for (var i = 0; i < (db.serviceOrders || []).length; i++) {
                var o = db.serviceOrders[i];
                if (o.chatId === chatId && (o.status === 'pending' || o.status === 'in_progress')) {
                    activeOrder = o; break;
                }
            }
            if (activeOrder) {
                reject(new Error('已有进行中的订单，请先完成'));
                return;
            }
            var amount = service.rewardValue || parseRewardValue(service.reward);
            var user = getUserById(currentUser.id);
            if (!user || (user.balance || 0) < amount) {
                reject(new Error('余额不足，需要 ' + amount + ' 元'));
                return;
            }
            user.balance -= amount;
            var order = {
                id: 'so' + ((db.serviceOrders || []).length + 1) + '-' + Date.now(),
                serviceId: serviceId,
                chatId: chatId,
                consumerId: currentUser.id,
                providerId: service.publisherId,
                amount: amount,
                status: 'pending',
                consumerConfirmed: false,
                providerConfirmed: false,
                createdAt: new Date().toISOString(),
                confirmedAt: null,
                autoConfirmAt: null
            };
            if (!db.serviceOrders) db.serviceOrders = [];
            db.serviceOrders.push(order);

            var convExists = false;
            for (var j = 0; j < (db.conversations || []).length; j++) {
                if (db.conversations[j].id === chatId) {
                    convExists = true; break;
                }
            }
            if (!convExists) {
                var partnerId = service.publisherId;
                var partner = getUserById(partnerId);
                db.conversations.push({
                    id: chatId,
                    partnerId: partnerId,
                    partnerName: partner ? partner.username : '未知用户',
                    partnerAvatar: partner ? partner.avatar : '',
                    taskId: serviceId,
                    taskTitle: service.title,
                    lastMessage: '服务申请者已申请服务，等待服务提供者确认',
                    lastTime: new Date().toISOString()
                });
            }

            saveDB(db);
            resolve({ success: true, order: order });
        }, 200);
    });
}

function mockConfirmServiceOrder(orderId, role) {
    return new Promise(function(resolve, reject) {
        setTimeout(function() {
            var currentUser = getCurrentUser();
            if (!currentUser) {
                reject(new Error('请先登录'));
                return;
            }
            var db = getDB();
            var order = null;
            for (var i = 0; i < (db.serviceOrders || []).length; i++) {
                if (db.serviceOrders[i].id === orderId) {
                    order = db.serviceOrders[i]; break;
                }
            }
            if (!order) {
                reject(new Error('订单不存在'));
                return;
            }
            if (role === 'consumer') {
                order.consumerConfirmed = true;
            } else {
                order.providerConfirmed = true;
            }
            if (order.status === 'pending' && order.providerConfirmed) {
                order.status = 'in_progress';
            }
            if (order.status === 'in_progress' && order.consumerConfirmed && order.providerConfirmed) {
                order.status = 'completed';
                order.confirmedAt = new Date().toISOString();
                var provider = getUserById(order.providerId);
                if (provider) {
                    provider.balance = (provider.balance || 0) + order.amount;
                }
            }
            saveDB(db);
            resolve({ success: true, order: order });
        }, 200);
    });
}

function mockGetActiveOrder(chatId) {
    return new Promise(function(resolve) {
        setTimeout(function() {
            var db = getDB();
            var orders = db.serviceOrders || [];
            var active = null;
            for (var i = orders.length - 1; i >= 0; i--) {
                if (orders[i].chatId === chatId && (orders[i].status === 'pending' || orders[i].status === 'in_progress')) {
                    active = orders[i]; break;
                }
            }
            resolve(active);
        }, 100);
    });
}

function mockGetOrderHistory(chatId) {
    return new Promise(function(resolve) {
        setTimeout(function() {
            var db = getDB();
            var orders = db.serviceOrders || [];
            var result = [];
            for (var i = 0; i < orders.length; i++) {
                if (orders[i].chatId === chatId) result.push(orders[i]);
            }
            resolve(result);
        }, 100);
    });
}

function mockConfirmTaskComplete(taskId, role) {
    return new Promise(function(resolve, reject) {
        setTimeout(function() {
            var currentUser = getCurrentUser();
            if (!currentUser) {
                reject(new Error('请先登录'));
                return;
            }
            var db = getDB();
            var task = getTaskById(taskId);
            if (!task) {
                reject(new Error('任务不存在'));
                return;
            }
            if (role === 'publisher') {
                task.publisherConfirmed = true;
            } else {
                task.takerConfirmed = true;
            }
            if (task.publisherConfirmed && task.takerConfirmed) {
                task.status = 'completed';
                task.paymentStatus = 'released';
                task.confirmedAt = new Date().toISOString();
                var taker = getUserById(task.takerId);
                if (taker) {
                    taker.balance = (taker.balance || 0) + (task.rewardValue || 0);
                }
            }
            saveDB(db);
            resolve({ success: true, task: task });
        }, 200);
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
            var db = getDB();
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

            // 同步更新会话列表中的最后一条消息预览
            for (var j = 0; j < db.conversations.length; j++) {
                if (db.conversations[j].id === msg.chatId) {
                    db.conversations[j].lastMessage = '消息已撤回';
                    break;
                }
            }

            saveDB(db);
            resolve({ success: true, message: msg });
        }, 100);
    });
}

function mockEnsureConversation(data) {
    return new Promise(function(resolve) {
        setTimeout(function() {
            var db = getDB();
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
                saveDB(db);
            }
            resolve({ success: true });
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
            var db = getDB();
            for (var i = 0; i < db.users.length; i++) {
                if (db.users[i].phone === phone && db.users[i].id !== currentUser.id) {
                    reject(new Error('该手机号已被其他账号使用'));
                    return;
                }
            }
            for (var i = 0; i < db.users.length; i++) {
                if (db.users[i].id === currentUser.id) {
                    db.users[i].phone = phone;
                    break;
                }
            }
            saveDB(db);
            var updatedUser = getUserById(currentUser.id);
            var safeUser = {
                id: updatedUser.id,
                username: updatedUser.username,
                phone: updatedUser.phone,
                email: updatedUser.email,
                avatar: updatedUser.avatar,
                creditScore: updatedUser.creditScore,
                authStatus: updatedUser.authStatus,
                bio: updatedUser.bio
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
            var db = getDB();
            for (var i = 0; i < db.users.length; i++) {
                if (db.users[i].email === email && db.users[i].id !== currentUser.id) {
                    reject(new Error('该邮箱已被其他账号使用'));
                    return;
                }
            }
            for (var i = 0; i < db.users.length; i++) {
                if (db.users[i].id === currentUser.id) {
                    db.users[i].email = email;
                    break;
                }
            }
            saveDB(db);
            var updatedUser = getUserById(currentUser.id);
            var safeUser = {
                id: updatedUser.id,
                username: updatedUser.username,
                phone: updatedUser.phone,
                email: updatedUser.email,
                avatar: updatedUser.avatar,
                creditScore: updatedUser.creditScore,
                authStatus: updatedUser.authStatus,
                bio: updatedUser.bio
            };
            setCurrentUser(safeUser);
            resolve({ success: true, user: safeUser });
        }, 200);
    });
}
