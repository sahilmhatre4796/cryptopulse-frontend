// ─── CryptoPulse API Client ─────────────────────────────────────────────────
// Replaces the old localStorage-only CP.auth with real JWT-based auth
// backed by the Express/PostgreSQL server. All other CP.* helpers (fmt,
// charts, nav, etc.) are unchanged and still live in app.js.
//
// Import order on each page: app.js → api-client.js
// api-client.js overrides CP.auth with real server calls.

const API_BASE = "https://cryptopulse-backend-ht7y.onrender.com";

// ── Low-level fetch wrapper ──────────────────────────────────────────────────
async function apiFetch(path, options = {}) {
  const defaults = {
    credentials: 'include',           // needed for httpOnly refresh-token cookie
    headers: { 'Content-Type': 'application/json' },
  };
  const token = _getAccessToken();
  if (token) defaults.headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...defaults, ...options,
    headers: { ...defaults.headers, ...(options.headers || {}) },
  });

  // 401 on a protected route → try one silent token refresh then retry
  if (res.status === 401 && !options._isRetry) {
    const refreshed = await _silentRefresh();
    if (refreshed) {
      options._isRetry = true;
      return apiFetch(path, options);
    }
    // Refresh also failed — session is dead, redirect to login
    _clearAccessToken();
    window.location.href = 'login.html';
    return;
  }

  // Parse JSON; return { ok, status, data }
  let data;
  try { data = await res.json(); } catch { data = null; }
  return { ok: res.ok, status: res.status, data };
}

// ── Token storage ─────────────────────────────────────────────────────────────
// Access token lives only in memory (sessionStorage as a pragmatic middle
// ground — cleared when the tab closes, not accessible to other origins).
// The refresh token is httpOnly cookie, so JS never sees it.
function _getAccessToken() { return sessionStorage.getItem('cp_at'); }
function _setAccessToken(t) { if (t) sessionStorage.setItem('cp_at', t); }
function _clearAccessToken() { sessionStorage.removeItem('cp_at'); }

