function goTo(page) {
    window.location.href = page;
}

// 返回上一页：有历史则后退（浏览器/滚动恢复机制会带回原位置），否则回大厅兜底
function goBack(fallback) {
    if (window.history.length > 1) {
        window.history.back();
    } else {
        window.location.href = fallback || 'task-hall.html';
    }
}
window.goBack = goBack;

function showDemoMessage(message) {
    alert(message || '当前为静态演示页面，未接入实际业务逻辑。');
}

// ==================== 导航栏 ====================

var NAV_ITEMS = [
    { label: '首页', href: 'index.html' },
    { label: '互助大厅', href: 'task-hall.html' },
    { label: '发布互助', href: 'publish-task.html' },
    { label: '消息中心', href: 'message-center.html' },
    { label: '我的订单', href: 'order-center.html' }
];

function renderNav() {
    var navLinks = document.querySelector('.nav-links');
    if (!navLinks) return;

    var currentPath = window.location.pathname;
    var currentPage = currentPath.substring(currentPath.lastIndexOf('/') + 1) || 'index.html';

    var html = '';
    NAV_ITEMS.forEach(function(item) {
        var isActive = currentPage === item.href ? 'active' : '';
        // 消息中心项预留未读红点占位，由 updateNavUnread 异步填充
        var badge = item.href === 'message-center.html'
            ? '<span id="navUnreadBadge" class="nav-unread" style="display:none;"></span>' : '';
        html += '<a href="' + item.href + '" class="' + isActive + '">' + item.label + badge + '</a>';
    });

    if (isLoggedIn()) {
        html += '<a href="profile.html">' + getCurrentUser().username + '</a>';
    } else {
        var redirectUrl = encodeURIComponent(currentPage);
        html += '<a href="login.html?redirect=' + redirectUrl + '">登录/注册</a>';
    }

    navLinks.innerHTML = html;
}

// 更新导航栏「消息中心」上的总未读红点
function updateNavUnread() {
    var badge = document.getElementById('navUnreadBadge');
    if (!badge) return;
    if (!isLoggedIn()) { badge.style.display = 'none'; return; }
    getUnreadCounts().then(function(res) {
        var n = (res && res.total) || 0;
        if (n > 0) {
            badge.textContent = n > 99 ? '99+' : n;
            badge.style.display = '';
        } else {
            badge.style.display = 'none';
        }
    });
}

// ==================== 页面保护 ====================

function protectPage(pages) {
    var currentPage = window.location.pathname.split('/').pop();
    if (pages.indexOf(currentPage) >= 0 && !isLoggedIn()) {
        alert('请先登录。');
        var redirectUrl = encodeURIComponent(window.location.pathname + window.location.search);
        window.location.href = 'login.html?redirect=' + redirectUrl;
        return false;
    }
    return true;
}

// 写操作（发布/下单/接单/确认等）前置校验：必须已登录且已实名，否则引导去登录/认证。
// 与 api.js 的 _isVerified 双重保险——UI 友好拦截 + 后端(mock)权威兜底。
function requireVerified() {
    if (!isLoggedIn()) {
        var redirect = encodeURIComponent(window.location.pathname.split('/').pop() + window.location.search);
        if (confirm('请先登录后再操作，是否前往登录？')) {
            window.location.href = 'login.html?redirect=' + redirect;
        }
        return false;
    }
    var u = getCurrentUser();
    if (!u || u.authStatus !== 'verified') {
        if (confirm('该操作需要先完成实名认证，是否前往认证？')) {
            window.location.href = 'auth.html';
        }
        return false;
    }
    return true;
}

// ==================== 登录/注册 ====================

function handleRegisterForm() {
    var form = document.getElementById('registerForm');
    if (!form) return;

    var redirect = getUrlParam('redirect') || '';
    var loginLink = document.querySelector('a[href="login.html"]');
    if (loginLink && redirect) {
        loginLink.href = 'login.html?redirect=' + encodeURIComponent(redirect);
    }

    form.addEventListener('submit', function(e) {
        e.preventDefault();
        var username = document.getElementById('registerUsername').value.trim();
        var phone = document.getElementById('registerPhone').value.trim();
        var email = document.getElementById('registerEmail').value.trim();
        var password = document.getElementById('registerPassword').value.trim();
        var confirmPassword = document.getElementById('registerConfirmPassword').value.trim();

        if (!username || !phone || !password || !confirmPassword) {
            alert('请完整填写必填信息。'); return;
        }
        if (!/^1\d{10}$/.test(phone)) {
            alert('请输入正确的 11 位手机号。'); return;
        }
        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            alert('请输入正确的邮箱地址。'); return;
        }
        if (password.length < 6) {
            alert('密码长度不能少于 6 位。'); return;
        }
        if (password !== confirmPassword) {
            alert('两次输入的密码不一致。'); return;
        }

        register({ username: username, phone: phone, email: email, password: password })
            .then(function() {
                alert('注册成功，请登录。');
                var redirect = getUrlParam('redirect') || '';
                var target = redirect ? 'login.html?redirect=' + encodeURIComponent(redirect) : 'login.html';
                window.location.href = target;
            })
            .catch(function(err) {
                alert(err.message || '注册失败');
            });
    });
}

function handleLoginForm() {
    var form = document.getElementById('loginForm');
    if (!form) return;

    var redirect = getUrlParam('redirect') || '';
    var registerLink = document.querySelector('a[href="register.html"]');
    if (registerLink && redirect) {
        registerLink.href = 'register.html?redirect=' + encodeURIComponent(redirect);
    }

    form.addEventListener('submit', function(e) {
        e.preventDefault();
        var account = document.getElementById('loginAccount').value.trim();
        var password = document.getElementById('loginPassword').value.trim();

        if (!account || !password) {
            alert('请输入用户名/手机号/邮箱和密码。'); return;
        }

        login(account, password)
            .then(function() {
                alert('登录成功。');
                var redirect = getUrlParam('redirect') || 'index.html';
                window.location.href = redirect;
            })
            .catch(function(err) {
                alert(err.message || '登录失败');
            });
    });
}

function handleLogout() {
    var btn = document.getElementById('logoutBtn');
    if (!btn) return;
    btn.addEventListener('click', function() {
        logout().then(function() {
            alert('已退出登录。');
            window.location.href = 'index.html';
        });
    });
}

// ==================== 个人中心 ====================

