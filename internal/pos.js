/**
 * internal/pos.js - Kasir (POS) V3.
 * Alur: pilih kategori / cari / scan -> ketuk produk (masuk keranjang) -> bar keranjang di bawah ->
 * keranjang (atur qty & satuan, diskon) -> bayar (Tunai/QRIS/Transfer/Hutang) -> struk (Pratinjau / Cetak).
 * Produk TANPA manajemen stok selalu bisa dijual. Produk yang dilacak stoknya & habis ditandai "Habis".
 */
window.Modules = window.Modules || {};
Modules.pos = (function () {
  var CAMERA_ICON = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z"/><circle cx="12" cy="13" r="3.4"/></svg>';
  var cart = []; // {product_id, product_name, unit_id, unit_name, unit_price, qty, discount, availableUnits}
  var customersCache = null;
  var allProducts = [], categories = [], activeCat = '', searchQ = '';
  var orderDiscount = 0;
  var unitsCache = {}; // product_id -> daftar satuan (hindari panggilan server tiap ketukan)

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

  function findLine(productId, unitId) { return cart.filter(function (l) { return l.product_id === productId && l.unit_id === unitId; })[0]; }

  function loadUnits(productId) {
    if (unitsCache[productId]) return Promise.resolve(unitsCache[productId]);
    return Api.call('productUnit.list', { product_id: productId }).then(function (d) {
      unitsCache[productId] = d.product_units; return d.product_units;
    });
  }

  function addToCart(p) {
    return loadUnits(p.product_id).then(function (units) {
      var base = units.filter(function (u) { return String(u.is_base) === 'true' || u.is_base === true; })[0] || units[0];
      if (!base) { Utils.toast('Produk ini belum punya satuan terdaftar.', 'error'); return; }
      var line = findLine(p.product_id, base.unit_id);
      if (line) { line.qty += 1; } else {
        cart.push({
          product_id: p.product_id, product_name: p.product_name, unit_id: base.unit_id, unit_name: base.unit_name,
          unit_price: base.selling_price ? Number(base.selling_price) : Number(p.selling_price),
          qty: 1, discount: 0, availableUnits: units
        });
      }
      renderCart();
    }).catch(function (err) { Utils.toast(err.message, 'error'); });
  }
  function subtotal() { return cart.reduce(function (s, l) { return s + l.qty * l.unit_price - l.discount; }, 0); }
  function grandTotal() { return Math.max(0, subtotal() - orderDiscount); }
  function itemCount() { return cart.reduce(function (s, l) { return s + l.qty; }, 0); }

  function render(container) {
    var I = (window.Layout && window.Layout.ICONS) || {};
    container.innerHTML =
      '<h1 class="page-title">Kasir</h1>' +
      '<div class="search-box"><input id="pos-search" type="search" placeholder="Cari produk, SKU, atau scan barcode" autocomplete="off">' +
      '<button class="btn btn-secondary" id="pos-scan" title="Scan barcode via kamera" aria-label="Scan barcode">' + CAMERA_ICON + '</button></div>' +
      '<div class="cat-row" id="pos-cats"></div>' +
      '<div id="pos-grid"><div class="spinner"></div></div>' +
      '<button class="cart-bar empty" id="pos-cartbar" type="button"></button>';

    document.getElementById('pos-scan').addEventListener('click', openCameraScan);
    document.getElementById('pos-cartbar').addEventListener('click', openCartModal);
    var searchInput = document.getElementById('pos-search');
    searchInput.addEventListener('input', Utils.debounce(function () { searchQ = searchInput.value.trim(); renderGrid(); }, 160));
    // Pemindai barcode fisik mengetik angka lalu Enter: cocok persis -> langsung masuk keranjang.
    searchInput.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter') return;
      var q = searchInput.value.trim();
      if (!q) return;
      var exact = allProducts.filter(function (p) { return String(p.barcode) === q || String(p.sku).toLowerCase() === q.toLowerCase(); })[0];
      if (exact) { e.preventDefault(); addToCart(exact); searchInput.value = ''; searchQ = ''; renderGrid(); }
    });

    updateCartBar();
    return Promise.all([Api.call('category.list', {}), Api.call('product.list', { activeOnly: true })]).then(function (r) {
      if (!container.isConnected) return;
      categories = r[0].categories || []; allProducts = r[1].products || [];
      if (activeCat && !categories.some(function (c) { return c.category_id === activeCat; })) activeCat = '';
      renderCats(); renderGrid();
    });
  }

  function renderCats() {
    var box = document.getElementById('pos-cats');
    if (!box) return;
    var used = {};
    allProducts.forEach(function (p) { used[p.category_id] = true; });
    var list = categories.filter(function (c) { return used[c.category_id] && (String(c.active) !== 'false' && c.active !== false); })
      .map(function (c) { var r = catRule(c.category_name); return { c: c, r: r }; })
      .sort(function (a, b) { return a.r.idx - b.r.idx || String(a.c.category_name).localeCompare(String(b.c.category_name)); });
    box.innerHTML =
      '<button class="cat-item' + (activeCat === '' ? ' active' : '') + '" data-cat=""><span class="cat-ic">' + CAT_ICONS.all + '</span><span class="cat-name">Semua</span></button>' +
      list.map(function (x) {
        return '<button class="cat-item' + (activeCat === x.c.category_id ? ' active' : '') + '" data-cat="' + x.c.category_id + '"><span class="cat-ic">' + CAT_ICONS[x.r.key] + '</span><span class="cat-name">' + Utils.escapeHtml(x.c.category_name) + '</span></button>';
      }).join('');
    Utils.qsa('[data-cat]', box).forEach(function (b) {
      b.addEventListener('click', function () { activeCat = b.getAttribute('data-cat'); renderCats(); renderGrid(); });
    });
  }

  function renderGrid() {
    var box = document.getElementById('pos-grid');
    if (!box) return;
    var q = searchQ.toLowerCase();
    var catName = {}; categories.forEach(function (c) { catName[c.category_id] = c.category_name; });
    var list = allProducts.filter(function (p) {
      if (activeCat && p.category_id !== activeCat) return false;
      if (!q) return true;
      return String(p.product_name).toLowerCase().indexOf(q) !== -1 || String(p.sku).toLowerCase().indexOf(q) !== -1 || String(p.barcode).indexOf(searchQ) !== -1;
    });
    if (allProducts.length === 0) {
      box.innerHTML = '<div class="empty-state"><img src="assets/icons/tokoqia-empty-state.png" alt=""><div class="empty-title">Belum ada produk</div><div class="empty-sub">Tambahkan produk dulu di menu Produk.</div><a class="btn btn-primary" href="#/internal/products">Ke Produk</a></div>';
      return;
    }
    if (list.length === 0) { box.innerHTML = '<div class="empty-state"><div class="empty-title">Produk tidak ditemukan</div><div class="empty-sub">Coba kata kunci atau kategori lain.</div></div>'; return; }
    box.innerHTML = '<div class="product-grid">' + list.map(function (p) {
      var managed = isManaged(p), avail = availableOf(p), out = managed && avail <= 0;
      var badge = managed ? '<span class="stock-badge' + (out ? ' out' : '') + '">' + (out ? 'Habis' : avail) + '</span>' : '';
      return '<div class="pcard' + (out ? ' disabled' : '') + '" data-add="' + p.product_id + '" role="button" tabindex="0">' +
        '<div class="thumb" style="background:' + hashColor(p.category_id) + ';">' + Utils.escapeHtml(initials(p.product_name)) + badge + '</div>' +
        '<div class="pbody"><div class="pname">' + Utils.escapeHtml(p.product_name) + '</div>' +
        '<div class="pprice">' + Utils.formatCurrency(p.selling_price) + '</div>' +
        '<div class="pmeta">' + Utils.escapeHtml(catName[p.category_id] || '') + '</div>' +
        '<button type="button" class="btn"' + (out ? ' disabled' : '') + '>' + (out ? 'Habis' : 'Tambah') + '</button></div></div>';
    }).join('') + '</div>';
    Utils.qsa('[data-add]', box).forEach(function (card) {
      card.addEventListener('click', function () {
        var p = allProducts.filter(function (x) { return x.product_id === card.getAttribute('data-add'); })[0];
        if (!p || (isManaged(p) && availableOf(p) <= 0)) return;
        addToCart(p);
      });
    });
  }

  function updateCartBar() {
    var bar = document.getElementById('pos-cartbar');
    if (!bar) return;
    var I = (window.Layout && window.Layout.ICONS) || {};
    var count = itemCount();
    bar.classList.toggle('empty', count === 0);
    bar.innerHTML = '<span class="cb-left"><span class="cb-ic">' + (I.cart || '') + (count ? '<span class="cb-count">' + count + '</span>' : '') + '</span>' +
      '<span><div class="cb-label">' + (count ? count + ' barang di keranjang' : 'Keranjang kosong') + '</div><div class="cb-total">' + Utils.formatCurrency(grandTotal()) + '</div></span></span>' +
      '<span class="cb-go">' + (count ? 'Lihat &rarr;' : '') + '</span>';
  }

  function openCartModal() {
    if (cart.length === 0) { Utils.toast('Keranjang masih kosong. Ketuk produk untuk menambah.', 'info'); return; }
    var m = Utils.openModal(
      '<h3>Keranjang</h3>' +
      '<div id="pos-cart"></div>' +
      '<div class="field" style="margin:10px 0 8px;"><label>Diskon Transaksi (Rp)</label><input id="pos-discount" type="number" inputmode="numeric" value="' + (orderDiscount || 0) + '" min="0"></div>' +
      '<div class="row"><span class="muted">Total</span><strong id="pos-total" style="color:var(--red);font-size:1.3rem;"></strong></div>' +
      '<div class="field-row" style="margin-top:12px;">' +
      '<button class="btn btn-outline btn-block" id="pos-more" type="button">Tambah Barang</button>' +
      '<button class="btn btn-primary btn-block" id="pos-pay" type="button">Bayar</button></div>'
    );
    m.querySelector('#pos-discount').addEventListener('input', function (e) { orderDiscount = Math.max(0, Number(e.target.value) || 0); renderCart(); });
    m.querySelector('#pos-more').addEventListener('click', function () { Utils.closeModal(); });
    m.querySelector('#pos-pay').addEventListener('click', function () {
      if (cart.length === 0) { Utils.toast('Keranjang masih kosong.', 'error'); return; }
      Utils.closeModal(); openPaymentModal();
    });
    renderCart();
  }

  function openCameraScan() {
    var m = Utils.openModal('<h3>Scan Barcode</h3><div id="scan-area" style="width:100%;min-height:220px;"></div><p class="hint">Arahkan kamera ke barcode produk. Jika kamera tidak bisa dibuka, gunakan pencarian manual.</p><button class="btn btn-outline btn-block" id="scan-cancel">Batal</button>');
    var scannerRef = null;
    window.BarcodeTools.startCameraScan('scan-area', function (text) {
      Api.call('product.list', { search: text }).then(function (d) {
        var exact = d.products.filter(function (p) { return p.barcode === text || p.sku === text; })[0] || d.products[0];
        Utils.closeModal();
        if (!exact) { Utils.toast('Barcode "' + text + '" tidak ditemukan di produk.', 'error'); return; }
        addToCart(exact);
        Utils.toast(exact.product_name + ' ditambahkan.', 'success');
      });
    }, function (err) {
      Utils.toast('Kamera tidak dapat diakses: ' + err.message, 'error');
    }).then(function (s) { scannerRef = s; }).catch(function () {});
    m.querySelector('#scan-cancel').addEventListener('click', function () {
      if (scannerRef) scannerRef.stop();
      Utils.closeModal();
    });
  }

  function renderCart() {
    updateCartBar();
    var box = document.getElementById('pos-cart');
    if (!box) return;
    if (cart.length === 0) { box.innerHTML = '<div class="empty-state">Keranjang masih kosong.</div>'; }
    else {
      box.innerHTML = cart.map(function (l, idx) {
        var unitSelect = l.availableUnits.length > 1
          ? '<select data-unit-switch="' + idx + '" style="margin-top:4px;font-size:0.78rem;padding:3px 6px;">' +
            l.availableUnits.map(function (u) { return '<option value="' + u.unit_id + '"' + (u.unit_id === l.unit_id ? ' selected' : '') + '>' + Utils.escapeHtml(u.unit_name) + '</option>'; }).join('') + '</select>'
          : '';  // satu satuan saja: nama satuan sudah tampil di baris harga
        return '<div class="cart-item"><div style="flex:1;"><div style="font-weight:600;">' + Utils.escapeHtml(l.product_name) + '</div>' +
          '<div class="muted">' + Utils.formatCurrency(l.unit_price) + ' / ' + Utils.escapeHtml(l.unit_name) + '</div>' + unitSelect +
          '<div class="muted" style="margin-top:2px;">Subtotal: <strong style="color:var(--ink);">' + Utils.formatCurrency(l.qty * l.unit_price) + '</strong></div></div>' +
          '<div class="qty-control"><button data-dec="' + idx + '">-</button><span>' + l.qty + '</span><button data-inc="' + idx + '">+</button></div>' +
          '<button class="btn btn-ghost btn-sm" data-remove="' + idx + '">Hapus</button></div>';
      }).join('');
      // Setiap handler dijaga (cart[idx] dicek dulu) - kalau tombol lama sempat ter-klik SETELAH
      // keranjang berubah/direset (mis. sehabis transaksi berhasil), tidak menyebabkan error
      // "Cannot read properties of undefined", cukup diabaikan dengan aman.
      Utils.qsa('[data-inc]', box).forEach(function (b) {
        b.addEventListener('click', function () {
          var l = cart[+b.getAttribute('data-inc')];
          if (!l) return;
          l.qty++; renderCart();
        });
      });
      Utils.qsa('[data-dec]', box).forEach(function (b) {
        b.addEventListener('click', function () {
          var idx = +b.getAttribute('data-dec');
          var l = cart[idx];
          if (!l) return;
          l.qty--; if (l.qty <= 0) cart.splice(idx, 1);
          renderCart();
        });
      });
      Utils.qsa('[data-remove]', box).forEach(function (b) {
        b.addEventListener('click', function () {
          var idx = +b.getAttribute('data-remove');
          if (!cart[idx]) return;
          cart.splice(idx, 1); renderCart();
        });
      });
      Utils.qsa('[data-unit-switch]', box).forEach(function (sel) {
        sel.addEventListener('change', function () {
          var idx = +sel.getAttribute('data-unit-switch');
          var l = cart[idx];
          if (!l) return;
          var u = l.availableUnits.filter(function (x) { return x.unit_id === sel.value; })[0];
          if (!u) return;
          l.unit_id = u.unit_id; l.unit_name = u.unit_name;
          l.unit_price = u.selling_price ? Number(u.selling_price) : Number(l.unit_price);
          renderCart();
        });
      });
    }
    var totalEl = document.getElementById('pos-total');
    if (totalEl) totalEl.textContent = Utils.formatCurrency(grandTotal());
  }

  function openPaymentModal() {
    if (cart.length === 0) { Utils.toast('Keranjang masih kosong.', 'error'); return; }
    var discount = orderDiscount;
    var total = subtotal() - discount;
    var m = Utils.openModal(
      '<h3>Pembayaran</h3>' +
      '<div class="row"><span>Total Tagihan</span><strong style="font-size:1.3rem;">' + Utils.formatCurrency(total) + '</strong></div>' +
      '<div class="field" style="margin-top:14px;"><label>Metode</label><select id="pay-method"><option value="CASH">Tunai</option><option value="QRIS">QRIS</option><option value="TRANSFER">Transfer</option><option value="HUTANG">Hutang (Piutang Pelanggan)</option></select></div>' +
      '<div class="field" id="pay-cash-field"><label>Uang Diterima</label><input id="pay-received" type="number" min="0"></div>' +
      '<div class="row" id="pay-change-row"><span>Kembalian</span><strong id="pay-change">Rp 0</strong></div>' +
      '<div class="field" id="pay-customer-field" style="display:none;"><label>Pelanggan (wajib untuk Hutang)</label><select id="pay-customer"></select></div>' +
      '<div id="pay-qris-preview"></div>' +
      '<a href="#" id="pay-split-toggle" style="display:block;margin:8px 0;font-size:0.85rem;">+ Split pembayaran (Tunai + QRIS, dsb)</a>' +
      '<div id="pay-split-area" style="display:none;">' +
      '<div class="field-row"><div class="field"><label>Metode ke-2</label><select id="pay-method-2"><option value="CASH">Tunai</option><option value="QRIS">QRIS</option><option value="TRANSFER">Transfer</option></select></div>' +
      '<div class="field"><label>Nominal</label><input id="pay-amount-2" type="number" min="0"></div></div>' +
      '<p class="hint">Nominal Metode 1 akan dihitung otomatis = Total - Nominal Metode 2.</p>' +
      '</div>' +
      '<button class="btn btn-primary btn-block" id="pay-submit" style="margin-top:14px;">Selesaikan Transaksi</button>'
    );
    var methodSel = m.querySelector('#pay-method');
    var receivedInput = m.querySelector('#pay-received');
    var splitToggle = m.querySelector('#pay-split-toggle');
    var splitArea = m.querySelector('#pay-split-area');
    var splitOn = false;
    splitToggle.addEventListener('click', function (e) {
      e.preventDefault();
      splitOn = !splitOn;
      splitArea.style.display = splitOn ? 'block' : 'none';
      splitToggle.textContent = splitOn ? '- Batalkan split pembayaran' : '+ Split pembayaran (Tunai + QRIS, dsb)';
      if (splitOn) { methodSel.value = 'CASH'; updateChange(); }
    });
    function updateChange() {
      var method = methodSel.value;
      var isHutang = method === 'HUTANG';
      splitToggle.style.display = isHutang ? 'none' : 'block';
      if (isHutang && splitOn) { splitOn = false; splitArea.style.display = 'none'; }
      m.querySelector('#pay-cash-field').style.display = (method === 'CASH' && !splitOn) ? 'block' : 'none';
      m.querySelector('#pay-change-row').style.display = (method === 'CASH' && !splitOn) ? 'flex' : 'none';
      m.querySelector('#pay-customer-field').style.display = isHutang ? 'block' : 'none';
      var received = Number(receivedInput.value || 0);
      m.querySelector('#pay-change').textContent = Utils.formatCurrency(Math.max(0, received - total));
      if (isHutang && !customersCache) {
        Api.call('customer.list', {}).then(function (d) {
          customersCache = d.customers;
          m.querySelector('#pay-customer').innerHTML = d.customers.map(function (c) { return '<option value="' + c.customer_id + '">' + Utils.escapeHtml(c.name) + '</option>'; }).join('');
        });
      }
      if (method === 'QRIS' && !splitOn) {
        Api.call('public.qrisInfo', {}).then(function (q) {
          m.querySelector('#pay-qris-preview').innerHTML = '<img src="' + q.qris_image_url + '" style="max-width:180px;display:block;margin:10px auto;">';
        }).catch(function () {});
      } else {
        m.querySelector('#pay-qris-preview').innerHTML = '';
      }
    }
    methodSel.addEventListener('change', updateChange);
    receivedInput.addEventListener('input', updateChange);
    updateChange();

    m.querySelector('#pay-submit').addEventListener('click', function () {
      var method = methodSel.value;
      var customerId = method === 'HUTANG' ? m.querySelector('#pay-customer').value : undefined;
      if (method === 'HUTANG' && !customerId) { Utils.toast('Pilih pelanggan untuk transaksi Hutang.', 'error'); return; }

      var payments;
      if (splitOn && method !== 'HUTANG') {
        var method2 = m.querySelector('#pay-method-2').value;
        var amount2 = Number(m.querySelector('#pay-amount-2').value || 0);
        if (amount2 <= 0 || amount2 >= total) { Utils.toast('Nominal metode ke-2 harus lebih dari 0 dan kurang dari total.', 'error'); return; }
        var amount1 = total - amount2;
        payments = [{ method: method, amount: amount1 }, { method: method2, amount: amount2 }];
      } else if (method === 'CASH') {
        var received = Number(receivedInput.value || 0);
        if (received < total) { Utils.toast('Uang diterima kurang dari total.', 'error'); return; }
        payments = [{ method: 'CASH', amount: total, received: received }];
      } else {
        payments = [{ method: method, amount: total }];
      }
      if (method === 'QRIS' || (splitOn && payments.some(function (pe) { return pe.method === 'QRIS'; }))) {
        if (!confirm('Pastikan pembayaran QRIS sudah benar-benar diterima (cek notifikasi/mutasi) sebelum konfirmasi. Lanjutkan?')) return;
      }
      var btn = m.querySelector('#pay-submit'); btn.disabled = true; btn.textContent = 'Memproses...';
      var idempotencyKey = 'sale_' + Date.now() + '_' + Math.random().toString(36).slice(2);
      Api.call('pos.createSale', {
        items: cart.map(function (l) { return { product_id: l.product_id, qty: l.qty, discount: l.discount, unit_id: l.unit_id }; }),
        discount: discount, payments: payments, customer_id: customerId, idempotency_key: idempotencyKey
      }).then(function (result) {
        Utils.closeModal();
        cart = []; orderDiscount = 0;
        showReceipt(result.sale_id);
      }).catch(function (err) {
        Utils.toast(err.message, 'error');
        btn.disabled = false; btn.textContent = 'Selesaikan Transaksi';
      });
    });
  }

  function showReceipt(saleId) {
    Api.call('pos.reprintReceipt', { sale_id: saleId }).then(function (data) {
      var m = Utils.openModal(
        '<h3>Transaksi Berhasil</h3>' +
        '<div class="receipt-preview">' + Utils.escapeHtml((window.ReceiptBuilder.buildPreviewLines || window.ReceiptBuilder.buildTextLines)(data).join('\n')) + '</div>' +
        '<div class="field-row" style="margin-top:14px;">' +
        '<button class="btn btn-outline btn-block" id="btn-preview">Pratinjau</button>' +
        '<button class="btn btn-secondary btn-block" id="btn-print">Cetak Struk</button>' +
        '</div>' +
        '<button class="btn btn-outline btn-block" id="btn-close" style="margin-top:8px;">Transaksi Baru</button>'
      );
      m.querySelector('#btn-preview').addEventListener('click', function () {
        // Pratinjau memakai data TRANSAKSI INI (bukan data contoh), sesuai Pengaturan Struk yang aktif.
        var mm = window.PrinterBrowserAdapter.getPaperWidth();
        var html = '<html><head><meta charset="utf-8">' + window.PrinterBrowserAdapter.styleFor(mm) +
          '</head><body>' + window.ReceiptBuilder.buildHtml(data) + '</body></html>';
        var pm = Utils.openModal(
          '<h3>Pratinjau Struk</h3>' +
          '<div style="display:flex;justify-content:center;background:#ddd;padding:14px;border-radius:8px;">' +
          '<iframe id="pos-preview-frame" style="border:none;width:240px;height:440px;background:#fff;box-shadow:0 1px 4px rgba(0,0,0,0.2);"></iframe>' +
          '</div>' +
          '<button class="btn btn-outline btn-block" id="btn-preview-close" style="margin-top:14px;">Tutup</button>'
        );
        pm.querySelector('#pos-preview-frame').srcdoc = html;
        pm.querySelector('#btn-preview-close').addEventListener('click', function () { pm.remove(); });
      });
      m.querySelector('#btn-print').addEventListener('click', function () {
        window.PrinterManager.printWithUI(m.querySelector('#btn-print'), data);
      });
      m.querySelector('#btn-close').addEventListener('click', function () { Utils.closeModal(); Router.render(); });
    });
  }

  return { render: render };
})();
