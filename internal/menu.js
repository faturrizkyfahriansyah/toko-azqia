/**
 * internal/menu.js - Halaman "Menu": semua halaman lain dalam grup (disaring menurut peran), plus Keluar.
 */
window.Modules = window.Modules || {};
Modules.menu = (function () {
  function render(container) {
    var I = Layout.ICONS, groups = Layout.drawerGroups().filter(function (g) { return g.label !== 'UTAMA'; });
    var user = Auth.getUser() || {};
    container.innerHTML = '<h1 class="page-title">Menu</h1>' +
      '<div class="menu-user"><div class="menu-avatar">' + Utils.escapeHtml(String(user.full_name || user.name || '?').trim().split(/\s+/).map(function (x) { return x[0]; }).slice(0, 2).join('').toUpperCase()) + '</div><div><div class="menu-user-name">' + Utils.escapeHtml(user.full_name || user.name || '') + '</div><div class="muted">' + Utils.escapeHtml(user.role || '') + '</div></div></div>' +
      groups.map(function (g) {
        return '<div class="menu-group-label">' + Utils.escapeHtml(g.label) + '</div><div class="menu-list">' + g.items.map(function (it) {
          return '<a class="menu-item" href="' + it.path + '"><span class="menu-ic">' + it.ic + '</span><span class="menu-tx">' + Utils.escapeHtml(it.label) + '</span><span class="menu-go">' + I.chevron + '</span></a>';
        }).join('') + '</div>';
      }).join('') +
      '<div class="menu-list" style="margin-top:14px;"><a class="menu-item" href="#" id="menu-logout"><span class="menu-ic">' + I.logout + '</span><span class="menu-tx" style="color:var(--red);">Keluar</span></a></div>';
    container.querySelector('#menu-logout').addEventListener('click', function (e) {
      e.preventDefault();
      if (window.Offline && Offline.pendingCount() > 0 && !confirm('Ada ' + Offline.pendingCount() + ' transaksi offline yang BELUM terkirim. Data tetap tersimpan di perangkat ini dan dikirim saat Anda masuk lagi. Keluar sekarang?')) return;
      Auth.logout().then(function () { location.hash = '#/internal/login'; });
    });
  }
  return { render: render };
})();
