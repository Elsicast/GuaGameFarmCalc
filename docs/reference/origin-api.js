// 前端API封装层
const API_BASE = window.location.origin + '/api';

// 客户端版本号：发版时必须与 server/version.js 的 GAME_VERSION 同步更新，否则同步/拉档会被服务端拒绝(426)
const CLIENT_VERSION = '2026-08-07-2';

const Api = {
  token: localStorage.getItem('mir2_token') || null,
  username: localStorage.getItem('mir2_username') || null,

  setAuth(token, username) {
    this.token = token;
    this.username = username;
    localStorage.setItem('mir2_token', token);
    localStorage.setItem('mir2_username', username);
  },

  clearAuth() {
    this.token = null;
    this.username = null;
    localStorage.removeItem('mir2_token');
    localStorage.removeItem('mir2_username');
  },

  isLoggedIn() {
    return !!this.token;
  },

  async request(path, options = {}) {
    const headers = { 'Content-Type': 'application/json' };
    if (this.token) headers['Authorization'] = 'Bearer ' + this.token;
    try {
      const res = await fetch(API_BASE + path, { ...options, headers });
      const data = await res.json();
      if (res.status === 401) {
        this.clearAuth();
        // 会话失效时同步清空游戏内存状态，防止重新登录其他账号时残留旧账号角色
        if (typeof game !== 'undefined') game.clearSession();
        renderApp();
        return { error: '登录已过期' };
      }
      // 版本门槛：服务端判定客户端过旧 → 强制破缓存刷新（带重试保护防死循环）
      if (res.status === 426 || (data && data.outdated)) {
        this._forceUpdateReload();
        return { error: '游戏版本过旧，正在强制更新…' };
      }
      return data;
    } catch (e) {
      console.error('API请求失败:', e);
      return { error: '网络连接失败' };
    }
  },

  // 版本过旧强刷：本地存档已存localStorage不会丢，带_upd参数破缓存；最多重试3次避免发版失误导致无限刷新
  _forceUpdateReload() {
    try {
      const retries = parseInt(sessionStorage.getItem('force_update_retry') || '0');
      if (retries >= 3) return; // 重试超限：不再刷新，避免死循环（通常是发版时两处版本号不一致，需人工介入）
      sessionStorage.setItem('force_update_retry', String(retries + 1));
    } catch (e) { /* 隐私模式下静默 */ }
    const u = new URL(location.href);
    u.searchParams.set('_upd', Date.now());
    location.replace(u.toString());
  },

  // === 账号 ===
  async register(username, password) {
    const res = await this.request('/register', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    });
    if (res.token) this.setAuth(res.token, res.username);
    return res;
  },

  async login(username, password) {
    const res = await this.request('/login', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    });
    if (res.token) this.setAuth(res.token, res.username);
    return res;
  },

  logout() {
    this.clearAuth();
  },

  // === 版本检测 ===
  async getVersion() {
    return this.request('/version?_=' + Date.now()); // 时间戳防缓存
  },

  // === 存档同步 ===
  async uploadSave(saveData) {
    const res = await this.request('/sync/upload', {
      method: 'POST',
      body: JSON.stringify({ ...saveData, clientVersion: CLIENT_VERSION })
    });
    // 版本冲突时抛出错误，让game.js捕获并重新拉取
    if (res && res.needSync) {
      const err = new Error(res.error);
      err.needSync = true;
      err.version = res.version;
      throw err;
    }
    return res;
  },

  async downloadSave() {
    return this.request('/sync/download?clientVersion=' + encodeURIComponent(CLIENT_VERSION));
  },

  // === 排行榜 ===
  async checkName(name) {
    return this.request('/check-name?name=' + encodeURIComponent(name));
  },

  async getLevelRank() {
    return this.request('/leaderboard/level');
  },

  async getTowerRank() {
    return this.request('/leaderboard/tower');
  },

  // === 寄售市场 ===
  async getMarket(page = 1, type = '') {
    let url = `/market?page=${page}`;
    if (type) url += `&type=${encodeURIComponent(type)}`;
    return this.request(url);
  },

  async listItem(itemUid, price) {
    return this.request('/market/list', {
      method: 'POST',
      body: JSON.stringify({ itemUid, price })
    });
  },

  async buyItem(marketId) {
    return this.request(`/market/buy/${marketId}`, { method: 'POST' });
  },

  async cancelItem(marketId) {
    return this.request(`/market/cancel/${marketId}`, { method: 'POST' });
  },

  async getMyListings() {
    return this.request('/market/mine');
  },

  // === 世界BOSS（遮天塔） ===
  async getWorldBossState() {
    return this.request('/world-boss/state?_=' + Date.now());
  },

  async worldBossAttack(damage) {
    return this.request('/world-boss/attack', {
      method: 'POST',
      body: JSON.stringify({ damage })
    });
  }
};
