/**
 * internal/inventory.js - kelompok PERSEDIAAN, tiga halaman terpisah (render(container, mode)):
 *   'stok'   -> Stok: daftar stok produk + penyesuaian + riwayat pergerakan
 *   'opname' -> Stok Opname: daftar opname + hitung fisik langkah demi langkah
 *   'returns'-> Retur: retur pelanggan / retur ke supplier (form bertahap)
 */
window.Modules = window.Modules || {};
Modules.inventory = (function () {
  var stokTab = 'daftar', stokFilter = 'all', returTab = 'pelanggan';

  function render(container, mode) {
    if (mode === 'opname') return renderOpname(container);
    if (mode === 'returns') return renderReturns(container);
    return renderStok(container);
  }

  function isManaged(p) { return !(p.manage_stock === false || String(p.manage_stock).toLowerCase() === 'false'); }
  function num(v) { return Number(v) || 0; }
  function loadProducts() { return Api.call('product.list', { activeOnly: true }).then(function (d) { return d.products || []; }); }
  function seg(items, cur, attr) {
    return '<div class="seg seg-full">' + items.map(function (i) { return '<button type="button" class="' + (cur === i[0] ? 'on' : '') + '" ' + attr + '="' + i[0] + '">' + i[1] + '</button>'; }).join('') + '</div>';
  }
  function head(title) { return '<h1 class="page-title">' + title + '</h1>'; }
  function lrow(name, sub, right, rightCls, attrs) {
    return '<div class="lrow" ' + (attrs || '') + '><div class="lr-main"><div class="lr-name">' + Utils.escapeHtml(name) + '</div><div class="lr-sub">' + sub + '</div></div><div class="lr-right ' + (rightCls || '') + '">' + right + '</div></div>';
  }

  /** Pemilih produk (cari nama / SKU / barcode) -> callback(produk). */
  function pickProduct(products, cb, title) {
    var m = Utils.openModal('<h3>' + (title || 'Pilih Produk') + '</h3><div class="search-box"><input id="pk-q" type="search" placeholder="Cari nama, SKU, atau barcode" autocomplete="off"></div><div id="pk-list" class="pk-list"></div>');
    var list = m.querySelector('#pk-list'), q = m.querySelector('#pk-q');
    function draw() {
      var s = q.value.trim().toLowerCase();
      var rows = products.filter(function (p) { return !s || String(p.product_name).toLowerCase().indexOf(s) !== -1 || String(p.sku).toLowerCase().indexOf(s) !== -1 || String(p.barcode).indexOf(s) !== -1; }).slice(0, 40);
      list.innerHTML = rows.length ? rows.map(function (p) { return lrow(p.product_name, Utils.escapeHtml(p.sku || ''), isManaged(p) ? 'Stok ' + num(p.current_stock) : '', '', 'data-pick="' + p.product_id + '"'); }).join('') : '<div class="empty-sub" style="padding:16px 0;">Produk tidak ditemukan.</div>';
      Utils.qsa('[data-pick]', list).forEach(function (r) { r.addEventListener('click', function () { var p = products.filter(function (x) { return x.product_id === r.getAttribute('data-pick'); })[0]; Utils.closeModal(); cb(p); }); });
    }
    q.addEventListener('input', Utils.debounce(draw, 120)); draw(); setTimeout(function () { q.focus(); }, 60);
  }

  // =============== STOK ===============
  function renderStok(container) {
    container.innerHTML = head('Stok') + seg([['daftar', 'Daftar Stok'], ['riwayat', 'Riwayat']], stokTab, 'data-st') + '<div id="inv-body" style="margin-top:12px;"><div class="spinner"></div></div>';
    Utils.qsa('[data-st]', container).forEach(function (b) { b.addEventListener('click', function () { stokTab = b.getAttribute('data-st'); renderStok(container); }); });
    var body = container.querySelector('#inv-body');
    return (stokTab === 'riwayat' ? stokRiwayat(body) : stokDaftar(body, container));
  }

  function stokDaftar(body, container) {
    return loadProducts().then(function (products) {
      var q = '';
      body.innerHTML = '<div class="search-box"><input id="st-q" type="search" placeholder="Cari produk atau SKU" autocomplete="off"></div>' +
        seg([['all', 'Semua'], ['low', 'Menipis'], ['out', 'Habis']], stokFilter, 'data-sf') + '<div id="st-list" style="margin-top:10px;"></div>';
      function status(p) { var s = num(p.current_stock) - num(p.reserved_stock); if (!isManaged(p)) return 'na'; if (s <= 0) return 'out'; if (s <= num(p.minimum_stock)) return 'low'; return 'ok'; }
      function draw() {
        var rows = products.filter(function (p) {
          if (q && String(p.product_name).toLowerCase().indexOf(q) === -1 && String(p.sku).toLowerCase().indexOf(q) === -1) return false;
          var st = status(p);
          return stokFilter === 'all' || (stokFilter === 'low' && st === 'low') || (stokFilter === 'out' && st === 'out');
        });
        var box = body.querySelector('#st-list');
        if (!rows.length) { box.innerHTML = '<div class="empty-state"><div class="empty-sub">Tidak ada produk pada filter ini.</div></div>'; return; }
        box.innerHTML = '<div class="lcard">' + rows.map(function (p) {
          var st = status(p), res = num(p.reserved_stock);
          var right = st === 'na' ? '<span class="muted">tanpa stok</span>' : num(p.current_stock);
          return lrow(p.product_name, Utils.escapeHtml(p.sku || '') + (st === 'na' ? '' : ' &middot; min ' + num(p.minimum_stock)) + (res ? ' &middot; dipesan ' + res : ''), right, st === 'out' ? 'bad' : (st === 'low' ? 'warn' : ''), 'data-p="' + p.product_id + '"');
        }).join('') + '</div>';
        Utils.qsa('[data-p]', box).forEach(function (r) { r.addEventListener('click', function () { adjustSheet(products.filter(function (x) { return x.product_id === r.getAttribute('data-p'); })[0], container); }); });
      }
      body.querySelector('#st-q').addEventListener('input', Utils.debounce(function (e) { q = e.target.value.trim().toLowerCase(); draw(); }, 140));
      Utils.qsa('[data-sf]', body).forEach(function (b) { b.addEventListener('click', function () { stokFilter = b.getAttribute('data-sf'); Utils.qsa('[data-sf]', body).forEach(function (x) { x.classList.toggle('on', x === b); }); draw(); }); });
      draw();
    });
  }

  function adjustSheet(p, container) {
    if (!p) return;
    if (!isManaged(p)) { Utils.toast('Produk ini tidak memakai manajemen stok. Aktifkan dulu di Edit Produk.', 'info'); return; }
    var m = Utils.openModal('<h3>Sesuaikan Stok</h3><div class="lcard" style="margin-bottom:12px;">' + lrow(p.product_name, Utils.escapeHtml(p.sku || ''), num(p.current_stock), '') + '</div>' +
      '<form id="adj">' +
      '<div class="field"><label>Perubahan jumlah (+ menambah, &minus; mengurangi)</label><div class="pc-step big"><button type="button" class="pc-b" data-d="-1">&minus;</button><input id="adj-qty" class="pc-q" type="number" inputmode="numeric" value="0"><button type="button" class="pc-b" data-d="1">+</button></div></div>' +
      '<div id="adj-after" class="hint" style="margin:-4px 0 10px;"></div>' +
      '<div class="field"><label>Jenis</label><select id="adj-type"><option value="ADJUSTMENT">Koreksi stok</option><option value="DAMAGE">Barang rusak</option><option value="LOSS">Barang hilang</option></select></div>' +
      '<div class="field"><label>Alasan (wajib)</label><input id="adj-reason" placeholder="Contoh: salah hitung saat barang masuk"></div>' +
      '<button class="btn btn-primary btn-block" type="submit">Simpan</button></form>');
    var qty = m.querySelector('#adj-qty'), after = m.querySelector('#adj-after');
    function upd() { var v = Math.trunc(num(qty.value)); after.textContent = v ? 'Stok menjadi ' + (num(p.current_stock) + v) : ''; }
    Utils.qsa('[data-d]', m).forEach(function (b) { b.addEventListener('click', function () { qty.value = Math.trunc(num(qty.value)) + Number(b.getAttribute('data-d')); upd(); }); });
    qty.addEventListener('input', upd);
    m.querySelector('#adj').addEventListener('submit', function (e) {
      e.preventDefault();
      var v = Math.trunc(num(qty.value)), reason = m.querySelector('#adj-reason').value.trim();
      if (!v) { Utils.toast('Isi perubahan jumlah.', 'error'); return; }
      if (!reason) { Utils.toast('Alasan wajib diisi.', 'error'); return; }
      var type = m.querySelector('#adj-type').value;
      if ((type === 'DAMAGE' || type === 'LOSS') && v > 0) { Utils.toast('Rusak/hilang harus mengurangi stok (angka minus).', 'error'); return; }
      Api.call('stock.adjustment', { product_id: p.product_id, qty: v, reason: reason, movement_type: type }).then(function () {
        Utils.closeModal(); Utils.toast('Stok disesuaikan.', 'success'); renderStok(container);
      }).catch(function (err) { Utils.toast(err.message, 'error'); });
    });
  }

  function stokRiwayat(body) {
    return Api.call('stock.ledger', { limit: 100 }).then(function (d) {
      var rows = d.movements || [];
      if (!rows.length) { body.innerHTML = '<div class="empty-state"><div class="empty-sub">Belum ada pergerakan stok.</div></div>'; return; }
      var LBL = { SALE: 'Penjualan', PURCHASE: 'Barang masuk', ADJUSTMENT: 'Koreksi', DAMAGE: 'Rusak', LOSS: 'Hilang', STOCK_OPNAME: 'Opname', RETURN_CUSTOMER: 'Retur pelanggan', RETURN_SUPPLIER: 'Retur supplier', VOID: 'Batal', ORDER_COMMIT: 'Pesanan online' };
      body.innerHTML = '<div class="table-wrap"><table><thead><tr><th>Produk</th><th>Jenis</th><th>Qty</th><th>Sesudah</th><th>Waktu</th></tr></thead><tbody>' +
        rows.map(function (m) { var q = num(m.qty); return '<tr><td>' + Utils.escapeHtml(m.product_name || m.product_id) + '</td><td>' + Utils.escapeHtml(LBL[m.movement_type] || m.movement_type) + '</td><td>' + (q > 0 ? '+' : '') + q + '</td><td>' + m.stock_after + '</td><td>' + Utils.formatDate(m.created_at) + '</td></tr>'; }).join('') +
        '</tbody></table></div>' + (d.total > rows.length ? '<p class="hint">Menampilkan ' + rows.length + ' terbaru dari ' + d.total + '.</p>' : '');
    });
  }

  // =============== STOK OPNAME ===============
  function renderOpname(container) {
    container.innerHTML = head('Stok Opname') + '<div id="inv-body"><div class="spinner"></div></div>';
    var body = container.querySelector('#inv-body');
    return Api.call('stock.opname.list', {}).then(function (d) {
      var rows = (d.opnames || []).slice().sort(function (a, b) { return String(b.created_at) < String(a.created_at) ? -1 : 1; });
      var draft = rows.filter(function (o) { return o.status === 'DRAFT'; })[0];
      body.innerHTML = '<div class="card"><div class="set-h">Hitung stok fisik</div><p class="hint" style="margin-top:0;">Stok sistem dicatat saat opname dimulai. Penjualan tetap berjalan; selisih dicatat ke riwayat stok saat Anda konfirmasi.</p>' +
        (draft ? '<button class="btn btn-primary btn-block" id="op-continue">Lanjutkan ' + Utils.escapeHtml(draft.opname_number) + '</button><button class="btn btn-outline btn-block" id="op-new" style="margin-top:8px;">Mulai opname baru</button>'
          : '<button class="btn btn-primary btn-block" id="op-new">+ Mulai Stok Opname</button>') + '</div>' +
        (rows.length ? '<div class="menu-group-label">RIWAYAT</div><div class="lcard">' + rows.map(function (o) {
          return lrow(o.opname_number, Utils.formatDateOnly(o.date), o.status === 'CONFIRMED' ? 'Selesai' : 'Draft', o.status === 'CONFIRMED' ? 'ok' : 'warn', o.status === 'DRAFT' ? 'data-open="' + o.opname_id + '"' : '');
        }).join('') + '</div>' : '');
      var nb = body.querySelector('#op-new');
      if (nb) nb.addEventListener('click', function () { startOpname(container); });
      var cb = body.querySelector('#op-continue'); if (cb) cb.addEventListener('click', function () { openCount(container, draft.opname_id); });
      Utils.qsa('[data-open]', body).forEach(function (r) { r.addEventListener('click', function () { openCount(container, r.getAttribute('data-open')); }); });
    });
  }

  function startOpname(container) {
    loadProducts().then(function (products) {
      var managed = products.filter(isManaged);
      if (!managed.length) { Utils.toast('Belum ada produk dengan manajemen stok.', 'error'); return; }
      var m = Utils.openModal('<h3>Mulai Stok Opname</h3><p class="hint" style="margin-top:0;">' + managed.length + ' produk akan dihitung. Stok sistem dicatat sekarang sebagai acuan.</p>' +
        '<button class="btn btn-primary btn-block" id="op-go">Mulai Hitung</button>');
      m.querySelector('#op-go').addEventListener('click', function () {
        var b = this; b.disabled = true;
        Api.call('stock.opname.create', { product_ids: managed.map(function (p) { return p.product_id; }) }).then(function (r) { Utils.closeModal(); openCount(container, r.opname_id); })
          .catch(function (err) { b.disabled = false; Utils.toast(err.message, 'error'); });
      });
    }).catch(function (err) { Utils.toast(err.message, 'error'); });
  }

  /** Halaman hitung fisik: satu baris per produk, selisih langsung terlihat, alasan hanya muncul bila ada selisih. */
  function openCount(container, opnameId) {
    container.innerHTML = '<div class="sub-head"><a class="sub-back" href="#/internal/opname" id="oc-back" aria-label="Kembali">&#8249;</a><h1 class="page-title">Hitung Fisik</h1></div><div id="inv-body"><div class="spinner"></div></div>';
    container.querySelector('#oc-back').addEventListener('click', function (e) { e.preventDefault(); renderOpname(container); });
    var body = container.querySelector('#inv-body'), key = 'azqia_opname_' + opnameId;
    Api.call('stock.opname.get', { opname_id: opnameId }).then(function (d) {
      var items = d.items || [], saved = {};
      try { saved = JSON.parse(localStorage.getItem(key) || '{}'); } catch (e) { saved = {}; }
      var state = {}; items.forEach(function (it) { state[it.opname_item_id] = saved[it.opname_item_id] || { c: '', r: '' }; });
      function persist() { try { localStorage.setItem(key, JSON.stringify(state)); } catch (e) {} }
      body.innerHTML = '<div class="search-box"><input id="oc-q" type="search" placeholder="Cari produk" autocomplete="off"></div>' +
        '<div class="oc-prog" id="oc-prog"></div><div id="oc-list" class="lcard"></div>' +
        '<button class="btn btn-primary btn-block" id="oc-confirm" style="margin-top:14px;">Konfirmasi Opname</button><p class="hint">Isian tersimpan di perangkat ini sampai dikonfirmasi. Produk yang dikosongkan dianggap sama dengan stok sistem.</p>';
      function diffOf(it) { var s = state[it.opname_item_id]; return s.c === '' ? 0 : num(s.c) - num(it.system_stock); }
      function prog() {
        var filled = items.filter(function (it) { return state[it.opname_item_id].c !== ''; }).length, diffs = items.filter(function (it) { return diffOf(it) !== 0; }).length;
        body.querySelector('#oc-prog').innerHTML = '<span><b>' + filled + '</b> / ' + items.length + ' dihitung</span><span>' + (diffs ? '<b class="bad">' + diffs + '</b> selisih' : 'tanpa selisih') + '</span>';
      }
      function draw() {
        var q = body.querySelector('#oc-q').value.trim().toLowerCase();
        var rows = items.filter(function (it) { return !q || String(it.product_name).toLowerCase().indexOf(q) !== -1 || String(it.sku).toLowerCase().indexOf(q) !== -1; });
        body.querySelector('#oc-list').innerHTML = rows.map(function (it) {
          var s = state[it.opname_item_id], df = diffOf(it);
          return '<div class="oc-row" data-id="' + it.opname_item_id + '"><div class="oc-top"><div class="lr-main"><div class="lr-name">' + Utils.escapeHtml(it.product_name) + '</div><div class="lr-sub">Sistem: ' + num(it.system_stock) + '</div></div>' +
            '<input class="oc-in" type="number" inputmode="numeric" min="0" placeholder="Fisik" value="' + Utils.escapeHtml(s.c) + '"></div>' +
            '<div class="oc-diff ' + (df ? 'bad' : '') + '"' + (df ? '' : ' hidden') + '>Selisih ' + (df > 0 ? '+' : '') + df + '</div>' +
            '<input class="oc-why" placeholder="Alasan selisih (wajib)" value="' + Utils.escapeHtml(s.r) + '"' + (df ? '' : ' hidden') + '></div>';
        }).join('') || '<div class="empty-sub" style="padding:16px;">Produk tidak ditemukan.</div>';
        prog();
      }
      body.querySelector('#oc-list').addEventListener('input', function (e) {
        var row = e.target.closest('.oc-row'); if (!row) return;
        var id = row.getAttribute('data-id'), it = items.filter(function (x) { return x.opname_item_id === id; })[0], s = state[id];
        if (e.target.classList.contains('oc-in')) {
          s.c = e.target.value; var df = diffOf(it);
          var dEl = row.querySelector('.oc-diff'), wEl = row.querySelector('.oc-why');
          dEl.hidden = !df; dEl.textContent = 'Selisih ' + (df > 0 ? '+' : '') + df; dEl.classList.toggle('bad', !!df); wEl.hidden = !df;
        } else if (e.target.classList.contains('oc-why')) s.r = e.target.value;
        persist(); prog();
      });
      body.querySelector('#oc-q').addEventListener('input', Utils.debounce(draw, 140));
      body.querySelector('#oc-confirm').addEventListener('click', function () {
        var btn = this, missing = items.filter(function (it) { return diffOf(it) !== 0 && !String(state[it.opname_item_id].r).trim(); });
        if (missing.length) { Utils.toast('Isi alasan untuk ' + missing.length + ' produk yang selisih (mis. ' + missing[0].product_name + ').', 'error'); return; }
        var diffs = items.filter(function (it) { return diffOf(it) !== 0; }).length;
        if (!confirm('Konfirmasi opname? ' + diffs + ' produk akan disesuaikan stoknya. Tindakan ini tidak bisa dibatalkan.')) return;
        btn.disabled = true;
        Api.call('stock.opname.confirm', { opname_id: opnameId, items: items.map(function (it) { var s = state[it.opname_item_id]; return { opname_item_id: it.opname_item_id, physical_count: s.c === '' ? num(it.system_stock) : num(s.c), reason: s.r || '' }; }) })
          .then(function () { try { localStorage.removeItem(key); } catch (e) {} Utils.toast('Stok opname dikonfirmasi.', 'success'); renderOpname(container); })
          .catch(function (err) { btn.disabled = false; Utils.toast(err.message, 'error'); });
      });
      draw();
    }).catch(function (err) { body.innerHTML = '<div class="empty-state"><div class="empty-title">Gagal memuat</div><div class="empty-sub">' + Utils.escapeHtml(err.message) + '</div></div>'; });
  }

  // =============== RETUR ===============
  function renderReturns(container) {
    container.innerHTML = head('Retur') + seg([['pelanggan', 'Dari Pelanggan'], ['supplier', 'Ke Supplier']], returTab, 'data-rt') + '<div id="inv-body" style="margin-top:12px;"><div class="spinner"></div></div>';
    Utils.qsa('[data-rt]', container).forEach(function (b) { b.addEventListener('click', function () { returTab = b.getAttribute('data-rt'); renderReturns(container); }); });
    var body = container.querySelector('#inv-body');
    var need = [loadProducts()]; if (returTab === 'supplier') need.push(Api.call('supplier.list', {}));
    return Promise.all(need).then(function (r) { return returTab === 'supplier' ? returSupplier(body, r[0], r[1].suppliers || []) : returCustomer(body, r[0]); });
  }

  function step(n, title, inner) { return '<div class="card rt-step"><div class="rt-n">' + n + '</div><div class="rt-b"><div class="set-h">' + title + '</div>' + inner + '</div></div>'; }
  function productStep(sel) {
    return '<button type="button" class="rt-pick" id="rt-pick">' + (sel ? '<b>' + Utils.escapeHtml(sel.product_name) + '</b><span>' + Utils.escapeHtml(sel.sku || '') + '</span>' : '<span>Ketuk untuk memilih produk</span>') + '</button>';
  }
  function qtyBox(id) { return '<div class="pc-step big"><button type="button" class="pc-b" data-qd="-1">&minus;</button><input id="' + id + '" class="pc-q" type="number" inputmode="numeric" min="1" value="1"><button type="button" class="pc-b" data-qd="1">+</button></div>'; }
  function wireQty(root, id) {
    var q = root.querySelector('#' + id);
    Utils.qsa('[data-qd]', root).forEach(function (b) { b.addEventListener('click', function () { q.value = Math.max(1, Math.trunc(num(q.value)) + Number(b.getAttribute('data-qd'))); }); });
  }

  function returCustomer(body, products) {
    var sel = null;
    function draw() {
      body.innerHTML = '<form id="rc">' +
        step(1, 'Produk yang dikembalikan', productStep(sel)) +
        step(2, 'Transaksi asal', '<div class="field"><label>Nomor transaksi / pesanan</label><input name="ref_id" placeholder="Contoh: INV-20261114-0001" required></div>' +
          '<div class="field"><label>Asal</label><select name="ref_type"><option value="SALE">Kasir</option><option value="ONLINE_ORDER">Toko online</option></select></div>') +
        step(3, 'Barang kembali', '<div class="field"><label>Jumlah</label>' + qtyBox('rc-qty') + '</div><div class="field"><label>Kondisi</label><select name="condition"><option value="BAIK">Baik (kembali ke stok)</option><option value="RUSAK">Rusak (tidak masuk stok)</option></select></div>') +
        step(4, 'Pengembalian uang', '<div class="field"><label>Jumlah refund (Rp), boleh kosong</label><input name="refund_amount" type="number" inputmode="numeric" value="0" min="0"></div>') +
        '<button class="btn btn-primary btn-block" type="submit">Proses Retur</button></form>';
      body.querySelector('#rt-pick').addEventListener('click', function () { pickProduct(products, function (p) { var keep = new FormData(body.querySelector('#rc')); sel = p; draw(); Utils.qsa('[name]', body).forEach(function (el) { if (keep.has(el.name)) el.value = keep.get(el.name); }); }); });
      wireQty(body, 'rc-qty');
      body.querySelector('#rc').addEventListener('submit', function (e) {
        e.preventDefault();
        if (!sel) { Utils.toast('Pilih produk dulu (langkah 1).', 'error'); return; }
        var fd = Object.fromEntries(new FormData(e.target).entries()); fd.product_id = sel.product_id; fd.qty = Math.max(1, Math.trunc(num(body.querySelector('#rc-qty').value)));
        var btn = e.target.querySelector('[type=submit]'); btn.disabled = true;
        Api.call('return.customer.create', fd).then(function (r) { Utils.toast('Retur ' + r.return_number + ' diproses.', 'success'); sel = null; draw(); })
          .catch(function (err) { btn.disabled = false; Utils.toast(err.message, 'error'); });
      });
    }
    draw();
  }

  function returSupplier(body, products, suppliers) {
    var sel = null;
    if (!suppliers.length) { body.innerHTML = '<div class="empty-state"><div class="empty-title">Belum ada supplier</div><div class="empty-sub">Tambahkan supplier dulu di menu Supplier.</div></div>'; return; }
    function draw() {
      body.innerHTML = '<form id="rs">' +
        step(1, 'Supplier', '<div class="field"><select name="supplier_id">' + suppliers.map(function (s) { return '<option value="' + s.supplier_id + '">' + Utils.escapeHtml(s.name) + '</option>'; }).join('') + '</select></div>') +
        step(2, 'Produk yang dikembalikan', productStep(sel)) +
        step(3, 'Barang dikembalikan', '<div class="field"><label>Jumlah</label>' + qtyBox('rs-qty') + '</div><div class="field"><label>Alasan</label><select name="condition"><option value="RUSAK">Rusak</option><option value="SALAH_KIRIM">Salah kirim</option></select></div>') +
        step(4, 'Kredit dari supplier', '<div class="field"><label>Nilai kredit (Rp), boleh kosong</label><input name="refund_amount" type="number" inputmode="numeric" value="0" min="0"></div>') +
        '<button class="btn btn-primary btn-block" type="submit">Proses Retur ke Supplier</button><p class="hint">Stok produk akan berkurang sebesar jumlah retur.</p></form>';
      body.querySelector('#rt-pick').addEventListener('click', function () { pickProduct(products, function (p) { var keep = new FormData(body.querySelector('#rs')); sel = p; draw(); Utils.qsa('[name]', body).forEach(function (el) { if (keep.has(el.name)) el.value = keep.get(el.name); }); }); });
      wireQty(body, 'rs-qty');
      body.querySelector('#rs').addEventListener('submit', function (e) {
        e.preventDefault();
        if (!sel) { Utils.toast('Pilih produk dulu (langkah 2).', 'error'); return; }
        var fd = Object.fromEntries(new FormData(e.target).entries()); fd.product_id = sel.product_id; fd.qty = Math.max(1, Math.trunc(num(body.querySelector('#rs-qty').value)));
        var btn = e.target.querySelector('[type=submit]'); btn.disabled = true;
        Api.call('return.supplier.create', fd).then(function (r) { Utils.toast('Retur ' + r.return_number + ' diproses. Stok berkurang.', 'success'); sel = null; draw(); })
          .catch(function (err) { btn.disabled = false; Utils.toast(err.message, 'error'); });
      });
    }
    draw();
  }

  return { render: render };
})();
