/**
 * js/layout.js — TOKOQIA Redesign v2.
 * Header edge-to-edge (hamburger + logo + "TOKOQIA" + bell, TANPA nama/role pengguna),
 * Navigation Drawer (slide-over, list navigation per grup, menggantikan "Lainnya"),
 * Bottom Navigation TEPAT 5 item (Ringkasan/Kasir/Produk/Pesan/Promo) dengan ikon SVG.
 * Identitas: TOKOQIA (aplikasi) > TOKO AZQIA (toko) > halaman > Profil Saya (pengguna).
 */
window.Layout = (function () {
  var LOGO = 'assets/brand/logo-horizontal.png';
  var LOGO_ICON = 'assets/brand/icon-192.png';

  // ---- Ikon SVG (bukan emoji) untuk header & bottom nav ----
  var ICONS = {
    menu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="4" y1="7" x2="20" y2="7"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="17" x2="20" y2="17"/></svg>',
    bell: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 5-2 6-2 6h16s-2-1-2-6"/><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0"/></svg>',
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg>',
    home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 11.5 12 4l8 7.5"/><path d="M6 10v9h12v-9"/></svg>',
    pos: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="8" width="16" height="12" rx="1.5"/><path d="M8 8V6a4 4 0 0 1 8 0v2"/><line x1="8" y1="13" x2="16" y2="13"/></svg>',
    box: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 8 12 3 3 8l9 5 9-5Z"/><path d="M3 8v8l9 5 9-5V8"/><line x1="12" y1="13" x2="12" y2="21"/></svg>',
    chat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a8 8 0 1 1-3.3-6.5L21 4l-1 4.2A7.9 7.9 0 0 1 21 12Z"/></svg>',
    tag: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20.6 12.6 12 21 3 12V3h9l8.6 8.6a1.9 1.9 0 0 1 0 2.8Z"/><circle cx="8" cy="8" r="1.4" fill="currentColor" stroke="none"/></svg>',
    receipt: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3h12v18l-2.5-1.5L13 21l-1-1.5L11 21l-2.5-1.5L6 21V3Z"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="9" y1="12" x2="15" y2="12"/></svg>',
    truck: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="12" height="10" rx="1"/><path d="M14 10h4l3 3v4h-7z"/><circle cx="7" cy="19" r="1.6"/><circle cx="17.5" cy="19" r="1.6"/></svg>',
    inbox: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12h4l2 3h4l2-3h4"/><path d="M5 4h14l2 8v7a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-7l2-8Z"/></svg>',
    undo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9H4V5"/><path d="M4 9c1.8-3 5-5 8.5-5A8.5 8.5 0 1 1 5 18"/></svg>',
    clipboard: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="4" width="12" height="17" rx="1.5"/><rect x="9" y="2.3" width="6" height="3" rx="1"/><line x1="9" y1="11" x2="15" y2="11"/><line x1="9" y1="15" x2="15" y2="15"/></svg>',
    search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="10.5" cy="10.5" r="6.5"/><line x1="20" y1="20" x2="15.3" y2="15.3"/></svg>',
    user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="3.5"/><path d="M4.5 20c1.4-3.8 4.4-6 7.5-6s6.1 2.2 7.5 6"/></svg>',
    card: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5.5" width="18" height="13" rx="1.8"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="6" y1="14.5" x2="10" y2="14.5"/></svg>',
    invoice: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2.5h9l3 3V21a.5.5 0 0 1-.5.5h-11A.5.5 0 0 1 6 21Z"/><line x1="9" y1="10" x2="15" y2="10"/><line x1="9" y1="14" x2="15" y2="14"/><line x1="9" y1="18" x2="12.5" y2="18"/></svg>',
    wallet: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18"/><circle cx="16.5" cy="14" r="1.2" fill="currentColor" stroke="none"/></svg>',
    trend: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 17 9 11 13 15 21 6"/><polyline points="15 6 21 6 21 12"/></svg>',
    usersGroup: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3"/><path d="M2.5 20c1.1-3.3 3.6-5 6.5-5s5.4 1.7 6.5 5"/><circle cx="17.5" cy="8.5" r="2.3"/><path d="M15.8 20c.5-2.5 2-4 4.4-4.6"/></svg>',
    gear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 13.5a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.9 2.9l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6V20a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.9-2.9l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.6-1H4a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.9-2.9l.1.1a1.7 1.7 0 0 0 1.9.3H10a1.7 1.7 0 0 0 1-1.6V4a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.9 2.9l-.1.1a1.7 1.7 0 0 0-.3 1.9V10a1.7 1.7 0 0 0 1.6 1H20a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"/></svg>',
    shield: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3 4.5 6v6.3C4.5 16.7 7.7 20 12 21c4.3-1 7.5-4.3 7.5-8.7V6Z"/><polyline points="9 12 11 14 15.5 9.5"/></svg>',
    cloud: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M7 18a4.5 4.5 0 0 1-.5-9 5.5 5.5 0 0 1 10.7-1.7A4 4 0 0 1 17 18Z"/></svg>',
    userCircle: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="10" r="3"/><path d="M6.3 18.5c1.1-2.3 3.2-3.5 5.7-3.5s4.6 1.2 5.7 3.5"/></svg>',
    logout: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>'
  };

  var BOTTOM_NAV = [
    { path: '#/internal/dashboard', label: 'Ringkasan', icon: ICONS.home },
    { path: '#/internal/pos', label: 'Kasir', icon: ICONS.pos },
    { path: '#/internal/products', label: 'Produk', icon: ICONS.box },
    { path: '#/internal/messages', label: 'Pesan', icon: ICONS.chat },
    { path: '#/internal/promos', label: 'Promo', icon: ICONS.tag }
  ];

  var SHOP_NAV = [
    { path: '#/shop/home', label: 'Beranda', icon: ICONS.home },
    { path: '#/shop/catalog', label: 'Katalog', icon: ICONS.box },
    { path: '#/shop/cart', label: 'Keranjang', icon: ICONS.pos },
    { path: '#/shop/tracking', label: 'Lacak', icon: ICONS.chat }
  ];

  function drawerGroups() {
    var groups = [
      { label: 'UTAMA', items: [
        { path: '#/internal/dashboard', label: 'Ringkasan', ic: ICONS.home },
        { path: '#/internal/pos', label: 'Kasir', ic: ICONS.pos },
        { path: '#/internal/products', label: 'Produk', ic: ICONS.box }
      ] },
      { label: 'TRANSAKSI', items: [
        { path: '#/internal/transactions', label: 'Riwayat Transaksi', ic: ICONS.receipt },
        { path: '#/internal/orders', label: 'Pesanan Online', ic: ICONS.truck },
        { path: '#/internal/purchases', label: 'Barang Masuk', ic: ICONS.inbox },
        { path: '#/internal/returns', label: 'Retur', ic: ICONS.undo }
      ] },
      { label: 'PERSEDIAAN', items: [
        { path: '#/internal/inventory', label: 'Stok', ic: ICONS.clipboard },
        { path: '#/internal/opname', label: 'Stok Opname', ic: ICONS.search }
      ] },
      { label: 'RELASI', items: [
        { path: '#/internal/customers', label: 'Pelanggan', ic: ICONS.user },
        { path: '#/internal/receivables', label: 'Piutang Pelanggan', ic: ICONS.card },
        { path: '#/internal/suppliers', label: 'Supplier', ic: ICONS.truck },
        { path: '#/internal/payables', label: 'Hutang Supplier', ic: ICONS.invoice }
      ] },
      { label: 'KEUANGAN', items: [
        { path: '#/internal/cash', label: 'Kas', ic: ICONS.wallet },
        { path: '#/internal/expenses', label: 'Pengeluaran', ic: ICONS.receipt },
        { path: '#/internal/reports', label: 'Laporan', ic: ICONS.trend }
      ] }
    ];
    var sistem = { label: 'SISTEM', items: [] };
    if (Auth.isPemilik()) {
      sistem.items = [
        { path: '#/internal/users', label: 'Pengguna', ic: ICONS.usersGroup },
        { path: '#/internal/settings', label: 'Pengaturan', ic: ICONS.gear },
        { path: '#/internal/audit', label: 'Audit Log', ic: ICONS.shield },
        { path: '#/internal/backup', label: 'Backup', ic: ICONS.cloud }
      ];
    } else {
      sistem.items = [{ path: '#/internal/settings', label: 'Pengaturan', ic: ICONS.gear }];
    }
    groups.push(sistem);
    groups.push({ label: 'AKUN', items: [{ path: '#/internal/profile', label: 'Profil Saya', ic: ICONS.userCircle }] });
    return groups;
  }

  function brandHtml(compact) {
    return '<a href="#/shop/home" class="brand"><img src="' + LOGO + '" alt="TOKOQIA">' +
      (compact ? '' : '<span class="app-name">TOKOQIA</span>') + '</a>';
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
        '<a href="#/shop/cart" class="icon-btn" aria-label="Keranjang">' + ICONS.pos + (cartCount > 0 ? '<span class="bell-badge">' + cartCount + '</span>' : '') + '</a></div>' +
        '<div id="view-container" class="content"></div>' +
        renderBottomNav(SHOP_NAV);
      return;
    }

    // internal (sudah login) - header baru: hamburger + logo + TOKOQIA + bell (tanpa nama/role)
    appRoot.className = 'internal-shell';
    var groups = drawerGroups();
    var sidebarHtml = groups.map(function (g) {
      return '<div class="group-label">' + g.label + '</div>' + g.items.map(function (it) {
        return '<a class="sidebar-link" href="' + it.path + '" data-path="' + it.path + '"><span class="dot"></span>' + it.label + '</a>';
      }).join('');
    }).join('');

    appRoot.innerHTML =
      '<div class="sidebar">' +
      '<div class="drawer-brand"><img src="' + LOGO_ICON + '" alt=""><div class="names"><span class="app-name">TOKOQIA</span><span class="store-name">TOKO AZQIA</span></div></div>' +
      sidebarHtml +
      '<div class="divider"></div>' +
      '<a class="sidebar-link desktop-profile" href="#/internal/profile" data-path="#/internal/profile"><span class="dot"></span>Profil Saya</a>' +
      '<a class="sidebar-link desktop-profile" href="#" id="btn-logout-side"><span class="dot"></span>Keluar</a>' +
      '</div>' +
      '<div style="flex:1;display:flex;flex-direction:column;min-width:0;">' +
      '<div class="topbar">' +
      '<button class="icon-btn" id="btn-drawer" aria-label="Menu">' + ICONS.menu + '</button>' +
      brandHtml() +
      '<div class="topbar-spacer"></div>' +
      '<button class="icon-btn" id="btn-bell" aria-label="Notifikasi">' + ICONS.bell + '<span id="bell-badge" class="bell-badge" style="display:none;">0</span></button>' +
      '<a href="#/internal/profile" class="icon-btn desktop-profile" id="btn-profile-top" aria-label="Profil" style="display:none;">' + ICONS.userCircle + '</a>' +
      '</div>' +
      '<div id="view-container" class="content"></div>' +
      renderBottomNav(BOTTOM_NAV) +
      '</div>' +
      renderDrawer(groups);

    var logoutHandler = function (e) { e.preventDefault(); Auth.logout().then(function () { location.hash = '#/internal/login'; }); };
    var sideLogout = document.getElementById('btn-logout-side');
    if (sideLogout) sideLogout.addEventListener('click', logoutHandler);

    wireDrawer();
    wireNotificationBell();
  }

  function renderDrawer(groups) {
    var itemsHtml = groups.map(function (g) {
      return '<div class="drawer-group-label">' + g.label + '</div>' + g.items.map(function (it) {
        return '<a class="drawer-link" href="' + it.path + '" data-path="' + it.path + '"><span class="ic">' + it.ic + '</span>' + it.label + '</a>';
      }).join('');
    }).join('');
    return (
      '<div class="drawer-overlay" id="drawer-overlay"></div>' +
      '<div class="drawer-panel" id="drawer-panel">' +
      '<button class="drawer-close" id="drawer-close" aria-label="Tutup">' + ICONS.close + '</button>' +
      '<div class="drawer-brand"><img src="' + LOGO_ICON + '" alt=""><div class="names"><span class="app-name">TOKOQIA</span><span class="store-name">TOKO AZQIA</span></div></div>' +
      itemsHtml +
      '<div class="drawer-group-label">&nbsp;</div>' +
      '<a class="drawer-link danger" href="#" id="drawer-logout"><span class="ic">' + ICONS.logout + '</span>Keluar</a>' +
      '</div>'
    );
  }

  function wireDrawer() {
    var overlay = document.getElementById('drawer-overlay');
    var panel = document.getElementById('drawer-panel');
    var openBtn = document.getElementById('btn-drawer');
    var closeBtn = document.getElementById('drawer-close');
    function open() { overlay.classList.add('open'); panel.classList.add('open'); overlay.style.display = 'block'; }
    function close() { overlay.classList.remove('open'); panel.classList.remove('open'); setTimeout(function () { overlay.style.display = 'none'; }, 200); }
    overlay.style.display = 'none';
    if (openBtn) openBtn.addEventListener('click', open);
    if (closeBtn) closeBtn.addEventListener('click', close);
    overlay.addEventListener('click', close);
    Utils.qsa('.drawer-link', panel).forEach(function (a) { a.addEventListener('click', close); });
    var drawerLogout = document.getElementById('drawer-logout');
    if (drawerLogout) drawerLogout.addEventListener('click', function (e) { e.preventDefault(); close(); Auth.logout().then(function () { location.hash = '#/internal/login'; }); });
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
      var listHtml = d.notifications.length === 0 ? '<div class="empty-state"><div class="empty-title">Belum ada notifikasi</div></div>' :
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

  function renderBottomNav(items) {
    var links = items.map(function (it) {
      return '<a href="' + it.path + '" data-path="' + it.path + '">' + it.icon + '<span>' + it.label + '</span></a>';
    }).join('');
    return '<nav class="bottom-nav">' + links + '</nav>';
  }

  function highlightActive(path) {
    Utils.qsa('[data-path]').forEach(function (a) {
      a.classList.toggle('active', a.getAttribute('data-path') === '#' + path);
    });
    var profileTop = document.getElementById('btn-profile-top');
    if (profileTop && window.innerWidth >= 900) profileTop.style.display = 'flex';
  }

  return { renderShell: renderShell, highlightActive: highlightActive };
})();
