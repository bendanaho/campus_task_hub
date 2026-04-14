function goTo(page) {
    window.location.href = page;
}

function showDemoMessage(message) {
    alert(message || "当前为静态演示页面，未接入实际业务逻辑。");
}

function getUsers() {
    const users = localStorage.getItem("campusUsers");
    return users ? JSON.parse(users) : [];
}

function saveUsers(users) {
    localStorage.setItem("campusUsers", JSON.stringify(users));
}

function getCurrentUser() {
    const currentUser = localStorage.getItem("currentUser");
    return currentUser ? JSON.parse(currentUser) : null;
}

function setCurrentUser(user) {
    localStorage.setItem("currentUser", JSON.stringify(user));
}

function clearCurrentUser() {
    localStorage.removeItem("currentUser");
}

function isLoggedIn() {
    return !!getCurrentUser();
}

function renderNavAuth() {
    const navAuthArea = document.getElementById("navAuthArea");
    if (!navAuthArea) {
        return;
    }

    if (isLoggedIn()) {
        navAuthArea.innerHTML = '<a href="profile.html">个人中心</a>';
    } else {
        navAuthArea.innerHTML = '<a href="login.html">登录/注册</a>';
    }
}

function handleRegisterForm() {
    const registerForm = document.getElementById("registerForm");
    if (!registerForm) {
        return;
    }

    registerForm.addEventListener("submit", function (e) {
        e.preventDefault();

        const username = document.getElementById("registerUsername").value.trim();
        const phone = document.getElementById("registerPhone").value.trim();
        const password = document.getElementById("registerPassword").value.trim();
        const confirmPassword = document.getElementById("registerConfirmPassword").value.trim();

        if (!username || !phone || !password || !confirmPassword) {
            alert("请完整填写注册信息。");
            return;
        }

        if (!/^1\d{10}$/.test(phone)) {
            alert("请输入正确的 11 位手机号。");
            return;
        }

        if (password.length < 6) {
            alert("密码长度不能少于 6 位。");
            return;
        }

        if (password !== confirmPassword) {
            alert("两次输入的密码不一致。");
            return;
        }

        const users = getUsers();

        const existedUser = users.find(function (user) {
            return user.username === username || user.phone === phone;
        });

        if (existedUser) {
            alert("该用户名或手机号已注册，请直接登录。");
            return;
        }

        const newUser = {
            username: username,
            phone: phone,
            password: password
        };

        users.push(newUser);
        saveUsers(users);

        alert("注册成功，请登录。");
        window.location.href = "login.html";
    });
}

function handleLoginForm() {
    const loginForm = document.getElementById("loginForm");
    if (!loginForm) {
        return;
    }

    loginForm.addEventListener("submit", function (e) {
        e.preventDefault();

        const account = document.getElementById("loginAccount").value.trim();
        const password = document.getElementById("loginPassword").value.trim();

        if (!account || !password) {
            alert("请输入用户名/手机号和密码。");
            return;
        }

        const users = getUsers();

        const matchedUser = users.find(function (user) {
            return (user.username === account || user.phone === account) && user.password === password;
        });

        if (!matchedUser) {
            alert("用户名/手机号或密码错误。");
            return;
        }

        setCurrentUser({
            username: matchedUser.username,
            phone: matchedUser.phone
        });

        alert("登录成功。");
        window.location.href = "index.html";
    });
}

function handleLogout() {
    const logoutBtn = document.getElementById("logoutBtn");
    if (!logoutBtn) {
        return;
    }

    logoutBtn.addEventListener("click", function () {
        clearCurrentUser();
        alert("已退出登录。");
        window.location.href = "index.html";
    });
}