function initProfilePage() {
    if (!window.location.pathname.includes('profile.html')) return;
    if (!protectPage(['profile.html'])) return;

    var currentUser = getCurrentUser();
    if (!currentUser) return;

    getUserProfile(currentUser.id).then(function(user) {
        if (!user) return;

        var avatarEl = document.querySelector('.profile-avatar');
        if (avatarEl) {
            if (user.avatar) {
                avatarEl.innerHTML = '<img src="' + user.avatar + '" alt="头像" onerror="this.parentElement.innerHTML=this.alt">';
                avatarEl.querySelector('img').alt = user.username;
            } else {
                avatarEl.textContent = user.username;
            }
        }

        var usernameEl = document.getElementById('profileUsername');
        var phoneEl = document.getElementById('profilePhone');
        var emailEl = document.getElementById('profileEmail');
        if (usernameEl) usernameEl.textContent = user.username || '';
        if (phoneEl) phoneEl.innerHTML = (user.phone || '') + ' <a href="javascript:void(0)" class="edit-link" id="editPhone">修改</a>';
        if (emailEl) emailEl.innerHTML = (user.email || '') + ' <a href="javascript:void(0)" class="edit-link" id="editEmail">修改</a>';

        var infoContainer = document.querySelector('.profile-info');
        if (infoContainer) {
            var oldRows = infoContainer.querySelectorAll('.dynamic-info');
            oldRows.forEach(function(el) { el.remove(); });

            var authStatusText = user.authStatus === 'verified' ? '已认证' : '未认证';
            var collegeText = user.authStatus === 'verified' ? (user.college || '未填写') : '未认证';
            var classText = user.authStatus === 'verified' ? (user.className || '未填写') : '未认证';

            var insertBefore = infoContainer.querySelector('.actions');

            var createRow = function(label, value) {
                var p = document.createElement('p');
                p.className = 'dynamic-info';
                p.innerHTML = '<strong>' + label + '</strong>：' + value;
                return p;
            };

            if (insertBefore) {
                infoContainer.insertBefore(createRow('实名认证状态', authStatusText), insertBefore);
                infoContainer.insertBefore(createRow('学院', collegeText), insertBefore);
                infoContainer.insertBefore(createRow('班级', classText), insertBefore);
                infoContainer.insertBefore(createRow('信用评分', (user.creditScore || '5.0') + ' / 5.0'), insertBefore);
                // 账户余额（平台虚拟钱包）+ 充值入口
                infoContainer.insertBefore(createRow('账户余额',
                    '<span id="balanceValue">…</span> 元 <a href="javascript:void(0)" class="edit-link" id="rechargeBtn">充值</a> <a href="bill.html" class="edit-link">查看账单</a>'), insertBefore);
                if (user.bio) {
                    infoContainer.insertBefore(createRow('个人简介', user.bio), insertBefore);
                }

                var renderBalance = function() {
                    getMyBalance().then(function(res) {
                        var el = document.getElementById('balanceValue');
                        if (el) el.textContent = (res && typeof res.balance === 'number') ? res.balance : 0;
                    });
                };
                renderBalance();

                var rechargeBtn = document.getElementById('rechargeBtn');
                if (rechargeBtn) {
                    rechargeBtn.addEventListener('click', function() {
                        var input = prompt('请输入充值金额（元）。说明：本平台为校园虚拟余额，非真实支付。', '50');
                        if (input === null) return;
                        var amt = Number(input);
                        if (!isFinite(amt) || amt <= 0) { alert('请输入正确的充值金额。'); return; }
                        recharge(amt).then(function(res) {
                            alert('充值成功！当前余额 ' + res.balance + ' 元');
                            renderBalance();
                        }).catch(function(err) {
                            alert(err.message || '充值失败');
                        });
                    });
                }
            }

            var authBtn = infoContainer.querySelector('a[href="auth.html"]');
            if (authBtn) {
                if (user.authStatus === 'verified') {
                    authBtn.textContent = '已实名';
                    authBtn.className = 'btn btn-disabled';
                    authBtn.href = 'javascript:void(0)';
                    authBtn.style.pointerEvents = 'none';
                } else {
                    authBtn.textContent = '去实名认证';
                    authBtn.className = 'btn btn-secondary';
                    authBtn.href = 'auth.html';
                    authBtn.style.pointerEvents = '';
                }
            }

            // 绑定修改手机号
            var editPhone = document.getElementById('editPhone');
            if (editPhone) {
                editPhone.addEventListener('click', function() {
                    var newPhone = prompt('请输入新的手机号：', user.phone || '');
                    if (!newPhone || newPhone.trim() === user.phone) return;
                    newPhone = newPhone.trim();
                    if (!/^1\d{10}$/.test(newPhone)) {
                        alert('请输入正确的 11 位手机号。'); return;
                    }
                    updatePhone(newPhone).then(function() {
                        alert('手机号修改成功！');
                        window.location.reload();
                    }).catch(function(err) {
                        alert(err.message || '修改失败');
                    });
                });
            }

            // 绑定修改邮箱
            var editEmail = document.getElementById('editEmail');
            if (editEmail) {
                editEmail.addEventListener('click', function() {
                    var newEmail = prompt('请输入新的邮箱：', user.email || '');
                    if (!newEmail || newEmail.trim() === user.email) return;
                    newEmail = newEmail.trim();
                    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
                        alert('请输入正确的邮箱地址。'); return;
                    }
                    updateEmail(newEmail).then(function() {
                        alert('邮箱修改成功！');
                        window.location.reload();
                    }).catch(function(err) {
                        alert(err.message || '修改失败');
                    });
                });
            }
        }
    });
}

// ==================== 实名认证 ====================

function initAuthForm() {
    var form = document.querySelector('.form-container form');
    if (!form || !window.location.pathname.includes('auth.html')) return;
    if (!protectPage(['auth.html'])) return;

    var submitBtn = form.querySelector('button[type="button"]');
    if (!submitBtn) return;

    submitBtn.addEventListener('click', function() {
        var realName = document.getElementById('realName').value.trim();
        var studentId = document.getElementById('studentId').value.trim();
        var college = document.getElementById('college').value.trim();
        var className = document.getElementById('className').value.trim();

        if (!realName || !studentId || !college) {
            alert('请完整填写认证信息。'); return;
        }

        submitAuth({ realName: realName, studentId: studentId, college: college, className: className })
            .then(function() {
                alert('认证提交成功！');
                window.location.href = 'profile.html';
            })
            .catch(function(err) {
                alert(err.message || '认证失败');
            });
    });
}

// ==================== 首页 ====================

function initHomePage() {
    if (!window.location.pathname.includes('index.html') && window.location.pathname !== '/' && !window.location.pathname.endsWith('/')) return;

    var taskList = document.querySelector('.task-list');
    if (!taskList) return;

    getTasks({}).then(function(tasks) {
        if (!tasks || tasks.length === 0) {
            taskList.innerHTML = '<p>暂无推荐任务</p>';
            return;
        }
        taskList.innerHTML = tasks.slice(0, 4).map(function(task) {
            var catName = CATEGORY_MAP[task.category] || task.category;
            var bodyImages = task.images && task.images.length > 0 ? '<div class="task-images">' + task.images.slice(0, 3).map(function(img) {
                return '<img src="' + img + '" class="task-image-thumb" onerror="this.style.display=\'none\'">';
            }).join('') + '</div>' : '';
            return '<div class="task-item">' +
                '<div class="task-item-main">' +
                    '<div class="task-item-top">' +
                        '<h3>' + task.title + '</h3>' +
                    '</div>' +
                    '<p class="meta">分类：' + catName + ' ｜ 任务发起者：' + task.publisherName + '（<span class="credit-score ' + getCreditColorClass(task.publisherCredit) + '">' + task.publisherCredit + '</span>） ｜ 报酬：' + task.reward + '</p>' +
                    '<div class="task-item-body">' +
                        '<p class="task-desc">' + task.description + '</p>' +
                        bodyImages +
                    '</div>' +
                    '<div class="actions">' +
                        '<a href="task-detail.html?id=' + task.id + '" class="btn btn-secondary">查看详情</a>' +
                    '</div>' +
                '</div>' +
            '</div>';
        }).join('');
    });
}

// ==================== 互助大厅 ====================

