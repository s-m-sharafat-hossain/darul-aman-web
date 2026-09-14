/**
 * Darul Aman Academy Portal — API client.
 * Wraps fetch() against the backend's { success, data, error } envelope,
 * handles the short-lived access token (kept in memory + sessionStorage)
 * and transparently retries once via /api/auth/refresh on a 401
 * (the refresh token itself lives in an httpOnly cookie set by the server).
 */
(function () {
  const BASE = window.DAA_CONFIG.API_BASE_URL;
  const TOKEN_KEY = 'daa_access_token';
  const USER_KEY = 'daa_user';

  function getToken() { return sessionStorage.getItem(TOKEN_KEY); }
  function setToken(t) { if (t) sessionStorage.setItem(TOKEN_KEY, t); }
  function clearSession() {
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(USER_KEY);
  }
  function getUser() {
    try { return JSON.parse(sessionStorage.getItem(USER_KEY) || 'null'); }
    catch (e) { return null; }
  }
  function setUser(u) { sessionStorage.setItem(USER_KEY, JSON.stringify(u)); }

  async function raw(path, opts, isRetry) {
    const res = await fetch(BASE + path, {
      method: opts.method || 'GET',
      headers: Object.assign(
        { 'Content-Type': 'application/json' },
        getToken() ? { Authorization: 'Bearer ' + getToken() } : {},
        opts.headers || {}
      ),
      credentials: 'include', // send httpOnly refresh cookie
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });

    let json = null;
    try { json = await res.json(); } catch (e) { /* no body */ }

    if (res.status === 401 && !isRetry && path !== '/auth/refresh' && path !== '/auth/login') {
      // Access token expired — try a silent refresh, then retry once.
      const refreshed = await tryRefresh();
      if (refreshed) return raw(path, opts, true);
      clearSession();
      if (!location.pathname.endsWith('/login.html')) {
        location.href = pathToLogin();
      }
    }

    if (!res.ok || (json && json.success === false)) {
      const message = (json && json.error && json.error.message) || 'Something went wrong. Please try again.';
      const err = new Error(message);
      err.status = res.status;
      err.details = json && json.error && json.error.details;
      throw err;
    }

    if (!json) return null;
    const data = json.data;
    // Paginated list endpoints send { total, page, limit, totalPages } alongside
    // data. Callers that just use the array/object see no difference; callers
    // that need pagination info can read data._meta. Non-enumerable so it
    // doesn't show up in Object.keys/JSON.stringify/array iteration.
    if (json.meta && data && typeof data === 'object') {
      Object.defineProperty(data, '_meta', { value: json.meta, enumerable: false, configurable: true });
    }
    return data;
  }

  async function tryRefresh() {
    try {
      const res = await fetch(BASE + '/auth/refresh', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
      const json = await res.json();
      if (res.ok && json && json.success && json.data && json.data.accessToken) {
        setToken(json.data.accessToken);
        return true;
      }
    } catch (e) { /* ignore, fall through to redirect */ }
    return false;
  }

  function pathToLogin() {
    // Portal pages live at /portal/<role>/xyz.html — login lives at /portal/login.html
    const depth = location.pathname.split('/portal/')[1].split('/').length - 1;
    return (depth > 0 ? '../'.repeat(depth) : '') + 'login.html';
  }

  // Multipart upload (e.g. Gallery image create/edit) — deliberately NOT
  // routed through raw() above, which always sets Content-Type: application/json
  // and JSON.stringifies the body. FormData needs the browser to set its own
  // multipart boundary header, so this builds the request by hand; it still
  // shares raw()'s auth/refresh-retry and { success, data, error } envelope
  // handling by delegating the actual send to the same 401-retry logic.
  async function upload(path, formData, method, isRetry) {
    const res = await fetch(BASE + path, {
      method: method || 'POST',
      headers: getToken() ? { Authorization: 'Bearer ' + getToken() } : {},
      credentials: 'include',
      body: formData,
    });
    let json = null;
    try { json = await res.json(); } catch (e) { /* no body */ }

    if (res.status === 401 && !isRetry) {
      const refreshed = await tryRefresh();
      if (refreshed) return upload(path, formData, method, true);
      clearSession();
      location.href = pathToLogin();
      return null;
    }
    if (!res.ok || (json && json.success === false)) {
      const message = (json && json.error && json.error.message) || 'Upload failed. Please try again.';
      const err = new Error(message);
      err.status = res.status;
      err.details = json && json.error && json.error.details;
      throw err;
    }
    return json ? json.data : null;
  }

  const api = {
    get: (path) => raw(path, { method: 'GET' }),
    post: (path, body) => raw(path, { method: 'POST', body }),
    patch: (path, body) => raw(path, { method: 'PATCH', body }),
    put: (path, body) => raw(path, { method: 'PUT', body }),
    del: (path) => raw(path, { method: 'DELETE' }),
    uploadForm: (path, formData) => upload(path, formData, 'POST'),
    uploadFormPut: (path, formData) => upload(path, formData, 'PUT'),

    async login(identifier, password, otp) {
      const data = await raw('/auth/login', { method: 'POST', body: { identifier, password, otp } });
      setToken(data.accessToken);
      setUser(data.user);
      return data;
    },
    async logout() {
      try { await raw('/auth/logout', { method: 'POST' }); } catch (e) { /* ignore */ }
      clearSession();
    },
    getUser,
    setUser,
    getToken,
    isLoggedIn: () => !!getToken(),

    /** Call at the top of every protected page. Redirects to login if no session. */
    requireAuth(allowedRoles) {
      const user = getUser();
      if (!user || !getToken()) {
        location.href = pathToLogin();
        return null;
      }
      if (allowedRoles && allowedRoles.length && !allowedRoles.includes(user.role)) {
        location.href = pathToLogin();
        return null;
      }
      return user;
    },
  };

  window.DAA_API = api;
})();