function protectProfilePage() {
    const isProfilePage = window.location.pathname.endsWith("profile.html");
    if (!isProfilePage) {
        return;
    }

    const currentUser = getCurrentUser();
    if (!currentUser) {
        alert("请先登录。");
        window.location.href = "login.html";
        return;
    }

    const profileUsername = document.getElementById("profileUsername");
    const profilePhone = document.getElementById("profilePhone");

    if (profileUsername) {
        profileUsername.textContent = currentUser.username || "";
    }

    if (profilePhone) {
        profilePhone.textContent = currentUser.phone || "";
    }
}

function initTaskHallFilter() {
    const filterDropdown = document.getElementById("filterDropdown");
    const filterToggle = document.getElementById("filterToggle");
    const taskTypeFilter = document.getElementById("taskTypeFilter");
    const taskKeyword = document.getElementById("taskKeyword");
    const searchBtn = document.getElementById("searchBtn");
    const categoryInputs = document.querySelectorAll('input[name="taskCategory"]');
    const taskItems = document.querySelectorAll(".task-item");
    const emptyState = document.getElementById("emptyState");

    if (!filterDropdown || !filterToggle) {
        return;
    }

    filterToggle.addEventListener("click", function (e) {
        e.stopPropagation();
        filterDropdown.classList.toggle("open");
    });

    document.addEventListener("click", function (e) {
        if (!filterDropdown.contains(e.target)) {
            filterDropdown.classList.remove("open");
        }
    });

    categoryInputs.forEach(function (input) {
        input.addEventListener("change", function () {
            updateFilterText();
            filterTasks();
        });
    });

    if (taskTypeFilter) {
        taskTypeFilter.addEventListener("change", function () {
            filterTasks();
        });
    }

    if (searchBtn) {
        searchBtn.addEventListener("click", function () {
            filterTasks();
        });
    }

    if (taskKeyword) {
        taskKeyword.addEventListener("keydown", function (e) {
            if (e.key === "Enter") {
                e.preventDefault();
                filterTasks();
            }
        });
    }

    function updateFilterText() {
        const checkedInputs = document.querySelectorAll('input[name="taskCategory"]:checked');
        const checkedLabels = Array.from(checkedInputs).map(function (input) {
            return input.parentElement.querySelector(".filter-text").textContent.trim();
        });

        if (checkedLabels.length === 0) {
            filterToggle.textContent = "选择任务分类";
            filterToggle.classList.remove("active");
        } else if (checkedLabels.length === 1) {
            filterToggle.textContent = checkedLabels[0];
            filterToggle.classList.add("active");
        } else {
            filterToggle.textContent = "已选择 " + checkedLabels.length + " 个分类";
            filterToggle.classList.add("active");
        }
    }

    function filterTasks() {
        const checkedInputs = document.querySelectorAll('input[name="taskCategory"]:checked');
        const selectedCategories = Array.from(checkedInputs).map(function (input) {
            return input.value;
        });

        const selectedType = taskTypeFilter ? taskTypeFilter.value : "all";
        const keyword = taskKeyword ? taskKeyword.value.trim().toLowerCase() : "";
        let visibleCount = 0;

        taskItems.forEach(function (item) {
            const category = item.getAttribute("data-category") || "";
            const type = item.getAttribute("data-type") || "";
            const text = item.textContent.toLowerCase();

            const typeMatched =
                selectedType === "all" || type === selectedType;

            const categoryMatched =
                selectedCategories.length === 0 || selectedCategories.includes(category);

            const keywordMatched =
                keyword === "" || text.includes(keyword);

            if (typeMatched && categoryMatched && keywordMatched) {
                item.style.display = "block";
                visibleCount++;
            } else {
                item.style.display = "none";
            }
        });

        if (emptyState) {
            emptyState.style.display = visibleCount === 0 ? "block" : "none";
        }
    }

    updateFilterText();
    filterTasks();
}

document.addEventListener("DOMContentLoaded", function () {
    renderNavAuth();
    handleRegisterForm();
    handleLoginForm();
    handleLogout();
    protectProfilePage();
    initTaskHallFilter();
});