function initTaskHall() {
    if (!window.location.pathname.includes('task-hall.html')) return;

    var taskList = document.getElementById('taskList');
    var emptyState = document.getElementById('emptyState');
    if (!taskList) return;

    function renderTasks() {
        var typeFilter = document.getElementById('taskTypeFilter');
        var keywordInput = document.getElementById('taskKeyword');
        var sortSelect = document.getElementById('sortSelect');

        var selectedSide = typeFilter ? typeFilter.value : 'all';
        var keyword = keywordInput ? keywordInput.value.trim() : '';
        var sortValue = sortSelect ? sortSelect.value : '';

        var checkedInputs = document.querySelectorAll('input[name="taskCategory"]:checked');
        var selectedCategories = Array.from(checkedInputs).map(function(input) { return input.value; });

        var filters = {
            side: selectedSide,
            categories: selectedCategories,
            keyword: keyword,
            sort: sortValue
        };

        getTasks(filters).then(function(tasks) {
            if (!tasks || tasks.length === 0) {
                taskList.innerHTML = '';
                if (emptyState) emptyState.style.display = 'block';
                return;
            }
            if (emptyState) emptyState.style.display = 'none';

            taskList.innerHTML = tasks.map(function(task) {
                var typeLabel = task.publisherSide === 'payer' ? '悬赏求助' : (task.publisherSide === 'none' ? '组队互助' : '提供服务');
                var typeClass = task.publisherSide === 'payer' ? 'badge-demand' : (task.publisherSide === 'none' ? 'badge-mutual' : 'badge-service');
                var catName = CATEGORY_MAP[task.category] || task.category;
                var creditColor = getCreditColorClass(task.publisherCredit);
                var timeStr = timeAgo(task.publishTime);

                var actionLabel = task.publisherSide === 'payer' ? '接单赚钱' : (task.publisherSide === 'none' ? '报名参加' : '下单找他');
                var actionClass = task.publisherSide === 'payer' ? 'btn-demand' : (task.publisherSide === 'none' ? 'btn-mutual' : 'btn-service');
                var actionBtn = '<button type="button" class="btn ' + actionClass + '" onclick="goToOrderChat(\'' + task.id + '\', \'' + task.publisherId + '\')">' + actionLabel + '</button>';

                var bodyImages = task.images && task.images.length > 0 ? '<div class="task-images">' + task.images.slice(0, 3).map(function(img) {
                    return '<img src="' + img + '" class="task-image-thumb" onerror="this.style.display=\'none\'">';
                }).join('') + '</div>' : '';
                return '<div class="task-item" data-side="' + task.publisherSide + '" data-category="' + task.category + '">' +
                    '<div class="task-item-main">' +
                        '<div class="task-item-top">' +
                            '<h3>' + task.title + '</h3>' +
                            '<span class="task-badge ' + typeClass + '">' + typeLabel + '</span>' +
                        '</div>' +
                        '<p class="meta">分类：' + catName + ' ｜ 任务发起者：' + task.publisherName + '（<span class="credit-score ' + creditColor + '">' + task.publisherCredit + '</span>）' + (task.publisherSide === 'none' ? '' : ' ｜ 报酬：' + task.reward) + (task.publisherSide === 'payer' && task.deadline ? ' ｜ 截止：' + formatDateTime(task.deadline) : '') + ' ｜ ' + timeStr + '</p>' +
                        '<div class="task-item-body">' +
                            '<p class="task-desc">' + task.description + '</p>' +
                            bodyImages +
                        '</div>' +
                        '<div class="actions">' +
                            '<a href="task-detail.html?id=' + task.id + '" class="btn btn-secondary">查看详情</a>' +
                            actionBtn +
                        '</div>' +
                    '</div>' +
                '</div>';
            }).join('');
        });
    }

    renderTasks();

    var searchBtn = document.getElementById('searchBtn');
    var keywordInput = document.getElementById('taskKeyword');
    var typeFilter = document.getElementById('taskTypeFilter');
    var sortSelect = document.getElementById('sortSelect');
    var categoryInputs = document.querySelectorAll('input[name="taskCategory"]');

    if (searchBtn) searchBtn.addEventListener('click', renderTasks);
    if (keywordInput) {
        keywordInput.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') { e.preventDefault(); renderTasks(); }
        });
    }
    if (typeFilter) typeFilter.addEventListener('change', renderTasks);
    if (sortSelect) sortSelect.addEventListener('change', renderTasks);
    categoryInputs.forEach(function(input) {
        input.addEventListener('change', function() {
            updateFilterText();
            renderTasks();
        });
    });

    function updateFilterText() {
        var toggle = document.getElementById('filterToggle');
        if (!toggle) return;
        var checked = document.querySelectorAll('input[name="taskCategory"]:checked');
        var labels = Array.from(checked).map(function(input) {
            return input.parentElement.querySelector('.filter-text').textContent.trim();
        });
        if (labels.length === 0) {
            toggle.textContent = '选择任务分类';
            toggle.classList.remove('active');
        } else if (labels.length === 1) {
            toggle.textContent = labels[0];
            toggle.classList.add('active');
        } else {
            toggle.textContent = '已选择 ' + labels.length + ' 个分类';
            toggle.classList.add('active');
        }
    }

    var filterDropdown = document.getElementById('filterDropdown');
    var filterToggle = document.getElementById('filterToggle');
    if (filterDropdown && filterToggle) {
        filterToggle.addEventListener('click', function(e) {
            e.stopPropagation();
            filterDropdown.classList.toggle('open');
        });
        document.addEventListener('click', function(e) {
            if (!filterDropdown.contains(e.target)) {
                filterDropdown.classList.remove('open');
            }
        });
    }

    updateFilterText();
}

// 点"接单赚钱/下单找他" → 跳到与发布者的聊天页，在那里发起订单（订单创建在 Step5 聊天页完成）
function goToOrderChat(postId, publisherId) {
    if (!isLoggedIn()) {
        alert('请先登录。');
        var redirectUrl = encodeURIComponent(window.location.pathname + window.location.search);
        window.location.href = 'login.html?redirect=' + redirectUrl;
        return;
    }
    var me = getCurrentUser();
    // String()：onclick 内联参数总是字符串，而真后端的 id 是数字（mock 是字符串），统一转字符串再比
    if (me && String(me.id) === String(publisherId)) {
        alert('这是你自己发布的帖子。');
        return;
    }
    var chatId = 'c-' + postId + '-' + me.id;
    window.location.href = 'chat-detail.html?chatId=' + encodeURIComponent(chatId) +
        '&partner=' + encodeURIComponent(publisherId) + '&task=' + encodeURIComponent(postId);
}

// ==================== 发布任务/服务 ====================

function initPublishForm() {
    if (!window.location.pathname.includes('publish-task.html')) return;
    // 一进发布页就校验：未登录/未实名立即弹提醒并引导去登录/认证
    // （requireVerified 同时管这两种情况；不再用只查登录的 protectPage）
    if (!requireVerified()) return;

    var form = document.querySelector('.form-container form');
    if (!form) return;

    // 注入图片上传区
    var imageSection = document.createElement('div');
    imageSection.className = 'form-group';
    imageSection.innerHTML = '<label>上传图片（可选，最多3张）</label>' +
        '<input type="file" id="postImages" class="form-control" accept="image/*" multiple>' +
        '<div id="imagePreview" class="image-preview-area"></div>';

    var actions = form.querySelector('.form-actions');
    if (actions) {
        form.insertBefore(imageSection, actions);
    }

    var imageInput = document.getElementById('postImages');
    var previewArea = document.getElementById('imagePreview');
    var uploadedImages = [];

    if (imageInput) {
        imageInput.addEventListener('change', function(e) {
            var files = Array.from(e.target.files).slice(0, 3);
            uploadedImages = [];
            previewArea.innerHTML = '';
            files.forEach(function(file) {
                var reader = new FileReader();
                reader.onload = function(ev) {
                    uploadedImages.push(ev.target.result);
                    var img = document.createElement('img');
                    img.src = ev.target.result;
                    img.className = 'preview-thumb';
                    previewArea.appendChild(img);
                };
                reader.readAsDataURL(file);
            });
        });
    }

    // 根据"出钱/收钱/纯互助"切换专属字段与文案
    var deadlineGroup = document.getElementById('deadlineGroup');
    var serviceTimeGroup = document.getElementById('serviceTimeGroup');
    var rewardGroup = document.getElementById('rewardGroup');
    var rewardLabel = document.getElementById('rewardLabel');

    function getSide() {
        var checked = form.querySelector('input[name="publisherSide"]:checked');
        return checked ? checked.value : 'payer';
    }
    function syncFields() {
        var side = getSide();
        if (deadlineGroup) deadlineGroup.style.display = side === 'payer' ? '' : 'none';
        if (serviceTimeGroup) serviceTimeGroup.style.display = side === 'earner' ? '' : 'none';
        // 纯互助不涉及金钱，隐藏报酬字段，并默认把分类设为「组队协作」
        if (rewardGroup) rewardGroup.style.display = side === 'none' ? 'none' : '';
        if (rewardLabel) rewardLabel.textContent = side === 'payer' ? '报酬金额（你愿意支付）' : '期望报酬（你的收费）';
        if (side === 'none') {
            var cat = document.getElementById('postCategory');
            if (cat) cat.value = 'teamwork';
        }
    }
    form.querySelectorAll('input[name="publisherSide"]').forEach(function(r) {
        r.addEventListener('change', syncFields);
    });
    syncFields();

    var publishBtn = form.querySelector('button[type="button"]');
    if (!publishBtn) return;

    publishBtn.addEventListener('click', function() {
        if (!requireVerified()) return;
        var side = getSide();
        var title = document.getElementById('postTitle').value.trim();
        var category = document.getElementById('postCategory').value;
        var description = document.getElementById('postDesc').value.trim();
        var reward = document.getElementById('postReward').value.trim();
        var contact = document.getElementById('postContact').value.trim();

        // 纯互助无报酬，reward 固定为「无」；其余方向报酬为必填
        if (side === 'none') {
            reward = '无';
        }
        if (!title || !category || !description || !reward) {
            alert('请填写必填项。'); return;
        }

        var data = {
            title: title,
            publisherSide: side,
            category: category,
            description: description,
            reward: reward,
            // rewardValue：从 reward 文本解析出的数字金额，订单冻结/结算用它。
            // 真后端只认这个字段（不会自己解析 reward 字符串），漏发会被当 0，导致冻结/付款显示 0。
            // 纯互助(none)不涉及金钱，固定 0。mock 端会自行重算，传了也无副作用。
            rewardValue: side === 'none' ? 0 : parseRewardValue(reward),
            contact: contact,
            images: uploadedImages,
            deadline: side === 'payer' ? document.getElementById('postDeadline').value : '',
            serviceTime: side === 'earner' ? document.getElementById('postServiceTime').value.trim() : ''
        };

        publishPost(data).then(function() {
            alert('发布成功！');
            window.location.href = 'task-hall.html';
        }).catch(function(err) {
            alert(err.message || '发布失败');
        });
    });
}

