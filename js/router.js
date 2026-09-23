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

  function currentPath() {
    var h = location.hash || '#/shop/home';
    return h.replace(/^#/, '');
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
    Utils.showLoading(container);
    try {
      Promise.resolve(matched.route.render(container, matched.params)).catch(function (err) {
        console.error(err);
        container.innerHTML = '<div class="empty-state"><h2>Terjadi kesalahan</h2><p>' + Utils.escapeHtml(err.message || String(err)) + '</p></div>';
      });
    } catch (err) {
      container.innerHTML = '<div class="empty-state"><h2>Terjadi kesalahan</h2><p>' + Utils.escapeHtml(err.message || String(err)) + '</p></div>';
    }
    if (window.Layout) window.Layout.highlightActive(path);
  }

  window.addEventListener('hashchange', render);
  window.addEventListener('DOMContentLoaded', render);

  return { register: register, navigate: navigate, render: render, currentPath: currentPath };
})();