async function _silentRefresh() {
  try {
    const res = await fetch(`${API_BASE}/api/auth/refresh`, {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) return false;
    const data = await res.json();
    if (data.accessToken) {
      _setAccessToken(data.accessToken);
      if (data.user) sessionStorage.setItem('cp_user', JSON.stringify(data.user));
      return true;
    }
    return false;
  } catch { return false; }
}

// ── Real auth implementation (overrides CP.auth from app.js) ────────────────
const realAuth = {
  // Try a silent refresh on page load — restores the session from the
  // httpOnly refresh cookie without asking the user to log in again.
  tryRestoreSession: async () => {
    if (_getAccessToken()) return true;   // already have a live token
    return _silentRefresh();
  },

  isLoggedIn: () => !!_getAccessToken(),

  getUser: () => {
    try { return JSON.parse(sessionStorage.getItem('cp_user')); } catch { return null; }
  },

  login: async (email, password) => {
    const r = await apiFetch('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
    if (!r.ok) throw new Error(r.data?.error || 'Login failed');
    _setAccessToken(r.data.accessToken);
    sessionStorage.setItem('cp_user', JSON.stringify(r.data.user));
    return r.data.user;
  },

  register: async (name, email, password) => {
    const r = await apiFetch('/api/auth/register', { method: 'POST', body: JSON.stringify({ name, email, password }) });
    if (!r.ok) throw new Error(r.data?.error || 'Registration failed');
    _setAccessToken(r.data.accessToken);
    sessionStorage.setItem('cp_user', JSON.stringify(r.data.user));
    return r.data.user;
  },

  logout: async () => {
    await apiFetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
    _clearAccessToken();
    sessionStorage.removeItem('cp_user');
    window.location.href = 'login.html';
  },

  requireAuth: async () => {
    const ok = await realAuth.tryRestoreSession();
    if (!ok) { window.location.href = 'login.html'; return false; }
    return true;
  },

  getMe: async () => {
    const r = await apiFetch('/api/auth/me');
    if (r?.ok) sessionStorage.setItem('cp_user', JSON.stringify(r.data.user));
    return r?.data?.user || null;
  },
};

// ── Portfolio API ──────────────────────────────────────────────────────────────
const portfolioApi = {
  getAll:     ()         => apiFetch('/api/portfolio'),
  getSummary: ()         => apiFetch('/api/portfolio/summary'),
  add:        (holding)  => apiFetch('/api/portfolio', { method: 'POST', body: JSON.stringify(holding) }),
  update:     (id, data) => apiFetch(`/api/portfolio/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  remove:     (id)       => apiFetch(`/api/portfolio/${id}`, { method: 'DELETE' }),
};

// ── Watchlist API ──────────────────────────────────────────────────────────────
const watchlistApi = {
  getAll: ()       => apiFetch('/api/watchlist'),
  add:    (coinId) => apiFetch('/api/watchlist', { method: 'POST', body: JSON.stringify({ coin_id: coinId }) }),
  remove: (coinId) => apiFetch(`/api/watchlist/${coinId}`, { method: 'DELETE' }),
};

// ── Alerts API ─────────────────────────────────────────────────────────────────
const alertsApi = {
  getAll:  (status) => apiFetch(`/api/alerts${status ? `?status=${status}` : ''}`),
  create:  (alert)  => apiFetch('/api/alerts', { method: 'POST', body: JSON.stringify(alert) }),
  cancel:  (id)     => apiFetch(`/api/alerts/${id}/cancel`, { method: 'PATCH' }),
  remove:  (id)     => apiFetch(`/api/alerts/${id}`, { method: 'DELETE' }),
};

// ── Bots API ───────────────────────────────────────────────────────────────────
const botsApi = {
  getAll:    ()           => apiFetch('/api/bots'),
  create:    (bot)        => apiFetch('/api/bots', { method: 'POST', body: JSON.stringify(bot) }),
  update:    (id, data)   => apiFetch(`/api/bots/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  setStatus: (id, status) => apiFetch(`/api/bots/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  getStats:  (id)         => apiFetch(`/api/bots/${id}/stats`),
  remove:    (id)         => apiFetch(`/api/bots/${id}`, { method: 'DELETE' }),
};

// ── Exchange keys API ──────────────────────────────────────────────────────────
const exchangeKeysApi = {
  getAll: ()    => apiFetch('/api/exchange-keys'),
  add:    (key) => apiFetch('/api/exchange-keys', { method: 'POST', body: JSON.stringify(key) }),
  remove: (id)  => apiFetch(`/api/exchange-keys/${id}`, { method: 'DELETE' }),
};

// ── Transactions API ───────────────────────────────────────────────────────────
const transactionsApi = {
  getAll:   (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return apiFetch(`/api/transactions${q ? '?' + q : ''}`);
  },
  getStats: ()    => apiFetch('/api/transactions/stats'),
  log:      (txn) => apiFetch('/api/transactions', { method: 'POST', body: JSON.stringify(txn) }),
};

// ── Subscription API ───────────────────────────────────────────────────────────
const subscriptionApi = {
  get: () => apiFetch('/api/subscription'),
};

// ── Override CP.auth and expose new API namespaces ───────────────────────────
// After this file loads, code that previously called CP.auth.login() now
// calls the real server. All other CP.* helpers (fmt, charts, nav) are
// unchanged — this file ONLY patches auth and adds the new API modules.
if (typeof CP !== 'undefined') {
  CP.auth = realAuth;

  // Old localStorage portfolio/watchlist stubs → replaced by server calls
  CP.portfolioApi    = portfolioApi;
  CP.watchlistApi    = watchlistApi;
  CP.alertsApi       = alertsApi;
  CP.botsApi         = botsApi;
  CP.exchangeKeysApi = exchangeKeysApi;
  CP.transactionsApi = transactionsApi;
  CP.subscriptionApi = subscriptionApi;
}

// Also expose at window level for convenience
window.CPApi = { portfolioApi, watchlistApi, alertsApi, botsApi, exchangeKeysApi, transactionsApi, subscriptionApi };