// ==================== 任务详情 ====================

function initTaskDetail() {
    if (!window.location.pathname.includes('task-detail.html')) return;

    var taskId = getUrlParam('id');
    if (!taskId) {
        document.querySelector('.detail-box').innerHTML = '<p>任务不存在</p>';
        return;
    }

    getTaskDetail(taskId).then(function(result) {
        if (!result || !result.task) {
            document.querySelector('.detail-box').innerHTML = '<p>任务不存在</p>';
            return;
        }

        var task = result.task;
        var catName = CATEGORY_MAP[task.category] || task.category;
        var typeLabel = task.publisherSide === 'payer' ? '悬赏求助（发布者出钱）' : (task.publisherSide === 'none' ? '组队互助（不涉及金钱）' : '提供服务（发布者收钱）');
        var expired = task.publisherSide === 'payer' && task.deadline && new Date(task.deadline).getTime() < Date.now();
        var statusMap = { open: '可下单', closed: '已结束' };
        var statusText = expired ? '已截止' : (statusMap[task.status] || task.status);

        var imagesHtml = '';
        if (task.images && task.images.length > 0) {
            imagesHtml = '<div class="detail-images">' +
                task.images.map(function(img) {
                    return '<img src="' + img + '" class="detail-image" onerror="this.style.display=\'none\'">';
                }).join('') +
            '</div>';
        }

        var box = document.querySelector('.detail-box');
        if (box) {
            var currentUser = getCurrentUser();
            var isMine = currentUser && currentUser.id === task.publisherId;
            var actionLabel = task.publisherSide === 'payer' ? '接单赚钱' : (task.publisherSide === 'none' ? '报名参加' : '下单找他');
            var serviceTimeHtml = (task.publisherSide === 'earner' && task.serviceTime)
                ? '<p><strong>可服务时间：</strong>' + task.serviceTime + '</p>' : '';
            box.innerHTML = '<p><strong>标题：</strong>' + task.title + '</p>' +
                '<p><strong>类型：</strong>' + typeLabel + '</p>' +
                '<p><strong>分类：</strong>' + catName + '</p>' +
                '<p><strong>描述：</strong>' + task.description + '</p>' +
                '<p><strong>发布者：</strong>' + task.publisherName + '（<span class="credit-score ' + getCreditColorClass(task.publisherCredit) + '">' + task.publisherCredit + '</span>）</p>' +
                '<p><strong>联系方式：</strong>' + (task.contact || '站内联系') + '</p>' +
                (task.publisherSide === 'none' ? '' : '<p><strong>报酬金额：</strong>' + task.reward + '</p>') +
                serviceTimeHtml +
                '<p><strong>发布时间：</strong>' + formatDateTime(task.publishTime) + '</p>' +
                (task.publisherSide === 'payer' && task.deadline ? '<p><strong>截止时间：</strong>' + formatDateTime(task.deadline) + '</p>' : '') +
                '<p><strong>状态：</strong>' + statusText + '</p>' +
                imagesHtml +
                '<div class="actions">' +
                    (isMine ? '<span class="note">这是你发布的帖子</span>'
                        : (expired ? '<span class="note">该悬赏已截止，无法接单</span>'
                            : '<button type="button" class="btn" onclick="goToOrderChat(\'' + task.id + '\', \'' + task.publisherId + '\')">' + actionLabel + '</button>')) +
                    '<button type="button" class="btn btn-secondary" onclick="goBack()">返回上一页</button>' +
                    '<a href="task-hall.html" class="btn btn-gray">返回互助大厅</a>' +
                '</div>';
        }
    });
}

// ==================== 消息中心 ====================

// 统一按订单（payer/earner）给出会话状态文案
// 按「当前用户视角」描述订单状态（是否发布者、付款/收款方都影响文案）。
// 消息中心与我的订单共用，保证两处状态文案一致。
function describeOrderStatus(order, currentUserId, isPublisher) {
    var isPayer = currentUserId === order.payerId;
    if (order.status === 'pending') {
        // 发布者一侧待接受 = 需我操作
        return isPublisher
            ? { text: '待我接受', className: 'status-pending', action: true }
            : { text: '待对方接受', className: 'status-pending' };
    }
    if (order.status === 'in_progress') {
        var myConfirmed = isPayer ? order.payerConfirmed : order.earnerConfirmed;
        var otherConfirmed = isPayer ? order.earnerConfirmed : order.payerConfirmed;
        if (otherConfirmed && !myConfirmed) return { text: '待我确认', className: 'status-pending', action: true };
        if (myConfirmed && !otherConfirmed) return { text: '我已确认，待对方确认', className: 'status-in_progress' };
        return { text: '进行中', className: 'status-in_progress' };
    }
    if (order.status === 'completed') return { text: '已完成', className: 'status-completed' };
    var fallbackClass = { cancelled: 'status-cancelled', disputed: 'status-pending', closed: 'status-completed' };
    return { text: getOrderStatusText(order.status), className: fallbackClass[order.status] || 'status-pending' };
}

async function getConversationStatusText(task, chatId, currentUserId) {
    if (!currentUserId) return { text: '', className: '' };
    var order = await getOrder(chatId);
    if (!order || order.status === 'cancelled') {
        return { text: '待下单', className: 'status-pending' };
    }
    var isPublisher = task && currentUserId === task.publisherId;
    return describeOrderStatus(order, currentUserId, isPublisher);
}

