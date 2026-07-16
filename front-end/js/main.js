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

    var loggedUser = isLoggedIn() ? getCurrentUser() : null;
    var admin = !!(loggedUser && loggedUser.role === 1);

    var html = '';
    NAV_ITEMS.forEach(function(item) {
        // 纯管理角色：只保留「互助大厅」供只读巡查，隐藏首页/发布/消息中心/我的订单等消费者入口
        if (admin && ['index.html', 'publish-task.html', 'message-center.html', 'order-center.html'].indexOf(item.href) >= 0) {
            return;
        }
        var isActive = currentPage === item.href ? 'active' : '';
        // 消息中心项预留未读红点占位，由 updateNavUnread 异步填充
        var badge = item.href === 'message-center.html'
            ? '<span id="navUnreadBadge" class="nav-unread" style="display:none;"></span>' : '';
        html += '<a href="' + item.href + '" class="' + isActive + '">' + item.label + badge + '</a>';
    });

    if (isLoggedIn()) {
        var navUser = loggedUser;
        // 管理员额外显示「管理后台」入口
        if (admin) {
            html += '<a href="admin.html" class="' + (currentPage === 'admin.html' ? 'active' : '') + '">管理后台</a>';
        }
        html += '<a href="profile.html">' + navUser.username + '</a>';
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
        // 单按钮提示：点"确定"直接前往实名认证（去掉"取消"选项）
        alert('该操作需要先完成实名认证，请先完成实名认证。');
        window.location.href = 'auth.html';
        return false;
    }
    return true;
}

// 当前登录用户是否管理员
function isAdminUser() {
    var u = getCurrentUser();
    return !!(u && u.role === 1);
}

// 交易类操作（发布/下单/接单/收付款/申诉）前置：管理员为纯管理角色，不参与交易。
// 返回 true 表示"被拦下"（调用方应 return）。
function blockIfAdmin() {
    if (isAdminUser()) {
        alert('管理员账号不参与交易，仅用于平台管理。');
        return true;
    }
    return false;
}

// 管理后台门禁：必须已登录且 role=1（与后端 /api/admin/** 的鉴权双保险）
function requireAdmin() {
    if (!isLoggedIn()) {
        alert('请先登录。');
        window.location.href = 'login.html?redirect=' + encodeURIComponent('admin.html');
        return false;
    }
    var u = getCurrentUser();
    if (!u || u.role !== 1) {
        alert('无管理员权限。');
        window.location.href = 'index.html';
        return false;
    }
    return true;
}

// ==================== 图片上传前压缩 ====================
// 把图片按最长边缩放到 maxDim 并以 JPEG 质量 quality 重编码，显著减小上传与入库体积
// （手机原图动辄数 MB，压后通常几百 KB）。返回 Promise<dataURL>。压缩失败自动回退原图，保证可用。
function compressImageFile(file, maxDim, quality) {
    maxDim = maxDim || 1600;
    quality = quality || 0.82;
    return new Promise(function(resolve, reject) {
        var reader = new FileReader();
        reader.onerror = function() { reject(new Error('读取图片失败')); };
        reader.onload = function(ev) {
            var image = new Image();
            image.onerror = function() { reject(new Error('不是有效的图片文件')); };
            image.onload = function() {
                var w = image.naturalWidth, h = image.naturalHeight;
                if (!w || !h) { resolve(ev.target.result); return; }
                var scale = Math.min(1, maxDim / Math.max(w, h));
                var nw = Math.round(w * scale), nh = Math.round(h * scale);
                var canvas = document.createElement('canvas');
                canvas.width = nw; canvas.height = nh;
                try {
                    canvas.getContext('2d').drawImage(image, 0, 0, nw, nh);
                    resolve(canvas.toDataURL('image/jpeg', quality));
                } catch (err) {
                    resolve(ev.target.result); // 跨域/解码异常时回退原图
                }
            };
            image.src = ev.target.result;
        };
        reader.readAsDataURL(file);
    });
}

// 通用图片上传器：拦非图片 + 累加(上限 max) + 逐张删除。
// images 为外部数组(直接 push/splice，供提交时读取)；重复选择同一文件也可追加。
function setupImageUploader(inputEl, previewEl, images, max) {
    max = max || 3;
    if (!inputEl || !previewEl) return;
    function render() {
        previewEl.innerHTML = '';
        images.forEach(function(url, i) {
            var wrap = document.createElement('span');
            wrap.style.cssText = 'position:relative;display:inline-block;margin:4px;';
            var img = document.createElement('img');
            img.src = url;   // 现在是 /uploads/xxx.jpg
            img.className = 'preview-thumb';
            var del = document.createElement('button');
            del.type = 'button';
            del.textContent = '×';
            del.title = '删除';
            del.style.cssText = 'position:absolute;top:-6px;right:-6px;width:20px;height:20px;border-radius:50%;border:none;background:rgba(0,0,0,.6);color:#fff;cursor:pointer;line-height:20px;padding:0;font-size:14px;';
            del.addEventListener('click', function() { images.splice(i, 1); render(); });
            wrap.appendChild(img);
            wrap.appendChild(del);
            previewEl.appendChild(wrap);
        });
    }
    inputEl.addEventListener('change', function(e) {
        var files = Array.from(e.target.files);
        e.target.value = ''; // 清空 input，允许再次选择/追加（含同一文件）
        if (files.length === 0) return;

        var slots = max - images.length;
        if (slots <= 0) {
            alert('最多上传 ' + max + ' 张图片，已达上限。');
            return;
        }
        // 汇总提示：非图片忽略、超限截取——各只提示一次
        var imgFiles = files.filter(function(f) { return f.type && f.type.indexOf('image/') === 0; });
        var nonImg = files.length - imgFiles.length;
        var toAdd = imgFiles.slice(0, slots);
        var dropped = imgFiles.length - toAdd.length;
        var msg = [];
        if (nonImg > 0) msg.push('已忽略 ' + nonImg + ' 个非图片文件');
        if (dropped > 0) msg.push('最多 ' + max + ' 张，仅添加前 ' + toAdd.length + ' 张（多选的 ' + dropped + ' 张未添加）');
        if (msg.length) alert(msg.join('；') + '。');

        // 上传成文件、只保留 URL(uploadImage 内部已做压缩)。
        // 此前这里 push 的是 base64 dataURL，会被原样存进 tasks.images，
        // 导致大厅每次都要下发几百 KB 的 base64 缩略图(实测响应 99% 都是它)。
        toAdd.forEach(function(file) {
            uploadImage(file).then(function(r) {
                if (images.length >= max) return;
                if (!r || !r.url) return;
                images.push(r.url);
                render();
            }).catch(function(err) { alert((err && err.message) || '图片上传失败'); });
        });
    });
}

// 按帖 id 缓存原图，点击放大时按需拉取一次（详情/列表接口默认只给缩略图）
var _postFullImagesCache = {};
function loadPostFullImages(postId) {
    if (_postFullImagesCache[postId]) return Promise.resolve(_postFullImagesCache[postId]);
    if (typeof getPostImages !== 'function') return Promise.resolve([]);
    return getPostImages(postId).then(function(imgs) {
        _postFullImagesCache[postId] = imgs || [];
        return _postFullImagesCache[postId];
    }).catch(function() { return []; });
}

