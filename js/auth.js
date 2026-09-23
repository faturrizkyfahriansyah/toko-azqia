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
  function isPemilik() {
    var u = getUser();
    return u && u.role === 'PEMILIK';
  }

  return {
    getToken: getToken, getUser: getUser, isLoggedIn: isLoggedIn, clearSession: clearSession,
    login: login, logout: logout, requireInternalAuth: requireInternalAuth, isPemilik: isPemilik
  };
})();
