/**
 * js/router.js - router hash sederhana, tanpa framework/bundler (sesuai arsitektur PWA statis).
 * Dua area: #/shop/... (publik, tanpa login) dan #/internal/... (staf, wajib login kecuali /login).
 */
window.Router = (function () {
  var routes = []; // {pattern: RegExp, keys: [...], area, publicRoute, render}

  function register(path, area, render, publicRoute) {
    var keys = [];
    var pattern = path.replace(/:[^/]+/g, function (m) { keys.push(m.substring(1)); return '([^/]+)'; });
    routes.push({ regex: new RegExp('^' + pattern + '$'), keys: keys, area: area, render: render, publicRoute: !!publicRoute });
  }

  /** Jalur tanpa query (#/shop/catalog?category=C1 -> /shop/catalog). Query dibaca modul sendiri dari location.hash. */
  function currentPath() {
    var h = location.hash || '#/shop/home';
    return h.replace(/^#/, '').split('?')[0];
  }

  function navigate(path) { location.hash = path; }

  function matchRoute(path) {
    for (var i = 0; i < routes.length; i++) {
      var m = routes[i].regex.exec(path);
      if (m) {
        var params = {};
        routes[i].keys.forEach(function (k, idx) { params[k] = decodeURIComponent(m[idx + 1]); });
        return { route: routes[i], params: params };
      }
    }
    return null;
  }

  function render() {
    var path = currentPath();
    var matched = matchRoute(path);
    var appRoot = document.getElementById('app');

    if (!matched) {
      appRoot.innerHTML = '<div class="content"><div class="empty-state"><h2>Halaman tidak ditemukan</h2><p>URL tidak dikenal.</p><a class="btn btn-primary" href="#/shop/home">Kembali ke Beranda</a></div></div>';
      return;
    }

    var isInternal = matched.route.area === 'internal';
    document.body.className = isInternal ? 'area-internal' : 'area-shop';

    if (isInternal && !matched.route.publicRoute) {
      if (!Auth.requireInternalAuth()) return;
    }

    if (window.Layout) window.Layout.renderShell(appRoot, matched.route.area, path);
    var container = document.getElementById('view-container') || appRoot;
    if (isInternal && window.Auth && Auth.isLoggedIn()) { if (window.Offline) Offline.start(); if (window.Notify) Notify.start(); }
    if (isInternal && !matched.route.publicRoute && window.Auth && Auth.canAccess && !Auth.canAccess('#' + path)) {
      container.innerHTML = '<div class="empty-state"><h2>Tidak ada akses</h2><p>Halaman ini tidak tersedia untuk peran Anda.</p><a class="btn btn-primary" href="' + Auth.homePath() + '">Kembali</a></div>';
      return;
    }
    Utils.showLoading(container);
    try {
      Promise.resolve(matched.route.render(container, matched.params)).catch(function (err) {
        console.error(err);
        errorView(container, err);
      });
    } catch (err) {
      errorView(container, err);
    }
    if (window.Layout) window.Layout.highlightActive(path);
  }

  /** Kesalahan memuat halaman: pesan jelas + tombol Coba lagi (tidak pernah spinner tanpa akhir). */
  function errorView(container, err) {
    var net = err && (err.code === 'TIMEOUT' || err.code === 'NETWORK_ERROR');
    container.innerHTML = '<div class="empty-state"><h2>' + (net ? 'Tidak dapat memuat data' : 'Terjadi kesalahan') + '</h2><p>' + Utils.escapeHtml((err && err.message) || String(err)) + '</p>' +
      '<button class="btn btn-primary" id="route-retry">Coba lagi</button></div>';
    var b = container.querySelector('#route-retry');
    if (b) b.addEventListener('click', function () { render(); });
  }

  /** Banner koneksi: pengguna tahu kapan offline (tidak menunggu tanpa penjelasan). */
  function connBanner(show) {
    var b = document.getElementById('conn-banner');
    if (!b) { b = document.createElement('div'); b.id = 'conn-banner'; b.setAttribute('role', 'status'); b.textContent = 'Tidak ada koneksi internet. Data mungkin tidak terbaru.'; document.body.appendChild(b); }
    b.hidden = !show;
  }
  window.addEventListener('offline', function () { connBanner(true); });
  window.addEventListener('online', function () { connBanner(false); if (window.Utils && Utils.toast) Utils.toast('Koneksi kembali.', 'success'); });
  window.addEventListener('DOMContentLoaded', function () { if (navigator.onLine === false) connBanner(true); });

  window.addEventListener('hashchange', render);
  window.addEventListener('DOMContentLoaded', render);

  return { register: register, navigate: navigate, render: render, currentPath: currentPath };
})();