// 打开大图遮罩（聊天图片点击放大用；遮罩不存在则临时创建）
window.openImageOverlay = function(src) {
    var overlay = document.getElementById('lightboxOverlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'lightboxOverlay';
        overlay.className = 'lightbox-overlay';
        overlay.innerHTML = '<img src="" alt="大图">';
        document.body.appendChild(overlay);
        overlay.addEventListener('click', function() { overlay.classList.remove('active'); });
    }
    var big = overlay.querySelector('img');
    if (big) big.src = src;
    overlay.classList.add('active');
};

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

        register({ username: username, phone: phone, email: email, password: password, confirmPassword: confirmPassword })
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
                // 管理员为纯管理角色 → 直接落地管理后台，忽略消费者页的 redirect
                if (isAdminUser()) {
                    window.location.href = 'admin.html';
                    return;
                }
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

    // URL 参数 userId 指定查看对象:有且不是自己 -> 他人主页(只读,无编辑入口)
    var targetUserId = getUrlParam('userId');
    var isSelf = !targetUserId || String(targetUserId) === String(currentUser.id);
    var fetchPromise = isSelf ? getUserProfile(currentUser.id) : getUserPublicProfile(targetUserId);

    fetchPromise.then(function(user) {
        if (!user) { alert('用户不存在'); return; }

        // 顶部标题区分自己/他人
        var titleEl = document.querySelector('.section-title');
        if (titleEl) {
            titleEl.textContent = isSelf ? '个人中心' : (user.username || 'TA') + ' 的主页';
            if (!isSelf) {
                // 他人主页:标题前加返回按钮
                var backBtn = document.createElement('a');
                backBtn.href = 'javascript:void(0)';
                backBtn.className = 'btn profile-back';
                backBtn.innerHTML = '<span class="profile-back-arrow">←</span> 返回上一页';
                backBtn.onclick = function() { goBack(); };
                titleEl.parentNode.insertBefore(backBtn, titleEl);
            }
        }

        var avatarEl = document.querySelector('.profile-avatar');
        if (avatarEl) {
            var fillAvatar = function(u) {
                var inner = u.avatar
                    ? '<img src="' + u.avatar + '" alt="' + (u.username || '') + '" class="avatar-img" onerror="this.style.display=\'none\'">'
                    : '<span class="avatar-fallback">' + (u.username || '') + '</span>';
                return inner + (isSelf ? '<div class="avatar-edit-hint"><i>📷</i> 点击更换头像</div>' : '');
            };
            avatarEl.innerHTML = fillAvatar(user);
            if (isSelf) {
                avatarEl.style.cursor = 'pointer';
                avatarEl.title = '点击更换头像';
                var avaInput = document.createElement('input');
                avaInput.type = 'file'; avaInput.accept = 'image/*'; avaInput.style.display = 'none';
                document.body.appendChild(avaInput);
                avatarEl.addEventListener('click', function() { avaInput.click(); });
                avaInput.addEventListener('change', function(e) {
                    var f = e.target.files[0]; avaInput.value = '';
                    if (!f || f.type.indexOf('image/') !== 0) { alert('只能上传图片'); return; }
                    uploadImage(f).then(function(r) { return updateProfile({ avatar: r.url }); }).then(function(u) {
                        avatarEl.innerHTML = fillAvatar(u);
                        var cu = getCurrentUser(); if (cu) { cu.avatar = u.avatar; setCurrentUser(cu); if (typeof renderNav === 'function') renderNav(); }
                        alert('头像已更新');
                    }).catch(function(err) { alert(err.message || '头像上传失败'); });
                });
            }
        }

        var usernameEl = document.getElementById('profileUsername');
        var phoneEl = document.getElementById('profilePhone');
        var emailEl = document.getElementById('profileEmail');
        if (usernameEl) usernameEl.textContent = user.username || '';
        if (isSelf) {
            if (phoneEl) phoneEl.innerHTML = (user.phone || '') + ' <a href="javascript:void(0)" class="edit-link" id="editPhone">修改</a>';
            if (emailEl) emailEl.innerHTML = (user.email || '') + ' <a href="javascript:void(0)" class="edit-link" id="editEmail">修改</a>';
        } else {
            // 他人主页不展示手机/邮箱(后端公开接口也不返回这两项)
            if (phoneEl && phoneEl.parentElement) phoneEl.parentElement.style.display = 'none';
            if (emailEl && emailEl.parentElement) emailEl.parentElement.style.display = 'none';
        }

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
                if (isSelf) {
                    // 账户余额（平台虚拟钱包）+ 充值入口(仅本人)
                    infoContainer.insertBefore(createRow('账户余额',
                        '<span id="balanceValue">…</span> 元 <a href="javascript:void(0)" class="edit-link" id="rechargeBtn">充值</a> <a href="bill.html" class="edit-link">查看账单</a>'), insertBefore);
                }
                // 个人简介 + 展示照片 → 渲染到右侧 .profile-extra
                var extra = document.querySelector('.profile-extra');
                var photos = [];
                try { photos = JSON.parse(user.profilePhotos || '[]') || []; } catch (e) { photos = []; }
                if (extra) {
                    extra.innerHTML =
                        '<div class="extra-block">' +
                            '<div class="extra-head"><span>个人简介</span>' + (isSelf ? '<a href="javascript:void(0)" class="edit-link" id="editBio">编辑</a>' : '') + '</div>' +
                            '<p id="bioValue" class="extra-bio">' + (user.bio ? user.bio.replace(/</g, '&lt;') : '（未填写）') + '</p>' +
                        '</div>' +
                        '<div class="extra-block">' +
                            '<div class="extra-head"><span>展示照片 ' + (isSelf ? '<em>最多5张</em>' : '') + '</span>' + (isSelf ? '<a href="javascript:void(0)" class="edit-link" id="addPhoto">添加</a>' : '') + '</div>' +
                            '<div id="profilePhotos" class="photo-gallery"></div>' +
                        '</div>';

                    var renderPhotos = function() {
                        var box = document.getElementById('profilePhotos');
                        if (!box) return;
                        box.innerHTML = photos.length ? photos.map(function(url, i) {
                            return '<span class="photo-item">' +
                                '<img src="' + url + '" onclick="openImageOverlay(this.src)">' +
                                (isSelf ? '<button type="button" data-i="' + i + '" class="photo-del">×</button>' : '') +
                                '</span>';
                        }).join('') : '<span class="extra-empty">（未上传照片）</span>';
                    };
                    renderPhotos();

                    if (isSelf) {
                        document.getElementById('editBio').addEventListener('click', function() {
                            var nb = prompt('编辑个人简介（最多500字）：', user.bio || '');
                            if (nb === null) return;
                            updateProfile({ bio: nb }).then(function(u) {
                                user.bio = u.bio || '';
                                document.getElementById('bioValue').textContent = user.bio || '（未填写）';
                            }).catch(function(err) { alert(err.message || '保存失败'); });
                        });

                        var photoInput = document.createElement('input');
                        photoInput.type = 'file'; photoInput.accept = 'image/*'; photoInput.style.display = 'none';
                        document.body.appendChild(photoInput);
                        document.getElementById('addPhoto').addEventListener('click', function() {
                            if (photos.length >= 5) { alert('最多上传 5 张'); return; }
                            photoInput.click();
                        });
                        photoInput.addEventListener('change', function(e) {
                            var f = e.target.files[0]; photoInput.value = '';
                            if (!f || f.type.indexOf('image/') !== 0) { alert('只能上传图片'); return; }
                            if (photos.length >= 5) { alert('最多上传 5 张'); return; }
                            uploadImage(f).then(function(r) {
                                var np = photos.concat([r.url]);
                                return updateProfile({ profilePhotos: np }).then(function() { photos = np; renderPhotos(); });
                            }).catch(function(err) { alert(err.message || '上传失败'); });
                        });
                        document.getElementById('profilePhotos').addEventListener('click', function(e) {
                            var btn = e.target.closest ? e.target.closest('.photo-del') : null;
                            if (!btn) return;
                            var i = parseInt(btn.getAttribute('data-i'), 10);
                            var np = photos.slice(); np.splice(i, 1);
                            updateProfile({ profilePhotos: np }).then(function() { photos = np; renderPhotos(); });
                        });
                    }
                }

                if (isSelf) {
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
                            var parsed = parseMoneyInput(input);
                            if (!parsed.ok) { alert(parsed.error); return; }
                            var amt = parsed.value;
                            recharge(amt).then(function(res) {
                                alert('充值成功！当前余额 ' + res.balance + ' 元');
                                renderBalance();
                            }).catch(function(err) {
                                alert(err.message || '充值失败');
                            });
                        });
                    }
                }
            }

            // 操作按钮区(去实名认证/我的订单/退出登录):仅本人显示
            var actionsEl = infoContainer.querySelector('.actions');
            if (actionsEl) actionsEl.style.display = isSelf ? '' : 'none';

            var authBtn = infoContainer.querySelector('a[href="auth.html"]');
            if (authBtn && isSelf) {
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

            if (isSelf) {
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

    // 纯管理角色不需要首页这类消费者内容（导航里也已隐藏），直接落地管理后台
    if (isAdminUser()) {
        window.location.replace('admin.html');
        return;
    }

    var taskList = document.querySelector('.task-list');
    if (!taskList) return;

    getTasks({ page: 0, size: 4 }).then(function(res) {
        var tasks = (res && res.list) ? res.list : [];
        if (tasks.length === 0) {
            taskList.innerHTML = '<p>暂无推荐任务</p>';
            return;
        }
        taskList.innerHTML = tasks.map(function(task) {
            var catName = CATEGORY_MAP[task.category] || task.category;
            var bodyImages = task.images && task.images.length > 0 ? '<div class="task-images">' + task.images.slice(0, 3).map(function(img, idx) {
                var thumbSrc = (img && img.thumb) ? img.thumb : ((img && img.full) ? img.full : img);
                return '<img src="' + thumbSrc + '" data-postid="' + task.id + '" data-idx="' + idx + '" class="task-image-thumb" loading="lazy" onerror="this.style.display=\'none\'">';
            }).join('') + '</div>' : '';
            return '<div class="task-item task-side-' + (task.publisherSide || 'none') + '">' +
                '<div class="task-item-main">' +
                    '<div class="task-item-top">' +
                        '<h3>' + task.title + '</h3>' +
                    '</div>' +
                    '<p class="meta">分类：' + catName + ' ｜ 任务发起者：' + '<a href="profile.html?userId=' + task.publisherId + '" class="user-link">' + task.publisherName + '</a>' + '（<span class="credit-score ' + getCreditColorClass(task.publisherCredit) + '">' + task.publisherCredit + '</span>） ｜ 报酬：' + formatReward(task.reward) + '</p>' +
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

// 用户「头像+名字」名片入口：点进 TA 的主页。头像缺省用名字首字兜底，加载失败也回退首字。
// 顶层函数，供大厅、任务详情等多个页面共用。
function userChip(userId, name, avatar, extraClass) {
    var safe = (name == null || name === '') ? '用户' : String(name);
    var letter = safe.charAt(0) || '?';
    var cls = 'user-chip' + (extraClass ? ' ' + extraClass : '');
    var img = avatar
        ? '<img src="' + avatar + '" class="user-chip-ava" alt="" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\'">'
        : '';
    var fb = '<span class="user-chip-ava user-chip-ava--fb"' + (avatar ? ' style="display:none"' : '') + '>' + letter + '</span>';
    var inner = img + fb + '<span class="user-chip-name">' + safe + '</span>';
    if (!userId) return '<span class="' + cls + ' user-chip--plain">' + inner + '</span>';
    return '<a href="profile.html?userId=' + userId + '" class="' + cls + '" title="查看 TA 的主页">' + inner + '</a>';
}

// ==================== 通用分页条 ====================
// 页码式分页:上一页 | 1 2 … N | 下一页 + "第 X / Y 页 · 共 N 条"。
// page 为 0-based。onGo(page) 由各页决定怎么翻:
//   大厅 → 重新请求后端(真·服务端分页);消息中心/我的订单 → 本地切片。
function renderPager(container, opts) {
    if (!container) return;
    var page = opts.page || 0;
    var totalPages = opts.totalPages || 0;
    var total = opts.total || 0;
    if (totalPages <= 1) { container.innerHTML = ''; container.style.display = 'none'; return; }
    container.style.display = '';

    // 页码窗口:当前页左右各 2 个,两端补首尾页与省略号,避免页数多时排满一屏
    var nums = [];
    var start = Math.max(0, page - 2), end = Math.min(totalPages - 1, page + 2);
    if (start > 0) { nums.push(0); if (start > 1) nums.push('gap'); }
    for (var i = start; i <= end; i++) nums.push(i);
    if (end < totalPages - 1) { if (end < totalPages - 2) nums.push('gap'); nums.push(totalPages - 1); }

    var html = '<button type="button" class="pager-btn" data-go="' + (page - 1) + '"' + (page === 0 ? ' disabled' : '') + '>上一页</button>';
    html += nums.map(function(n) {
        if (n === 'gap') return '<span class="pager-gap">…</span>';
        return '<button type="button" class="pager-btn pager-num' + (n === page ? ' active' : '') + '" data-go="' + n + '">' + (n + 1) + '</button>';
    }).join('');
    html += '<button type="button" class="pager-btn" data-go="' + (page + 1) + '"' + (page >= totalPages - 1 ? ' disabled' : '') + '>下一页</button>';
    html += '<span class="pager-info">第 ' + (page + 1) + ' / ' + totalPages + ' 页 · 共 ' + total + ' 条</span>';
    container.innerHTML = html;

    container.onclick = function(e) {
        var b = e.target.closest ? e.target.closest('.pager-btn') : null;
        if (!b || b.disabled) return;
        var go = parseInt(b.getAttribute('data-go'), 10);
        if (isNaN(go) || go < 0 || go >= totalPages || go === page) return;
        opts.onGo(go);
    };
}

// 本地分页:把整份数组切出第 page 页(消息中心/我的订单用)
function pageSlice(arr, page, size) {
    return arr.slice(page * size, page * size + size);
}

// ==================== 互助大厅 ====================

function initTaskHall() {
    if (!window.location.pathname.includes('task-hall.html')) return;

    var taskList = document.getElementById('taskList');
    var emptyState = document.getElementById('emptyState');
    if (!taskList) return;

    var currentPage = 0;
    var pageSize = 10;
    var pagerEl = document.getElementById('hallPager');

    function buildFilters() {
        var typeFilter = document.getElementById('taskTypeFilter');
        var keywordInput = document.getElementById('taskKeyword');
        var sortSelect = document.getElementById('sortSelect');

        var selectedSide = typeFilter ? typeFilter.value : 'all';
        var keyword = keywordInput ? keywordInput.value.trim() : '';
        var sortValue = sortSelect ? sortSelect.value : '';

        var checkedInputs = document.querySelectorAll('input[name="taskCategory"]:checked');
        var selectedCategories = Array.from(checkedInputs).map(function(input) { return input.value; });

        return {
            side: selectedSide,
            categories: selectedCategories,
            keyword: keyword,
            sort: sortValue
        };
    }

    function renderTaskItem(task) {
        var typeLabel = task.publisherSide === 'payer' ? '悬赏求助' : (task.publisherSide === 'none' ? '组队互助' : '提供服务');
        var typeClass = task.publisherSide === 'payer' ? 'badge-demand' : (task.publisherSide === 'none' ? 'badge-mutual' : 'badge-service');
        var catName = CATEGORY_MAP[task.category] || task.category;
        var creditColor = getCreditColorClass(task.publisherCredit);
        var timeStr = timeAgo(task.publishTime);

        var actionLabel = task.publisherSide === 'payer' ? '接单赚钱' : (task.publisherSide === 'none' ? '报名参加' : '下单找他');
        var actionClass = task.publisherSide === 'payer' ? 'btn-demand' : (task.publisherSide === 'none' ? 'btn-mutual' : 'btn-service');
        // 管理员为纯管理角色、不参与交易：不显示接单/下单，改为就地下架入口（大厅只列 open 帖，故下架总是可用）
        var actionBtn = isAdminUser()
            ? '<button type="button" class="btn btn-danger" onclick="handleAdminClosePost(\'' + task.id + '\')">下架</button>'
            : '<button type="button" class="btn ' + actionClass + '" onclick="goToOrderChat(\'' + task.id + '\', \'' + task.publisherId + '\')">' + actionLabel + '</button>';

        var bodyImages = task.images && task.images.length > 0 ? '<div class="task-images">' + task.images.slice(0, 3).map(function(img, idx) {
            var thumbSrc = (img && img.thumb) ? img.thumb : ((img && img.full) ? img.full : img);
            return '<img src="' + thumbSrc + '" data-postid="' + task.id + '" data-idx="' + idx + '" class="task-image-thumb" loading="lazy" onerror="this.style.display=\'none\'">';
        }).join('') + '</div>' : '';
        return '<div class="task-item task-side-' + task.publisherSide + '" data-postid="' + task.id + '" data-side="' + task.publisherSide + '" data-category="' + task.category + '">' +
            '<div class="task-item-main">' +
                '<div class="task-item-top">' +
                    '<h3>' + task.title + '</h3>' +
                    '<span class="task-badge ' + typeClass + '">' + typeLabel + '</span>' +
                '</div>' +
                '<div class="task-publisher">' + userChip(task.publisherId, task.publisherName, task.publisherAvatar) + '<span class="task-publisher-credit">信用 <span class="credit-score ' + creditColor + '">' + task.publisherCredit + '</span></span></div>' +
                '<p class="meta">分类：' + catName + (task.publisherSide === 'none' ? '' : ' ｜ 报酬：' + formatReward(task.reward)) + (task.publisherSide === 'payer' && task.deadline ? ' ｜ 截止：' + formatDateTime(task.deadline) : '') + ' ｜ ' + timeStr + '</p>' +
                '<div class="task-item-body">' +
                    '<p class="task-desc">' + task.description + '</p>' +
                    bodyImages +
                '</div>' +
                '<div class="actions">' +
                    '<a href="task-detail.html?id=' + task.id + '" class="btn btn-secondary">查看详情</a>' +
                    actionBtn +
                    // 登录的普通用户可举报；管理员/未登录不显示
                    (isLoggedIn() && !isAdminUser() ? '<button type="button" class="btn btn-small btn-link-report" onclick="handleReport(\'' + task.id + '\')">举报</button>' : '') +
                '</div>' +
            '</div>' +
        '</div>';
    }

    // reset=true：回到首页并清空列表（筛选/排序/搜索变化时）；reset=false：加载下一页追加
    // 大厅是真·服务端分页:每翻一页就带 page 重新请求，只渲染当页(不再追加)。
    // reset=true 表示筛选/搜索变了 → 回到第 1 页。
    function fetchAndRender(reset) {
        if (reset) currentPage = 0;
        var filters = buildFilters();
        filters.page = currentPage;
        filters.size = pageSize;
        getTasks(filters).then(function(res) {
            var tasks = (res && res.list) ? res.list : [];
            var total = (res && typeof res.total === 'number') ? res.total : tasks.length;
            window.__hallCurrentPage = currentPage;   // 供 WebSocket 新任务插卡判断是否在第 1 页
            if (tasks.length === 0 && currentPage === 0) {
                taskList.innerHTML = '';
                if (emptyState) emptyState.style.display = 'block';
                renderPager(pagerEl, { page: 0, totalPages: 0, total: 0, onGo: function() {} });
                return;
            }
            if (emptyState) emptyState.style.display = 'none';
            taskList.innerHTML = tasks.map(renderTaskItem).join('');
            renderPager(pagerEl, {
                page: currentPage,
                totalPages: Math.ceil(total / pageSize),
                total: total,
                onGo: function(p) {
                    currentPage = p;
                    fetchAndRender(false);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                }
            });
        });
    }

    function renderTasks() { fetchAndRender(true); }

    // 管理员就地下架后重拉列表（被下架的帖会从大厅消失）
    window.__adminOnPostChanged = renderTasks;

    renderTasks();
    // 暴露给 initWebSocket 的 NEW_TASK 局部插入新卡片用
    window.renderTaskItem = renderTaskItem;
    // 实时新任务是否匹配当前筛选(类型/分类/关键词)——不匹配则不插入，避免"看着生活服务却冒出跑腿代办"
    window.hallMatchesCurrentFilter = function(task) {
        if (!task) return false;
        var f = buildFilters();
        if (f.side && f.side !== 'all' && task.publisherSide !== f.side) return false;
        if (f.categories && f.categories.length > 0 && f.categories.indexOf(task.category) < 0) return false;
        if (f.keyword) {
            var kw = f.keyword.toLowerCase();
            var hay = ((task.title || '') + ' ' + (task.description || '') + ' ' + (task.publisherName || '')).toLowerCase();
            if (hay.indexOf(kw) < 0) return false;
        }
        return true;
    };

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
    if (blockIfAdmin()) return;
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
    // 未登录直接拦截跳登录页（参照消息中心/我的订单），
    // 避免非法进入发布界面后还能点“取消”留在页面看到表单
    if (!protectPage(['publish-task.html'])) return;
    // 管理员为纯管理角色，不发布互助
    if (isAdminUser()) {
        alert('管理员账号不参与交易，仅用于平台管理。');
        window.location.href = 'admin.html';
        return;
    }
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
    setupImageUploader(imageInput, previewArea, uploadedImages, 3);

    // 根据"出钱/收钱/纯互助"切换专属字段与文案
    var deadlineGroup = document.getElementById('deadlineGroup');
    var serviceTimeGroup = document.getElementById('serviceTimeGroup');
    var rewardGroup = document.getElementById('rewardGroup');
    var rewardLabel = document.getElementById('rewardLabel');
    // 报酬 label 文本由 syncFields 动态切换，固定一个 span 承载文本，保留必填 * 标记不被覆盖
    var rewardText = rewardLabel ? rewardLabel.querySelector('.reward-text') : null;

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
        if (rewardText) rewardText.textContent = side === 'payer' ? '报酬金额（你愿意支付）' : '期望报酬（你的收费）';
        if (side === 'none') {
            var cat = document.getElementById('postCategory');
            if (cat) cat.value = 'teamwork';
        } else {
            // 从"组队"切回我出钱/我收钱：清掉组队时自动设的分类，恢复未选状态
            var cat2 = document.getElementById('postCategory');
            if (cat2 && cat2.value === 'teamwork') cat2.value = '';
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
        var deadline = document.getElementById('postDeadline').value;

        // 逐项校验必填，给出具体提示（与表单 * 标注一致）
        if (!title) { alert('请填写标题。'); return; }
        if (!category) { alert('请选择分类。'); return; }
        if (!description) { alert('请填写描述。'); return; }
        if (side === 'payer' && !deadline) { alert('请选择截止时间。'); return; }
        // 纯互助无报酬，reward 固定为「无」；其余方向报酬为必填
        if (side === 'none') {
            reward = '无';
        }
        if (side !== 'none' && !reward) { alert('请填写报酬金额。'); return; }
        // 报酬金额最多两位小数（reward 为自由文本，拦"5.999"这类多于两位小数的数字）
        if (side !== 'none' && /\d+\.\d{3,}/.test(reward)) { alert('报酬金额最多保留两位小数。'); return; }

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

        // 防重复提交：提交即锁按钮并改文案，成功后跳转、失败时恢复
        if (publishBtn.disabled) return;
        publishBtn.disabled = true;
        var _oldText = publishBtn.textContent;
        publishBtn.textContent = '发布中…';

        publishPost(data).then(function() {
            alert('发布成功！');
            window.location.href = 'task-hall.html';
        }).catch(function(err) {
            alert(err.message || '发布失败');
            publishBtn.disabled = false;
            publishBtn.textContent = _oldText;
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
        var publisher = result.publisher || {};
        var catName = CATEGORY_MAP[task.category] || task.category;
        var typeLabel = task.publisherSide === 'payer' ? '悬赏求助（发布者出钱）' : (task.publisherSide === 'none' ? '组队互助（不涉及金钱）' : '提供服务（发布者收钱）');
        var expired = task.publisherSide === 'payer' && task.deadline && new Date(task.deadline).getTime() < Date.now();
        var statusMap = { open: '可下单', closed: '已结束' };
        var statusText = expired ? '已截止' : (statusMap[task.status] || task.status);

        var imagesHtml = '';
        if (task.images && task.images.length > 0) {
            imagesHtml = '<div class="detail-images">' +
                task.images.map(function(img, idx) {
                    var thumbSrc = (img && img.thumb) ? img.thumb : ((img && img.full) ? img.full : img);
                    return '<img src="' + thumbSrc + '" data-idx="' + idx + '" class="detail-image" loading="lazy" onerror="this.style.display=\'none\'">';
                }).join('') +
            '</div>';
        }

        var box = document.querySelector('.detail-box');
        if (box) {
            var currentUser = getCurrentUser();
            var isMine = currentUser && currentUser.id === task.publisherId;
            var isAdminView = (typeof isAdminUser === 'function') && isAdminUser();
            // 管理员就地下架后刷新本页（状态会变成已结束）
            if (isAdminView) window.__adminOnPostChanged = function() { window.location.reload(); };
            var actionLabel = task.publisherSide === 'payer' ? '接单赚钱' : (task.publisherSide === 'none' ? '报名参加' : '下单找他');
            var serviceTimeHtml = (task.publisherSide === 'earner' && task.serviceTime)
                ? '<p><strong>可服务时间：</strong>' + task.serviceTime + '</p>' : '';
            var sideClass = task.publisherSide === 'payer' ? 'side-payer' : (task.publisherSide === 'none' ? 'side-none' : 'side-earner');
            box.innerHTML = '<div class="detail-banner ' + sideClass + '">' + typeLabel + '</div>' +
                '<p><strong>标题：</strong>' + task.title + '</p>' +
                '<p><strong>类型：</strong>' + typeLabel + '</p>' +
                '<p><strong>分类：</strong>' + catName + '</p>' +
                '<p><strong>描述：</strong>' + task.description + '</p>' +
                '<div class="detail-publisher"><strong>发布者：</strong>' + userChip(task.publisherId, task.publisherName, publisher.avatar, 'user-chip--lg') + '<span class="task-publisher-credit">信用 <span class="credit-score ' + getCreditColorClass(task.publisherCredit) + '">' + task.publisherCredit + '</span></span></div>' +
                '<p><strong>联系方式：</strong>' + (task.contact || '站内联系') + '</p>' +
                (task.publisherSide === 'none' ? '' : '<p><strong>报酬金额：</strong>' + formatReward(task.reward) + '</p>') +
                serviceTimeHtml +
                '<p><strong>发布时间：</strong>' + formatDateTime(task.publishTime) + '</p>' +
                (task.publisherSide === 'payer' && task.deadline ? '<p><strong>截止时间：</strong>' + formatDateTime(task.deadline) + '</p>' : '') +
                '<p><strong>状态：</strong>' + statusText + '</p>' +
                imagesHtml +
                '<div class="actions">' +
                    // 管理员不参与交易：不给接单/下单（原先会显示但点了被 blockIfAdmin 拦住，纯白点），改为就地下架
                    (isAdminView
                        ? (task.status === 'open'
                            ? '<button type="button" class="btn btn-danger" onclick="handleAdminClosePost(\'' + task.id + '\')">下架该帖</button>'
                            : '<span class="note">该帖已下架/已结束</span>')
                        : (isMine ? (task.status === 'open'
                                ? '<span class="note">这是你发布的帖子</span> <button type="button" class="btn btn-small btn-secondary" onclick="handleOwnerClose(\'' + task.id + '\')">撤回</button>'
                                : '<span class="note">这是你发布的帖子（已结束）</span>')
                            // 已下架/结束的帖子仍可通过直链打开，但不能再下单（后端会拒），不给接单按钮
                            : (task.status === 'closed' ? '<span class="note">该任务已下架或结束，无法接单</span>'
                                : (expired ? '<span class="note">该悬赏已截止，无法接单</span>'
                                    : '<button type="button" class="btn" onclick="goToOrderChat(\'' + task.id + '\', \'' + task.publisherId + '\')">' + actionLabel + '</button>')))) +
                    '<button type="button" class="btn btn-secondary" onclick="goBack()">返回上一页</button>' +
                '</div>';
            // 管理员视角:若该任务有待处理举报,在详情底部展示举报内容(原因/举报人/时间)
            if (typeof isAdminUser === 'function' && isAdminUser()) {
                getAdminReports().then(function(list) {
                    var rep = (list || []).find(function(it) { return it.post && String(it.post.id) === String(task.id); });
                    if (!rep) return;
                    var reasonsHtml = rep.reasons.map(function(r) {
                        return '<li>' + (r.reporterName || '匿名') + '：' + (r.reason || '') + '<span class="msg-time"> （' + formatDateTime(r.createdAt) + '）</span></li>';
                    }).join('');
                    box.insertAdjacentHTML('beforeend', '<div class="card report-detail-block" style="margin-top:16px;">' +
                        '<div class="msg-header"><h3>举报信息</h3><span class="status-badge status-action">被举报 ' + rep.reportCount + ' 次</span></div>' +
                        '<ul class="report-reasons">' + reasonsHtml + '</ul></div>');
                }).catch(function() {});
            }
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
    var overviewEl = document.getElementById('msgOverview');
    var tabsEl = document.getElementById('msgTabs');
    var filterBar = document.getElementById('msgFilterBar');
    var statusFilter = document.getElementById('msgStatusFilter');
    var roleFilter = document.getElementById('msgRoleFilter');
    var keywordInput = document.getElementById('msgKeyword');
    var searchBtn = document.getElementById('msgSearchBtn');
    if (!list) return;

    var enriched = [];
    var counts = { action: 0, progress: 0, unread: 0 };
    var activeTab = 'action';
    var pagerEl = document.getElementById('msgPager');
    var msgPage = 0;            // 当前标签页内的页码(0-based)
    var msgPageSize = 8;

    function renderRow(item) {
        var c = item.c;
        var si = item.statusInfo || {};
        var needAction = !!si.action;
        var inProgress = !needAction && si.className === 'status-in_progress';
        var statusBadge = si.text
            ? '<span class="status-badge ' + (needAction ? 'status-action' : si.className) + '">' + (needAction ? '● ' : '') + si.text + '</span>'
            : '';
        var uc = item.unread || 0;
        var unreadBadge = uc > 0 ? '<span class="msg-unread">' + (uc > 99 ? '99+' : uc) + ' 条未读</span>' : '';
        var reviewBtn = (si.review && item.orderId)
            ? '<button type="button" class="btn btn-small btn-link-skip" onclick="skipReview(\'' + item.orderId + '\')">暂不评价</button>'
            : '';
        var itemClass = 'message-item';
        if (needAction) itemClass += ' needs-action';
        else if (inProgress) itemClass += ' needs-progress';
        return '<div class="' + itemClass + '">' +
            '<div class="msg-header">' +
                '<h3>' + c.taskTitle + (item.roleText ? ' ｜ ' + item.roleText : '') + unreadBadge + '</h3>' +
                '<span class="msg-time">' + timeAgo(c.lastTime) + '</span>' +
            '</div>' +
            '<p class="meta">' + statusBadge + '聊天对象：' + (c.partnerId ? '<a href="profile.html?userId=' + c.partnerId + '" class="user-link">' + c.partnerName + '</a>' : c.partnerName) + '</p>' +
            '<p class="msg-preview">' + item.msgPreview + '</p>' +
            '<div class="actions">' +
                '<a href="chat-detail.html?chatId=' + c.id + '&partner=' + c.partnerId + '&task=' + (c.taskId || '') + '" class="btn">进入聊天</a>' +
                reviewBtn +
            '</div>' +
        '</div>';
    }

    // 分页渲染：标签页的分类计数必须基于「整份会话列表」才准确，所以这里是本地分页——
    // 后端一次批量返回全量(已优化为 4 次查询)，前端按当前标签切片显示。
    function renderList(arr, emptyText) {
        if (!arr.length) {
            list.innerHTML = '<div class="card empty-state"><p>' + (emptyText || '暂无消息') + '</p></div>';
            renderPager(pagerEl, { page: 0, totalPages: 0, total: 0, onGo: function() {} });
            return;
        }
        var totalPages = Math.ceil(arr.length / msgPageSize);
        if (msgPage > totalPages - 1) msgPage = totalPages - 1;   // 数据变少时夹住页码
        list.innerHTML = pageSlice(arr, msgPage, msgPageSize).map(renderRow).join('');
        renderPager(pagerEl, {
            page: msgPage, totalPages: totalPages, total: arr.length,
            onGo: function(p) { msgPage = p; renderList(arr, emptyText); window.scrollTo({ top: 0, behavior: 'smooth' }); }
        });
    }

    // 「全部」标签的筛选（状态/角色/关键词）
    function applyFilters() {
        var st = statusFilter ? statusFilter.value : 'all';
        var rl = roleFilter ? roleFilter.value : 'all';
        var kw = keywordInput ? keywordInput.value.trim().toLowerCase() : '';
        var filtered = enriched.filter(function(item) {
            var c = item.c;
            var si = item.statusInfo || {};
            if (st === 'action' && !si.action) return false;
            if (st === 'progress' && si.className !== 'status-in_progress') return false;
            if (st === 'review' && !si.review) return false;
            if (st === 'done' && si.text !== '已完成') return false;
            if (st === 'closed' && !si.closed) return false;
            if (rl === 'payer' && item.roleText !== '我是付款方') return false;
            if (rl === 'earner' && item.roleText !== '我是收款方') return false;
            if (kw) {
                var hay = ((c.taskTitle || '') + ' ' + (c.partnerName || '')).toLowerCase();
                if (hay.indexOf(kw) < 0) return false;
            }
            return true;
        });
        renderList(filtered, '没有符合条件的会话');
    }

    function renderPanel() {
        if (filterBar) filterBar.style.display = (activeTab === 'all') ? '' : 'none';
        if (activeTab === 'all') { applyFilters(); return; }
        if (activeTab === 'action') {
            renderList(enriched.filter(function(it) { return it.needsAction && !it.isSystem; }), '没有需要处理的消息');
            return;
        }
        if (activeTab === 'progress') {
            // 进行中：按最后消息时间倒序，方便和对方继续沟通
            var prog = enriched.filter(function(it) { return it.inProgress; })
                .slice().sort(function(a, b) { return String(b.c.lastTime || '').localeCompare(String(a.c.lastTime || '')); });
            renderList(prog, '暂无进行中的订单');
            return;
        }
        // 未读：按最后消息时间倒序（含未读的系统通知）
        var arr = enriched.filter(function(it) { return it.unread > 0; })
            .slice().sort(function(a, b) { return String(b.c.lastTime || '').localeCompare(String(a.c.lastTime || '')); });
        renderList(arr, '没有未读消息');
    }

    function renderOverview() {
        if (!overviewEl) return;
        overviewEl.innerHTML =
            '<div class="ov-card ov-danger" data-tab="action"><p class="ov-label">待我处理</p><p class="ov-num">' + counts.action + '</p></div>' +
            '<div class="ov-card ov-progress" data-tab="progress"><p class="ov-label">进行中</p><p class="ov-num">' + counts.progress + '</p></div>' +
            '<div class="ov-card ov-accent" data-tab="unread"><p class="ov-label">未读</p><p class="ov-num">' + counts.unread + '</p></div>';
    }
    function renderTabs() {
        if (!tabsEl) return;
        var tabs = [
            { key: 'action', label: '待处理', count: counts.action, danger: true },
            { key: 'progress', label: '进行中', count: counts.progress },
            { key: 'unread', label: '未读', count: counts.unread },
            { key: 'all', label: '全部' }
        ];
        tabsEl.innerHTML = tabs.map(function(t) {
            var badge = t.count > 0 ? ' <span class="tab-badge' + (t.danger ? ' tab-badge-danger' : '') + '">' + t.count + '</span>' : '';
            return '<button type="button" class="order-tab' + (activeTab === t.key ? ' active' : '') + '" data-tab="' + t.key + '">' + t.label + badge + '</button>';
        }).join('');
    }
    function switchTab(key) { activeTab = key; msgPage = 0; renderTabs(); renderPanel(); }

    function convScore(item) {
        var si = item.statusInfo || {};
        if (si.action) return 4;
        if (si.className === 'status-in_progress') return 3;
        if (item.unread > 0) return 2;
        if (si.review) return 1;
        return 0;
    }

    // 只重拉数据 + 重绘，不碰 activeTab / msgPage，也不重新绑定事件。
    // 新消息到达时必须走这里：以前 WebSocket 直接重跑 initMessageCenter()，
    // 会把当前标签重置回"待处理"、页码回到第 1 页，还每次多绑一组事件监听。
    function loadData() {
    var keepScroll = window.scrollY || window.pageYOffset || 0;
    return getEnrichedConversations().then(function(items) {
        if (!items || items.length === 0) {
            list.innerHTML = '<div class="card empty-state"><p>暂无消息</p></div>';
            if (overviewEl) overviewEl.innerHTML = '';
            if (tabsEl) tabsEl.innerHTML = '';
            return;
        }
        var currentUser = getCurrentUser();
        var myId = currentUser ? currentUser.id : '';

        // 聚合接口一次返回，纯本地计算；每项附 isSystem / unread / needsAction 三个分类标记
        enriched = items.map(function(it) {
            var c = it.conversation;
            var isSystem = c.id.indexOf('sys-notify-') === 0;
            var unread = it.unread || 0;

            if (isSystem) {
                return {
                    c: c, roleText: '', statusInfo: { text: '', className: '' },
                    msgPreview: c.lastMessage ? ('[系统] ' + c.lastMessage) : '',
                    orderId: null, isSystem: true, unread: unread, needsAction: false, inProgress: false
                };
            }

            var order = it.order;
            // 帖子已下架/删除：没有活跃订单时不能再下单，此前一律显示"待下单"，
            // 点进去才发现下不了单（任务栏写着"该任务已下架或结束"），状态是骗人的。
            var taskGone = !!it.taskDeleted || (!!it.taskStatus && it.taskStatus !== 'open');
            var statusInfo;
            if (!order || order.status === 'cancelled') {
                statusInfo = taskGone
                    ? { text: '已下架/已结束', className: 'status-cancelled', closed: true }
                    : { text: '待下单', className: 'status-pending' };
            } else {
                var isPublisher = (it.taskPublisherId != null) && (myId === it.taskPublisherId);
                statusInfo = describeOrderStatus(order, myId, isPublisher);
            }
            if (order && order.status === 'completed' && !it.reviewed && !isReviewSkipped(order.id)) {
                statusInfo = { text: '待我评价', className: 'status-completed', review: true };
            }

            var roleText = '';
            if (it.taskPublisherSide && myId) {
                if (it.taskPublisherSide === 'none') {
                    roleText = (myId === it.taskPublisherId) ? '我是发起者' : '我是参与者';
                } else {
                    var iAmPayer = (myId === it.taskPublisherId) ? (it.taskPublisherSide === 'payer') : (it.taskPublisherSide === 'earner');
                    roleText = iAmPayer ? '我是付款方' : '我是收款方';
                }
            }

            var msgPreview = '';
            if (c.lastMessage) {
                if (c.lastMessageSenderId === myId) msgPreview = '我：' + c.lastMessage;
                else if (c.lastMessageSenderId) msgPreview = (it.lastSenderName || '对方') + '：' + c.lastMessage;
                else msgPreview = c.lastMessage;
            }

            // 待我处理 = 待我接受/待我确认(action) 或 待我评价(review)
            var needsAction = (statusInfo.action === true) || (statusInfo.review === true);
            // 进行中 = 订单实际状态为 in_progress（含"待我确认"这类子状态，方便沟通时统一查看）
            var inProgress = !!(order && order.status === 'in_progress');
            return { c: c, roleText: roleText, statusInfo: statusInfo, msgPreview: msgPreview, orderId: order ? order.id : null, isSystem: false, unread: unread, needsAction: needsAction, inProgress: inProgress };
        });

        // 「全部」标签默认排序（待办>进行中>未读>待评价>普通）
        enriched.sort(function(a, b) { return convScore(b) - convScore(a); });

        counts = {
            action: enriched.filter(function(it) { return it.needsAction && !it.isSystem; }).length,
            progress: enriched.filter(function(it) { return it.inProgress; }).length,
            unread: enriched.filter(function(it) { return it.unread > 0; }).length
        };

        renderOverview();
        renderTabs();
        renderPanel();
        // 列表是整块重绘的，绘完把滚动位置放回原处，避免"来条新消息就被弹回顶部"
        if (keepScroll > 0) window.scrollTo(0, keepScroll);
    });
    }

    loadData();
    // 从聊天页"返回"时页面常由 bfcache 恢复，DOMContentLoaded 不再触发，
    // 未读角标会停在离开前的状态。注册刷新钩子，由 pageshow/visibilitychange 重新拉数据。
    window.__pageRefresh = loadData;
    // WebSocket 收到新消息时也走它做局部刷新（保持当前标签/页码/滚动位置）
    window.refreshMessageCenter = loadData;

    if (overviewEl) overviewEl.addEventListener('click', function(e) { var c = e.target.closest && e.target.closest('.ov-card'); if (c) switchTab(c.getAttribute('data-tab')); });
    if (tabsEl) tabsEl.addEventListener('click', function(e) { var b = e.target.closest && e.target.closest('.order-tab'); if (b) switchTab(b.getAttribute('data-tab')); });
    // 筛选条件变了 → 结果集变了，页码必须回到第 1 页，否则可能停在一个已不存在的页上
    function applyFiltersFromPage1() { msgPage = 0; applyFilters(); }
    if (statusFilter) statusFilter.addEventListener('change', applyFiltersFromPage1);
    if (roleFilter) roleFilter.addEventListener('change', applyFiltersFromPage1);
    if (searchBtn) searchBtn.addEventListener('click', applyFiltersFromPage1);
    if (keywordInput) keywordInput.addEventListener('keydown', function(e) { if (e.key === 'Enter') { e.preventDefault(); applyFiltersFromPage1(); } });
}

// 消息中心「暂不评价」：本地记住用户主动跳过的订单，不再在消息中心提示待评价
function isReviewSkipped(orderId) {
    if (!orderId) return false;
    try {
        var skipped = JSON.parse(localStorage.getItem('skipped_reviews') || '[]');
        return skipped.indexOf(String(orderId)) >= 0;
    } catch (e) { return false; }
}
window.skipReview = function(orderId) {
    if (!orderId) return;
    try {
        var skipped = JSON.parse(localStorage.getItem('skipped_reviews') || '[]');
        if (skipped.indexOf(String(orderId)) < 0) {
            skipped.push(String(orderId));
            localStorage.setItem('skipped_reviews', JSON.stringify(skipped));
        }
    } catch (e) {}
    // 重新渲染消息中心列表（去掉该会话的待评价提示）。
    // 走局部刷新而不是重跑 init：否则点一下"暂不评价"就被弹回"待处理"第 1 页。
    if (typeof window.refreshMessageCenter === 'function') window.refreshMessageCenter();
};

// ==================== 聊天详情 ====================

function initChatDetail() {
    if (!window.location.pathname.includes('chat-detail.html')) return;
    if (!protectPage(['chat-detail.html'])) return;

    var chatId = getUrlParam('chatId');
    var partnerId = getUrlParam('partner');
    var taskId = getUrlParam('task');
    // 归一化：历史链接可能出现字符串 "undefined"/"null"，视为无 taskId
    if (taskId === 'undefined' || taskId === 'null') taskId = '';

    // 管理员只读查看模式（?admin=1 且当前登录用户是管理员）：
    // 仲裁取证用——只看聊天记录，隐藏输入/付款/订单操作，不标记已读、不创建会话
    var meForAdmin = getCurrentUser();
    var adminView = getUrlParam('admin') === '1' && !!(meForAdmin && meForAdmin.role === 1);

    // 系统通知会话（平台 → 用户，单向、不可回复）
    var sysNotifyView = !!chatId && chatId.indexOf('sys-notify-') === 0;

    if (!chatId) {
        document.querySelector('.chat-box').innerHTML = '<p>聊天不存在</p>';
        return;
    }

    if (adminView || sysNotifyView) {
        var inputArea = document.querySelector('.chat-input-area');
        if (inputArea) inputArea.style.display = 'none';
    }
    if (sysNotifyView) {
        var metaEls0 = document.querySelectorAll('.chat-header .meta');
        if (metaEls0.length >= 1) metaEls0[0].textContent = '聊天对象：系统通知';
        if (metaEls0.length >= 2) metaEls0[1].textContent = '平台通知，不可回复';
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
            metaEls[0].innerHTML = '聊天对象：' + (partnerIdParam ? '<a href="profile.html?userId=' + partnerIdParam + '" class="user-link">' + partnerName + '</a>' : partnerName);
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
    function paymentCardHTML(m, currentUser, isSelf, myBalance) {
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
                // 余额预判：不足则禁用支付按钮，避免点了才被后端拒绝（myBalance 为 null 时放行，交后端兜底）
                var insufficient = (myBalance !== null && myBalance !== undefined) && (Number(myBalance) < Number(p.amount));
                if (insufficient) {
                    statusText = '余额不足，无法支付';
                    actions = '<button type="button" class="btn btn-small" disabled style="opacity:0.6;cursor:not-allowed;">余额不足</button>';
                } else {
                    statusText = '待你支付';
                    actions = '<button type="button" class="btn btn-small pay-card-btn" onclick="handlePayCard(\'' + m.id + '\')">支付 ¥' + p.amount + '</button>';
                }
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

    function renderMessages(forceScroll) {
        getMessages(chatId).then(async function(messages) {
            var currentUser = getCurrentUser();
            if (!messages || messages.length === 0) {
                messageList.innerHTML = '<p style="text-align:center;color:#999;">暂无消息，开始聊天吧</p>';
                return;
            }
            // 预查当前用户余额，供收款卡片支付按钮做余额预判（查询失败则放行，交后端兜底）
            var myBalance = null;
            if (currentUser) {
                try { myBalance = (await getMyBalance()).balance; } catch (e) { myBalance = null; }
            }
            // 记录刷新前是否在底部附近（用户在看最新消息），用于智能滚动
            var wasNearBottom = chatBox.scrollHeight - chatBox.scrollTop - chatBox.clientHeight < 80;
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
                    return paymentCardHTML(m, currentUser, isSelf, myBalance);
                }
                // mock 用 senderId='system' 标记系统消息，真后端用 type='system'——两种都识别
                if (m.senderId === 'system' || m.type === 'system') {
                    return '<div class="chat-message system">' + m.content + '</div>';
                }
                if (m.type === 'image') {
                    var icls = isSelf ? 'chat-right' : 'chat-left';
                    return '<div class="chat-message ' + icls + '" data-msg-id="' + m.id + '" data-sender="' + m.senderId + '">' +
                        '<img src="' + m.content + '" onclick="openImageOverlay(this.src)" style="max-width:180px;max-height:180px;border-radius:8px;cursor:pointer;display:block;" onerror="this.style.display=\'none\'">' +
                        '<div class="chat-time">' + formatDateTime(m.time) + '</div>' +
                    '</div>';
                }
                var cls = isSelf ? 'chat-right' : 'chat-left';
                return '<div class="chat-message ' + cls + '" data-msg-id="' + m.id + '" data-sender="' + m.senderId + '">' +
                    '<div class="chat-text">' + m.content + '</div>' +
                    '<div class="chat-time">' + formatDateTime(m.time) + '</div>' +
                '</div>';
            }).join('');
            // 智能滚动：forceScroll 非 false（进入页面/发消息）或原本在底部附近 -> 滚到底；否则保持位置（不打断查看历史）
            if (forceScroll !== false || wasNearBottom) {
                chatBox.scrollTop = chatBox.scrollHeight;
            }
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
        // 管理员只读：不查订单（后端订单接口仅参与者可查），只显示提示与返回入口
        if (adminView) {
            taskBar.innerHTML = '<div class="task-bar-info"><span class="task-bar-status">管理员只读查看模式</span></div>' +
                '<div class="task-bar-actions"><a href="admin.html" class="btn btn-small btn-secondary">返回管理后台</a></div>';
            taskBar.style.display = 'flex';
            return;
        }
        if (!taskId) { taskBar.style.display = 'none'; return; }
        // 帖子可能已被管理员删除(软删) → getTaskDetail 抛 404。此前这里没有兜底，
        // 整个 renderTaskBar 会因异常中断，任务栏渲染不出来，当事人连"确认完成/申诉"都点不到。
        // 后端已禁止删除有活跃订单的帖子，这里再兜一层：任务没了也要让订单能走完。
        var result = null;
        try {
            result = await getTaskDetail(taskId);
        } catch (e) {
            result = null;
        }
        var task = result && result.task;
        if (!task) {
            // 任务已不可见：仅凭订单本身（不依赖任务信息）让进行中的订单还能确认完成/申诉，
            // 否则付款方的钱会一直冻结着、双方谁也点不了。
            var lostOrder = null;
            try { lostOrder = await getOrder(chatId); } catch (e2) { lostOrder = null; }
            if (!lostOrder || lostOrder.status !== 'in_progress') {
                taskBar.innerHTML = '<div class="task-bar-info"><span class="task-bar-status">该任务已被删除或不可见</span></div>';
                taskBar.style.display = 'flex';
                return;
            }
            var lostUser = getCurrentUser();
            var lostIsPayer = lostUser && lostUser.id === lostOrder.payerId;
            var lostMyConfirmed = lostIsPayer ? lostOrder.payerConfirmed : lostOrder.earnerConfirmed;
            var lostActions = '<span class="task-bar-money">' +
                (lostIsPayer ? '已支付 ' + lostOrder.amount + ' 元·冻结中' : '完成后到账 ' + lostOrder.amount + ' 元') + '</span>';
            lostActions += lostMyConfirmed
                ? '<span class="task-bar-waiting">等待对方确认...</span>'
                : '<button type="button" class="btn btn-small" onclick="handleOrderConfirm(\'' + lostOrder.id + '\')">确认完成</button>';
            lostActions += '<button type="button" class="btn btn-small btn-secondary" onclick="handleDispute(\'' + lostOrder.id + '\')">申诉</button>';
            taskBar.innerHTML = '<div class="task-bar-info"><span class="task-bar-status">该任务已被删除，本单仍可继续处理</span></div>' +
                '<div class="task-bar-actions">' + lostActions + '</div>';
            taskBar.style.display = 'flex';
            return;
        }
        var currentUser = getCurrentUser();

        var order = await getOrder(chatId);
        if (order && order.postId !== task.id) order = null; // 只认本帖的订单

        var html = '<div class="task-bar-info">' +
            '<span class="task-bar-title">' + task.title + '</span>' +
            // 纯互助不涉及金钱，不显示报酬
            (task.publisherSide === 'none' ? '' : '<span class="task-bar-reward">' + formatReward(task.reward) + '</span>');
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
        // 仅在「尚未下单 / pending 待接受」阶段提示付款方备款；
        // in_progress 起资金已冻结（acceptOrder 时已扣款），不再用当前余额比对订单金额，否则会误报"余额不足"
        if (order && order.status !== 'pending') return '';
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
            // 帖子已下架/结束：后端 createOrder 会以"任务不存在或已取消"拒掉，
            // 这里提前说清楚，别给一个点了必然失败的下单按钮（大厅卡片可能还没被实时移除）
            if (task.status === 'closed') {
                return '<span class="task-bar-status">该任务已下架或结束，无法下单</span>';
            }
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
            // 双方任一方可申诉：订单转入争议、资金冻结，等待管理员裁决
            actions += '<button type="button" class="btn btn-small btn-secondary" onclick="handleDispute(\'' + order.id + '\')">申诉</button>';
            return actions;
        }

        if (order.status === 'disputed') {
            return '<span class="task-bar-status">争议处理中，资金已冻结，等待管理员裁决</span>';
        }

        if (order.status === 'closed') {
            var resMap = { refund: '全额退款', settle: '全额结算', partial: '部分结算' };
            var resText = resMap[order.resolution] || '';
            return '<span class="task-bar-waiting">已结案' + (resText ? ' · ' + resText : '') +
                (order.resolutionNote ? '（' + order.resolutionNote + '）' : '') + '</span>';
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
    // 暴露给全局 handleXxx（接单/确认/申诉/支付等写操作成功后局部刷新，不再整页 reload）
    window.renderMessages = renderMessages;
    window.renderTaskBar = renderTaskBar;

    // 打开聊天即把对方发来的未读消息标记为已读，并刷新导航栏红点（管理员只读不标已读）
    if (!adminView) {
        markMessagesRead(chatId).then(function() { updateNavUnread(); });
    }

    // 确保 conversation 存在，使消息中心能显示该会话（管理员只读不创建会话）
    if (!adminView && partnerId && taskId) {
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
        // Enter 发送；Ctrl+Enter 或 Shift+Enter 手动换行（输入法组合中的回车不触发）
        chatInput.addEventListener('keydown', function(e) {
            if (e.key !== 'Enter' || e.isComposing) return;
            if (e.ctrlKey || e.shiftKey) {
                // 手动换行：在光标处插入换行符
                e.preventDefault();
                var s = chatInput.selectionStart, en = chatInput.selectionEnd;
                chatInput.value = chatInput.value.slice(0, s) + '\n' + chatInput.value.slice(en);
                chatInput.selectionStart = chatInput.selectionEnd = s + 1;
                return;
            }
            e.preventDefault();
            doSend();
        });

        // 注入"图片"按钮：上传图片(文件存储)后作为图片消息发送
        var imgBtn = document.createElement('button');
        imgBtn.type = 'button';
        imgBtn.className = 'btn btn-secondary';
        imgBtn.textContent = '图片';
        imgBtn.style.marginRight = '6px';
        var imgInput = document.createElement('input');
        imgInput.type = 'file';
        imgInput.accept = 'image/*';
        imgInput.style.display = 'none';
        sendBtn.parentNode.insertBefore(imgBtn, sendBtn);
        sendBtn.parentNode.insertBefore(imgInput, sendBtn);
        imgBtn.addEventListener('click', function() { imgInput.click(); });
        imgInput.addEventListener('change', function(e) {
            var file = e.target.files[0];
            imgInput.value = '';
            if (!file) return;
            if (!file.type || file.type.indexOf('image/') !== 0) { alert('只能发送图片'); return; }
            imgBtn.disabled = true; imgBtn.textContent = '上传中…';
            uploadImage(file).then(function(res) {
                return sendMessage(chatId, res.url, 'image');
            }).then(function() {
                renderMessages();
            }).catch(function(err) {
                alert(err.message || '图片发送失败');
            }).then(function() {
                imgBtn.disabled = false; imgBtn.textContent = '图片';
            });
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
            var parsed = parseMoneyInput(input);
            if (!parsed.ok) { alert(parsed.error); return; }
            var amt = parsed.value;
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
        // 局部刷新：支付卡片状态 + 余额提示（renderTaskBar 内会重拉余额）
        window.renderMessages && window.renderMessages();
        window.renderTaskBar && window.renderTaskBar();
    }).catch(function(err) {
        alert(err.message || '支付失败');
    });
};

// 发起方取消一张待支付的收款卡片
window.handleCancelCard = function(messageId) {
    if (!confirm('确定取消这笔收款吗？')) return;
    cancelPaymentCard(messageId).then(function() {
        // 局部刷新：只更新卡片状态，不影响订单/余额
        window.renderMessages && window.renderMessages();
    }).catch(function(err) {
        alert(err.message || '取消失败');
    });
};

// 响应者发起订单（接单/下单）
window.handleOrderCreate = function(postId, chatId) {
    if (!requireVerified()) return;
    createOrder(postId, chatId).then(function() {
        alert('已发起订单，等待对方接受！');
        // 局部刷新：任务栏（按钮变"等待对方接受"）+ 系统消息
        window.renderTaskBar && window.renderTaskBar();
        window.renderMessages && window.renderMessages();
    }).catch(function(err) {
        alert(err.message || '操作失败');
    });
};

// 发布者接受订单
window.handleOrderAccept = function(orderId) {
    if (!requireVerified()) return;
    acceptOrder(orderId).then(function() {
        alert('已接受订单，开始执行！');
        // 局部刷新：任务栏（状态变进行中、余额冻结提示）+ 系统消息
        window.renderTaskBar && window.renderTaskBar();
        window.renderMessages && window.renderMessages();
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
        // 局部刷新：任务栏（按钮变回"接单/下单"）+ 系统消息
        window.renderTaskBar && window.renderTaskBar();
        window.renderMessages && window.renderMessages();
    }).catch(function(err) {
        alert(err.message || '操作失败');
    });
};

// 确认完成（任一方，双方都确认才结算）
// ==================== 管理员帖子操作（多页共用） ====================
// 管理后台、互助大厅、任务详情都能下架帖子，故这些函数必须是顶层的
// （原先定义在 initAdminPage 内部，而它只在 admin.html 运行，别的页面拿不到）。
// 各页在自己的 init 里注册 __adminOnPostChanged，决定操作成功后怎么刷新。
window.__adminOnPostChanged = null;
function _afterAdminPostChange() {
    if (typeof window.__adminOnPostChanged === 'function') window.__adminOnPostChanged();
}

window.handleAdminClosePost = function(postId) {
    var reason = prompt('下架原因（将通过系统通知告知发布者；可留空）：');
    if (reason === null) return; // 取消
    adminClosePost(postId, reason).then(function() {
        alert('已下架，已通知发布者。');
        _afterAdminPostChange();
    }).catch(function(err) {
        alert(err.message || '操作失败');
    });
};

window.handleAdminDeletePost = function(postId) {
    var reason = prompt('删除原因（将通过系统通知告知发布者；可留空）。删除为软删除，全站不可见但记录保留：');
    if (reason === null) return;
    adminDeletePost(postId, reason).then(function() {
        alert('已删除，已通知发布者。');
        _afterAdminPostChange();
    }).catch(function(err) {
        alert(err.message || '操作失败');
    });
};

// 忽略（驳回）某帖的全部待处理举报：举报不成立时用，帖子保持展示，只通知举报人
window.handleAdminDismissReports = function(postId) {
    var reason = prompt('忽略原因（将通知举报人；可留空）。帖子将保持正常展示：');
    if (reason === null) return;
    adminDismissReports(postId, reason).then(function(n) {
        alert('已忽略该帖举报' + (n ? '（' + n + ' 条）' : '') + '，帖子保持展示，已通知举报人。');
        _afterAdminPostChange();
    }).catch(function(err) {
        alert(err.message || '操作失败');
    });
};

// 普通用户举报帖子：填理由 → 提交给管理员处理
window.handleReport = function(postId) {
    if (!isLoggedIn()) {
        alert('请先登录后再举报。');
        window.location.href = 'login.html?redirect=' + encodeURIComponent('task-hall.html');
        return;
    }
    var reason = prompt('请填写举报理由（如：虚假信息、诈骗、垃圾广告、内容违规等）：');
    if (reason === null) return;
    reportPost(postId, reason).then(function() {
        alert('举报已提交，感谢反馈，管理员会尽快处理。');
    }).catch(function(err) {
        alert(err.message || '举报失败');
    });
};

// 发布者撤回自己的帖子（软下架）
window.handleOwnerClose = function(postId) {
    if (!confirm('确定撤回该互助吗？\n撤回后大厅不再显示，已有待接受申请将取消，进行中订单继续执行完。')) return;
    ownerClosePost(postId).then(function() {
        alert('已撤回');
        window.location.href = 'task-hall.html';
    }).catch(function(err) {
        alert(err.message || '撤回失败');
    });
};

// 发起申诉：填写理由 → 订单转 disputed（资金保持冻结），聊天发系统消息
window.handleDispute = function(orderId) {
    if (blockIfAdmin()) return;
    if (!requireVerified()) return;
    var reason = prompt('请填写申诉理由（将提交给管理员仲裁）：');
    if (reason === null) return;
    disputeOrder(orderId, reason).then(function() {
        alert('申诉已提交，订单已冻结，等待管理员处理。');
        // 局部刷新：任务栏（状态变争议处理中）+ 系统消息
        window.renderTaskBar && window.renderTaskBar();
        window.renderMessages && window.renderMessages();
    }).catch(function(err) {
        alert(err.message || '申诉失败');
    });
};

window.handleOrderConfirm = function(orderId) {
    if (!requireVerified()) return;
    confirmOrder(orderId).then(function(res) {
        if (res.order && res.order.status === 'completed') {
            // 纯互助订单无金钱结算
            alert(res.order.amount > 0 ? '订单已完成，款项已结算！' : '互助已完成！');
        } else {
            alert('已确认完成，等待对方确认。');
        }
        // 局部刷新：任务栏（按钮/状态流转，完成时余额变化）+ 系统消息
        window.renderTaskBar && window.renderTaskBar();
        window.renderMessages && window.renderMessages();
    }).catch(function(err) {
        alert(err.message || '操作失败');
    });
};


// ==================== 我的订单 ====================

function initOrderCenter() {
    if (!window.location.pathname.includes('order-center.html')) return;
    if (!protectPage(['order-center.html'])) return;

    var panel = document.getElementById('orderPanel');
    var orderPagerEl = document.getElementById('orderPager');
    var orderPage = 0;          // 当前标签页内的页码(0-based)
    var orderPageSize = 8;
    var tabsEl = document.getElementById('orderTabs');
    var overviewEl = document.getElementById('orderOverview');
    var filterBar = document.getElementById('orderFilterBar');
    var filterSelect = document.getElementById('orderFilter');
    var statusSelect = document.getElementById('orderStatus');
    var keywordInput = document.getElementById('orderKeyword');
    var searchBtn = document.getElementById('orderSearchBtn');
    if (!panel) return;

    var currentUser = getCurrentUser();
    if (!currentUser) { panel.innerHTML = '<div class="card empty-state"><p>请先登录</p></div>'; return; }
    var myId = currentUser.id;

    var allOrders = [];          // getMyOrders 全量（已附 reviewed）
    var myOpenPosts = [];        // 我发布的 open 帖子
    var myClosedPosts = [];      // 我发布的已下架/已结束帖子
    var activeTab = 'action';
    var counts = { action: 0, progress: 0, mine: 0 };

    function statusOf(r) {
        var isPublisher = r.post ? r.post.publisherId === myId : false;
        return describeOrderStatus(r.order, myId, isPublisher);
    }
    function isReviewPending(r) {
        return r.order.status === 'completed' && !r.reviewed && !isReviewSkipped(r.order.id);
    }
    function isNeedsAction(r) { return statusOf(r).action === true || isReviewPending(r); }
    function isInProgress(r) {
        if (isNeedsAction(r)) return false;
        return r.order.status === 'in_progress' || r.order.status === 'disputed';
    }
    function roleAmount(r) {
        var isMutual = r.post && r.post.publisherSide === 'none';
        var roleLabel = isMutual
            ? (r.post.publisherId === myId ? '发起者' : '参与者')
            : (r.myRole === 'payer' ? '我付款' : '我收款');
        var amountText = isMutual ? '不涉及金钱' : ((r.myRole === 'payer' ? '付 ' : '收 ') + r.order.amount + ' 元');
        return roleLabel + ' · ' + amountText;
    }

    // 紧凑单行卡（需要处理 / 进行中）
    function compactCard(r) {
        var o = r.order;
        var si = statusOf(r);
        var badgeText = si.text, badgeCls = si.className;
        var primaryHref = 'chat-detail.html?chatId=' + o.chatId + '&partner=' + r.partnerId + '&task=' + o.postId;
        var primaryText = '去处理';
        if (isReviewPending(r)) {
            badgeText = '待我评价'; badgeCls = 'status-completed';
            var toUserId = r.myRole === 'payer' ? o.earnerId : o.payerId;
            primaryHref = 'review.html?order=' + o.id + '&to=' + toUserId;
            primaryText = '去评价';
        } else if (!si.action) {
            primaryText = '进入聊天';
        }
        return '<div class="record-item order-row">' +
            '<div class="order-row-main">' +
                '<h3 class="order-row-title">' + r.title + '</h3>' +
                '<p class="meta"><span class="status-badge ' + badgeCls + '">' + badgeText + '</span>' + roleAmount(r) + ' · 对方 ' + (r.partnerId ? '<a href="profile.html?userId=' + r.partnerId + '" class="user-link">' + r.partnerName + '</a>' : r.partnerName) + '</p>' +
            '</div>' +
            '<a href="' + primaryHref + '" class="btn btn-secondary order-row-btn">' + primaryText + '</a>' +
        '</div>';
    }

    // 我发布的·待响应 卡
    function openPostCard(p) {
        var typeLabel = p.publisherSide === 'payer' ? '悬赏求助' : (p.publisherSide === 'none' ? '组队互助' : '提供服务');
        var rewardText = p.publisherSide === 'none' ? '不涉及金钱' : ('报酬 ' + formatReward(p.reward));
        return '<div class="record-item order-row">' +
            '<div class="order-row-main">' +
                '<h3 class="order-row-title">' + p.title + '</h3>' +
                '<p class="meta"><span class="status-badge status-pending">待响应</span>' + typeLabel + ' · ' + rewardText + ' · ' + timeAgo(p.publishTime) + '</p>' +
            '</div>' +
            '<div class="order-row-actions">' +
                '<a href="task-detail.html?id=' + p.id + '" class="btn btn-secondary btn-small">详情</a>' +
                '<button type="button" class="btn btn-small btn-link-report" onclick="handleOrderCenterWithdraw(\'' + p.id + '\')">撤回</button>' +
            '</div>' +
        '</div>';
    }

    // 我发布的·已下架/已结束 卡：只读，不给撤回（已经不在大厅了）
    function closedPostCard(p) {
        var typeLabel = p.publisherSide === 'payer' ? '悬赏求助' : (p.publisherSide === 'none' ? '组队互助' : '提供服务');
        var rewardText = p.publisherSide === 'none' ? '不涉及金钱' : ('报酬 ' + formatReward(p.reward));
        return '<div class="record-item order-row">' +
            '<div class="order-row-main">' +
                '<h3 class="order-row-title">' + p.title + '</h3>' +
                '<p class="meta"><span class="status-badge status-cancelled">已下架/已结束</span>' + typeLabel + ' · ' + rewardText + ' · ' + timeAgo(p.publishTime) + '</p>' +
            '</div>' +
            '<div class="order-row-actions">' +
                '<a href="task-detail.html?id=' + p.id + '" class="btn btn-secondary btn-small">详情</a>' +
            '</div>' +
        '</div>';
    }

    // 全部订单：详细卡 + 筛选
    async function renderAllTab() {
        var moneyRole = (filterSelect && (filterSelect.value === 'payer' || filterSelect.value === 'earner')) ? filterSelect.value : undefined;
        var statusValue = statusSelect ? statusSelect.value : 'all';
        var keyword = keywordInput ? keywordInput.value.trim() : '';
        var records = await getMyOrders(moneyRole, keyword, statusValue);
        if (!records || records.length === 0) {
            panel.innerHTML = '<div class="card empty-state"><p>暂无符合条件的订单</p></div>';
            renderPager(orderPagerEl, { page: 0, totalPages: 0, total: 0, onGo: function() {} });
            return;
        }
        var allTp = Math.ceil(records.length / orderPageSize);
        if (orderPage > allTp - 1) orderPage = allTp - 1;
        var enriched = pageSlice(records, orderPage, orderPageSize).map(function(r) {
            return { r: r, reviewed: !!r.reviewed };   // reviewed 随列表由后端返回
        });
        renderPager(orderPagerEl, {
            page: orderPage, totalPages: allTp, total: records.length,
            onGo: function(p) { orderPage = p; renderAllTab(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
        });
        panel.innerHTML = enriched.map(function(item) {
            var r = item.r, o = r.order;
            var isPublisher = r.post ? r.post.publisherId === myId : false;
            var st = describeOrderStatus(o, myId, isPublisher);
            var actionsHtml = '<a href="task-detail.html?id=' + o.postId + '" class="btn btn-secondary">查看详情</a>' +
                '<a href="chat-detail.html?chatId=' + o.chatId + '&partner=' + r.partnerId + '&task=' + o.postId + '" class="btn btn-secondary">进入聊天</a>';
            if (o.status === 'completed' && !item.reviewed) {
                var toUserId = r.myRole === 'payer' ? o.earnerId : o.payerId;
                actionsHtml += '<a href="review.html?order=' + o.id + '&to=' + toUserId + '" class="btn btn-secondary">去评价</a>';
            }
            return '<div class="record-item">' +
                '<h3>' + r.title + '</h3>' +
                '<p class="meta"><span class="status-badge ' + st.className + '">' + st.text + '</span>' + roleAmount(r) + ' ｜ 时间：' + formatDateTime(o.createdAt) + ' ｜ 对方：' + (r.partnerId ? '<a href="profile.html?userId=' + r.partnerId + '" class="user-link">' + r.partnerName + '</a>' : r.partnerName) + '</p>' +
                '<div class="actions">' + actionsHtml + '</div>' +
            '</div>';
        }).join('');
    }

    function renderOverview() {
        overviewEl.innerHTML =
            '<div class="ov-card ov-danger" data-tab="action"><p class="ov-label">需要我处理</p><p class="ov-num">' + counts.action + '</p></div>' +
            '<div class="ov-card ov-accent" data-tab="progress"><p class="ov-label">进行中</p><p class="ov-num">' + counts.progress + '</p></div>' +
            '<div class="ov-card" data-tab="mine"><p class="ov-label">我发布的·待响应</p><p class="ov-num">' + counts.mine + '</p></div>';
    }
    function renderTabs() {
        var tabs = [
            { key: 'action', label: '需要我处理', count: counts.action, danger: true },
            { key: 'progress', label: '进行中', count: counts.progress },
            { key: 'mine', label: '我发布的', count: counts.mine },
            { key: 'all', label: '全部订单' }
        ];
        tabsEl.innerHTML = tabs.map(function(t) {
            var badge = (t.count > 0) ? ' <span class="tab-badge' + (t.danger ? ' tab-badge-danger' : '') + '">' + t.count + '</span>' : '';
            return '<button type="button" class="order-tab' + (activeTab === t.key ? ' active' : '') + '" data-tab="' + t.key + '">' + t.label + badge + '</button>';
        }).join('');
    }
    function renderPanel() {
        filterBar.style.display = (activeTab === 'all') ? '' : 'none';
        if (activeTab === 'all') { renderAllTab(); return; }
        if (activeTab === 'mine') {
            if (!myOpenPosts.length && !myClosedPosts.length) {
                panel.innerHTML = '<div class="card empty-state"><p>你还没有发布过互助</p></div>';
                renderPager(orderPagerEl, { page: 0, totalPages: 0, total: 0, onGo: function() {} });
                return;
            }
            var mineHtml = '';
            mineHtml += '<h3 class="mine-group-title">待响应（' + myOpenPosts.length + '）</h3>';
            mineHtml += myOpenPosts.length
                ? myOpenPosts.map(openPostCard).join('')
                : '<div class="card empty-state"><p>没有待响应的发布</p></div>';
            if (myClosedPosts.length) {
                mineHtml += '<h3 class="mine-group-title">已下架 / 已结束（' + myClosedPosts.length + '）</h3>';
                mineHtml += myClosedPosts.map(closedPostCard).join('');
            }
            panel.innerHTML = mineHtml;
            // 「我发布的」是分组视图(待响应/已下架)，分页会把组标题切散，故不分页
            renderPager(orderPagerEl, { page: 0, totalPages: 0, total: 0, onGo: function() {} });
            return;
        }
        var arr = allOrders.filter(activeTab === 'action' ? isNeedsAction : isInProgress);
        if (!arr.length) {
            panel.innerHTML = '<div class="card empty-state"><p>' + (activeTab === 'action' ? '没有需要处理的订单' : '没有进行中的订单') + '</p></div>';
            renderPager(orderPagerEl, { page: 0, totalPages: 0, total: 0, onGo: function() {} });
            return;
        }
        var tp = Math.ceil(arr.length / orderPageSize);
        if (orderPage > tp - 1) orderPage = tp - 1;
        panel.innerHTML = pageSlice(arr, orderPage, orderPageSize).map(compactCard).join('');
        renderPager(orderPagerEl, {
            page: orderPage, totalPages: tp, total: arr.length,
            onGo: function(p) { orderPage = p; renderPanel(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
        });
    }
    function switchTab(key) { activeTab = key; orderPage = 0; renderTabs(); renderPanel(); }

    async function loadAll() {
        var records = await getMyOrders();
        // reviewed 由后端批量算好随列表返回；此前这里对每个已完成订单都要单独发一次
        // /reviews/has-reviewed 请求(HTTP 级 N+1)，12 个已完成订单就要多发 12 个请求。
        allOrders = (records || []).map(function(r) {
            return Object.assign({}, r, { reviewed: !!r.reviewed });
        });
        // 我发布的帖子拆两组：open=待响应(可撤回)；其余=已下架/已结束。
        // 后者以前无处可看——发布者收到"已被管理员下架"的通知，却在自己页面找不到那个帖子。
        try {
            var allMyPosts = (await getMyPosts()) || [];
            myOpenPosts = allMyPosts.filter(function(p) { return p.status === 'open'; });
            myClosedPosts = allMyPosts.filter(function(p) { return p.status !== 'open'; });
        } catch (e) { myOpenPosts = []; myClosedPosts = []; }
        counts = {
            action: allOrders.filter(isNeedsAction).length,
            progress: allOrders.filter(isInProgress).length,
            mine: myOpenPosts.length
        };
        renderOverview();
        renderTabs();
        renderPanel();
    }

    // 撤回发布：确认后软下架（悬赏冻结报酬退回），重新加载
    window.handleOrderCenterWithdraw = function(postId) {
        if (!confirm('确定撤回该互助吗？\n撤回后大厅不再显示，待接受申请将取消；悬赏冻结的报酬将退回余额。')) return;
        ownerClosePost(postId).then(function() { alert('已撤回'); loadAll(); }).catch(function(err) { alert(err.message || '撤回失败'); });
    };

    tabsEl.addEventListener('click', function(e) { var b = e.target.closest && e.target.closest('.order-tab'); if (b) switchTab(b.getAttribute('data-tab')); });
    overviewEl.addEventListener('click', function(e) { var c = e.target.closest && e.target.closest('.ov-card'); if (c) switchTab(c.getAttribute('data-tab')); });
    // 筛选条件变了 → 结果集变了，页码回到第 1 页
    function renderAllTabFromPage1() { orderPage = 0; renderAllTab(); }
    if (filterSelect) filterSelect.addEventListener('change', renderAllTabFromPage1);
    if (statusSelect) statusSelect.addEventListener('change', renderAllTabFromPage1);
    if (searchBtn) searchBtn.addEventListener('click', renderAllTabFromPage1);
    if (keywordInput) keywordInput.addEventListener('keydown', function(e) { if (e.key === 'Enter') { e.preventDefault(); renderAllTabFromPage1(); } });

    loadAll();
    // 同消息中心：bfcache 恢复后重新拉取，避免订单状态/数字停留在离开前
    window.__pageRefresh = loadAll;
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
    var ratingNum = document.getElementById('ratingNum');
    function paintStars() {
        starBtns.forEach(function(b, i) { b.classList.toggle('active', i < selectedRating); });
        if (ratingNum) ratingNum.textContent = selectedRating + ' 星';
    }
    starBtns.forEach(function(btn, index) {
        btn.addEventListener('click', function() { selectedRating = index + 1; paintStars(); });
    });
    paintStars();

    var imageInput = document.getElementById('reviewImages');
    var previewArea = document.getElementById('imagePreview');
    var uploadedImages = [];
    setupImageUploader(imageInput, previewArea, uploadedImages, 3);

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

    var catMap = { recharge: '充值', order: '订单结算', payment: '收付款',
        escrow_freeze: '冻结报酬', escrow_refund: '退回', escrow_transfer: '转账托管' };

    // 账单标题：从备注取「：」后的任务/订单名，取不到则用编号兜底。
    // relatedId 带作用域前缀（post:12 / order:3 / msg:9），避免帖子与订单撞号，
    // 这里按前缀还原成人话。
    function billTitle(note, relId) {
        var s = String(note || '');
        var i = s.lastIndexOf('：');
        var t = i >= 0 ? s.slice(i + 1).trim() : s;
        if (t) return t;
        var r = String(relId || '');
        if (r.indexOf('post:') === 0) return '帖子 #' + r.slice(5);
        if (r.indexOf('order:') === 0) return '订单 #' + r.slice(6);
        if (r.indexOf('msg:') === 0) return '转账 #' + r.slice(4);
        return '订单 #' + r;
    }

    Promise.all([getBalance().catch(function() { return null; }), getMyBills()]).then(function(arr) {
        var bal = arr[0] || {}, res = arr[1] || {};
        var totalIn = res.totalIn || 0, totalOut = res.totalOut || 0;
        if (summary) {
            var avail = bal.balance != null ? bal.balance : '—';
            var frozen = bal.frozenBalance != null ? bal.frozenBalance : 0;
            summary.innerHTML =
                '<div class="bill-sum-item"><span class="bill-sum-label">可用余额</span><span style="font-size:20px;font-weight:700;">¥' + avail + '</span></div>' +
                '<div class="bill-sum-item"><span class="bill-sum-label">冻结中</span><span class="bill-out" style="font-size:20px;font-weight:700;">¥' + frozen + '</span></div>' +
                '<div class="bill-sum-item"><span class="bill-sum-label">总收入</span><span class="bill-in">+¥' + totalIn + '</span></div>' +
                '<div class="bill-sum-item"><span class="bill-sum-label">总支出</span><span class="bill-out">-¥' + totalOut + '</span></div>';
        }

        var items = res.list || [];
        if (items.length === 0) {
            list.innerHTML = '<div class="card empty-state"><p>暂无账单记录</p></div>';
            return;
        }

        // 按 relatedId 分组：有 relatedId → 订单账单(可展开看构成)；无 → 单条流水(充值/即时转账)
        var groups = {}, order = [];
        items.forEach(function(t) {
            var key = t.relatedId ? ('g' + t.relatedId) : ('s' + t.id);
            if (!groups[key]) { groups[key] = { rel: t.relatedId, items: [], grouped: !!t.relatedId }; order.push(key); }
            groups[key].items.push(t);
        });
        // 组按最新一笔时间倒序（items 沿用后端的时间倒序，[0] 即最新）
        order.sort(function(a, b) {
            return String(groups[b].items[0].time || '').localeCompare(String(groups[a].items[0].time || ''));
        });

        list.innerHTML = order.map(function(key) {
            var g = groups[key];
            var gin = 0, gout = 0;
            g.items.forEach(function(t) { if (t.direction === 'in') gin += Number(t.amount) || 0; else gout += Number(t.amount) || 0; });
            var gnet = gin - gout;
            var netSign = gnet >= 0 ? '+' : '-';
            var netCls = gnet >= 0 ? 'bill-in' : 'bill-out';
            var latest = g.items[0];

            if (!g.grouped) {
                var t = g.items[0];
                var sign = t.direction === 'in' ? '+' : '-';
                return '<div class="card bill-single" style="display:flex;justify-content:space-between;align-items:center;">' +
                    '<div><div class="bill-note">' + (t.note || catMap[t.category] || '交易') + '</div>' +
                    '<div class="bill-meta">' + (catMap[t.category] || t.category) + ' ｜ ' + formatDateTime(t.time) + '</div></div>' +
                    '<div class="bill-amount ' + (t.direction === 'in' ? 'bill-in' : 'bill-out') + '">' + sign + '¥' + t.amount + '</div>' +
                '</div>';
            }

            var comps = g.items.map(function(t) {
                var s = t.direction === 'in' ? '+' : '-';
                return '<div class="bill-item" style="display:flex;justify-content:space-between;padding:6px 0;">' +
                    '<div><div style="font-size:13px;">' + (t.note || catMap[t.category] || t.category) + '</div>' +
                    '<div class="bill-meta">' + (catMap[t.category] || t.category) + ' ｜ ' + formatDateTime(t.time) + '</div></div>' +
                    '<div class="' + (t.direction === 'in' ? 'bill-in' : 'bill-out') + '" style="white-space:nowrap;">' + s + '¥' + t.amount + '</div>' +
                '</div>';
            }).join('');

            return '<div class="card bill-order-group">' +
                '<div class="bill-order-head" style="display:flex;justify-content:space-between;align-items:center;cursor:pointer;">' +
                    '<div><div style="font-weight:600;">' + billTitle(latest.note, g.rel) + '</div>' +
                    '<div class="bill-meta">订单账单 ｜ ' + g.items.length + ' 笔明细 ｜ ' + formatDateTime(latest.time) + '</div></div>' +
                    '<div style="display:flex;align-items:center;gap:10px;">' +
                        '<span class="' + netCls + '" style="font-weight:600;">' + netSign + '¥' + Math.abs(Math.round(gnet * 100) / 100) + '</span>' +
                        '<span class="bill-chevron" style="display:inline-block;transition:transform .2s;color:#999;">▸</span>' +
                    '</div>' +
                '</div>' +
                '<div class="bill-order-body" style="display:none;margin-top:8px;padding-top:8px;border-top:1px solid #eee;">' + comps + '</div>' +
            '</div>';
        }).join('');

        // 点击订单账单头部：展开/收起明细，箭头旋转
        list.addEventListener('click', function(e) {
            var head = e.target.closest ? e.target.closest('.bill-order-head') : null;
            if (!head || !list.contains(head)) return;
            var body = head.parentNode.querySelector('.bill-order-body');
            var chev = head.querySelector('.bill-chevron');
            if (!body) return;
            var open = body.style.display !== 'none';
            body.style.display = open ? 'none' : 'block';
            if (chev) chev.style.transform = open ? '' : 'rotate(90deg)';
        });
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
                overlay.classList.add('active');
                // 大厅列表不含原图，先用缩略图占位，再按 postId+idx 从详情接口按需加载原图
                bigImg.src = e.target.src;
                var directFull = e.target.getAttribute('data-full'); // 兼容旧渲染
                if (directFull) { bigImg.src = directFull; return; }
                var pid = e.target.getAttribute('data-postid');
                var idx = parseInt(e.target.getAttribute('data-idx'), 10) || 0;
                if (pid) {
                    loadPostFullImages(pid).then(function(imgs) {
                        var it = imgs[idx];
                        var full = it && (it.full || it.thumb);
                        if (full) bigImg.src = full;
                    });
                }
            }
        });
    }

    var detailBox = document.querySelector('.detail-box');
    if (detailBox) {
        detailBox.addEventListener('click', function(e) {
            if (e.target.classList.contains('detail-image')) {
                e.stopPropagation();
                var bigImg = overlay.querySelector('img');
                overlay.classList.add('active');
                bigImg.src = e.target.src; // 先用缩略图占位
                var idx = parseInt(e.target.getAttribute('data-idx'), 10) || 0;
                var pid = (typeof getUrlParam === 'function') ? getUrlParam('id') : null;
                if (pid) {
                    loadPostFullImages(pid).then(function(imgs) {
                        var it = imgs[idx];
                        var full = it && (it.full || it.thumb);
                        if (full) bigImg.src = full;
                    });
                }
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

// ==================== 管理后台 ====================

function initAdminPage() {
    if (!window.location.pathname.includes('admin.html')) return;
    if (!requireAdmin()) return;

    var content = document.getElementById('adminContent');
    var tabs = document.querySelectorAll('.admin-tab');
    if (!content) return;
    // tab 状态写 URL hash:从详情返回(history.back)时能回到原 tab,而非默认跳"待处理申诉"
    var validTabs = ['disputes', 'reports', 'orders', 'posts'];
    var hashTab = (location.hash || '').replace('#', '');
    var currentTab = validTabs.indexOf(hashTab) >= 0 ? hashTab : 'disputes';
    tabs.forEach(function(b) { b.classList.toggle('active', b.getAttribute('data-tab') === currentTab); });

    tabs.forEach(function(btn) {
        btn.addEventListener('click', function() {
            currentTab = btn.getAttribute('data-tab');
            tabs.forEach(function(b) { b.classList.toggle('active', b === btn); });
            history.replaceState(null, '', '#' + currentTab);
            render();
        });
    });

    function statusBadge(status) {
        var clsMap = {
            pending: 'status-pending', in_progress: 'status-in_progress', completed: 'status-completed',
            cancelled: 'status-cancelled', disputed: 'status-action', closed: 'status-completed'
        };
        return '<span class="status-badge ' + (clsMap[status] || 'status-pending') + '">' + getOrderStatusText(status) + '</span>';
    }

    async function render() {
        content.innerHTML = '<div class="card empty-state"><p>加载中…</p></div>';
        try {
            if (currentTab === 'disputes') {
                renderDisputes(await getAdminDisputes());
            } else if (currentTab === 'reports') {
                renderReports(await getAdminReports());
            } else if (currentTab === 'orders') {
                renderOrders(await getAdminOrders());
            } else {
                renderPosts(await getAdminPosts());
            }
        } catch (e) {
            content.innerHTML = '<div class="card empty-state"><p>' + (e.message || '加载失败') + '</p></div>';
        }
    }

    function renderReports(list) {
        if (!list || list.length === 0) {
            content.innerHTML = '<div class="card empty-state"><p>暂无待处理举报</p></div>';
            return;
        }
        content.innerHTML = list.map(function(item) {
            var t = item.post;
            var typeLabel = t.publisherSide === 'payer' ? '悬赏求助' : (t.publisherSide === 'none' ? '组队互助' : '提供服务');
            var reasons = item.reasons.map(function(r) {
                return '<li>' + r.reporterName + '：' + r.reason + '<span class="msg-time"> （' + formatDateTime(r.createdAt) + '）</span></li>';
            }).join('');
            return '<div class="card dispute-card">' +
                '<div class="msg-header"><h3>' + t.title +
                    ' <span class="status-badge status-action">被举报 ' + item.reportCount + ' 次</span></h3></div>' +
                '<p class="meta">' + typeLabel + ' ｜ 发布者：' + t.publisherName + ' ｜ 报酬：' + formatReward(t.reward) + '</p>' +
                '<ul class="report-reasons">' + reasons + '</ul>' +
                '<div class="actions">' +
                    '<a href="task-detail.html?id=' + t.id + '" class="btn btn-small btn-secondary">查看详情</a>' +
                    // 举报处理是二元裁决：成立→下架，不成立→忽略。
                    // 删除是高危动作（会让该帖已有订单失去任务详情），只保留在「帖子管理」里。
                    '<button type="button" class="btn btn-small" onclick="handleAdminClosePost(\'' + t.id + '\')">下架</button>' +
                    '<button type="button" class="btn btn-small btn-secondary" onclick="handleAdminDismissReports(\'' + t.id + '\')">忽略</button>' +
                '</div>' +
            '</div>';
        }).join('');
    }

    function renderDisputes(list) {
        if (!list || list.length === 0) {
            content.innerHTML = '<div class="card empty-state"><p>暂无待处理申诉</p></div>';
            return;
        }
        content.innerHTML = list.map(function(item) {
            var o = item.order;
            return '<div class="card dispute-card">' +
                '<div class="msg-header"><h3>' + item.postTitle + '</h3>' +
                    '<span class="msg-time">' + formatDateTime(o.disputedAt) + '</span></div>' +
                '<p class="meta">订单号：' + o.id + ' ｜ 金额：' + (o.amount || 0) + ' 元（冻结中） ｜ 付款方：' + item.payerName + ' ｜ 收款方：' + item.earnerName + '</p>' +
                '<p class="meta">申诉人：' + item.disputedByName + ' ｜ 理由：' + (o.disputeReason || '') + '</p>' +
                '<div class="form-group"><textarea id="note-' + o.id + '" class="form-control" rows="2" placeholder="处理说明（必填，将随结案系统消息展示给双方）"></textarea></div>' +
                '<div class="actions">' +
                    '<a class="btn btn-small btn-secondary" href="chat-detail.html?chatId=' + encodeURIComponent(o.chatId) + '&admin=1">查看聊天记录</a>' +
                    '<button type="button" class="btn btn-small" onclick="handleAdminResolve(\'' + o.id + '\', \'refund\')">全额退款给' + item.payerName + '</button>' +
                    '<button type="button" class="btn btn-small" onclick="handleAdminResolve(\'' + o.id + '\', \'settle\')">全额结算给' + item.earnerName + '</button>' +
                    (o.amount > 0 ? '<button type="button" class="btn btn-small btn-secondary" onclick="handleAdminResolve(\'' + o.id + '\', \'partial\')">部分结算…</button>' : '') +
                '</div>' +
            '</div>';
        }).join('');
    }

    function renderOrders(list) {
        if (!list || list.length === 0) {
            content.innerHTML = '<div class="card empty-state"><p>暂无订单</p></div>';
            return;
        }
        content.innerHTML = list.map(function(item) {
            var o = item.order;
            var resMap = { refund: '全额退款', settle: '全额结算', partial: '部分结算' };
            var extra = o.status === 'closed' && o.resolution
                ? '<p class="meta">结案：' + (resMap[o.resolution] || o.resolution) + (o.resolutionNote ? '（' + o.resolutionNote + '）' : '') + '</p>'
                : '';
            return '<div class="card">' +
                '<div class="msg-header"><h3>' + item.postTitle + ' ' + statusBadge(o.status) + '</h3>' +
                    '<span class="msg-time">' + formatDateTime(o.createdAt) + '</span></div>' +
                '<p class="meta">订单号：' + o.id + ' ｜ 金额：' + (o.amount || 0) + ' 元 ｜ 付款方：' + item.payerName + ' ｜ 收款方：' + item.earnerName + '</p>' +
                extra +
                '<div class="actions"><a class="btn btn-small btn-secondary" href="chat-detail.html?chatId=' + encodeURIComponent(o.chatId) + '&admin=1">查看聊天记录</a></div>' +
            '</div>';
        }).join('');
    }

    function renderPosts(list) {
        if (!list || list.length === 0) {
            content.innerHTML = '<div class="card empty-state"><p>暂无帖子</p></div>';
            return;
        }
        content.innerHTML = list.map(function(t) {
            var typeLabel = t.publisherSide === 'payer' ? '悬赏求助' : (t.publisherSide === 'none' ? '组队互助' : '提供服务');
            var stBadge = t.status === 'open'
                ? '<span class="status-badge status-in_progress">上架中</span>'
                : '<span class="status-badge status-cancelled">已下架/关闭</span>';
            return '<div class="card">' +
                '<div class="msg-header"><h3>' + t.title + ' ' + stBadge + '</h3>' +
                    '<span class="msg-time">' + formatDateTime(t.publishTime) + '</span></div>' +
                '<p class="meta">' + typeLabel + ' ｜ 发布者：' + t.publisherName + ' ｜ 报酬：' + formatReward(t.reward) + '</p>' +
                '<div class="actions">' +
                    '<a href="task-detail.html?id=' + t.id + '" class="btn btn-small btn-secondary">查看详情</a>' +
                    (t.status === 'open' ? '<button type="button" class="btn btn-small" onclick="handleAdminClosePost(\'' + t.id + '\')">下架</button>' : '') +
                    '<button type="button" class="btn btn-small btn-danger" onclick="handleAdminDeletePost(\'' + t.id + '\')">删除</button>' +
                '</div>' +
            '</div>';
        }).join('');
    }

    // 裁决：读卡片上的处理说明；partial 再询问结算金额
    window.handleAdminResolve = function(orderId, decision) {
        var noteEl = document.getElementById('note-' + orderId);
        var note = noteEl ? noteEl.value.trim() : '';
        if (!note) { alert('请先填写处理说明。'); return; }
        var amountToEarner = null;
        if (decision === 'partial') {
            var input = prompt('请输入结算给收款方的金额（元），其余将退回付款方：');
            if (input === null) return;
            amountToEarner = Number(input);
        }
        var confirmText = {
            refund: '确认全额退款给付款方并结案？',
            settle: '确认全额结算给收款方并结案？',
            partial: '确认按该金额部分结算并结案？'
        }[decision];
        if (!confirm(confirmText)) return;
        resolveDispute(orderId, decision, amountToEarner, note).then(function() {
            alert('已结案，双方将在聊天中收到结案系统消息。');
            render();
        }).catch(function(err) {
            alert(err.message || '处理失败');
        });
    };

    // 帖子被下架/删除/举报被忽略后刷新本页列表（管理员操作函数是多页共用的顶层函数）
    window.__adminOnPostChanged = render;

    render();
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
    initAdminPage();
    initLightbox();
    initDevAccountSwitcher();
    // 启动 WebSocket 通信保护机制
    initWebSocket();

    // 页面重新可见时刷新数据。
    // 浏览器"返回"通常从 bfcache 恢复页面，DOMContentLoaded 不会再触发，
    // 于是"进聊天已读 → 返回消息中心"后未读角标仍在，必须手动刷新才消失。
    // pageshow(persisted) 覆盖 bfcache 恢复；visibilitychange 覆盖切回标签页。
    function refreshOnReturn() {
        if (!isLoggedIn()) return;
        updateNavUnread();
        if (typeof window.__pageRefresh === 'function') window.__pageRefresh();
    }
    window.addEventListener('pageshow', function(e) { if (e.persisted) refreshOnReturn(); });
    document.addEventListener('visibilitychange', function() {
        if (document.visibilityState === 'visible') refreshOnReturn();
    });

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


// ==================== WebSocket 实时通知广播系统 ====================
var ws = null;

function initWebSocket() {
    if (!isLoggedIn()) return;
    var currentUser = getCurrentUser();
    if (!currentUser || !currentUser.id) return;

    // 避免网络波动引发的重复连接
    if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;

    // 建立与后端的 WebSocket 连接
    // 本地开发连本机 8080；部署后走同源相对路径，由 Nginx 反代 /ws -> 8080，协议自动跟随页面（https->wss）。
    const wsUrl = (location.hostname === 'localhost' || location.hostname === '127.0.0.1')
        ? 'ws://localhost:8080/ws/notification/' + currentUser.id
        : (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws/notification/' + currentUser.id;
    ws = new WebSocket(wsUrl);

    ws.onopen = function() {
        console.log('【WebSocket】校园实时通知系统连接成功');
    };

    ws.onmessage = function(event) {
        console.log('【WebSocket】收到实时数据包:', event.data);
        try {
            var data = JSON.parse(event.data);
            
            // 场景一：有新任务发布（广播给所有正在浏览大厅的用户）--大厅局部插入新卡片，不 reload、不丢滚动
            if (data.type === 'NEW_TASK') {
                // 改为页码分页后，只有停在第 1 页时插新卡才合理；在第 3 页插一张最新的会让分页错乱
                if (window.location.pathname.includes('task-hall.html') && data.postId
                        && !window.__hallCurrentPage) {
                    fetchTaskById(data.postId).then(function(res) {
                        var task = res && res.task;
                        if (!task) return;
                        // 只插入匹配当前筛选(类型/分类/关键词)的新任务；不匹配则忽略，刷新时由服务端筛选保证一致
                        if (window.hallMatchesCurrentFilter && !window.hallMatchesCurrentFilter(task)) return;
                        var taskList = document.getElementById('taskList');
                        if (!taskList) return;
                        // 已存在同 id 卡片则不重复插入
                        if (taskList.querySelector('.task-item[data-postid="' + task.id + '"]')) return;
                        if (!window.renderTaskItem) return;
                        var wrap = document.createElement('div');
                        wrap.innerHTML = window.renderTaskItem(task);
                        var card = wrap.firstChild;
                        if (card) {
                            card.style.transition = 'background-color 0.8s ease';
                            card.style.backgroundColor = '#fff7e6';
                            taskList.insertBefore(card, taskList.firstChild);
                            setTimeout(function() { card.style.backgroundColor = ''; }, 1500);
                        }
                    });
                }
            }
            
            // 场景二：任务已被抢单/正式接取（通知详情页竞争者退出 + 大厅局部移除被接卡片，不 reload）
            if (data.type === 'TASK_TAKEN') {
                var currentTaskId = getUrlParam('id');
                if (window.location.pathname.includes('task-detail.html') && String(currentTaskId) === String(data.postId)) {
                    // 禁用按钮区域防止误触操作
                    var actionsDiv = document.querySelector('.detail-box .actions');
                    if (actionsDiv) {
                        actionsDiv.innerHTML = '<span class="note" style="color:#cf222e; font-weight:bold; font-size:16px;">⚠️ 该任务刚刚已被其他同学抢先接取！</span>';
                    }
                    alert('告知：该任务已被接取，3秒后系统将自动返回互助大厅。');
                    setTimeout(function() {
                        window.location.href = 'task-hall.html';
                    }, 3000);
                }
                // 大厅：淡出移除被接的悬赏帖卡片，保留滚动位置
                if (window.location.pathname.includes('task-hall.html') && data.postId) {
                    var takenCard = document.querySelector('.task-item[data-postid="' + data.postId + '"]');
                    if (takenCard) {
                        takenCard.style.transition = 'opacity 0.4s ease';
                        takenCard.style.opacity = '0';
                        setTimeout(function() { takenCard.remove(); }, 400);
                    }
                }
            }
            
            // 场景二之二：任务被下架/撤回/删除（大厅实时移除该卡片 + 详情页拦住即将失败的下单）
            // 不广播的话，别人的大厅会一直留着这张卡，点"接单"进聊天再下单才被后端拒("任务不存在或已取消")
            if (data.type === 'TASK_CLOSED' && data.postId) {
                if (window.location.pathname.includes('task-hall.html')) {
                    var closedCard = document.querySelector('.task-item[data-postid="' + data.postId + '"]');
                    if (closedCard) {
                        closedCard.style.transition = 'opacity 0.4s ease';
                        closedCard.style.opacity = '0';
                        setTimeout(function() { closedCard.remove(); }, 400);
                    }
                }
                var closedTaskId = getUrlParam('id');
                if (window.location.pathname.includes('task-detail.html') && String(closedTaskId) === String(data.postId)) {
                    var closedActions = document.querySelector('.detail-box .actions');
                    if (closedActions) {
                        closedActions.innerHTML = '<span class="note" style="color:#cf222e; font-weight:bold;">⚠️ 该任务已被下架或结束，无法下单。</span>' +
                            '<button type="button" class="btn btn-secondary" onclick="goBack()">返回上一页</button>';
                    }
                }
                // 正在该任务的聊天页：刷新任务栏，按钮会变成"该任务已下架/已结束，无法下单"
                if (window.location.pathname.includes('chat-detail.html') && window.renderTaskBar) {
                    window.renderTaskBar();
                }
            }

            // 场景三：点对点精准精准核心业务流单推（收到订单申请、被接单通知、确认提醒、争议等）
            if (data.type === 'PERSONAL_NOTICE') {
                // 非阻塞横幅提示（不再用 alert 阻塞页面）；点击横幅才跳转/刷新，不再自动 reload 打断操作
                showRealtimeBanner('🔔 ' + data.message, function() {
                    if (window.location.pathname.includes('message-center.html') ||
                        window.location.pathname.includes('order-center.html') ||
                        window.location.pathname.includes('chat-detail.html')) {
                        window.location.reload();
                    } else {
                        window.location.href = 'message-center.html';
                    }
                });

                // 自动联动刷新导航栏的消息未读红点（非阻塞）
                if (typeof updateNavUnread === 'function') updateNavUnread();
            }

            // 场景四：聊天页实时刷新（对方发消息/支付卡片/订单系统消息）--局部刷新，不 reload、不丢滚动
            if (data.type === 'CHAT_UPDATE') {
                if (window.location.pathname.includes('chat-detail.html')) {
                    var curChat = getUrlParam('chatId');
                    if (curChat && String(curChat) === String(data.chatId)) {
                        // forceScroll=false：原本在底部才滚到底，否则保持位置（不打断查看历史）
                        if (window.renderMessages) window.renderMessages(false);
                        if (window.renderTaskBar) window.renderTaskBar();
                    }
                } else if (window.location.pathname.includes('message-center.html')) {
                    // 消息中心：只重拉数据重绘（保持当前标签/页码/滚动位置）。
                    // 不能再调 initMessageCenter()——那会重置回"待处理"第 1 页并重复绑定事件，
                    // 用户一收到消息就被打断。
                    if (typeof window.refreshMessageCenter === 'function') window.refreshMessageCenter();
                }
            }
        } catch (e) {
            console.error('【WebSocket】消息包解析异常:', e);
        }
    };

    ws.onclose = function() {
        console.log('【WebSocket】连接已断开，5秒后启动惰性重连机制...');
        setTimeout(initWebSocket, 5000);
    };

    ws.onerror = function(err) {
        console.error('【WebSocket】通信链路异常:', err);
    };
}

/**
 * 局部非阻塞顶部浮动条提示组件（支持手动关闭、无操作8秒自销毁、点击触发reload）
 */
function showRealtimeBanner(text, onClickAction) {
    var banner = document.createElement('div');
    banner.className = 'realtime-banner';
    banner.style.position = 'fixed';
    banner.style.top = '25px';
    banner.style.right = '25px';
    banner.style.backgroundColor = '#1f6feb';
    banner.style.color = '#fff';
    banner.style.padding = '14px 22px';
    banner.style.borderRadius = '8px';
    banner.style.boxShadow = '0 6px 16px rgba(0,0,0,0.18)';
    banner.style.zIndex = '99999';
    banner.style.cursor = 'pointer';
    banner.style.fontSize = '14px';
    banner.style.display = 'flex';
    banner.style.alignItems = 'center';
    banner.style.gap = '12px';
    banner.style.animation = 'fadeInRight 0.3s ease-out';
    
    var textNode = document.createElement('span');
    textNode.textContent = text;
    banner.appendChild(textNode);
    
    var closeBtn = document.createElement('span');
    closeBtn.innerHTML = '&times;';
    closeBtn.style.fontWeight = 'bold';
    closeBtn.style.fontSize = '20px';
    closeBtn.style.cursor = 'pointer';
    closeBtn.style.color = 'rgba(255,255,255,0.7)';
    closeBtn.onmouseover = function() { this.style.color = '#fff'; };
    closeBtn.onmouseout = function() { this.style.color = 'rgba(255,255,255,0.7)'; };
    closeBtn.onclick = function(e) {
        e.stopPropagation();
        banner.remove();
    };
    banner.appendChild(closeBtn);
    
    banner.onclick = function() {
        if (typeof onClickAction === 'function') onClickAction();
        banner.remove();
    };
    
    document.body.appendChild(banner);
    
    setTimeout(function() {
        if (banner.parentNode) banner.remove();
    }, 8000);
}