function initMessageCenter() {
    if (!window.location.pathname.includes('message-center.html')) return;
    if (!protectPage(['message-center.html'])) return;

    var list = document.querySelector('.message-list');
    if (!list) return;

    getConversations().then(async function(conversations) {
        if (!conversations || conversations.length === 0) {
            list.innerHTML = '<div class="card empty-state"><p>暂无消息</p></div>';
            return;
        }

        var unread = await getUnreadCounts();
        var unreadByChat = (unread && unread.byChat) || {};

        var enriched = await Promise.all(conversations.map(async function(c) {
            var currentUser = getCurrentUser();
            var roleText = '';
            var task = c.taskId ? await fetchTaskById(c.taskId) : null;
            var statusInfo = await getConversationStatusText(task, c.id, currentUser ? currentUser.id : '');

            // 完成但我还没评价 → 待我评价（待办）
            var order = await getOrder(c.id);
            if (order && order.status === 'completed' && currentUser) {
                var reviewed = await hasReviewed(order.id);
                if (!reviewed) statusInfo = { text: '待我评价', className: 'status-pending', action: true };
            }

            if (task && currentUser) {
                if (task.publisherSide === 'none') {
                    roleText = (currentUser.id === task.publisherId) ? '我是发起者' : '我是参与者';
                } else {
                    var iAmPayer = (currentUser.id === task.publisherId)
                        ? (task.publisherSide === 'payer')
                        : (task.publisherSide === 'earner');
                    roleText = iAmPayer ? '我是付款方' : '我是收款方';
                }
            }

            // 最后一条消息前缀
            var msgPreview = '';
            if (c.lastMessage) {
                if (c.lastMessageSenderId === 'system') {
                    msgPreview = '[系统] ' + c.lastMessage;
                } else if (c.lastMessageSenderId === (currentUser ? currentUser.id : '')) {
                    msgPreview = '我：' + c.lastMessage;
                } else if (c.lastMessageSenderId) {
                    var sender = await fetchUserById(c.lastMessageSenderId);
                    msgPreview = (sender ? sender.username : '对方') + '：' + c.lastMessage;
                } else {
                    msgPreview = c.lastMessage;
                }
            }

            return { c: c, roleText: roleText, statusInfo: statusInfo, msgPreview: msgPreview };
        }));

        // 排序优先级：先未读、再待我操作。同级保持原有时间倒序（sort 稳定）
        function convScore(item) {
            var uc = unreadByChat[item.c.id] || 0;
            return (uc > 0 ? 2 : 0) + (item.statusInfo && item.statusInfo.action ? 1 : 0);
        }
        enriched.sort(function(a, b) { return convScore(b) - convScore(a); });

        list.innerHTML = enriched.map(function(item) {
            var c = item.c;
            var needAction = item.statusInfo && item.statusInfo.action;
            var statusBadge = item.statusInfo.text
                ? '<span class="status-badge ' + (needAction ? 'status-action' : item.statusInfo.className) + '">' +
                    (needAction ? '● ' : '') + item.statusInfo.text + '</span>'
                : '';
            var uc = unreadByChat[c.id] || 0;
            var unreadBadge = uc > 0
                ? '<span class="msg-unread">' + (uc > 99 ? '99+' : uc) + ' 条未读</span>'
                : '';

            return '<div class="message-item' + (uc > 0 ? ' has-unread' : '') + (needAction ? ' needs-action' : '') + '">' +
                '<div class="msg-header">' +
                    '<h3>' + c.taskTitle + (item.roleText ? ' ｜ ' + item.roleText : '') + unreadBadge + '</h3>' +
                    '<span class="msg-time">' + timeAgo(c.lastTime) + '</span>' +
                '</div>' +
                '<p class="meta">' + statusBadge + '聊天对象：' + c.partnerName + '</p>' +
                '<p class="msg-preview">' + item.msgPreview + '</p>' +
                '<div class="actions">' +
                    '<a href="chat-detail.html?chatId=' + c.id + '&partner=' + c.partnerId + '&task=' + c.taskId + '" class="btn">进入聊天</a>' +
                '</div>' +
            '</div>';
        }).join('');
    });
}

// ==================== 聊天详情 ====================

