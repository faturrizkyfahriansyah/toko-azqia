/**
 * js/layout.js - shell topbar/sidebar/bottom-nav untuk area shop & internal, + Pusat Notifikasi.
 * Struktur menu internal mengikuti 6 kelompok: Menu Utama, Transaksi, Persediaan, Relasi,
 * Keuangan, Sistem. Item Pemilik-only disembunyikan di UI untuk Pengelola - HANYA kosmetik,
 * penegakan akses sesungguhnya selalu di backend (42_Validation.gs).
 */
window.Layout = (function () {
  var SHOP_NAV = [
    { path: '#/shop/home', label: 'Beranda', icon: '🏠' },
    { path: '#/shop/catalog', label: 'Katalog', icon: '🛍️' },
    { path: '#/shop/cart', label: 'Keranjang', icon: '🛒' },
    { path: '#/shop/tracking', label: 'Lacak', icon: '📦' }
  ];

  function internalMainNav() {
    return [
      { path: '#/internal/dashboard', label: 'Ringkasan', icon: '📊' },
      { path: '#/internal/pos', label: 'Kasir', icon: '🧾' },
      { path: '#/internal/products', label: 'Produk', icon: '📦' },
      { path: '#/internal/messages', label: 'Pesan', icon: '💬' },
      { path: '#/internal/promos', label: 'Promo', icon: '🏷️' }
    ];
  }
  function internalMoreNav() {
    var items = [
      { path: '#/internal/transactions', label: 'Riwayat Transaksi' },
      { path: '#/internal/orders', label: 'Pesanan Online' },
      { path: '#/internal/purchases', label: 'Barang Masuk' },
      { path: '#/internal/inventory', label: 'Stok' },
      { path: '#/internal/opname', label: 'Stok Opname' },
      { path: '#/internal/returns', label: 'Retur' },
      { path: '#/internal/customers', label: 'Pelanggan' },
      { path: '#/internal/receivables', label: 'Piutang Pelanggan' },
      { path: '#/internal/suppliers', label: 'Supplier' },
      { path: '#/internal/payables', label: 'Hutang Supplier' },
      { path: '#/internal/cash', label: 'Kas' },
      { path: '#/internal/expenses', label: 'Pengeluaran' },
      { path: '#/internal/reports', label: 'Laporan' }
    ];
    if (Auth.isPemilik()) {
      items.push({ path: '#/internal/users', label: 'Pengguna' });
      items.push({ path: '#/internal/settings', label: 'Pengaturan' });
      items.push({ path: '#/internal/audit', label: 'Audit Log' });
      items.push({ path: '#/internal/backup', label: 'Backup' });
    } else {
      items.push({ path: '#/internal/settings', label: 'Pengaturan' });
    }
    items.push({ path: '#/internal/profile', label: 'Profil' });
    return items;
  }
  function internalSidebarGroups() {
    var groups = [
      { label: 'UTAMA', items: [{ path: '#/internal/dashboard', label: 'Ringkasan Toko' }, { path: '#/internal/pos', label: 'Kasir' }, { path: '#/internal/products', label: 'Produk' }] },
      { label: 'TRANSAKSI', items: [{ path: '#/internal/transactions', label: 'Riwayat Transaksi' }, { path: '#/internal/purchases', label: 'Barang Masuk' }, { path: '#/internal/returns', label: 'Retur' }, { path: '#/internal/orders', label: 'Pesanan Online' }] },
      { label: 'PERSEDIAAN', items: [{ path: '#/internal/inventory', label: 'Stok' }, { path: '#/internal/opname', label: 'Stok Opname' }, { path: '#/internal/promos', label: 'Promo' }] },
      { label: 'RELASI', items: [{ path: '#/internal/suppliers', label: 'Supplier' }, { path: '#/internal/customers', label: 'Pelanggan' }, { path: '#/internal/receivables', label: 'Piutang Pelanggan' }, { path: '#/internal/payables', label: 'Hutang Supplier' }] },
      { label: 'KEUANGAN', items: [{ path: '#/internal/expenses', label: 'Pengeluaran' }, { path: '#/internal/cash', label: 'Kas' }, { path: '#/internal/reports', label: 'Laporan' }] }
    ];
    if (Auth.isPemilik()) {
      groups.push({ label: 'SISTEM', items: [{ path: '#/internal/messages', label: 'Pesan' }, { path: '#/internal/users', label: 'Pengguna' }, { path: '#/internal/settings', label: 'Pengaturan' }, { path: '#/internal/audit', label: 'Audit Log' }, { path: '#/internal/backup', label: 'Backup' }] });
    } else {
      groups.push({ label: 'SISTEM', items: [{ path: '#/internal/messages', label: 'Pesan' }, { path: '#/internal/settings', label: 'Pengaturan' }] });
    }
    groups.push({ label: 'AKUN', items: [{ path: '#/internal/profile', label: 'Profil' }] });
    return groups;
  }

  function brandHtml() {
    return '<a href="#/shop/home" class="brand"><span class="dot"></span><span>TOKO AZQIA<small>Melayani Kebutuhan, Membangun Kepercayaan.</small></span></a>';
  }

  function renderShell(appRoot, area, path) {
    if (area === 'internal' && path === '/internal/login') {
      appRoot.className = '';
      appRoot.innerHTML = '<div class="topbar">' + brandHtml() + '</div><div id="view-container" class="content" style="max-width:400px;"></div>';
      return;
    }

    if (area === 'shop') {
      appRoot.className = '';
      var cartCount = (window.Cart ? window.Cart.count() : 0);
      appRoot.innerHTML =
        '<div class="topbar">' + brandHtml() +
        '<a href="#/shop/cart" class="btn btn-ghost">🛒 ' + cartCount + '</a></div>' +
        '<div id="view-container" class="content"></div>' +
        renderBottomNav(SHOP_NAV);
      return;
    }

    // internal (sudah login)
    appRoot.className = 'internal-shell';
    var user = Auth.getUser() || {};
    var sidebarHtml = internalSidebarGroups().map(function (g) {
      return '<div class="group-label">' + g.label + '</div>' + g.items.map(function (it) {
        return '<a href="' + it.path + '" data-path="' + it.path + '">' + it.label + '</a>';
      }).join('');
    }).join('');

    appRoot.innerHTML =
      '<div class="sidebar">' + brandHtml() + '<div class="divider"></div>' + sidebarHtml +
      '<div class="divider"></div><a href="#" id="btn-logout">Keluar</a></div>' +
      '<div style="flex:1;display:flex;flex-direction:column;min-width:0;">' +
      '<div class="topbar"><div style="font-weight:700;">' + Utils.escapeHtml(user.name || '') + '<div class="muted" style="font-size:0.72rem;">' + Utils.escapeHtml(user.role || '') + '</div></div>' +
      '<div class="row" style="gap:8px;"><button class="btn btn-ghost" id="btn-bell" style="position:relative;">🔔<span id="bell-badge" class="badge red" style="display:none;position:absolute;top:2px;right:2px;padding:1px 5px;font-size:0.62rem;">0</span></button>' +
      '<a href="#" id="btn-logout-top" class="btn btn-outline btn-sm">Keluar</a></div></div>' +
      '<div id="view-container" class="content"></div>' +
      renderBottomNav(internalMainNav(), true) +
      '</div>';

    ['btn-logout', 'btn-logout-top'].forEach(function (id) {
      var n = document.getElementById(id);
      if (n) n.addEventListener('click', function (e) { e.preventDefault(); Auth.logout().then(function () { location.hash = '#/internal/login'; }); });
    });

    wireNotificationBell();

    var moreBtn = document.getElementById('nav-more');
    if (moreBtn) moreBtn.addEventListener('click', function (e) {
      e.preventDefault();
      var items = internalMoreNav().map(function (it) { return '<a href="' + it.path + '" class="btn btn-outline btn-block" style="margin-bottom:8px;">' + it.label + '</a>'; }).join('');
      var m = Utils.openModal('<h3>Menu Lainnya</h3>' + items + '<button class="btn btn-ghost btn-block" id="close-more">Tutup</button>');
      m.querySelector('#close-more').addEventListener('click', Utils.closeModal);
      Utils.qsa('a', m).forEach(function (a) { a.addEventListener('click', Utils.closeModal); });
    });
  }

  function wireNotificationBell() {
    var bell = document.getElementById('btn-bell');
    if (!bell) return;
    Api.call('notification.list', {}).then(function (d) {
      var badge = document.getElementById('bell-badge');
      if (d.unread_count > 0) { badge.style.display = 'block'; badge.textContent = d.unread_count > 99 ? '99+' : d.unread_count; }
    }).catch(function () {});
    bell.addEventListener('click', function () { openNotificationPanel(); });
  }

  function openNotificationPanel() {
    Api.call('notification.list', {}).then(function (d) {
      var listHtml = d.notifications.length === 0 ? '<div class="empty-state">Tidak ada notifikasi.</div>' :
        d.notifications.map(function (n) {
          var isRead = String(n.read) === 'true' || n.read === true;
          return '<div class="card" style="' + (isRead ? 'opacity:0.6;' : '') + '"><div class="row"><strong>' + Utils.escapeHtml(n.title) + '</strong><span class="muted" style="font-size:0.72rem;">' + Utils.formatDate(n.created_at) + '</span></div>' +
            '<div class="muted">' + Utils.escapeHtml(n.message) + '</div></div>';
        }).join('');
      var m = Utils.openModal('<h3>Notifikasi</h3>' + listHtml +
        (d.notifications.length > 0 ? '<button class="btn btn-outline btn-block" id="mark-all-read" style="margin-top:10px;">Tandai Semua Terbaca</button>' : ''));
      var markBtn = m.querySelector('#mark-all-read');
      if (markBtn) markBtn.addEventListener('click', function () {
        Api.call('notification.markRead', {}).then(function () { Utils.closeModal(); wireNotificationBell(); Utils.toast('Semua notifikasi ditandai terbaca.', 'success'); });
      });
    });
  }

  function renderBottomNav(items, withMore) {
    var links = items.map(function (it) {
      return '<a href="' + it.path + '" data-path="' + it.path + '"><span class="icon">' + it.icon + '</span>' + it.label + '</a>';
    }).join('');
    if (withMore) links += '<a href="#" id="nav-more"><span class="icon">⋯</span>Lainnya</a>';
    return '<nav class="bottom-nav">' + links + '</nav>';
  }

  function highlightActive(path) {
    Utils.qsa('[data-path]').forEach(function (a) {
      a.classList.toggle('active', a.getAttribute('data-path') === '#' + path);
    });
  }

  return { renderShell: renderShell, highlightActive: highlightActive };
})();
