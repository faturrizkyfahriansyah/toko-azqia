/**
 * internal/prices.js - Harga & Satuan: aturan harga grosir + harga eceran/grosir per satuan, per produk.
 * Aturan: OFF | CUSTOMER | QTY | CUSTOMER_OR_QTY (lihat js/pricing.js). Satuan tanpa harga grosir selalu eceran.
 */
window.Modules = window.Modules || {};
Modules.prices = (function () {
  var RULES = [
    ['OFF', 'Mati - semua pembeli harga eceran'],
    ['CUSTOMER', 'Pelanggan bertipe GROSIR mendapat harga grosir'],
    ['QTY', 'Harga grosir bila jumlah mencapai minimal per satuan'],
    ['CUSTOMER_OR_QTY', 'Pelanggan GROSIR ATAU jumlah mencapai minimal']
  ];
  var state = { rule: 'OFF', search: '', offset: 0, total: 0, loaded: 0 };
  function esc(s) { return Utils.escapeHtml(String(s === undefined || s === null ? '' : s)); }
  function usesQty() { return state.rule === 'QTY' || state.rule === 'CUSTOMER_OR_QTY'; }

  function cols() { return usesQty() ? 4 : 3; }
  function tableShell() {
    return '<div class="table-wrap pr-wrap"><table class="no-card pr-table"><thead><tr><th>Satuan</th><th>Eceran</th><th>Grosir</th>' + (usesQty() ? '<th>Min</th>' : '') + '</tr></thead><tbody id="pr-body"></tbody></table></div>';
  }
  /** Satu produk = baris judul + satu baris per satuan. Kolom langsung bisa diubah; tersimpan otomatis saat selesai mengetik. */
  function productRows(p) {
    var head = '<tr class="pr-prod"><td colspan="' + cols() + '"><span class="pr-name">' + esc(p.product_name) + '</span> <span class="muted">' + esc(p.sku) + '</span></td></tr>';
    return head + p.units.map(function (u) {
      return '<tr class="pr-unit" data-uid="' + esc(u.product_unit_id) + '"><td class="pr-u"><span class="pr-ok" aria-hidden="true"></span>' + esc(u.unit_name) +
        (u.is_base ? '' : '<small class="muted">1 = ' + u.conversion_to_base + '</small>') + '</td>' +
        '<td><input type="number" inputmode="numeric" min="0" data-f="selling_price" value="' + esc(Math.round(u.selling_price)) + '"></td>' +
        '<td><input type="number" inputmode="numeric" min="0" data-f="wholesale_price" placeholder="-" value="' + (u.wholesale_price === null ? '' : esc(Math.round(u.wholesale_price))) + '"></td>' +
        (usesQty() ? '<td><input type="number" inputmode="numeric" min="0" data-f="wholesale_min_qty" placeholder="-" value="' + (u.wholesale_min_qty || '') + '"></td>' : '') + '</tr>';
    }).join('');
  }
  function wire(root) {
    Utils.qsa('tr.pr-unit', root).forEach(function (row) {
      if (row.__wired) return; row.__wired = true;
      var ok = row.querySelector('.pr-ok');
      Utils.qsa('input', row).forEach(function (i) {
        i.addEventListener('input', function () { row.__v = (row.__v || 0) + 1; row.classList.add('dirty'); row.classList.remove('err'); ok.className = 'pr-ok'; });
        i.addEventListener('change', function () {
          var payload = { product_unit_id: row.getAttribute('data-uid') };
          Utils.qsa('input[data-f]', row).forEach(function (x) { payload[x.getAttribute('data-f')] = x.value === '' ? '' : Number(x.value); });
          ok.className = 'pr-ok busy'; var ver = row.__v || 0;
          Api.call('price.update', payload).then(function (r) {
            if ((row.__v || 0) !== ver) return;   // pengguna sudah mengetik lagi: jangan timpa isian; perubahan berikutnya disimpan sendiri
            row.classList.remove('dirty', 'err'); ok.className = 'pr-ok done';
            var g = row.querySelector('[data-f="wholesale_price"]'); g.value = r.unit.wholesale_price === null ? '' : Math.round(r.unit.wholesale_price);
          }).catch(function (e) { row.classList.add('err'); ok.className = 'pr-ok bad'; Utils.toast(e.message, 'error'); });
        });
      });
    });
  }
  function load(reset) {
    var list = document.getElementById('pr-list'), more = document.getElementById('pr-more'); if (!list) return Promise.resolve();
    if (reset) { state.offset = 0; state.loaded = 0; list.innerHTML = ''; Utils.showLoading(list); }
    more.innerHTML = '';
    return Api.call('price.list', { search: state.search, offset: state.offset, limit: 30 }).then(function (d) {
      if (!document.getElementById('pr-list')) return;
      var ruleChanged = state.rule !== d.rule;
      state.rule = d.rule; state.total = d.total; state.loaded += d.products.length;
      if (!d.products.length && reset) { list.innerHTML = '<div class="empty-state"><div class="empty-title">Produk tidak ditemukan</div></div>'; return; }
      if (reset || ruleChanged || !document.getElementById('pr-body')) list.innerHTML = tableShell();
      document.getElementById('pr-body').insertAdjacentHTML('beforeend', d.products.map(productRows).join(''));
      wire(list);
      document.getElementById('pr-count').textContent = state.loaded + ' dari ' + state.total + ' produk';
      if (state.loaded < state.total) { more.innerHTML = '<button type="button" class="btn btn-secondary btn-block" id="pr-more-btn">Muat lebih banyak</button>'; document.getElementById('pr-more-btn').addEventListener('click', function () { state.offset = state.loaded; load(false); }); }
    }).catch(function (e) {
      list.innerHTML = '<div class="empty-state"><h2>Tidak dapat memuat harga</h2><p>' + esc(e.message) + '</p><button class="btn btn-primary" id="pr-retry">Coba lagi</button></div>';
      document.getElementById('pr-retry').addEventListener('click', function () { load(true); });
    });
  }
  function render(container) {
    container.innerHTML = '<h1 class="page-title">Harga &amp; Satuan</h1>' +
      '<div class="card"><h3 style="margin-top:0;">Aturan harga grosir</h3><div class="field"><select id="pr-rule">' + RULES.map(function (r) { return '<option value="' + r[0] + '">' + r[1] + '</option>'; }).join('') + '</select></div>' +
      '<p class="hint" id="pr-rule-hint"></p><button class="btn btn-primary btn-sm" id="pr-rule-save" disabled>Simpan aturan</button> <span id="pr-rule-msg" class="muted"></span></div>' +
      '<div class="search-box"><input id="pr-search" type="search" placeholder="Cari produk atau SKU" autocomplete="off"></div><div id="pr-count" class="muted"></div><div id="pr-list"></div><div id="pr-more"></div>';
    var sel = document.getElementById('pr-rule'), save = document.getElementById('pr-rule-save');
    function hint() { document.getElementById('pr-rule-hint').textContent = { OFF: 'Harga grosir diabaikan. Isi harga grosir per satuan di bawah lebih dulu, lalu pilih aturan.', CUSTOMER: 'Atur tipe pelanggan di menu Pelanggan (GROSIR / REGULAR). Hanya satuan yang punya harga grosir yang terpengaruh.', QTY: 'Isi "Min. jumlah grosir" pada satuan yang bergrosir (mis. Dus: min 2).', CUSTOMER_OR_QTY: 'Cukup salah satu syarat terpenuhi.' }[sel.value] || ''; }
    sel.addEventListener('change', function () { save.disabled = false; hint(); });
    save.addEventListener('click', function () {
      save.disabled = true;
      Api.call('price.settings.update', { wholesale_rule: sel.value }).then(function () { state.rule = sel.value; document.getElementById('pr-rule-msg').textContent = 'Tersimpan \u2713'; load(true); }).catch(function (e) { Utils.toast(e.message, 'error'); save.disabled = false; });
    });
    document.getElementById('pr-search').addEventListener('input', Utils.debounce(function (e) { state.search = e.target.value.trim(); load(true); }, 300));
    return Api.call('price.settings.get', {}).then(function (s) { state.rule = s.wholesale_rule; sel.value = s.wholesale_rule; hint(); return load(true); });
  }
  return { render: render };
})();