function initChatDetail() {
    if (!window.location.pathname.includes('chat-detail.html')) return;
    if (!protectPage(['chat-detail.html'])) return;

    var chatId = getUrlParam('chatId');
    var partnerId = getUrlParam('partner');
    var taskId = getUrlParam('task');

    if (!chatId) {
        document.querySelector('.chat-box').innerHTML = '<p>聊天不存在</p>';
        return;
    }

    var chatBox = document.querySelector('.chat-box');
    var messageList = document.getElementById('messageList');
    if (!messageList) {
        messageList = document.createElement('div');
        messageList.id = 'messageList';
        chatBox.innerHTML = '';
        chatBox.appendChild(messageList);
    }

    // 动态更新聊天页头部信息
    async function updateChatHeader() {
        if (!taskId) return;
        var partnerIdParam = getUrlParam('partner');
        var metaEls = document.querySelectorAll('.chat-header .meta');
        if (metaEls.length >= 2) {
            // 优先使用 URL 参数中准确的 partnerId 查询用户信息
            var partnerName = '未知用户';
            if (partnerIdParam) {
                var partner = await fetchUserById(partnerIdParam);
                if (partner) partnerName = partner.username;
            }
            metaEls[0].textContent = '聊天对象：' + partnerName;
            getTaskDetail(taskId).then(function(result) {
                var task = result && result.task;
                var roleText = '';
                var currentUser = getCurrentUser();
                if (task && currentUser) {
                    if (task.publisherSide === 'none') {
                        roleText = (currentUser.id === task.publisherId) ? '我是发起者' : '我是参与者';
                    } else {
                        var iAmPayer = (currentUser.id === task.publisherId)
                            ? (task.publisherSide === 'payer')
                            : (task.publisherSide === 'earner');
                        roleText = iAmPayer ? '我是付款方' : '我是收款方';
                    }
                }
                metaEls[1].textContent = '对应帖子：' + (task ? task.title : '') + (roleText ? ' ｜ ' + roleText : '');
            });
        }
    }
    updateChatHeader();

    // 渲染一张收款/转账卡片（气泡按发送者左右对齐，卡片自带样式）
    function paymentCardHTML(m, currentUser, isSelf) {
        var p = m.payment;
        var side = isSelf ? 'chat-right' : 'chat-left';
        var kindLabel = p.kind === 'request' ? '收款' : '转账';
        var statusText = '', actions = '';
        if (p.status === 'paid') {
            statusText = '已完成';
        } else if (p.status === 'cancelled') {
            statusText = '已取消';
        } else { // pending：仅收款卡片会处于此状态
            var iAmPayer = currentUser && currentUser.id === p.payerId;
            if (iAmPayer) {
                statusText = '待你支付';
                actions = '<button type="button" class="btn btn-small pay-card-btn" onclick="handlePayCard(\'' + m.id + '\')">支付 ¥' + p.amount + '</button>';
            } else {
                statusText = '等待对方支付';
                if (currentUser && currentUser.id === m.senderId) {
                    actions = '<button type="button" class="btn btn-small btn-secondary" onclick="handleCancelCard(\'' + m.id + '\')">取消</button>';
                }
            }
        }
        return '<div class="chat-message chat-payment ' + side + '">' +
            '<div class="pay-card pay-' + p.status + '">' +
                '<div class="pay-card-head">' + kindLabel + '</div>' +
                '<div class="pay-card-amount">¥' + p.amount + '</div>' +
                '<div class="pay-card-status">' + statusText + '</div>' +
                (actions ? '<div class="pay-card-actions">' + actions + '</div>' : '') +
            '</div>' +
            '<div class="chat-time">' + formatDateTime(m.time) + '</div>' +
        '</div>';
    }

    function renderMessages() {
        getMessages(chatId).then(function(messages) {
            var currentUser = getCurrentUser();
            if (!messages || messages.length === 0) {
                messageList.innerHTML = '<p style="text-align:center;color:#999;">暂无消息，开始聊天吧</p>';
                return;
            }
            messageList.innerHTML = messages.map(function(m) {
                // String()：真后端 id 是数字、mock 是字符串，统一转字符串比较
                var isSelf = !!currentUser && String(m.senderId) === String(currentUser.id);
                if (m.withdrawn) {
                    var withdrawText = isSelf ? '你撤回了一条消息' : '对方撤回了一条消息';
                    return '<div class="chat-message withdrawn" data-msg-id="' + m.id + '" data-sender="' + m.senderId + '">' +
                        withdrawText +
                    '</div>';
                }
                if (m.type === 'payment') {
                    return paymentCardHTML(m, currentUser, isSelf);
                }
                // mock 用 senderId='system' 标记系统消息，真后端用 type='system'——两种都识别
                if (m.senderId === 'system' || m.type === 'system') {
                    return '<div class="chat-message system">' + m.content + '</div>';
                }
                var cls = isSelf ? 'chat-right' : 'chat-left';
                return '<div class="chat-message ' + cls + '" data-msg-id="' + m.id + '" data-sender="' + m.senderId + '">' +
                    '<div>' + m.content + '</div>' +
                    '<div class="chat-time">' + formatDateTime(m.time) + '</div>' +
                '</div>';
            }).join('');
            // 滚动容器是 chat-box（overflow-y:auto），滚它才能让最新消息落到最底部
            chatBox.scrollTop = chatBox.scrollHeight;
            bindContextMenu();
        });
    }

    function bindContextMenu() {
        var msgs = messageList.querySelectorAll('.chat-message');
        var currentUser = getCurrentUser();
        if (!currentUser) return;

        msgs.forEach(function(msgEl) {
            msgEl.addEventListener('contextmenu', function(e) {
                e.preventDefault();
                if (msgEl.classList.contains('withdrawn')) return;
                var senderId = msgEl.getAttribute('data-sender');
                // data-* 属性读出来永远是字符串，真后端的 id 是数字——转字符串比较，否则撤回菜单永远不出现
                if (senderId !== String(currentUser.id)) return;

                var existingMenu = document.querySelector('.context-menu');
                if (existingMenu) existingMenu.remove();

                var menu = document.createElement('div');
                menu.className = 'context-menu';
                menu.innerHTML = '<button type="button">撤回</button>';
                menu.style.left = e.pageX + 'px';
                menu.style.top = e.pageY + 'px';
                document.body.appendChild(menu);

                menu.querySelector('button').addEventListener('click', function() {
                    menu.remove();
                    var msgId = msgEl.getAttribute('data-msg-id');
                    withdrawMessage(msgId).then(function() {
                        renderMessages();
                    }).catch(function(err) {
                        alert(err.message || '撤回失败');
                    });
                });

                function closeMenu(ev) {
                    if (!menu.contains(ev.target)) {
                        menu.remove();
                        document.removeEventListener('click', closeMenu);
                    }
                }
                setTimeout(function() {
                    document.addEventListener('click', closeMenu);
                }, 0);
            });
        });
    }

    // 顶部状态栏
    var taskBar = document.getElementById('chatTaskBar');
    if (!taskBar) {
        taskBar = document.createElement('div');
        taskBar.id = 'chatTaskBar';
        taskBar.className = 'chat-task-bar';
        chatBox.parentNode.insertBefore(taskBar, chatBox);
    }

    async function renderTaskBar() {
        if (!taskId) { taskBar.style.display = 'none'; return; }
        var result = await getTaskDetail(taskId);
        var task = result && result.task;
        if (!task) { taskBar.style.display = 'none'; return; }
        var currentUser = getCurrentUser();

        var order = await getOrder(chatId);
        if (order && order.postId !== task.id) order = null; // 只认本帖的订单

        var html = '<div class="task-bar-info">' +
            '<span class="task-bar-title">' + task.title + '</span>' +
            // 纯互助不涉及金钱，不显示报酬
            (task.publisherSide === 'none' ? '' : '<span class="task-bar-reward">' + task.reward + '</span>');
        if (order && order.status !== 'cancelled') {
            html += '<span class="task-bar-status">' + getOrderStatusText(order.status) + '</span>';
        }
        html += await buildBalanceHint(task, order, currentUser);
        html += '</div><div class="task-bar-actions">' +
            (await buildTaskBarActions(task, order, currentUser)) +
            '</div>';
        taskBar.innerHTML = html;
        taskBar.style.display = 'flex';
    }

    // 当「当前用户是本单付款方」时，在任务栏展示：当前余额 ｜ 本单需支付金额（不足则标红）
    async function buildBalanceHint(task, order, currentUser) {
        if (!currentUser || task.publisherSide === 'none') return '';
        // 仅在「待付款/进行中/尚未下单」阶段提示，已完成/已取消不再提示
        if (order && ['cancelled', 'completed', 'disputed', 'closed'].indexOf(order.status) >= 0) return '';
        var isPublisher = currentUser.id === task.publisherId;
        // 是否为本单付款方：有订单看 payerId；无订单时——服务帖(earner)由响应者付、悬赏帖(payer)由发布者付
        var iAmPayer = order
            ? (currentUser.id === order.payerId)
            : (task.publisherSide === 'earner' ? !isPublisher : isPublisher);
        if (!iAmPayer) return '';
        var amount = order ? order.amount : (task.rewardValue || parseRewardValue(task.reward));
        var bal = 0;
        try { bal = (await getMyBalance()).balance || 0; } catch (e) { bal = 0; }
        // 变价订单(面议/按页计费，金额为 0)：只显示余额，费用走聊天收款/转账
        if (!(amount > 0)) {
            return '<span class="task-bar-balance">当前余额 ¥' + bal + ' ｜ 金额面议，可用下方收款/转账</span>';
        }
        var short = bal < amount;
        return '<span class="task-bar-balance' + (short ? ' insufficient' : '') + '">' +
            '当前余额 ¥' + bal + ' ｜ 本单需 ¥' + amount + (short ? '（余额不足，请先充值）' : '') +
            '</span>';
    }

    // 按"在这笔订单里我是付款方还是收款方 + 订单状态"决定按钮（2 角色，取代原来的 4 角色分支）
    async function buildTaskBarActions(task, order, currentUser) {
        var isPublisher = currentUser && currentUser.id === task.publisherId;

        // 尚无有效订单
        if (!order || order.status === 'cancelled') {
            // 悬赏帖过了截止时间：不再允许接单
            if (task.publisherSide === 'payer' && task.deadline && new Date(task.deadline).getTime() < Date.now()) {
                return '<span class="task-bar-status">该悬赏已截止</span>';
            }
            if (isPublisher) {
                return '<span class="task-bar-waiting">等待对方发起订单...</span>';
            }
            // 响应者发起：悬赏帖→我接单收钱；服务帖→我下单付钱；纯互助→报名参加
            var amount = task.rewardValue || parseRewardValue(task.reward);
            var label = task.publisherSide === 'payer' ? '接单赚钱'
                : (task.publisherSide === 'none' ? '报名参加' : ('下单（支付 ' + amount + ' 元）'));
            return '<button type="button" class="btn btn-small" onclick="handleOrderCreate(\'' + task.id + '\', \'' + chatId + '\')">' + label + '</button>';
        }

        var isPayer = currentUser && currentUser.id === order.payerId;

        if (order.status === 'pending') {
            if (isPublisher) {
                return '<button type="button" class="btn btn-small" onclick="handleOrderAccept(\'' + order.id + '\')">接受订单</button>' +
                    '<button type="button" class="btn btn-small btn-secondary" onclick="handleOrderCancel(\'' + order.id + '\')">拒绝</button>';
            }
            return '<span class="task-bar-waiting">等待对方接受...</span>' +
                '<button type="button" class="btn btn-small btn-secondary" onclick="handleOrderCancel(\'' + order.id + '\')">撤回</button>';
        }

        if (order.status === 'in_progress') {
            var moneyHint = task.publisherSide === 'none'
                ? '组队进行中'
                : (isPayer
                    ? '已支付 ' + order.amount + ' 元·冻结中'
                    : '完成后到账 ' + order.amount + ' 元');
            var myConfirmed = isPayer ? order.payerConfirmed : order.earnerConfirmed;
            var actions = '<span class="task-bar-money">' + moneyHint + '</span>';
            if (!myConfirmed) {
                actions += '<button type="button" class="btn btn-small" onclick="handleOrderConfirm(\'' + order.id + '\')">确认完成</button>';
            } else {
                actions += '<span class="task-bar-waiting">等待对方确认...</span>';
            }
            return actions;
        }

        if (order.status === 'completed') {
            var toUserId = isPayer ? order.earnerId : order.payerId;
            var reviewed = await hasReviewed(order.id);
            if (!reviewed) {
                return '<a href="review.html?order=' + order.id + '&to=' + toUserId + '" class="btn btn-small">去评价</a>';
            }
            return '<span class="task-bar-waiting">已完成</span>';
        }

        // disputed / closed（阶段二）
        return '<span class="task-bar-status">' + getOrderStatusText(order.status) + '</span>';
    }

    renderMessages();
    renderTaskBar();

    // 打开聊天即把对方发来的未读消息标记为已读，并刷新导航栏红点
    markMessagesRead(chatId).then(function() { updateNavUnread(); });

    // 确保 conversation 存在，使消息中心能显示该会话
    if (partnerId && taskId) {
        Promise.all([fetchUserById(partnerId), getTaskDetail(taskId)]).then(function(arr) {
            var partner = arr[0];
            var result = arr[1];
            ensureConversation({
                chatId: chatId,
                partnerId: partnerId,
                partnerName: partner ? partner.username : '',
                taskId: taskId,
                taskTitle: result && result.task ? result.task.title : ''
            });
        });
    }

    var sendBtn = document.getElementById('sendBtn');
    var chatInput = document.getElementById('chatInput');
    if (sendBtn && chatInput) {
        var doSend = function() {
            var content = chatInput.value.trim();
            if (!content) return;
            sendMessage(chatId, content).then(function() {
                chatInput.value = '';
                renderMessages();
            }).catch(function(err) {
                alert(err.message || '发送失败');
            });
        };
        sendBtn.addEventListener('click', doSend);
        // Enter 发送，Shift+Enter 换行（输入法组合中的回车不触发）
        chatInput.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
                e.preventDefault();
                doSend();
            }
        });
    }

    // 收款 / 转账入口
    var reqBtn = document.getElementById('requestPayBtn');
    var transBtn = document.getElementById('transferBtn');
    if (!partnerId) {
        // 无对方信息时无法收付款，隐藏入口
        if (reqBtn) reqBtn.style.display = 'none';
        if (transBtn) transBtn.style.display = 'none';
    } else {
        var promptAndSend = function(kind, verb, confirmTransfer) {
            if (!requireVerified()) return;
            var input = prompt('请输入' + verb + '金额（元）：');
            if (input === null) return;
            var amt = Number(input);
            if (!isFinite(amt) || amt <= 0) { alert('请输入正确的金额。'); return; }
            if (confirmTransfer && !confirm('确认立即向对方转账 ¥' + amt + ' 元？余额将立即扣除。')) return;
            sendPaymentCard(chatId, partnerId, kind, amt).then(function() {
                renderMessages();
                updateNavUnread();
            }).catch(function(err) {
                alert(err.message || '操作失败');
            });
        };
        if (reqBtn) reqBtn.addEventListener('click', function() { promptAndSend('request', '收款', false); });
        if (transBtn) transBtn.addEventListener('click', function() { promptAndSend('transfer', '转账', true); });
    }
}

