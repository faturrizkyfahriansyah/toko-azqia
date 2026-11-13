/**
 * internal/pos.js - Kasir (POS) V3.
 * Alur: pilih kategori / cari / scan -> ketuk produk (masuk keranjang) -> bar keranjang di bawah ->
 * keranjang (atur qty & satuan, diskon) -> bayar (Tunai/QRIS/Transfer/Hutang) -> struk (Pratinjau / Cetak).
 * Produk TANPA manajemen stok selalu bisa dijual. Produk yang dilacak stoknya & habis ditandai "Habis".
 */
window.Modules = window.Modules || {};
Modules.pos = (function () {
  var CAMERA_ICON = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z"/><circle cx="12" cy="13" r="3.4"/></svg>';
  var cart = []; // {product, product_id, product_name, unit_id, unit_name, conversion_to_base, unit_price, retail_price, wholesale, qty, discount, availableUnits}
  var customers = [], customerId = '', rule = 'OFF';
  var allProducts = [], categories = [], activeCat = '', searchQ = '', snapshot = null;
  var orderDiscount = 0;
  var unitsByProduct = {}; // product_id -> satuan (dari snapshot: tanpa panggilan server)
  var refreshTimer = null;

  // Ikon kategori (SVG garis) - dipilih lewat kata kunci pada nama kategori.
  var G = 'viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"';
  var CAT_ICONS = {
    segar: '<svg ' + G + '><path d="M4 14c0-4 3.5-7 8-7 3 0 5.5 1.2 7 3.5-1 3.3-4 5.5-8 5.5-3.7 0-7-1-7-2Z"/><path d="M19 10.5c.9-.4 1.8-.3 2.5.3"/><circle cx="8.5" cy="12" r="0.8" fill="currentColor"/><path d="M12 7.5V5M9 8l-1-2.2"/></svg>',
    pokok: '<svg ' + G + '><path d="M6 8h12l1.5 11a1 1 0 0 1-1 1.1H5.5a1 1 0 0 1-1-1.1L6 8Z"/><path d="M9 8c0-2 1.2-3.5 3-3.5S15 6 15 8"/><path d="M8.5 13.5c1.2-.8 2.3-.8 3.5 0s2.3.8 3.5 0"/></svg>',
    telur: '<svg ' + G + '><path d="M12 3.5c-3 0-5.5 5-5.5 9a5.5 5.5 0 0 0 11 0c0-4-2.5-9-5.5-9Z"/><path d="M9.5 14.5a2.7 2.7 0 0 0 2.5 2"/></svg>',
    roti: '<svg ' + G + '><path d="M5 11c-1.5-3 1-6 4-5.5 1.5-1 4-1 5.5 0 3-.5 5.5 2.5 4 5.5v6.5a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V11Z"/><path d="M9 11l1 3M13 11l1 3"/></svg>',
    minuman: '<svg ' + G + '><path d="M10 3h4v3l2 2.5V19a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2V8.5L10 6V3Z"/><path d="M8 12h8"/></svg>',
    perawatan: '<svg ' + G + '><rect x="9" y="11" width="6" height="9" rx="1"/><path d="M10 11V8.5c0-1 .8-1.6 2-1.6s2 .6 2 1.6V11"/><path d="M12 6.9V3.5"/><path d="M17.5 5l.6 1.5 1.5.6-1.5.6-.6 1.5-.6-1.5-1.5-.6 1.5-.6.6-1.5Z"/></svg>',
    rumah: '<svg ' + G + '><path d="M9 10V6.5A1.5 1.5 0 0 1 10.5 5H13l2 2v3"/><rect x="7" y="10" width="10" height="10" rx="2"/><path d="M13 5h4M11 14h2"/></svg>',
    atk: '<svg ' + G + '><path d="M4 20l1-4L16.5 4.5a2 2 0 0 1 2.8 0l.2.2a2 2 0 0 1 0 2.8L8 19l-4 1Z"/><path d="M14.5 6.5l3 3"/></svg>',
    tag: '<svg ' + G + '><path d="M20.6 12.6 12 21 3 12V3h9l8.6 8.6a1.9 1.9 0 0 1 0 2.8Z"/><circle cx="8" cy="8" r="1.4"/></svg>',
    all: '<svg ' + G + '><rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/></svg>'
  };
  // Urutan & kata kunci kategori standar (sesuai referensi marketplace).
  var CAT_RULES = [
    { key: 'segar', re: /segar|beku|frozen|daging|ikan|sayur|buah/i },
    { key: 'pokok', re: /pokok|sembako|beras|bumbu|masak/i },
    { key: 'telur', re: /telur|susu|olahan/i },
    { key: 'roti', re: /roti|snack|makanan|mie|ringan|kue|biskuit/i },
    { key: 'minuman', re: /minum|kopi|teh|air/i },
    { key: 'perawatan', re: /perawatan|kecantikan|mandi|kosmetik|sabun/i },
    { key: 'rumah', re: /rumah|kebersihan|tangga|cuci/i },
    { key: 'atk', re: /atk|alat tulis|tulis|kantor/i }
  ];
  var PALETTE = ['#e5484d', '#3b82f6', '#f59e0b', '#10b981', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

  function catRule(name) {
    for (var i = 0; i < CAT_RULES.length; i++) if (CAT_RULES[i].re.test(name || '')) return { idx: i, key: CAT_RULES[i].key };
    return { idx: 99, key: 'tag' };
  }
  function hashColor(str) {
    var h = 0; String(str || '').split('').forEach(function (c) { h = (h * 31 + c.charCodeAt(0)) >>> 0; });
    return PALETTE[h % PALETTE.length];
  }
  function initials(name) {
    var w = String(name || '?').trim().split(/\s+/);
    return ((w[0] || '?')[0] + (w[1] ? w[1][0] : (w[0][1] || ''))).toUpperCase();
  }
  function isManaged(p) { return !(p.manage_stock === false || String(p.manage_stock).toLowerCase() === 'false'); }
  function availableOf(p) { return Number(p.current_stock) - Number(p.reserved_stock); }

  function custType() { var c = customers.filter(function (x) { return x.customer_id === customerId; })[0]; return c ? c.type : ''; }
  function custName() { var c = customers.filter(function (x) { return x.customer_id === customerId; })[0]; return c ? c.name : ''; }
  function applySnapshot(sn) {
    snapshot = sn; allProducts = sn.products || []; categories = sn.categories || []; customers = sn.customers || []; rule = (sn.pricing && sn.pricing.wholesale_rule) || 'OFF';
    unitsByProduct = {}; (sn.product_units || []).forEach(function (u) { (unitsByProduct[u.product_id] = unitsByProduct[u.product_id] || []).push(u); });
  }
  function baseUnit(units) { return units.filter(function (u) { return u.is_base === true || String(u.is_base) === 'true'; })[0] || units[0]; }
  function priceLine(l) {
    var r = window.Pricing.unitPrice(l.product, l.unit, l.qty, custType(), rule);
    l.unit_price = r.price; l.retail_price = r.retail; l.wholesale = r.wholesale;
  }
  function repriceCart() { cart.forEach(priceLine); }
  function findLine(productId, unitId) { return cart.filter(function (l) { return l.product_id === productId && l.unit_id === unitId; })[0]; }
  function thumbHtml(p, badge) {
    var ini = Utils.escapeHtml(initials(p.product_name));
    return '<div class="thumb" style="background:' + hashColor(p.category_id) + ';">' + (p.photo_id ? '<img loading="lazy" alt="" src="' + Utils.photoUrl(p.photo_id, 240) + '" onerror="this.remove()">' : '') + '<span class="thumb-ini">' + ini + '</span>' + badge + '</div>';
  }

  function addToCart(p) {
    var units = unitsByProduct[p.product_id] || [], base = baseUnit(units);
    if (!base) { Utils.toast('Produk ini belum punya satuan terdaftar.', 'error'); return; }
    var line = findLine(p.product_id, base.unit_id);
    if (line) { line.qty += 1; priceLine(line); } else {
      line = { product: p, product_id: p.product_id, product_name: p.product_name, unit: base, unit_id: base.unit_id, unit_name: base.unit_name, conversion_to_base: base.conversion_to_base, qty: 1, discount: 0, availableUnits: units };
      priceLine(line); cart.push(line);
    }
    renderCart();
  }
  function subtotal() { return cart.reduce(function (s, l) { return s + l.qty * l.unit_price - l.discount; }, 0); }
  function grandTotal() { return Math.max(0, subtotal() - orderDiscount); }
  function itemCount() { return cart.reduce(function (s, l) { return s + l.qty; }, 0); }

  // ---------- status koneksi & antrean ----------
  function updateStatus() {
    var el = document.getElementById('pos-status'); if (!el) return;
    var c = Offline.counts(), waiting = c.pending + c.failed;
    el.className = 'pos-status ' + (c.online ? (waiting ? 'warn' : 'ok') : 'off');
    el.innerHTML = '<span class="dot"></span><span>' + (c.online ? 'Online' : 'Offline') + '</span>' + (waiting ? '<span class="pos-q">' + waiting + ' menunggu kirim</span>' : '') + (c.syncing ? '<span class="pos-q">mengirim&hellip;</span>' : '');
  }
  function openQueue() {
    Offline.list().then(function (d) {
      var rows = d.outbox.map(function (x) {
        return '<div class="card"><div class="row"><strong>' + Utils.escapeHtml(x.local_number) + '</strong><span>' + Utils.formatCurrency(x.total) + '</span></div><div class="muted">' + Utils.escapeHtml(x.created_at.slice(11, 16)) + ' &middot; ' + (x.status === 'failed' ? '<span style="color:var(--danger);font-weight:700;">Ditolak: ' + Utils.escapeHtml(x.error) + '</span>' : 'menunggu kirim') + '</div>' +
          (x.status === 'failed' ? '<div class="field-row" style="margin-top:8px;"><button class="btn btn-secondary btn-sm" data-retry="' + x.local_id + '">Coba lagi</button><button class="btn btn-outline btn-sm" data-discard="' + x.local_id + '">Hapus</button></div>' : '') + '</div>';
      }).join('');
      var sent = d.done.map(function (x) { return '<div class="muted" style="font-size:0.82rem;">' + Utils.escapeHtml(x.local_number) + ' &rarr; <strong>' + Utils.escapeHtml(x.server_number) + '</strong> &middot; ' + Utils.formatCurrency(x.total) + (x.negative_stock && x.negative_stock.length ? ' &middot; stok negatif' : '') + '</div>'; }).join('');
      var m = Utils.openModal('<h3>Antrean Offline</h3>' + (rows || '<div class="empty-state"><div class="empty-sub">Tidak ada transaksi yang menunggu.</div></div>') +
        '<button class="btn btn-primary btn-block" id="q-sync" style="margin-top:10px;">Kirim sekarang</button>' + (sent ? '<h4 style="margin-top:14px;">Baru terkirim</h4>' + sent : '') +
        '<p class="hint">Transaksi offline tersimpan di perangkat ini dan dikirim otomatis saat internet kembali. Jangan menghapus data browser sebelum antrean kosong.</p>');
      m.querySelector('#q-sync').addEventListener('click', function () { Offline.sync().then(function (r) { Offline.announce(r); Utils.closeModal(); if (r && r.offline) Utils.toast('Masih offline.', 'error'); }); });
      Utils.qsa('[data-retry]', m).forEach(function (b) { b.addEventListener('click', function () { Offline.retryFailed(b.getAttribute('data-retry')).then(function (r) { Offline.announce(r); Utils.closeModal(); }); }); });
      Utils.qsa('[data-discard]', m).forEach(function (b) { b.addEventListener('click', function () { if (confirm('Hapus transaksi ini dari antrean? Data penjualannya HILANG.')) Offline.discard(b.getAttribute('data-discard')).then(function () { Utils.closeModal(); openQueue(); }); }); });
    });
  }

  function render(container) {
    var I = (window.Layout && window.Layout.ICONS) || {};
    container.innerHTML =
      '<div class="row"><h1 class="page-title" style="margin:0;">Kasir</h1><button type="button" class="pos-status ok" id="pos-status"></button></div>' +
      '<div class="search-box"><input id="pos-search" type="search" placeholder="Cari produk, SKU, atau scan barcode" autocomplete="off">' +
      '<button class="btn btn-secondary" id="pos-scan" title="Scan barcode via kamera" aria-label="Scan barcode">' + CAMERA_ICON + '</button></div>' +
      '<div class="cat-row" id="pos-cats"></div>' +
      '<div id="pos-grid"><div class="spinner"></div></div>' +
      '<button class="cart-bar empty" id="pos-cartbar" type="button"></button>';
    document.getElementById('pos-scan').addEventListener('click', openCameraScan);
    document.getElementById('pos-cartbar').addEventListener('click', openCartModal);
    document.getElementById('pos-status').addEventListener('click', openQueue);
    Offline.on(function () { if (container.isConnected) updateStatus(); });
    var searchInput = document.getElementById('pos-search');
    searchInput.addEventListener('input', Utils.debounce(function () { searchQ = searchInput.value.trim(); renderGrid(); }, 160));
    searchInput.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter') return;
      var q = searchInput.value.trim(); if (!q) return;
      var exact = allProducts.filter(function (p) { return String(p.barcode) === q || String(p.sku).toLowerCase() === q.toLowerCase(); })[0];
      if (exact) { e.preventDefault(); addToCart(exact); searchInput.value = ''; searchQ = ''; renderGrid(); }
    });
    updateCartBar(); updateStatus();
    function show(sn) { applySnapshot(sn); repriceCart(); if (activeCat && !categories.some(function (c) { return c.category_id === activeCat; })) activeCat = ''; renderCats(); renderGrid(); updateCartBar(); }
    // Critical Data First: tampil SEGERA dari penyimpanan perangkat, lalu segarkan di latar belakang bila online.
    return Offline.loadSnapshot().then(function (cached) {
      if (cached) show(cached);
      if (!Offline.isOnline()) { if (!cached) document.getElementById('pos-grid').innerHTML = '<div class="empty-state"><div class="empty-title">Belum ada data tersimpan</div><div class="empty-sub">Buka Kasir sekali saat online agar produk tersimpan untuk dipakai offline.</div></div>'; return; }
      return Offline.refreshSnapshot().then(function (fresh) { if (container.isConnected) show(fresh); }).catch(function (err) {
        if (!cached && container.isConnected) document.getElementById('pos-grid').innerHTML = '<div class="empty-state"><div class="empty-title">Tidak dapat memuat produk</div><div class="empty-sub">' + Utils.escapeHtml(err.message) + '</div><button class="btn btn-primary" id="pos-retry">Coba lagi</button></div>';
        var rb = document.getElementById('pos-retry'); if (rb) rb.addEventListener('click', function () { Router.render(); });
      });
    }).then(function () {
      if (refreshTimer) clearInterval(refreshTimer);
      refreshTimer = setInterval(function () { if (!container.isConnected) { clearInterval(refreshTimer); return; } if (Offline.isOnline() && !Offline.counts().syncing) Offline.refreshSnapshot().then(function (fresh) { if (container.isConnected) show(fresh); }).catch(function () {}); }, 600000);
    });
  }

  function renderCats() {
    var box = document.getElementById('pos-cats'); if (!box) return;
    var used = {}; allProducts.forEach(function (p) { used[p.category_id] = true; });
    var list = categories.filter(function (c) { return used[c.category_id]; })
      .map(function (c) { return { c: c, r: catRule(c.category_name) }; })
      .sort(function (a, b) { return a.r.idx - b.r.idx || String(a.c.category_name).localeCompare(String(b.c.category_name)); });
    box.innerHTML =
      '<button class="cat-item' + (activeCat === '' ? ' active' : '') + '" data-cat=""><span class="cat-ic">' + CAT_ICONS.all + '</span><span class="cat-name">Semua</span></button>' +
      list.map(function (x) { return '<button class="cat-item' + (activeCat === x.c.category_id ? ' active' : '') + '" data-cat="' + x.c.category_id + '"><span class="cat-ic">' + CAT_ICONS[x.r.key] + '</span><span class="cat-name">' + Utils.escapeHtml(x.c.category_name) + '</span></button>'; }).join('');
    Utils.qsa('[data-cat]', box).forEach(function (b) { b.addEventListener('click', function () { activeCat = b.getAttribute('data-cat'); renderCats(); renderGrid(); }); });
  }

  function renderGrid() {
    var box = document.getElementById('pos-grid'); if (!box) return;
    var q = searchQ.toLowerCase(), catName = {}; categories.forEach(function (c) { catName[c.category_id] = c.category_name; });
    var list = allProducts.filter(function (p) {
      if (activeCat && p.category_id !== activeCat) return false;
      if (!q) return true;
      return String(p.product_name).toLowerCase().indexOf(q) !== -1 || String(p.sku).toLowerCase().indexOf(q) !== -1 || String(p.barcode).indexOf(searchQ) !== -1;
    });
    if (allProducts.length === 0) { box.innerHTML = '<div class="empty-state"><img src="assets/icons/tokoqia-empty-state.png" alt=""><div class="empty-title">Belum ada produk</div><div class="empty-sub">Tambahkan produk dulu di menu Produk.</div></div>'; return; }
    if (list.length === 0) { box.innerHTML = '<div class="empty-state"><div class="empty-title">Produk tidak ditemukan</div><div class="empty-sub">Coba kata kunci atau kategori lain.</div></div>'; return; }
    box.innerHTML = '<div class="product-grid">' + list.map(function (p) {
      var managed = isManaged(p), avail = availableOf(p), out = managed && avail <= 0 && Offline.isOnline();
      var badge = managed ? '<span class="stock-badge' + (avail <= 0 ? ' out' : '') + '">' + (avail <= 0 ? 'Habis' : avail) + '</span>' : '';
      return '<div class="pcard' + (out ? ' disabled' : '') + '" data-add="' + p.product_id + '" role="button" tabindex="0">' + thumbHtml(p, badge) +
        '<div class="pbody"><div class="pname">' + Utils.escapeHtml(p.product_name) + '</div><div class="pprice">' + Utils.formatCurrency(p.selling_price) + '</div>' +
        '<div class="pmeta">' + Utils.escapeHtml(catName[p.category_id] || '') + '</div><button type="button" class="btn"' + (out ? ' disabled' : '') + '>' + (out ? 'Habis' : 'Tambah') + '</button></div></div>';
    }).join('') + '</div>';
    Utils.qsa('[data-add]', box).forEach(function (card) {
      card.addEventListener('click', function () {
        var p = allProducts.filter(function (x) { return x.product_id === card.getAttribute('data-add'); })[0];
        if (!p) return;
        if (isManaged(p) && availableOf(p) <= 0) {
          if (Offline.isOnline()) return;
          Utils.toast('Stok tercatat habis. Mode offline: tetap dicatat, stok menjadi negatif.', 'info');
        }
        addToCart(p);
      });
    });
  }

  function updateCartBar() {
    var bar = document.getElementById('pos-cartbar'); if (!bar) return;
    var I = (window.Layout && window.Layout.ICONS) || {}, count = itemCount();
    bar.classList.toggle('empty', count === 0);
    bar.innerHTML = '<span class="cb-left"><span class="cb-ic">' + (I.cart || '') + (count ? '<span class="cb-count">' + count + '</span>' : '') + '</span>' +
      '<span><div class="cb-label">' + (count ? count + ' barang di keranjang' : 'Keranjang kosong') + '</div><div class="cb-total">' + Utils.formatCurrency(grandTotal()) + '</div></span></span>' +
      '<span class="cb-go">' + (count ? 'Lihat &rarr;' : '') + '</span>';
  }

  function openCartModal() {
    if (cart.length === 0) { Utils.toast('Keranjang masih kosong. Ketuk produk untuk menambah.', 'info'); return; }
    var m = Utils.openModal(
      '<h3>Keranjang</h3>' +
      '<div class="field"><label>Pelanggan' + (rule !== 'OFF' ? ' <span class="muted" style="font-weight:400;">(menentukan harga grosir)</span>' : '') + '</label><select id="pos-customer"><option value="">Umum (tanpa pelanggan)</option>' +
      customers.map(function (c) { return '<option value="' + c.customer_id + '"' + (c.customer_id === customerId ? ' selected' : '') + '>' + Utils.escapeHtml(c.name) + (String(c.type).toUpperCase() === 'GROSIR' ? ' \u00B7 Grosir' : '') + '</option>'; }).join('') + '</select></div>' +
      '<div id="pos-cart"></div>' +
      '<div class="field" style="margin:10px 0 8px;"><label>Diskon Transaksi (Rp)</label><input id="pos-discount" type="number" inputmode="numeric" value="' + (orderDiscount || 0) + '" min="0"></div>' +
      '<div class="row"><span class="muted">Total</span><strong id="pos-total" style="color:var(--red);font-size:1.3rem;"></strong></div>' +
      '<div class="field-row" style="margin-top:12px;"><button class="btn btn-outline btn-block" id="pos-more" type="button">Tambah Barang</button><button class="btn btn-primary btn-block" id="pos-pay" type="button">Bayar</button></div>');
    m.querySelector('#pos-customer').addEventListener('change', function (e) { customerId = e.target.value; repriceCart(); renderCart(); });
    m.querySelector('#pos-discount').addEventListener('input', function (e) { orderDiscount = Math.max(0, Number(e.target.value) || 0); renderCart(); });
    m.querySelector('#pos-more').addEventListener('click', function () { Utils.closeModal(); });
    m.querySelector('#pos-pay').addEventListener('click', function () { if (cart.length === 0) { Utils.toast('Keranjang masih kosong.', 'error'); return; } Utils.closeModal(); openPaymentModal(); });
    renderCart();
  }

  function openCameraScan() {
    var m = Utils.openModal('<h3>Scan Barcode</h3><div id="scan-area" style="width:100%;min-height:220px;"></div><p class="hint">Arahkan kamera ke barcode produk. Bila kamera tidak bisa dibuka, ketik barcode di kolom pencarian.</p><button class="btn btn-outline btn-block" id="scan-cancel">Batal</button>');
    var scannerRef = null;
    window.BarcodeTools.startCameraScan('scan-area', function (text) {
      var exact = allProducts.filter(function (p) { return p.barcode === text || p.sku === text; })[0];   // lokal: bekerja offline
      if (scannerRef) scannerRef.stop(); Utils.closeModal();
      if (!exact) { Utils.toast('Barcode "' + text + '" tidak ditemukan di produk.', 'error'); return; }
      addToCart(exact); Utils.toast(exact.product_name + ' ditambahkan.', 'success');
    }, function (err) { Utils.toast('Kamera tidak dapat diakses: ' + err.message, 'error'); }).then(function (s) { scannerRef = s; }).catch(function () {});
    m.querySelector('#scan-cancel').addEventListener('click', function () { if (scannerRef) scannerRef.stop(); Utils.closeModal(); });
  }

  function renderCart() {
    updateCartBar();
    var box = document.getElementById('pos-cart');
    if (box) {
      if (cart.length === 0) box.innerHTML = '<div class="empty-state">Keranjang masih kosong.</div>';
      else {
        box.innerHTML = cart.map(function (l, idx) {
          var unitSelect = l.availableUnits.length > 1
            ? '<select data-unit-switch="' + idx + '" style="margin-top:4px;font-size:0.78rem;padding:3px 6px;">' + l.availableUnits.map(function (u) { return '<option value="' + u.unit_id + '"' + (u.unit_id === l.unit_id ? ' selected' : '') + '>' + Utils.escapeHtml(u.unit_name) + '</option>'; }).join('') + '</select>' : '';
          return '<div class="cart-item"><div style="flex:1;min-width:0;"><div style="font-weight:600;">' + Utils.escapeHtml(l.product_name) + '</div>' +
            '<div class="muted">' + Utils.formatCurrency(l.unit_price) + ' / ' + Utils.escapeHtml(l.unit_name) + (l.wholesale ? ' <span class="badge green">Grosir</span>' : '') + '</div>' + unitSelect +
            '<div class="muted" style="margin-top:2px;">Subtotal: <strong style="color:var(--ink);">' + Utils.formatCurrency(l.qty * l.unit_price) + '</strong></div></div>' +
            '<div class="qty-control"><button data-dec="' + idx + '">-</button><span>' + l.qty + '</span><button data-inc="' + idx + '">+</button></div><button class="btn btn-ghost btn-sm" data-remove="' + idx + '">Hapus</button></div>';
        }).join('');
        Utils.qsa('[data-inc]', box).forEach(function (b) { b.addEventListener('click', function () { var l = cart[+b.getAttribute('data-inc')]; if (!l) return; l.qty++; priceLine(l); renderCart(); }); });
        Utils.qsa('[data-dec]', box).forEach(function (b) { b.addEventListener('click', function () { var idx = +b.getAttribute('data-dec'), l = cart[idx]; if (!l) return; l.qty--; if (l.qty <= 0) cart.splice(idx, 1); else priceLine(l); renderCart(); }); });
        Utils.qsa('[data-remove]', box).forEach(function (b) { b.addEventListener('click', function () { var idx = +b.getAttribute('data-remove'); if (!cart[idx]) return; cart.splice(idx, 1); renderCart(); }); });
        Utils.qsa('[data-unit-switch]', box).forEach(function (sel) {
          sel.addEventListener('change', function () {
            var l = cart[+sel.getAttribute('data-unit-switch')]; if (!l) return;
            var u = l.availableUnits.filter(function (x) { return x.unit_id === sel.value; })[0]; if (!u) return;
            l.unit = u; l.unit_id = u.unit_id; l.unit_name = u.unit_name; l.conversion_to_base = u.conversion_to_base; priceLine(l); renderCart();
          });
        });
      }
    }
    var totalEl = document.getElementById('pos-total'); if (totalEl) totalEl.textContent = Utils.formatCurrency(grandTotal());
  }

  function openPaymentModal() {
    if (cart.length === 0) { Utils.toast('Keranjang masih kosong.', 'error'); return; }
    var discount = orderDiscount, total = subtotal() - discount;
    var m = Utils.openModal(
      '<h3>Pembayaran</h3>' + (Offline.isOnline() ? '' : '<div class="hint" style="color:var(--warning);font-weight:700;">Mode offline: transaksi disimpan di perangkat dan dikirim saat online.</div>') +
      '<div class="row"><span>Total Tagihan</span><strong style="font-size:1.3rem;">' + Utils.formatCurrency(total) + '</strong></div>' +
      '<div class="field" style="margin-top:14px;"><label>Metode</label><select id="pay-method"><option value="CASH">Tunai</option><option value="QRIS">QRIS</option><option value="TRANSFER">Transfer</option><option value="HUTANG">Hutang</option></select></div>' +
      '<div class="field" id="pay-cash-field"><label>Uang Diterima</label><input id="pay-received" type="number" min="0" inputmode="numeric"></div>' +
      '<div class="row" id="pay-change-row"><span>Kembalian</span><strong id="pay-change">Rp 0</strong></div>' +
      '<div class="field" id="pay-customer-field" style="display:none;"><label>Pelanggan (wajib untuk Hutang)</label><select id="pay-customer"><option value="">Pilih pelanggan</option>' + customers.map(function (c) { return '<option value="' + c.customer_id + '"' + (c.customer_id === customerId ? ' selected' : '') + '>' + Utils.escapeHtml(c.name) + '</option>'; }).join('') + '</select></div>' +
      '<div id="pay-qris-preview"></div>' +
      '<a href="#" id="pay-split-toggle" style="display:block;margin:8px 0;font-size:0.85rem;">+ Split pembayaran (Tunai + QRIS, dsb)</a>' +
      '<div id="pay-split-area" style="display:none;"><div class="field-row"><div class="field"><label>Metode ke-2</label><select id="pay-method-2"><option value="CASH">Tunai</option><option value="QRIS" selected>QRIS</option><option value="TRANSFER">Transfer</option></select></div>' +
      '<div class="field"><label>Nominal</label><input id="pay-amount-2" type="number" min="0"></div></div><p class="hint">Nominal Metode 1 dihitung otomatis = Total - Nominal Metode 2.</p></div>' +
      '<button class="btn btn-primary btn-block" id="pay-submit" style="margin-top:14px;">Selesaikan Transaksi</button>');
    var methodSel = m.querySelector('#pay-method'), receivedInput = m.querySelector('#pay-received'), splitToggle = m.querySelector('#pay-split-toggle'), splitArea = m.querySelector('#pay-split-area'), splitOn = false;
    splitToggle.addEventListener('click', function (e) { e.preventDefault(); splitOn = !splitOn; splitArea.style.display = splitOn ? 'block' : 'none'; splitToggle.textContent = splitOn ? '- Batalkan split pembayaran' : '+ Split pembayaran (Tunai + QRIS, dsb)'; if (splitOn) { methodSel.value = 'CASH'; updateChange(); } });
    function updateChange() {
      var method = methodSel.value, isHutang = method === 'HUTANG';
      splitToggle.style.display = isHutang ? 'none' : 'block';
      if (isHutang && splitOn) { splitOn = false; splitArea.style.display = 'none'; }
      m.querySelector('#pay-cash-field').style.display = (method === 'CASH' && !splitOn) ? 'block' : 'none';
      m.querySelector('#pay-change-row').style.display = (method === 'CASH' && !splitOn) ? 'flex' : 'none';
      m.querySelector('#pay-customer-field').style.display = isHutang ? 'block' : 'none';
      m.querySelector('#pay-change').textContent = Utils.formatCurrency(Math.max(0, Number(receivedInput.value || 0) - total));
      if (method === 'QRIS' && !splitOn && Offline.isOnline()) {
        Api.call('public.qrisInfo', {}).then(function (q) { m.querySelector('#pay-qris-preview').innerHTML = '<img src="' + q.qris_image_url + '" style="max-width:180px;display:block;margin:10px auto;">'; }).catch(function () {});
      } else m.querySelector('#pay-qris-preview').innerHTML = '';
    }
    methodSel.addEventListener('change', updateChange); receivedInput.addEventListener('input', updateChange); updateChange();

    m.querySelector('#pay-submit').addEventListener('click', function () {
      var method = methodSel.value, cid = customerId || '';
      if (method === 'HUTANG') { cid = m.querySelector('#pay-customer').value || customerId; if (!cid) { Utils.toast('Pilih pelanggan untuk transaksi Hutang.', 'error'); return; } }
      var payments;
      if (splitOn && method !== 'HUTANG') {
        var method2 = m.querySelector('#pay-method-2').value, amount2 = Number(m.querySelector('#pay-amount-2').value || 0);
        if (amount2 <= 0 || amount2 >= total) { Utils.toast('Nominal metode ke-2 harus lebih dari 0 dan kurang dari total.', 'error'); return; }
        payments = [{ method: method, amount: total - amount2 }, { method: method2, amount: amount2 }];
      } else if (method === 'CASH') {
        var received = Number(receivedInput.value || 0);
        if (received < total) { Utils.toast('Uang diterima kurang dari total.', 'error'); return; }
        payments = [{ method: 'CASH', amount: total, received: received }];
      } else payments = [{ method: method, amount: total }];
      if (method === 'QRIS' || (splitOn && payments.some(function (pe) { return pe.method === 'QRIS'; }))) { if (!confirm('Pastikan pembayaran QRIS sudah benar-benar diterima (cek notifikasi/mutasi) sebelum konfirmasi. Lanjutkan?')) return; }
      var btn = m.querySelector('#pay-submit'); btn.disabled = true; btn.textContent = 'Memproses...';
      var snapCart = cart.map(function (l) { return { product_id: l.product_id, product_name: l.product_name, unit_id: l.unit_id, unit_name: l.unit_name, conversion_to_base: l.conversion_to_base, unit_price: l.unit_price, qty: l.qty, discount: l.discount }; });
      var base = { items: cart.map(function (l) { return { product_id: l.product_id, qty: l.qty, discount: l.discount, unit_id: l.unit_id }; }), discount: discount, payments: payments, customer_id: cid || undefined, idempotency_key: 'sale_' + Date.now() + '_' + Math.random().toString(36).slice(2) };
      var cname = custName();
      function finished(isQueued, result, item) {
        Utils.closeModal(); cart = []; orderDiscount = 0; customerId = ''; updateCartBar();
        if (window.Notify) { Notify.playEvent('SALE_DONE'); if (result && result.sale_number) Notify.rememberSale(result.sale_number); }
        if (isQueued) { Offline.decrementLocal(snapCart); showLocalReceipt(item); renderGrid(); }
        else { if (window.Offline) Api.call('notify.flush', {}).catch(function () {}); showReceipt(result.sale_id); }
      }
      function queue() { return Offline.enqueue(base, snapCart, cname).then(function (item) { finished(true, null, item); }); }
      if (!Offline.isOnline()) { queue(); return; }
      Api.call('pos.createSale', base).then(function (result) { finished(false, result); }).catch(function (err) {
        if (err && (err.code === 'NETWORK_ERROR' || err.code === 'TIMEOUT')) { Utils.toast('Koneksi terputus. Transaksi disimpan di perangkat dan dikirim otomatis.', 'info'); queue(); return; }
        Utils.toast(err.message, 'error'); btn.disabled = false; btn.textContent = 'Selesaikan Transaksi';
      });
    });
  }

  function receiptModal(data, title, note) {
    var m = Utils.openModal(
      '<h3>' + title + '</h3>' + (note ? '<div class="hint" style="color:var(--warning);font-weight:700;">' + note + '</div>' : '') +
      '<div class="receipt-preview">' + Utils.escapeHtml((window.ReceiptBuilder.buildPreviewLines || window.ReceiptBuilder.buildTextLines)(data).join('\n')) + '</div>' +
      '<div class="field-row" style="margin-top:14px;"><button class="btn btn-outline btn-block" id="btn-preview">Pratinjau</button><button class="btn btn-secondary btn-block" id="btn-print">Cetak Struk</button></div>' +
      '<button class="btn btn-outline btn-block" id="btn-close" style="margin-top:8px;">Transaksi Baru</button>');
    m.querySelector('#btn-preview').addEventListener('click', function () {
      var mm = window.PrinterBrowserAdapter.getPaperWidth();
      var html = '<html><head><meta charset="utf-8">' + window.PrinterBrowserAdapter.styleFor(mm) + '</head><body>' + window.ReceiptBuilder.buildHtml(data) + '</body></html>';
      var pm = Utils.openModal('<h3>Pratinjau Struk</h3><div style="display:flex;justify-content:center;background:#ddd;padding:14px;border-radius:8px;"><iframe id="pos-preview-frame" style="border:none;width:240px;height:440px;background:#fff;box-shadow:0 1px 4px rgba(0,0,0,0.2);"></iframe></div><button class="btn btn-outline btn-block" id="btn-preview-close" style="margin-top:14px;">Tutup</button>');
      pm.querySelector('#pos-preview-frame').srcdoc = html; pm.querySelector('#btn-preview-close').addEventListener('click', function () { pm.remove(); });
    });
    m.querySelector('#btn-print').addEventListener('click', function () { window.PrinterManager.printWithUI(m.querySelector('#btn-print'), data); });
    m.querySelector('#btn-close').addEventListener('click', function () { Utils.closeModal(); Router.render(); });
  }
  function showReceipt(saleId) {
    Api.call('pos.reprintReceipt', { sale_id: saleId }).then(function (data) { receiptModal(data, 'Transaksi Berhasil'); }).catch(function (err) { Utils.toast('Transaksi tersimpan, tetapi struk gagal dimuat: ' + err.message + '. Buka Riwayat untuk cetak ulang.', 'error'); Router.render(); });
  }
  function showLocalReceipt(item) { receiptModal(item.receipt, 'Transaksi Tersimpan (Offline)', 'Disimpan di perangkat ini. Nomor ' + Utils.escapeHtml(item.local_number) + ' diganti nomor resmi setelah terkirim.'); }

  return { render: render };
})();
