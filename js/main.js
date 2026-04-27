function goTo(page) {
    window.location.href = page;
}

function showDemoMessage(message) {
    alert(message || '当前为静态演示页面，未接入实际业务逻辑。');
}

// ==================== 导航栏 ====================

var NAV_ITEMS = [
    { label: '首页', href: 'index.html' },
    { label: '任务大厅', href: 'task-hall.html' },
    { label: '发布任务', href: 'publish-task.html' },
    { label: '发布服务', href: 'take-task.html' },
    { label: '消息中心', href: 'message-center.html' }
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
        html += '<a href="login.html">登录/注册</a>';
    }

    navLinks.innerHTML = html;
}

// ==================== 页面保护 ====================

function protectPage(pages) {
    var currentPage = window.location.pathname.split('/').pop();
    if (pages.indexOf(currentPage) >= 0 && !isLoggedIn()) {
        alert('请先登录。');
        window.location.href = 'login.html';
        return false;
    }
    return true;
}

// ==================== 登录/注册 ====================

function handleRegisterForm() {
    var form = document.getElementById('registerForm');
    if (!form) return;

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
                window.location.href = 'login.html';
            })
            .catch(function(err) {
                alert(err.message || '注册失败');
            });
    });
}

function handleLoginForm() {
    var form = document.getElementById('loginForm');
    if (!form) return;

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
                window.location.href = 'index.html';
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
                    '<p class="meta">分类：' + catName + ' ｜ 发布者：' + task.publisherName + '（<span class="credit-score ' + getCreditColorClass(task.publisherCredit) + '">' + task.publisherCredit + '</span>） ｜ 报酬：' + task.reward + '</p>' +
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

// ==================== 任务大厅 ====================

function initTaskHall() {
    if (!window.location.pathname.includes('task-hall.html')) return;

    var taskList = document.getElementById('taskList');
    var emptyState = document.getElementById('emptyState');
    if (!taskList) return;

    function renderTasks() {
        var typeFilter = document.getElementById('taskTypeFilter');
        var keywordInput = document.getElementById('taskKeyword');
        var sortSelect = document.getElementById('sortSelect');

        var selectedType = typeFilter ? typeFilter.value : 'all';
        var keyword = keywordInput ? keywordInput.value.trim() : '';
        var sortValue = sortSelect ? sortSelect.value : '';

        var checkedInputs = document.querySelectorAll('input[name="taskCategory"]:checked');
        var selectedCategories = Array.from(checkedInputs).map(function(input) { return input.value; });

        var filters = {
            type: selectedType,
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
                var typeLabel = task.type === 'demand' ? '需求单' : '服务单';
                var typeClass = task.type === 'demand' ? 'badge-demand' : 'badge-service';
                var catName = CATEGORY_MAP[task.category] || task.category;
                var creditColor = getCreditColorClass(task.publisherCredit);
                var timeStr = timeAgo(task.publishTime);

                var actionBtn = '';
                if (task.type === 'demand') {
                    actionBtn = '<button type="button" class="btn btn-demand" onclick="handleTakeTask(\'' + task.id + '\')">接单</button>';
                } else {
                    actionBtn = '<button type="button" class="btn btn-service" onclick="handleTakeTask(\'' + task.id + '\')">联系服务者</button>';
                }

                var bodyImages = task.images && task.images.length > 0 ? '<div class="task-images">' + task.images.slice(0, 3).map(function(img) {
                    return '<img src="' + img + '" class="task-image-thumb" onerror="this.style.display=\'none\'">';
                }).join('') + '</div>' : '';
                return '<div class="task-item" data-type="' + task.type + '" data-category="' + task.category + '">' +
                    '<div class="task-item-main">' +
                        '<div class="task-item-top">' +
                            '<h3>' + task.title + '</h3>' +
                            '<span class="task-badge ' + typeClass + '">' + typeLabel + '</span>' +
                        '</div>' +
                        '<p class="meta">分类：' + catName + ' ｜ 发布者：' + task.publisherName + '（<span class="credit-score ' + creditColor + '">' + task.publisherCredit + '</span>） ｜ 报酬：' + task.reward + ' ｜ ' + timeStr + '</p>' +
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

function handleTakeTask(taskId) {
    if (!isLoggedIn()) {
        alert('请先登录。');
        window.location.href = 'login.html';
        return;
    }
    takeTask(taskId).then(function() {
        alert('操作成功！');
        window.location.reload();
    }).catch(function(err) {
        alert(err.message || '操作失败');
    });
}

// ==================== 发布任务/服务 ====================

function initPublishForm() {
    var isTaskPage = window.location.pathname.includes('publish-task.html');
    var isServicePage = window.location.pathname.includes('take-task.html');
    if (!isTaskPage && !isServicePage) return;
    if (!protectPage(['publish-task.html', 'take-task.html'])) return;

    var form = document.querySelector('.form-container form');
    if (!form) return;

    var imageSection = document.createElement('div');
    imageSection.className = 'form-group';
    imageSection.innerHTML = '<label>上传图片（可选，最多3张）</label>' +
        '<input type="file" id="taskImages" class="form-control" accept="image/*" multiple>' +
        '<div id="imagePreview" class="image-preview-area"></div>';

    var actions = form.querySelector('.form-actions');
    if (actions) {
        form.insertBefore(imageSection, actions);
    }

    var imageInput = document.getElementById('taskImages');
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

    var publishBtn = form.querySelector('button[type="button"]');
    if (!publishBtn) return;

    publishBtn.addEventListener('click', function() {
        var title, category, description, reward, deadline, contact;

        if (isTaskPage) {
            title = document.getElementById('taskTitle').value.trim();
            category = document.getElementById('taskCategory').value;
            description = document.getElementById('taskDesc').value.trim();
            reward = document.getElementById('taskReward').value.trim();
            deadline = document.getElementById('taskDeadline').value;
            contact = document.getElementById('taskContact').value.trim();
        } else {
            title = document.getElementById('serviceTitle').value.trim();
            category = document.getElementById('serviceCategory').value;
            description = document.getElementById('serviceDesc').value.trim();
            reward = document.getElementById('serviceReward').value.trim();
            deadline = '';
            contact = document.getElementById('serviceContact').value.trim();
        }

        if (!title || !category || !description || !reward) {
            alert('请填写必填项。'); return;
        }

        var data = {
            title: title, category: category, description: description,
            reward: reward, deadline: deadline, contact: contact,
            images: uploadedImages
        };

        var apiCall = isTaskPage ? publishTask(data) : publishService(data);
        apiCall.then(function(res) {
            alert(isTaskPage ? '任务发布成功！' : '服务发布成功！');
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
        var typeLabel = task.type === 'demand' ? '需求单' : '服务单';
        var statusMap = { pending: '待接单', in_progress: '进行中', completed: '已完成', available: '可接服务' };
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
            box.innerHTML = '<p><strong>任务标题：</strong>' + task.title + '</p>' +
                '<p><strong>任务类型：</strong>' + typeLabel + '</p>' +
                '<p><strong>任务分类：</strong>' + catName + '</p>' +
                '<p><strong>任务描述：</strong>' + task.description + '</p>' +
                '<p><strong>发布者：</strong>' + task.publisherName + '（<span class="credit-score ' + getCreditColorClass(task.publisherCredit) + '">' + task.publisherCredit + '</span>）</p>' +
                '<p><strong>联系方式：</strong>' + (task.contact || '站内联系') + '</p>' +
                '<p><strong>报酬金额：</strong>' + task.reward + '</p>' +
                '<p><strong>发布时间：</strong>' + formatDateTime(task.publishTime) + '</p>' +
                (task.deadline ? '<p><strong>截止时间：</strong>' + formatDateTime(task.deadline) + '</p>' : '') +
                '<p><strong>任务状态：</strong>' + statusText + '</p>' +
                imagesHtml +
                '<div class="actions">' +
                    (task.type === 'demand' ? '<button type="button" class="btn" onclick="handleTakeTask(\'' + task.id + '\')">接单</button>' : '<button type="button" class="btn" onclick="handleTakeTask(\'' + task.id + '\')">联系服务者</button>') +
                    '<a href="chat-detail.html?chatId=c-' + task.publisherId + '&partner=' + task.publisherId + '&task=' + task.id + '" class="btn btn-secondary">联系对方</a>' +
                    '<a href="task-hall.html" class="btn btn-gray">返回任务大厅</a>' +
                '</div>';
        }
    });
}

// ==================== 消息中心 ====================

function initMessageCenter() {
    if (!window.location.pathname.includes('message-center.html')) return;
    if (!protectPage(['message-center.html'])) return;

    var list = document.querySelector('.message-list');
    if (!list) return;

    getConversations().then(function(conversations) {
        if (!conversations || conversations.length === 0) {
            list.innerHTML = '<div class="card empty-state"><p>暂无消息</p></div>';
            return;
        }

        list.innerHTML = conversations.map(function(c) {
            var nameInitial = c.partnerName ? c.partnerName.charAt(0) : '?';
            return '<div class="message-item">' +
                '<h3>聊天对象：' + c.partnerName + '</h3>' +
                '<p class="meta">对应任务：' + c.taskTitle + '</p>' +
                '<p>' + (c.lastMessage || '') + '</p>' +
                '<p class="meta">' + timeAgo(c.lastTime) + '</p>' +
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

    renderMessages();

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

    function render(type) {
        var apiCall = type === 'published' ? getMyPublishedTasks() : getMyTasks();
        apiCall.then(function(tasks) {
            if (isServiceView) {
                tasks = tasks.filter(function(t) { return t.type === 'service'; });
            }
            if (!tasks || tasks.length === 0) {
                var emptyText = isServiceView ? '暂无服务' : '暂无任务';
                list.innerHTML = '<div class="card empty-state"><p>' + emptyText + '</p></div>';
                return;
            }
            list.innerHTML = tasks.map(function(task) {
                var role = type === 'published' ? '发布者' : '接单者';
                var otherName = type === 'published' ? (task.takerName || '暂无') : task.publisherName;
                var statusMap = { pending: '待接单', in_progress: '进行中', completed: '已完成', available: '可接服务' };
                var partnerId = type === 'published' ? (task.takerId || task.publisherId) : task.publisherId;
                var typeLabel = task.type === 'demand' ? '需求' : '服务';
                return '<div class="record-item">' +
                    '<h3>' + task.title + '</h3>' +
                    '<p class="meta">类型：' + typeLabel + ' ｜ 身份：' + role + ' ｜ 状态：' + (statusMap[task.status] || task.status) + ' ｜ 发布时间：' + formatDateTime(task.publishTime) + '</p>' +
                    '<p>' + (type === 'published' ? '接单人：' : '发布者：') + otherName + '</p>' +
                    '<div class="actions">' +
                        '<a href="task-detail.html?id=' + task.id + '" class="btn btn-secondary">查看详情</a>' +
                        '<a href="chat-detail.html?chatId=c-' + partnerId + '&partner=' + partnerId + '&task=' + task.id + '" class="btn btn-secondary">联系对方</a>' +
                        '<a href="review.html?task=' + task.id + '&to=' + partnerId + '" class="btn btn-secondary">去评价</a>' +
                    '</div>' +
                '</div>';
            }).join('');
        });
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

    var submitBtn = form.querySelector('button[type="button"]');
    if (submitBtn) {
        submitBtn.addEventListener('click', function() {
            var content = document.getElementById('reviewContent').value.trim();
            if (!content) {
                alert('请填写评价内容。'); return;
            }

            submitReview({
                taskId: taskId, toUserId: toUserId,
                rating: selectedRating, content: content
            }).then(function() {
                alert('评价提交成功！');
                window.location.href = 'my-task.html';
            }).catch(function(err) {
                alert(err.message || '评价失败');
            });
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
    initReview();
});
