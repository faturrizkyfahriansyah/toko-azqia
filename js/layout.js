/**
 * js/layout.js - shell topbar/sidebar/bottom-nav untuk area shop & internal.
 * Item menu Pemilik-only (Pengguna, Audit, Backup) disembunyikan di UI untuk Pengelola -
 * ini HANYA kosmetik, penegakan akses sesungguhnya selalu di backend (42_Validation.gs).
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
      { path: '#/internal/reports', label: 'Laporan', icon: '📈' }
    ];
  }
  function internalMoreNav() {
    var items = [
      { path: '#/internal/inventory', label: 'Stok & Opname' },
      { path: '#/internal/purchases', label: 'Barang Masuk' },
      { path: '#/internal/suppliers', label: 'Supplier' },
      { path: '#/internal/customers', label: 'Pelanggan' },
      { path: '#/internal/orders', label: 'Pesanan Online' }
    ];
    if (Auth.isPemilik()) {
      items.push({ path: '#/internal/users', label: 'Pengguna' });
      items.push({ path: '#/internal/settings', label: 'Pengaturan & Sistem' });
    }
    return items;
  }
  function internalSidebarGroups() {
    var groups = [
      { label: 'OPERASIONAL', items: [{ path: '#/internal/dashboard', label: 'Ringkasan' }, { path: '#/internal/pos', label: 'Kasir' }] },
      { label: 'PRODUK & STOK', items: [{ path: '#/internal/products', label: 'Produk' }, { path: '#/internal/inventory', label: 'Stok & Opname' }, { path: '#/internal/purchases', label: 'Barang Masuk' }] },
      { label: 'RELASI', items: [{ path: '#/internal/suppliers', label: 'Supplier' }, { path: '#/internal/customers', label: 'Pelanggan' }] },
      { label: 'ONLINE', items: [{ path: '#/internal/orders', label: 'Pesanan Online' }] },
      { label: 'LAPORAN', items: [{ path: '#/internal/reports', label: 'Laporan' }] }
    ];
    if (Auth.isPemilik()) {
      groups.push({ label: 'ADMIN', items: [{ path: '#/internal/users', label: 'Pengguna' }, { path: '#/internal/settings', label: 'Pengaturan & Sistem' }] });
    }
    return groups;
  }

  function brandHtml() {
    return '<a href="#/shop/home" class="brand"><span class="dot"></span><span>TOKO AZKIA<small>Melayani Kebutuhan, Membangun Kepercayaan.</small></span></a>';
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
      '<a href="#" id="btn-logout-top" class="btn btn-outline btn-sm">Keluar</a></div>' +
      '<div id="view-container" class="content"></div>' +
      renderBottomNav(internalMainNav(), true) +
      '</div>';

    ['btn-logout', 'btn-logout-top'].forEach(function (id) {
      var n = document.getElementById(id);
      if (n) n.addEventListener('click', function (e) { e.preventDefault(); Auth.logout().then(function () { location.hash = '#/internal/login'; }); });
    });

    var moreBtn = document.getElementById('nav-more');
    if (moreBtn) moreBtn.addEventListener('click', function (e) {
      e.preventDefault();
      var items = internalMoreNav().map(function (it) { return '<a href="' + it.path + '" class="btn btn-outline btn-block" style="margin-bottom:8px;">' + it.label + '</a>'; }).join('');
      var m = Utils.openModal('<h3>Menu Lainnya</h3>' + items + '<button class="btn btn-ghost btn-block" id="close-more">Tutup</button>');
      m.querySelector('#close-more').addEventListener('click', Utils.closeModal);
      Utils.qsa('a', m).forEach(function (a) { a.addEventListener('click', Utils.closeModal); });
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
