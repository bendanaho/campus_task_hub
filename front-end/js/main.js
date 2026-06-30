function goTo(page) {
    window.location.href = page;
}

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
        html += '<a href="' + item.href + '" class="' + isActive + '">' + item.label + '</a>';
    });

    if (isLoggedIn()) {
        html += '<a href="profile.html">' + getCurrentUser().username + '</a>';
    } else {
        var redirectUrl = encodeURIComponent(currentPage);
        html += '<a href="login.html?redirect=' + redirectUrl + '">登录/注册</a>';
    }

    navLinks.innerHTML = html;
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
                if (user.bio) {
                    infoContainer.insertBefore(createRow('个人简介', user.bio), insertBefore);
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
                var typeLabel = task.publisherSide === 'payer' ? '悬赏求助' : '提供服务';
                var typeClass = task.publisherSide === 'payer' ? 'badge-demand' : 'badge-service';
                var catName = CATEGORY_MAP[task.category] || task.category;
                var creditColor = getCreditColorClass(task.publisherCredit);
                var timeStr = timeAgo(task.publishTime);

                var actionLabel = task.publisherSide === 'payer' ? '接单赚钱' : '下单找他';
                var actionClass = task.publisherSide === 'payer' ? 'btn-demand' : 'btn-service';
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
                        '<p class="meta">分类：' + catName + ' ｜ 任务发起者：' + task.publisherName + '（<span class="credit-score ' + creditColor + '">' + task.publisherCredit + '</span>） ｜ 报酬：' + task.reward + ' ｜ ' + timeStr + '</p>' +
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
    if (me && me.id === publisherId) {
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
    if (!protectPage(['publish-task.html'])) return;

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

    // 根据"出钱/收钱"切换专属字段与文案
    var deadlineGroup = document.getElementById('deadlineGroup');
    var serviceTimeGroup = document.getElementById('serviceTimeGroup');
    var rewardLabel = document.getElementById('rewardLabel');

    function getSide() {
        var checked = form.querySelector('input[name="publisherSide"]:checked');
        return checked ? checked.value : 'payer';
    }
    function syncFields() {
        var side = getSide();
        if (deadlineGroup) deadlineGroup.style.display = side === 'payer' ? '' : 'none';
        if (serviceTimeGroup) serviceTimeGroup.style.display = side === 'earner' ? '' : 'none';
        if (rewardLabel) rewardLabel.textContent = side === 'payer' ? '报酬金额（你愿意支付）' : '期望报酬（你的收费）';
    }
    form.querySelectorAll('input[name="publisherSide"]').forEach(function(r) {
        r.addEventListener('change', syncFields);
    });
    syncFields();

    var publishBtn = form.querySelector('button[type="button"]');
    if (!publishBtn) return;

    publishBtn.addEventListener('click', function() {
        var side = getSide();
        var title = document.getElementById('postTitle').value.trim();
        var category = document.getElementById('postCategory').value;
        var description = document.getElementById('postDesc').value.trim();
        var reward = document.getElementById('postReward').value.trim();
        var contact = document.getElementById('postContact').value.trim();

        if (!title || !category || !description || !reward) {
            alert('请填写必填项。'); return;
        }

        var data = {
            title: title,
            publisherSide: side,
            category: category,
            description: description,
            reward: reward,
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
        var typeLabel = task.publisherSide === 'payer' ? '悬赏求助（发布者出钱）' : '提供服务（发布者收钱）';
        var statusMap = { open: '可下单', closed: '已结束' };
        var statusText = statusMap[task.status] || task.status;

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
            var actionLabel = task.publisherSide === 'payer' ? '接单赚钱' : '下单找他';
            var serviceTimeHtml = (task.publisherSide === 'earner' && task.serviceTime)
                ? '<p><strong>可服务时间：</strong>' + task.serviceTime + '</p>' : '';
            box.innerHTML = '<p><strong>标题：</strong>' + task.title + '</p>' +
                '<p><strong>类型：</strong>' + typeLabel + '</p>' +
                '<p><strong>分类：</strong>' + catName + '</p>' +
                '<p><strong>描述：</strong>' + task.description + '</p>' +
                '<p><strong>发布者：</strong>' + task.publisherName + '（<span class="credit-score ' + getCreditColorClass(task.publisherCredit) + '">' + task.publisherCredit + '</span>）</p>' +
                '<p><strong>联系方式：</strong>' + (task.contact || '站内联系') + '</p>' +
                '<p><strong>报酬金额：</strong>' + task.reward + '</p>' +
                serviceTimeHtml +
                '<p><strong>发布时间：</strong>' + formatDateTime(task.publishTime) + '</p>' +
                (task.publisherSide === 'payer' && task.deadline ? '<p><strong>截止时间：</strong>' + formatDateTime(task.deadline) + '</p>' : '') +
                '<p><strong>状态：</strong>' + statusText + '</p>' +
                imagesHtml +
                '<div class="actions">' +
                    (isMine ? '<span class="note">这是你发布的帖子</span>' : '<button type="button" class="btn" onclick="goToOrderChat(\'' + task.id + '\', \'' + task.publisherId + '\')">' + actionLabel + '</button>') +
                    '<a href="task-hall.html" class="btn btn-gray">返回互助大厅</a>' +
                '</div>';
        }
    });
}

// ==================== 消息中心 ====================

// 统一按订单（payer/earner）给出会话状态文案
async function getConversationStatusText(task, chatId, currentUserId) {
    if (!currentUserId) return { text: '', className: '' };
    var order = await getOrder(chatId);
    if (!order || order.status === 'cancelled') {
        return { text: '待下单', className: 'status-pending' };
    }
    var isPayer = currentUserId === order.payerId;
    if (order.status === 'pending') {
        var isPublisher = task && currentUserId === task.publisherId;
        return { text: isPublisher ? '待我接受' : '待对方接受', className: 'status-pending' };
    }
    if (order.status === 'in_progress') {
        var myConfirmed = isPayer ? order.payerConfirmed : order.earnerConfirmed;
        var otherConfirmed = isPayer ? order.earnerConfirmed : order.payerConfirmed;
        if (otherConfirmed && !myConfirmed) return { text: '待我确认', className: 'status-pending' };
        if (myConfirmed && !otherConfirmed) return { text: '我已确认，待对方确认', className: 'status-in_progress' };
        return { text: '进行中', className: 'status-in_progress' };
    }
    if (order.status === 'completed') return { text: '已完成', className: 'status-completed' };
    return { text: getOrderStatusText(order.status), className: 'status-pending' };
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

        var enriched = await Promise.all(conversations.map(async function(c) {
            var currentUser = getCurrentUser();
            var roleText = '';
            var task = c.taskId ? await fetchTaskById(c.taskId) : null;
            var statusInfo = await getConversationStatusText(task, c.id, currentUser ? currentUser.id : '');

            if (task && currentUser) {
                var iAmPayer = (currentUser.id === task.publisherId)
                    ? (task.publisherSide === 'payer')
                    : (task.publisherSide === 'earner');
                roleText = iAmPayer ? '我是付款方' : '我是收款方';
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

        list.innerHTML = enriched.map(function(item) {
            var c = item.c;
            var statusBadge = item.statusInfo.text
                ? '<span class="status-badge ' + item.statusInfo.className + '">' + item.statusInfo.text + '</span>'
                : '';

            return '<div class="message-item">' +
                '<div class="msg-header">' +
                    '<h3>' + c.taskTitle + (item.roleText ? ' ｜ ' + item.roleText : '') + '</h3>' +
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
                    var iAmPayer = (currentUser.id === task.publisherId)
                        ? (task.publisherSide === 'payer')
                        : (task.publisherSide === 'earner');
                    roleText = iAmPayer ? '我是付款方' : '我是收款方';
                }
                metaEls[1].textContent = '对应帖子：' + (task ? task.title : '') + (roleText ? ' ｜ ' + roleText : '');
            });
        }
    }
    updateChatHeader();

    function renderMessages() {
        getMessages(chatId).then(function(messages) {
            var currentUser = getCurrentUser();
            if (!messages || messages.length === 0) {
                messageList.innerHTML = '<p style="text-align:center;color:#999;">暂无消息，开始聊天吧</p>';
                return;
            }
            messageList.innerHTML = messages.map(function(m) {
                var isSelf = m.senderId === (currentUser ? currentUser.id : '');
                if (m.withdrawn) {
                    var withdrawText = isSelf ? '你撤回了一条消息' : '对方撤回了一条消息';
                    return '<div class="chat-message withdrawn" data-msg-id="' + m.id + '" data-sender="' + m.senderId + '">' +
                        withdrawText +
                    '</div>';
                }
                if (m.senderId === 'system') {
                    return '<div class="chat-message system">' + m.content + '</div>';
                }
                var cls = isSelf ? 'chat-right' : 'chat-left';
                return '<div class="chat-message ' + cls + '" data-msg-id="' + m.id + '" data-sender="' + m.senderId + '">' +
                    '<div>' + m.content + '</div>' +
                    '<div class="chat-time">' + formatDateTime(m.time) + '</div>' +
                '</div>';
            }).join('');
            messageList.scrollTop = messageList.scrollHeight;
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
                if (senderId !== currentUser.id) return;

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
            '<span class="task-bar-reward">' + task.reward + '</span>';
        if (order && order.status !== 'cancelled') {
            html += '<span class="task-bar-status">' + getOrderStatusText(order.status) + '</span>';
        }
        html += '</div><div class="task-bar-actions">' +
            (await buildTaskBarActions(task, order, currentUser)) +
            '</div>';
        taskBar.innerHTML = html;
        taskBar.style.display = 'flex';
    }

    // 按"在这笔订单里我是付款方还是收款方 + 订单状态"决定按钮（2 角色，取代原来的 4 角色分支）
    async function buildTaskBarActions(task, order, currentUser) {
        var isPublisher = currentUser && currentUser.id === task.publisherId;

        // 尚无有效订单
        if (!order || order.status === 'cancelled') {
            if (isPublisher) {
                return '<span class="task-bar-waiting">等待对方发起订单...</span>';
            }
            // 响应者发起：悬赏帖→我接单收钱；服务帖→我下单付钱
            var amount = task.rewardValue || parseRewardValue(task.reward);
            var label = task.publisherSide === 'payer' ? '接单赚钱' : ('下单（支付 ' + amount + ' 元）');
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
            var moneyHint = isPayer
                ? '已支付 ' + order.amount + ' 元·冻结中'
                : '完成后到账 ' + order.amount + ' 元';
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
        sendBtn.addEventListener('click', function() {
            var content = chatInput.value.trim();
            if (!content) return;
            sendMessage(chatId, content).then(function() {
                chatInput.value = '';
                renderMessages();
            }).catch(function(err) {
                alert(err.message || '发送失败');
            });
        });
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

// 响应者发起订单（接单/下单）
window.handleOrderCreate = function(postId, chatId) {
    createOrder(postId, chatId).then(function() {
        alert('已发起订单，等待对方接受！');
        window.location.reload();
    }).catch(function(err) {
        alert(err.message || '操作失败');
    });
};

// 发布者接受订单
window.handleOrderAccept = function(orderId) {
    acceptOrder(orderId).then(function() {
        alert('已接受订单，开始执行！');
        window.location.reload();
    }).catch(function(err) {
        alert(err.message || '操作失败');
    });
};

// 取消订单（pending 阶段：发布者拒绝 / 响应者撤回）
window.handleOrderCancel = function(orderId) {
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
    confirmOrder(orderId).then(function(res) {
        if (res.order && res.order.status === 'completed') {
            alert('订单已完成，款项已结算！');
        } else {
            alert('已确认完成，等待对方确认。');
        }
        window.location.reload();
    }).catch(function(err) {
        alert(err.message || '操作失败');
    });
};


// ==================== 我的任务 ====================

function initMyTasks() {
    if (!window.location.pathname.includes('my-task.html')) return;
    if (!protectPage(['my-task.html'])) return;

    var list = document.querySelector('.record-list');
    if (!list) return;

    var viewType = getUrlParam('view') || 'task';
    var isServiceView = viewType === 'service';

    var sectionTitle = document.querySelector('.section-title');
    if (sectionTitle) {
        sectionTitle.textContent = isServiceView ? '我的服务' : '我的任务';
    }
    document.title = isServiceView ? '我的服务' : '我的任务';

    var tabs = document.querySelectorAll('.tab');
    if (tabs[0]) tabs[0].textContent = isServiceView ? '我发布的服务' : '我发布的任务';
    if (tabs[1]) tabs[1].textContent = isServiceView ? '我接取的服务' : '我接取的任务';

    async function render(type) {
        if (isServiceView && type === 'taken') {
            getMyServiceOrders().then(async function(orders) {
                if (!orders || orders.length === 0) {
                    list.innerHTML = '<div class="card empty-state"><p>暂无服务</p></div>';
                    return;
                }
                var enriched = await Promise.all(orders.map(async function(order) {
                    var service = await fetchTaskById(order.serviceId);
                    var provider = await fetchUserById(order.providerId);
                    return { order: order, service: service, provider: provider };
                }));
                list.innerHTML = enriched.map(function(item) {
                    var order = item.order;
                    var statusMap = { pending: '待确认', in_progress: '进行中', completed: '已完成', cancelled: '已取消', refunded: '已退款' };
                    return '<div class="record-item">' +
                        '<h3>' + (item.service ? item.service.title : '未知服务') + '</h3>' +
                        '<p class="meta">类型：服务 ｜ 身份：服务申请者 ｜ 状态：' + (statusMap[order.status] || order.status) + ' ｜ 申请时间：' + formatDateTime(order.createdAt) + '</p>' +
                        '<p>服务提供者：' + (item.provider ? item.provider.username : '未知') + '</p>' +
                        '<div class="actions">' +
                            '<a href="task-detail.html?id=' + order.serviceId + '" class="btn btn-secondary">查看服务</a>' +
                            '<a href="chat-detail.html?chatId=' + order.chatId + '&partner=' + order.providerId + '&task=' + order.serviceId + '" class="btn btn-secondary">进入聊天</a>' +
                        '</div>' +
                    '</div>';
                }).join('');
            });
        } else {
            var apiCall = type === 'published' ? getMyPublishedTasks() : getMyTasks();
            apiCall.then(async function(tasks) {
                if (isServiceView) {
                    tasks = tasks.filter(function(t) { return t.type === 'service'; });
                } else {
                    tasks = tasks.filter(function(t) { return t.type === 'demand'; });
                }
                if (!tasks || tasks.length === 0) {
                    var emptyText = isServiceView ? '暂无服务' : '暂无任务';
                    list.innerHTML = '<div class="card empty-state"><p>' + emptyText + '</p></div>';
                    return;
                }
                var enriched = await Promise.all(tasks.map(async function(task) {
                    var hasReview = false;
                    if (task.status === 'completed') {
                        hasReview = await hasReviewed(task.id);
                    }
                    return { task: task, hasReview: hasReview };
                }));
                list.innerHTML = enriched.map(function(item) {
                    var task = item.task;
                    var role = type === 'published' ? '任务发起者' : '任务接单者';
                    var otherName = type === 'published' ? (task.takerName || '暂无') : task.publisherName;
                    var statusMap = { pending: '待接单', in_progress: '进行中', completed: '已完成', available: '可接服务' };
                    var partnerId = type === 'published' ? (task.takerId || task.publisherId) : task.publisherId;
                    var typeLabel = task.type === 'demand' ? '需求' : '服务';
                    var actionsHtml = '<a href="task-detail.html?id=' + task.id + '" class="btn btn-secondary">查看详情</a>';
                    if (task.status === 'in_progress' || task.status === 'pending') {
                        actionsHtml += '<a href="chat-detail.html?chatId=c-' + partnerId + '&partner=' + partnerId + '&task=' + task.id + '" class="btn btn-secondary">联系对方</a>';
                    }
                    if (task.status === 'completed') {
                        if (!item.hasReview) {
                            actionsHtml += '<a href="review.html?task=' + task.id + '&to=' + partnerId + '" class="btn btn-secondary">去评价</a>';
                        }
                    }
                    return '<div class="record-item">' +
                        '<h3>' + task.title + '</h3>' +
                        '<p class="meta">类型：' + typeLabel + ' ｜ 身份：' + role + ' ｜ 状态：' + (statusMap[task.status] || task.status) + ' ｜ 发布时间：' + formatDateTime(task.publishTime) + '</p>' +
                        '<p>' + (type === 'published' ? '任务接单者：' : '任务发起者：') + otherName + '</p>' +
                        '<div class="actions">' + actionsHtml + '</div>' +
                    '</div>';
                }).join('');
            });
        }
    }

    tabs.forEach(function(tab, index) {
        tab.addEventListener('click', function() {
            tabs.forEach(function(t) { t.classList.remove('active'); });
            tab.classList.add('active');
            render(index === 0 ? 'published' : 'taken');
        });
    });

    if (tabs[0]) tabs[0].classList.add('active');
    render('published');
}

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
        getOrderCenterRecords(filterValue).then(async function(records) {
            if (records.length === 0) {
                list.innerHTML = '<div class="card empty-state"><p>暂无订单</p></div>';
                return;
            }

            var enriched = await Promise.all(records.map(async function(r) {
                var hasReview = false;
                if (r.status === '已完成') {
                    var taskIdForReview = r.task ? r.task.id : '';
                    hasReview = taskIdForReview ? await hasReviewed(taskIdForReview) : false;
                }
                return { r: r, hasReview: hasReview };
            }));

            list.innerHTML = enriched.map(function(item) {
                var r = item.r;
                var statusBadge = r.statusClass
                    ? '<span class="status-badge ' + r.statusClass + '">' + r.status + '</span>'
                    : '<span class="status-badge">' + r.status + '</span>';

                var actionsHtml = '<a href="task-detail.html?id=' + (r.task ? r.task.id : '') + '" class="btn btn-secondary">查看详情</a>';

                if (r.task) {
                    var chatPartnerId = '';
                    var chatTaskId = r.task.id;
                    if (r.task.type === 'demand') {
                        if (r.roleLabel === '任务发起者' && r.task.takerId) chatPartnerId = r.task.takerId;
                        else if (r.roleLabel === '任务接单者') chatPartnerId = r.task.publisherId;
                    } else if (r.order) {
                        chatPartnerId = r.roleLabel === '服务提供者' ? r.order.consumerId : r.order.providerId;
                    }
                    if (chatPartnerId) {
                        actionsHtml += '<a href="chat-detail.html?chatId=c-' + chatPartnerId + '&partner=' + chatPartnerId + '&task=' + chatTaskId + '" class="btn btn-secondary">联系对方</a>';
                    }
                }

                if (r.status === '已完成' && !item.hasReview) {
                    var toUserId = '';
                    var taskIdForReview = r.task ? r.task.id : '';
                    if (r.task && r.task.type === 'demand') {
                        toUserId = r.roleLabel === '任务发起者' ? r.task.takerId : r.task.publisherId;
                    } else if (r.order) {
                        toUserId = r.roleLabel === '服务提供者' ? r.order.consumerId : r.order.providerId;
                    }
                    if (toUserId) {
                        actionsHtml += '<a href="review.html?task=' + taskIdForReview + '&to=' + toUserId + '" class="btn btn-secondary">去评价</a>';
                    }
                }

                return '<div class="record-item">' +
                    '<h3>' + r.title + '</h3>' +
                    '<p class="meta">' + statusBadge + '类型：' + r.typeLabel + ' ｜ 身份：' + r.roleLabel + ' ｜ 时间：' + r.timeStr + '</p>' +
                    '<p>对方：' + r.partnerName + '</p>' +
                    '<div class="actions">' + actionsHtml + '</div>' +
                '</div>';
            }).join('');
        });
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

    var taskId = getUrlParam('task');
    var toUserId = getUrlParam('to');

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
                taskId: taskId, toUserId: toUserId,
                rating: selectedRating, content: content,
                images: uploadedImages
            }).then(function() {
                alert('评价提交成功！');
                window.location.href = 'order-center.html';
            }).catch(function(err) {
                alert(err.message || '评价失败');
            });
        });
    }
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

// ==================== 初始化入口 ====================

document.addEventListener('DOMContentLoaded', function() {
    renderNav();
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
    initMyTasks();
    initOrderCenter();
    initReview();
    initLightbox();

    var scrollKey = 'scroll_' + location.pathname;
    var savedScroll = sessionStorage.getItem(scrollKey);
    if (savedScroll !== null) {
        window.scrollTo(0, parseInt(savedScroll));
        sessionStorage.removeItem(scrollKey);
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
