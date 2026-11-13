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

  function unitHtml(p, u) {
    return '<div class="pr-unit" data-uid="' + esc(u.product_unit_id) + '"><div class="pr-unit-head"><strong>' + esc(u.unit_name) + '</strong>' +
      (u.is_base ? ' <span class="badge blue">dasar</span>' : '<span class="muted"> &middot; 1 ' + esc(u.unit_name) + ' = ' + u.conversion_to_base + ' satuan dasar</span>') + '</div>' +
      '<div class="pr-fields"><label>Eceran (Rp)<input type="number" inputmode="numeric" min="0" data-f="selling_price" value="' + esc(Math.round(u.selling_price)) + '"></label>' +
      '<label>Grosir (Rp)<input type="number" inputmode="numeric" min="0" data-f="wholesale_price" placeholder="kosong = tidak ada" value="' + (u.wholesale_price === null ? '' : esc(Math.round(u.wholesale_price))) + '"></label>' +
      (usesQty() ? '<label>Min. jumlah grosir<input type="number" inputmode="numeric" min="0" data-f="wholesale_min_qty" value="' + (u.wholesale_min_qty || '') + '"></label>' : '') +
      '</div><div class="pr-actions"><span class="pr-msg muted"></span><button type="button" class="btn btn-primary btn-sm" data-save disabled>Simpan</button></div></div>';
  }
  function productHtml(p) {
    return '<div class="card pr-card"><div class="pr-head">' + (p.photo_id ? '<img class="mini-thumb" loading="lazy" alt="" src="' + Utils.photoUrl(p.photo_id, 96) + '" onerror="this.remove()">' : '') +
      '<div><div class="pr-name">' + esc(p.product_name) + '</div><div class="muted">' + esc(p.sku) + '</div></div></div>' + p.units.map(function (u) { return unitHtml(p, u); }).join('') + '</div>';
  }
  function wire(root) {
    Utils.qsa('.pr-unit', root).forEach(function (box) {
      if (box.__wired) return; box.__wired = true;
      var btn = box.querySelector('[data-save]'), msg = box.querySelector('.pr-msg');
      Utils.qsa('input', box).forEach(function (i) { i.addEventListener('input', function () { btn.disabled = false; msg.textContent = ''; }); });
      btn.addEventListener('click', function () {
        var payload = { product_unit_id: box.getAttribute('data-uid') };
        Utils.qsa('input[data-f]', box).forEach(function (i) { payload[i.getAttribute('data-f')] = i.value === '' ? '' : Number(i.value); });
        btn.disabled = true; btn.textContent = 'Menyimpan...';
        Api.call('price.update', payload).then(function (r) {
          msg.textContent = 'Tersimpan \u2713'; msg.style.color = 'var(--success)'; btn.textContent = 'Simpan';
          var g = box.querySelector('[data-f="wholesale_price"]'); g.value = r.unit.wholesale_price === null ? '' : Math.round(r.unit.wholesale_price);
        }).catch(function (e) { msg.textContent = e.message; msg.style.color = 'var(--danger)'; btn.disabled = false; btn.textContent = 'Simpan'; });
      });
    });
  }
  function load(reset) {
    var list = document.getElementById('pr-list'), more = document.getElementById('pr-more'); if (!list) return Promise.resolve();
    if (reset) { state.offset = 0; state.loaded = 0; list.innerHTML = ''; Utils.showLoading(list); }
    more.innerHTML = '';
    return Api.call('price.list', { search: state.search, offset: state.offset, limit: 30 }).then(function (d) {
      if (!document.getElementById('pr-list')) return;
      if (reset) list.innerHTML = '';
      state.rule = d.rule; state.total = d.total; state.loaded += d.products.length;
      if (!d.products.length && reset) { list.innerHTML = '<div class="empty-state"><div class="empty-title">Produk tidak ditemukan</div></div>'; return; }
      list.insertAdjacentHTML('beforeend', d.products.map(productHtml).join(''));
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