// ==================== 聊天全局函数 ====================

function getOrderStatusText(status) {
    var map = {
        pending: '待接受', in_progress: '进行中', completed: '已完成',
        cancelled: '已取消', disputed: '争议处理中', closed: '已结案'
    };
    return map[status] || status;
}

// 付款方支付一张收款卡片
window.handlePayCard = function(messageId) {
    if (!requireVerified()) return;
    payPaymentCard(messageId).then(function() {
        alert('支付成功！');
        window.location.reload();
    }).catch(function(err) {
        alert(err.message || '支付失败');
    });
};

// 发起方取消一张待支付的收款卡片
window.handleCancelCard = function(messageId) {
    if (!confirm('确定取消这笔收款吗？')) return;
    cancelPaymentCard(messageId).then(function() {
        window.location.reload();
    }).catch(function(err) {
        alert(err.message || '取消失败');
    });
};

// 响应者发起订单（接单/下单）
window.handleOrderCreate = function(postId, chatId) {
    if (!requireVerified()) return;
    createOrder(postId, chatId).then(function() {
        alert('已发起订单，等待对方接受！');
        window.location.reload();
    }).catch(function(err) {
        alert(err.message || '操作失败');
    });
};

// 发布者接受订单
window.handleOrderAccept = function(orderId) {
    if (!requireVerified()) return;
    acceptOrder(orderId).then(function() {
        alert('已接受订单，开始执行！');
        window.location.reload();
    }).catch(function(err) {
        alert(err.message || '操作失败');
    });
};

// 取消订单（pending 阶段：发布者拒绝 / 响应者撤回）
window.handleOrderCancel = function(orderId) {
    if (!requireVerified()) return;
    if (!confirm('确定取消该订单吗？')) return;
    cancelOrder(orderId).then(function() {
        alert('订单已取消。');
        window.location.reload();
    }).catch(function(err) {
        alert(err.message || '操作失败');
    });
};

// 确认完成（任一方，双方都确认才结算）
window.handleOrderConfirm = function(orderId) {
    if (!requireVerified()) return;
    confirmOrder(orderId).then(function(res) {
        if (res.order && res.order.status === 'completed') {
            // 纯互助订单无金钱结算
            alert(res.order.amount > 0 ? '订单已完成，款项已结算！' : '互助已完成！');
        } else {
            alert('已确认完成，等待对方确认。');
        }
        window.location.reload();
    }).catch(function(err) {
        alert(err.message || '操作失败');
    });
};


// ==================== 我的订单 ====================

function initOrderCenter() {
    if (!window.location.pathname.includes('order-center.html')) return;
    if (!protectPage(['order-center.html'])) return;

    var list = document.querySelector('.record-list');
    var filterSelect = document.getElementById('orderFilter');
    if (!list) return;

    async function renderAll() {
        var currentUser = getCurrentUser();
        if (!currentUser) {
            list.innerHTML = '<div class="card empty-state"><p>请先登录</p></div>';
            return;
        }

        var filterValue = filterSelect ? filterSelect.value : 'all';
        var moneyRole = (filterValue === 'payer' || filterValue === 'earner') ? filterValue : undefined;
        var records = await getMyOrders(moneyRole);
        if (!records || records.length === 0) {
            list.innerHTML = '<div class="card empty-state"><p>暂无订单</p></div>';
            return;
        }

        var enriched = await Promise.all(records.map(async function(r) {
            var reviewed = r.order.status === 'completed' ? await hasReviewed(r.order.id) : false;
            return { r: r, reviewed: reviewed };
        }));

        list.innerHTML = enriched.map(function(item) {
            var r = item.r;
            var o = r.order;
            var isMutual = r.post && r.post.publisherSide === 'none';
            var roleLabel = isMutual
                ? (r.post.publisherId === currentUser.id ? '发起者' : '参与者')
                : (r.myRole === 'payer' ? '我付款' : '我收款');
            var amountText = isMutual ? '不涉及金钱' : ((r.myRole === 'payer' ? '支付 ' : '收入 ') + o.amount + ' 元');
            var isPublisher = r.post ? r.post.publisherId === currentUser.id : false;
            var st = describeOrderStatus(o, currentUser.id, isPublisher);
            var statusBadge = '<span class="status-badge ' + st.className + '">' + st.text + '</span>';

            var actionsHtml = '<a href="task-detail.html?id=' + o.postId + '" class="btn btn-secondary">查看详情</a>' +
                '<a href="chat-detail.html?chatId=' + o.chatId + '&partner=' + r.partnerId + '&task=' + o.postId + '" class="btn btn-secondary">进入聊天</a>';

            if (o.status === 'completed' && !item.reviewed) {
                var toUserId = r.myRole === 'payer' ? o.earnerId : o.payerId;
                actionsHtml += '<a href="review.html?order=' + o.id + '&to=' + toUserId + '" class="btn btn-secondary">去评价</a>';
            }

            return '<div class="record-item">' +
                '<h3>' + r.title + '</h3>' +
                '<p class="meta">' + statusBadge + '身份：' + roleLabel + ' ｜ 金额：' + amountText + ' ｜ 时间：' + formatDateTime(o.createdAt) + '</p>' +
                '<p>对方：' + r.partnerName + '</p>' +
                '<div class="actions">' + actionsHtml + '</div>' +
            '</div>';
        }).join('');
    }

    renderAll();
    if (filterSelect) {
        filterSelect.addEventListener('change', renderAll);
    }
}

// ==================== 评价 ====================

function initReview() {
    if (!window.location.pathname.includes('review.html')) return;
    if (!protectPage(['review.html'])) return;

    var form = document.querySelector('.form-container form');
    if (!form) return;

    var orderId = getUrlParam('order');
    var toUserId = getUrlParam('to');
    var toUserName = '';
    var submitBtnEl = form.querySelector('.form-actions button[type="button"]');

    // 填充"对应帖子/被评价对象"，并处理"订单未完成 / 已评价"
    (async function fillReviewInfo() {
        var record = null;
        if (orderId) {
            var mine = await getMyOrders();
            // String()：orderId 来自 URL 参数（字符串），真后端订单 id 是数字
            record = mine.find(function(x) { return String(x.order.id) === String(orderId); });
        }
        var taskNameInput = document.getElementById('taskName');
        var targetInput = document.getElementById('reviewTarget');
        if (record) {
            toUserName = record.partnerName;
            if (taskNameInput) { taskNameInput.value = record.title; taskNameInput.readOnly = true; }
            if (targetInput) { targetInput.value = toUserName; targetInput.readOnly = true; }
            if (record.order.status !== 'completed') {
                alert('该订单尚未完成，暂不能评价。');
            } else if (await hasReviewed(orderId) && submitBtnEl) {
                submitBtnEl.disabled = true;
                submitBtnEl.textContent = '你已评价';
            }
        } else if (toUserId) {
            var u = await fetchUserById(toUserId);
            toUserName = u ? u.username : '';
            if (targetInput) targetInput.value = toUserName;
        }
    })();

    var selectedRating = 5;
    var starBtns = document.querySelectorAll('.rating-star');
    starBtns.forEach(function(btn, index) {
        btn.addEventListener('click', function() {
            selectedRating = index + 1;
            starBtns.forEach(function(b, i) {
                if (i < selectedRating) {
                    b.style.backgroundColor = '#1f6feb';
                    b.style.color = '#fff';
                } else {
                    b.style.backgroundColor = '#eef4ff';
                    b.style.color = '#1f6feb';
                }
            });
        });
    });

    var imageInput = document.getElementById('reviewImages');
    var previewArea = document.getElementById('imagePreview');
    var uploadedImages = [];

    if (imageInput) {
        imageInput.addEventListener('change', function(e) {
            var files = Array.from(e.target.files).slice(0, 3);
            uploadedImages = [];
            previewArea.innerHTML = '';
            files.forEach(function(file) {
                var reader = new FileReader();
                reader.onload = function(ev) {
                    uploadedImages.push(ev.target.result);
                    var img = document.createElement('img');
                    img.src = ev.target.result;
                    img.className = 'preview-thumb';
                    previewArea.appendChild(img);
                };
                reader.readAsDataURL(file);
            });
        });
    }

    var submitBtn = form.querySelector('.form-actions button[type="button"]');
    if (submitBtn) {
        submitBtn.addEventListener('click', function() {
            var content = document.getElementById('reviewContent').value.trim();
            if (!content) {
                alert('请填写评价内容。'); return;
            }

            submitReview({
                orderId: orderId, toUserId: toUserId, toUserName: toUserName,
                rating: selectedRating, content: content,
                images: uploadedImages
            }).then(function() {
                alert('评价提交成功！');
                // 返回来处（聊天页/我的订单），而不是固定跳到我的订单
                goBack('order-center.html');
            }).catch(function(err) {
                alert(err.message || '评价失败');
            });
        });
    }
}

