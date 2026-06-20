// ─── CryptoPulse App.js ───────────────────────────────────────────────────
// Shared utilities: auth, API, nav, formatters, toast

const CP = (() => {

  // ── Security utilities ───────────────────────────────────────────────────
  // escapeHtml: every piece of text from an external API (news titles, coin
  // names) or from user input (registration name) must pass through this
  // before being placed in innerHTML. Without it, a malicious or compromised
  // API response — or a crafted account name — could inject a <script> or
  // event-handler attribute into the page.
  const escapeHtml = (str) => {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  };

  // safeUrl: only allow http/https links to be rendered as href/window.open
  // targets. Blocks javascript:, data:, vbscript: and similar URI schemes
  // that would otherwise execute when clicked.
  const safeUrl = (url) => {
    try {
      const u = new URL(url, window.location.href);
      return (u.protocol === 'http:' || u.protocol === 'https:') ? u.href : '#';
    } catch { return '#'; }
  };

  // hashPassword: SHA-256 via the browser's native Web Crypto API. This is a
  // real one-way hash (unlike btoa, which is plain reversible base64 — anyone
  // opening devtools could read a btoa'd password instantly). Note this is
  // still a client-only demo auth system: a hash checked entirely in the
  // browser cannot be as secure as server-verified authentication, since the
  // hashing logic itself is visible to anyone viewing the page source. Real
  // production auth must verify credentials against a backend.
  const hashPassword = async (password) => {
    const data = new TextEncoder().encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
  };

  // ── Auth ──────────────────────────────────────────────────────────────────
  const auth = {
    hashPassword,
    getUser: () => { try { return JSON.parse(localStorage.getItem('cp_user')); } catch { return null; } },
    setUser: (u) => localStorage.setItem('cp_user', JSON.stringify(u)),
    isLoggedIn: () => !!auth.getUser(),
    logout: () => { localStorage.removeItem('cp_user'); window.location.href = 'login.html'; },
    requireAuth: () => {
      if (!auth.isLoggedIn()) { window.location.href = 'login.html'; return false; }
      return true;
    },
    register: async (name, email, password) => {
      const cleanName = String(name || '').trim().slice(0, 60);
      const cleanEmail = String(email || '').trim().toLowerCase().slice(0, 120);
      if (!cleanName) throw new Error('Please enter your name');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) throw new Error('Please enter a valid email address');
      if (!password || password.length < 6) throw new Error('Password must be at least 6 characters');
      const users = JSON.parse(localStorage.getItem('cp_users') || '[]');
      if (users.find(u => u.email === cleanEmail)) throw new Error('Email already registered');
      const hashed = await hashPassword(password);
      const user = { id: Date.now(), name: cleanName, email: cleanEmail, password: hashed, createdAt: new Date().toISOString() };
      users.push(user);
      localStorage.setItem('cp_users', JSON.stringify(users));
      const { password: _, ...safeUser } = user;
      auth.setUser(safeUser);
      return safeUser;
    },
    login: async (email, password) => {
      const cleanEmail = String(email || '').trim().toLowerCase();
      const users = JSON.parse(localStorage.getItem('cp_users') || '[]');
      const hashed = await hashPassword(password || '');
      const user = users.find(u => u.email === cleanEmail && u.password === hashed);
      if (!user) throw new Error('Invalid email or password');
      const { password: _, ...safeUser } = user;
      auth.setUser(safeUser);
      return safeUser;
    }
  };

  // ── API ───────────────────────────────────────────────────────────────────
  const COINGECKO = 'https://api.coingecko.com/api/v3';
  const FEAR_GREED = 'https://api.alternative.me/fng/?limit=1';
  const NEWS_API = 'https://min-api.cryptocompare.com/data/v2/news/?lang=EN&sortOrder=popular';

  const cache = {};
  const CACHE_TTL = 30000; // 30s

  const fetchCached = async (key, url, ttl = CACHE_TTL) => {
    const now = Date.now();
    if (cache[key] && (now - cache[key].ts) < ttl) return cache[key].data;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    cache[key] = { data, ts: now };
    return data;
  };

  const api = {
    getTopCoins: (n = 20) =>
      fetchCached(`top_${n}`, `${COINGECKO}/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=${n}&page=1&sparkline=true`),

    getGlobal: () =>
      fetchCached('global', `${COINGECKO}/global`, 60000),

    getCoinHistory: (id, days = 7) =>
      fetchCached(`history_${id}_${days}`, `${COINGECKO}/coins/${id}/market_chart?vs_currency=usd&days=${days}`),

    getCoinDetail: (id) =>
      fetchCached(`coin_${id}`, `${COINGECKO}/coins/${id}?localization=false&tickers=false&community_data=false&developer_data=false`, 60000),

    getFearGreed: () =>
      fetchCached('fg', FEAR_GREED, 300000),

    getNews: () =>
      fetchCached('news', NEWS_API, 300000),

    getTrending: () =>
      fetchCached('trending', `${COINGECKO}/search/trending`, 300000),
  };

  // ── Portfolio ─────────────────────────────────────────────────────────────
  const portfolio = {
    get: () => { try { return JSON.parse(localStorage.getItem('cp_portfolio') || '[]'); } catch { return []; } },
    save: (p) => localStorage.setItem('cp_portfolio', JSON.stringify(p)),
    add: (coinId, symbol, name, amount, buyPrice) => {
      const p = portfolio.get();
      const entry = { id: Date.now(), coinId, symbol, name, amount: parseFloat(amount), buyPrice: parseFloat(buyPrice), addedAt: new Date().toISOString() };
      p.push(entry);
      portfolio.save(p);
      return entry;
    },
    remove: (id) => { const p = portfolio.get().filter(h => h.id !== id); portfolio.save(p); },
    update: (id, updates) => {
      const p = portfolio.get().map(h => h.id === id ? { ...h, ...updates } : h);
      portfolio.save(p);
    }
  };

  // ── Watchlist ─────────────────────────────────────────────────────────────
  const watchlist = {
    get: () => { try { return JSON.parse(localStorage.getItem('cp_watchlist') || '["bitcoin","ethereum","solana"]'); } catch { return []; } },
    add: (id) => { const w = watchlist.get(); if (!w.includes(id)) { w.push(id); localStorage.setItem('cp_watchlist', JSON.stringify(w)); } },
    remove: (id) => { const w = watchlist.get().filter(c => c !== id); localStorage.setItem('cp_watchlist', JSON.stringify(w)); },
    toggle: (id) => { watchlist.get().includes(id) ? watchlist.remove(id) : watchlist.add(id); },
    has: (id) => watchlist.get().includes(id)
  };

  // ── Formatters ────────────────────────────────────────────────────────────
  const fmt = {
    price: (n) => {
      if (n === null || n === undefined) return '—';
      if (n >= 1000) return '$' + n.toLocaleString('en-US', { maximumFractionDigits: 2 });
      if (n >= 1) return '$' + n.toFixed(2);
      if (n >= 0.01) return '$' + n.toFixed(4);
      return '$' + n.toFixed(8);
    },
    compact: (n) => {
      if (n === null || n === undefined) return '—';
      if (n >= 1e12) return '$' + (n / 1e12).toFixed(2) + 'T';
      if (n >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
      if (n >= 1e6) return '$' + (n / 1e6).toFixed(2) + 'M';
      if (n >= 1e3) return '$' + (n / 1e3).toFixed(1) + 'K';
      return '$' + n.toFixed(2);
    },
    pct: (n) => {
      if (n === null || n === undefined) return '—';
      const v = n.toFixed(2);
      return (n >= 0 ? '+' : '') + v + '%';
    },
    pctClass: (n) => n >= 0 ? 'pos' : 'neg',
    num: (n, d = 2) => n?.toLocaleString('en-US', { maximumFractionDigits: d }) ?? '—',
    date: (ts) => {
      const d = new Date(ts * 1000);
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    },
    ago: (ts) => {
      const diff = Date.now() - (ts * 1000);
      if (diff < 60000) return 'just now';
      if (diff < 3600000) return Math.floor(diff / 60000) + 'm ago';
      if (diff < 86400000) return Math.floor(diff / 3600000) + 'h ago';
      return Math.floor(diff / 86400000) + 'd ago';
    }
  };

  // ── Toast ─────────────────────────────────────────────────────────────────
  let toastContainer;
  const toast = {
    init: () => {
      toastContainer = document.createElement('div');
      toastContainer.className = 'toast-container';
      document.body.appendChild(toastContainer);
    },
    show: (msg, type = 'info', duration = 3000) => {
      if (!toastContainer) toast.init();
      const el = document.createElement('div');
      el.className = `toast toast-${type}`;
      el.textContent = msg;
      toastContainer.appendChild(el);
      setTimeout(() => { el.style.opacity = '0'; el.style.transform = 'translateX(20px)'; el.style.transition = '0.2s'; setTimeout(() => el.remove(), 200); }, duration);
    },
    success: (m) => toast.show(m, 'success'),
    error: (m) => toast.show(m, 'error'),
    info: (m) => toast.show(m, 'info')
  };

  // ── Nav ───────────────────────────────────────────────────────────────────
  const nav = {
    initSidebar: (activePage) => {
      const user = auth.getUser();
      const links = [
        { id: 'dashboard', href: 'dashboard.html', label: 'Dashboard', icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>` },
        { id: 'markets', href: 'markets.html', label: 'Markets', icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>` },
        { id: 'portfolio', href: 'portfolio.html', label: 'Portfolio', icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>` },
        { id: 'news', href: 'news.html', label: 'News', icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2"/><path d="M18 14h-8"/><path d="M15 18h-5"/><path d="M10 6h8v4h-8V6Z"/></svg>` },
      ];
      const sidebar = document.getElementById('sidebar');
      if (!sidebar) return;
      sidebar.innerHTML = `
        <div class="sidebar-logo">
          <div class="sidebar-logo-icon">CP</div>
          <div>
            <div class="sidebar-logo-text">CRYPTO<span>PULSE</span></div>
          </div>
        </div>
        <nav class="sidebar-nav">
          <div class="nav-section-label">Main</div>
          ${links.map(l => `
            <a href="${l.href}" class="nav-link ${activePage === l.id ? 'active' : ''}">
              ${l.icon} ${l.label}
            </a>`).join('')}
          <div class="nav-section-label" style="margin-top:auto">Account</div>
          <div class="nav-link" onclick="CP.auth.logout()" style="cursor:pointer">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            Sign Out
          </div>
        </nav>
        <div class="sidebar-bottom">
          <div class="flex items-center gap-2">
            <div style="width:30px;height:30px;border-radius:50%;background:var(--primary-dim);border:1px solid var(--primary);display:grid;place-items:center;font-size:0.7rem;font-weight:700;color:var(--primary)">${escapeHtml(user?.name?.charAt(0)?.toUpperCase() || 'U')}</div>
            <div>
              <div style="font-size:0.8rem;font-weight:600">${escapeHtml(user?.name || 'User')}</div>
              <div style="font-size:0.65rem;color:var(--fg-muted)">${escapeHtml(user?.email || '')}</div>
            </div>
          </div>
        </div>`;
    },
    initTopbar: (title = '') => {
      const tb = document.getElementById('topbar');
      if (!tb) return;
      tb.innerHTML = `
        <button class="btn btn-ghost btn-icon" id="sidebar-toggle" style="display:none">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
        </button>
        <div style="font-family:var(--font-heading);font-size:0.8rem;font-weight:700;letter-spacing:0.05em;color:var(--fg-muted)">${title}</div>
        <div class="flex items-center gap-2" style="margin-left:auto">
          <div class="flex gap-1">
            <div class="loading-dot"></div>
            <div class="loading-dot"></div>
            <div class="loading-dot"></div>
          </div>
          <span style="font-size:0.7rem;color:var(--fg-muted);font-family:var(--font-mono)">LIVE</span>
        </div>`;
      // Mobile toggle
      if (window.innerWidth <= 768) {
        document.getElementById('sidebar-toggle').style.display = 'flex';
        document.getElementById('sidebar-toggle').onclick = () => document.getElementById('sidebar').classList.toggle('open');
      }
    }
  };

  // ── Chart helpers ─────────────────────────────────────────────────────────
  const charts = {
    defaultOptions: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { intersect: false, mode: 'index' },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#0A0A0A',
          borderColor: '#1F1F1F',
          borderWidth: 1,
          titleColor: '#888',
          bodyColor: '#EDEDED',
          titleFont: { family: 'JetBrains Mono', size: 11 },
          bodyFont: { family: 'JetBrains Mono', size: 12 },
          padding: 10
        }
      },
      scales: {
        x: { display: false },
        y: {
          display: true,
          position: 'right',
          grid: { color: 'rgba(31,31,31,0.8)', drawBorder: false },
          ticks: { color: '#888', font: { family: 'JetBrains Mono', size: 10 }, callback: (v) => '$' + v.toLocaleString() }
        }
      }
    },
    priceChart: (ctx, labels, data, up = true) => {
      const color = up ? '#00F0FF' : '#FF2E2E';
      const fill = up ? 'rgba(0,240,255,0.08)' : 'rgba(255,46,46,0.08)';
      return new Chart(ctx, {
        type: 'line',
        data: {
          labels,
          datasets: [{
            data,
            borderColor: color,
            backgroundColor: fill,
            borderWidth: 1.5,
            fill: true,
            tension: 0.4,
            pointRadius: 0,
            pointHoverRadius: 4,
            pointHoverBackgroundColor: color
          }]
        },
        options: { ...charts.defaultOptions }
      });
    },
    miniChart: (ctx, data, up = true) => {
      const color = up ? '#00FF94' : '#FF2E2E';
      return new Chart(ctx, {
        type: 'line',
        data: {
          labels: data.map((_, i) => i),
          datasets: [{ data, borderColor: color, borderWidth: 1.5, fill: false, tension: 0.4, pointRadius: 0 }]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false }, tooltip: { enabled: false } },
          scales: { x: { display: false }, y: { display: false } }
        }
      });
    }
  };

  // ── Coin color map ─────────────────────────────────────────────────────────
  const coinColors = {
    bitcoin: '#F7931A', ethereum: '#627EEA', solana: '#9945FF',
    cardano: '#0033AD', ripple: '#00AAE4', polkadot: '#E6007A',
    dogecoin: '#C2A633', avalanche: '#E84142', chainlink: '#375BD2',
    litecoin: '#B8B8B8', uniswap: '#FF007A', 'matic-network': '#8247E5',
    stellar: '#7D00FF', vechain: '#15BDFF'
  };
  const getCoinColor = (id) => coinColors[id] || `hsl(${(id.charCodeAt(0) * 37) % 360}, 70%, 60%)`;

  // ── DOM helpers ───────────────────────────────────────────────────────────
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => [...document.querySelectorAll(sel)];
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html) e.innerHTML = html; return e; };

  return { auth, api, fmt, toast, nav, charts, portfolio, watchlist, getCoinColor, escapeHtml, safeUrl, $, $$, el };
})();
