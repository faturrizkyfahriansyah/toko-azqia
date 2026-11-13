/**
 * js/auth.js - sesi login internal (Pemilik/Pengelola). Token disimpan di localStorage
 * perangkat ini saja (bukan cookie lintas domain) - lihat docs/KNOWN_LIMITATIONS.md.
 */
window.Auth = (function () {
  var TOKEN_KEY = 'azqia_token';
  var USER_KEY = 'azqia_user';

  function getToken() { return localStorage.getItem(TOKEN_KEY) || ''; }
  function getUser() {
    try { return JSON.parse(localStorage.getItem(USER_KEY) || 'null'); } catch (e) { return null; }
  }
  function isLoggedIn() { return !!getToken() && !!getUser(); }
  function clearSession() { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(USER_KEY); }

  function login(username, password) {
    return Api.call('auth.login', { username: username, password: password }).then(function (data) {
      localStorage.setItem(TOKEN_KEY, data.token);
      localStorage.setItem(USER_KEY, JSON.stringify(data.user));
      return data.user;
    });
  }
  function logout() {
    return Api.call('auth.logout', {}).catch(function () {}).then(function () { clearSession(); });
  }
  function requireInternalAuth() {
    if (!isLoggedIn()) { location.hash = '#/internal/login'; return false; }
    return true;
  }
  // ---- Peran (K-18). PENTING: ini hanya MERAPIKAN tampilan; keputusan akses SELALU di backend (fail-closed). ----
  var ROLE_ACCESS = {
    KASIR: ['dashboard', 'pos', 'transactions', 'customers', 'notifications', 'profile'],
    PETUGAS_GUDANG: ['dashboard', 'products', 'purchases', 'inventory', 'opname', 'returns', 'suppliers', 'notifications', 'profile'],
    ADMIN_WA: ['dashboard', 'whatsapp', 'orders', 'customers', 'notifications', 'profile']
  };
  var ROLE_HOME = { KASIR: '#/internal/pos', PETUGAS_GUDANG: '#/internal/inventory', ADMIN_WA: '#/internal/whatsapp' };
  function role() { var u = getUser(); return u && u.role ? u.role : ''; }
  function isFullRole(r) { return r === 'PEMILIK' || r === 'PENGELOLA'; }
  /** Boleh membuka halaman ini (untuk menu & penjaga rute). Peran tak dikenal hanya boleh Profil. */
  function canAccess(path) {
    var r = role();
    if (!r || isFullRole(r)) return true;
    var seg = String(path || '').replace(/^#?\/internal\//, '').split(/[\/?]/)[0];
    return (ROLE_ACCESS[r] || ['profile']).indexOf(seg) !== -1;
  }
  function homePath() { var r = role(); if (window.AZQIA_ENTRY === 'kasir' && canAccess('#/internal/pos')) return '#/internal/pos'; return (ROLE_HOME[r]) || (isFullRole(r) || !r ? '#/internal/dashboard' : '#/internal/profile'); }
  function isPemilik() {
    var u = getUser();
    return u && u.role === 'PEMILIK';
  }

  return {
    getToken: getToken, getUser: getUser, isLoggedIn: isLoggedIn, clearSession: clearSession,
    login: login, logout: logout, requireInternalAuth: requireInternalAuth, isPemilik: isPemilik, role: role, canAccess: canAccess, homePath: homePath
  };
})();
