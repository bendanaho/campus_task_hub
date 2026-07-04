const TOKEN_KEY = 'campus_token';
const CURRENT_USER_KEY = 'campus_current_user';
// token 为“电子通行证”

function getToken() {//
    return localStorage.getItem(TOKEN_KEY);
}

function setToken(token) {//
    localStorage.setItem(TOKEN_KEY, token);
}

function removeToken() {//
    localStorage.removeItem(TOKEN_KEY);
}

function getCurrentUser() {//
    const user = localStorage.getItem(CURRENT_USER_KEY);
    return user ? JSON.parse(user) : null;
}

function setCurrentUser(user) {//
    localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
}

function removeCurrentUser() {//
    localStorage.removeItem(CURRENT_USER_KEY);
}

function isLoggedIn() {
    return !!getToken() && !!getCurrentUser();
}

function getUrlParam(name) {
    const params = new URLSearchParams(window.location.search);
    return params.get(name);
}

function formatDateTime(dateStr) {
    const date = new Date(dateStr);
    const pad = n => n.toString().padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function timeAgo(dateStr) {
    const now = new Date();
    const date = new Date(dateStr);
    const diff = Math.floor((now - date) / 1000);
    if (diff < 60) return '刚刚';
    if (diff < 3600) return `${Math.floor(diff / 60)}分钟前`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}小时前`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}天前`;
    return formatDateTime(dateStr);
}

function getStorage(key, defaultValue) {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : defaultValue;
}

function setStorage(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
}

function getCreditColorClass(score) {
    if (score >= 4.5) return 'credit-high';
    if (score >= 3.0) return 'credit-mid';
    return 'credit-low';
}

function getCreditColorValue(score) {
    if (score >= 4.5) return '#16a34a';
    if (score >= 3.0) return '#f59e0b';
    return '#e74c3c';
}

function parseRewardValue(reward) {
    if (!reward) return 0;
    const match = reward.match(/(\d+)/);
    return match ? parseInt(match[1], 10) : 0;
}

// 报酬展示：纯数字补「元」（"10"→"10元"）；已带单位或文字的原样返回
// （"10元"/"面议"/"3-5元/单"/"无" 均不变，避免出现"10元元"）
function formatReward(reward) {
    if (reward === null || reward === undefined) return '';
    const s = String(reward).trim();
    return /^\d+(\.\d+)?$/.test(s) ? s + '元' : s;
}

function debounce(fn, delay) {
    delay = delay || 300;
    let timer;
    return function () {
        const args = arguments;
        const self = this;
        clearTimeout(timer);
        timer = setTimeout(function () {
            fn.apply(self, args);
        }, delay);
    };
}

function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}