// ==================== 我的账单 ====================

function initBills() {
    if (!window.location.pathname.includes('bill.html')) return;
    if (!protectPage(['bill.html'])) return;

    var summary = document.getElementById('billSummary');
    var list = document.getElementById('billList');
    if (!list) return;

    var catMap = { recharge: '充值', order: '订单', payment: '收付款' };

    getMyBills().then(function(res) {
        var totalIn = res.totalIn || 0, totalOut = res.totalOut || 0, net = totalIn - totalOut;
        if (summary) {
            summary.innerHTML =
                '<div class="bill-sum-item"><span class="bill-sum-label">总收入</span><span class="bill-in">+¥' + totalIn + '</span></div>' +
                '<div class="bill-sum-item"><span class="bill-sum-label">总支出</span><span class="bill-out">-¥' + totalOut + '</span></div>' +
                '<div class="bill-sum-item"><span class="bill-sum-label">净额</span><span>' + (net >= 0 ? '+' : '-') + '¥' + Math.abs(net) + '</span></div>';
        }

        var items = res.list || [];
        if (items.length === 0) {
            list.innerHTML = '<div class="card empty-state"><p>暂无账单记录</p></div>';
            return;
        }
        list.innerHTML = items.map(function(t) {
            var sign = t.direction === 'in' ? '+' : '-';
            var cls = t.direction === 'in' ? 'bill-in' : 'bill-out';
            return '<div class="bill-item">' +
                '<div class="bill-item-main">' +
                    '<div class="bill-note">' + (t.note || catMap[t.category] || '交易') + '</div>' +
                    '<div class="bill-meta">' + (catMap[t.category] || t.category) + ' ｜ ' + formatDateTime(t.time) + '</div>' +
                '</div>' +
                '<div class="bill-amount ' + cls + '">' + sign + '¥' + t.amount + '</div>' +
            '</div>';
        }).join('');
    }).catch(function(err) {
        list.innerHTML = '<div class="card empty-state"><p>' + (err.message || '加载失败') + '</p></div>';
    });
}

// ==================== 图片放大 ====================

function initLightbox() {
    var overlay = document.getElementById('lightboxOverlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'lightboxOverlay';
        overlay.className = 'lightbox-overlay';
        overlay.innerHTML = '<img src="" alt="大图">';
        document.body.appendChild(overlay);

        overlay.addEventListener('click', function() {
            overlay.classList.remove('active');
        });

        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') {
                overlay.classList.remove('active');
            }
        });
    }

    var taskList = document.getElementById('taskList');
    if (taskList) {
        taskList.addEventListener('click', function(e) {
            if (e.target.classList.contains('task-image-thumb')) {
                e.stopPropagation();
                var bigImg = overlay.querySelector('img');
                bigImg.src = e.target.src;
                overlay.classList.add('active');
            }
        });
    }

    var detailBox = document.querySelector('.detail-box');
    if (detailBox) {
        detailBox.addEventListener('click', function(e) {
            if (e.target.classList.contains('detail-image')) {
                e.stopPropagation();
                var bigImg = overlay.querySelector('img');
                bigImg.src = e.target.src;
                overlay.classList.add('active');
            }
        });
    }
}

// ==================== 【仅测试用】一键切换账号 ====================
// 只在 mock 模式（USE_MOCK=true）出现；接入真实后端(USE_MOCK=false)时不渲染、代码不执行。
// 自成一块，交付前可整段删除。免密切换：直接把当前用户设为所选种子账号并刷新本页。
function initDevAccountSwitcher() {
    if (typeof USE_MOCK === 'undefined' || !USE_MOCK) return;   // 接后端时直接退出
    if (typeof getDB !== 'function') return;
    var users = (getDB().users || []);
    if (!users.length) return;

    var cur = getCurrentUser();
    var opts = '<option value="">（未登录）</option>';
    for (var i = 0; i < users.length; i++) {
        var u = users[i];
        opts += '<option value="' + u.id + '"' + (cur && cur.id === u.id ? ' selected' : '') + '>' + u.username + '</option>';
    }

    var box = document.createElement('div');
    box.className = 'dev-switcher';
    box.innerHTML = '<span class="dev-switcher-label">🔧 测试账号</span>' +
        '<select id="devUserSelect">' + opts + '</select>';
    document.body.appendChild(box);

    document.getElementById('devUserSelect').addEventListener('change', function() {
        var id = this.value;
        if (!id) { removeCurrentUser(); removeToken(); location.reload(); return; }
        var list = getDB().users || [], picked = null;
        for (var j = 0; j < list.length; j++) { if (list[j].id === id) { picked = list[j]; break; } }
        if (!picked) return;
        setCurrentUser({
            id: picked.id, username: picked.username, phone: picked.phone, avatar: picked.avatar,
            creditScore: picked.creditScore, authStatus: picked.authStatus, bio: picked.bio
        });
        setToken('mock-token-' + picked.id + '-' + Date.now());
        location.reload();
    });
}

// ==================== 初始化入口 ====================

document.addEventListener('DOMContentLoaded', function() {
    renderNav();
    updateNavUnread();
    handleRegisterForm();
    handleLoginForm();
    handleLogout();
    initProfilePage();
    initAuthForm();
    initHomePage();
    initTaskHall();
    initPublishForm();
    initTaskDetail();
    initMessageCenter();
    initChatDetail();
    initOrderCenter();
    initReview();
    initBills();
    initLightbox();
    initDevAccountSwitcher();

    var scrollKey = 'scroll_' + location.pathname;
    var savedScroll = sessionStorage.getItem(scrollKey);
    if (savedScroll !== null) {
        var target = parseInt(savedScroll, 10) || 0;
        sessionStorage.removeItem(scrollKey);
        if (target > 0) {
            // 列表/消息等内容异步渲染，页面高度会逐步增大——重试直到能滚到目标位置
            var tries = 0;
            var restore = function() {
                window.scrollTo(0, target);
                tries++;
                if (Math.abs(window.scrollY - target) > 2 && tries < 30) {
                    setTimeout(restore, 50);
                }
            };
            restore();
        }
    }

    document.addEventListener('click', function(e) {
        var link = e.target.closest('a');
        if (link) {
            var href = link.getAttribute('href');
            if (href && href.indexOf('http') !== 0 && href.indexOf('#') !== 0 && href.indexOf('javascript') !== 0) {
                var currentPath = location.pathname.split('/').pop();
                var targetPath = href.split('?')[0].split('/').pop();
                if (targetPath !== currentPath) {
                    sessionStorage.setItem(scrollKey, window.scrollY);
                }
            }
        }
    });
});
