/**
 * shop/catalog.js - Katalog: pencarian, filter kategori, daftar produk berhalaman ("Muat lebih banyak").
 */
window.Modules = window.Modules || {};
Modules.catalog = (function () {
  function parseQuery() {
    var hash = location.hash.split('?')[1] || '', params = {};
    hash.split('&').forEach(function (kv) { var p = kv.split('='); if (p[0]) params[p[0]] = decodeURIComponent((p[1] || '').replace(/\+/g, ' ')); });
    return params;
  }
  function render(container) {
    var q = parseQuery(), ui = Modules.shopui, state = { search: q.search || '', category_id: q.category || '', page: 1, byId: {}, shown: 0, total: 0 };
    container.innerHTML = '<h1 class="shop-title">Katalog</h1><div class="shop-search"><input id="cat-search" type="search" placeholder="Cari produk..." aria-label="Cari produk" value="' + ui.esc(state.search) + '"></div><div id="cat-chips"></div><div id="cat-count" class="muted"></div><div id="cat-list"></div><div id="cat-more"></div>';
    var list = container.querySelector('#cat-list'), more = container.querySelector('#cat-more'), count = container.querySelector('#cat-count'), token = 0;
    ui.wire(list, function (id) { return state.byId[id]; });
    function load(reset) {
      var my = ++token; if (reset) { state.page = 1; state.byId = {}; state.shown = 0; list.innerHTML = ''; }
      if (reset) Utils.showLoading(list);
      more.innerHTML = '';
      return Api.call('public.products', { search: state.search, category_id: state.category_id, page: state.page }).then(function (d) {
        if (my !== token || !container.isConnected) return;
        if (reset) list.innerHTML = '';
        d.products.forEach(function (p) { state.byId[p.product_id] = p; });
        state.shown += d.products.length; state.total = d.total;
        if (state.shown === 0) { list.innerHTML = '<div class="empty-state"><p>Produk tidak ditemukan.</p><a class="btn btn-secondary" href="#/shop/catalog">Lihat semua produk</a></div>'; count.textContent = ''; return; }
        var holder = list.querySelector('.p-grid'); if (!holder) { list.innerHTML = '<div class="p-grid"></div>'; holder = list.querySelector('.p-grid'); }
        holder.insertAdjacentHTML('beforeend', d.products.map(ui.card).join(''));
        count.textContent = state.shown + ' dari ' + state.total + ' produk';
        if (state.shown < state.total) { more.innerHTML = '<button type="button" class="btn btn-secondary btn-block" id="cat-more-btn">Muat lebih banyak</button>'; more.querySelector('#cat-more-btn').addEventListener('click', function () { state.page++; load(false); }); }
      }).catch(function (err) {
        if (my !== token) return;
        list.innerHTML = '<div class="empty-state"><h2>Tidak dapat memuat produk</h2><p>' + ui.esc(err.message) + '</p><button type="button" class="btn btn-primary" id="cat-retry">Coba lagi</button></div>';
        list.querySelector('#cat-retry').addEventListener('click', function () { load(true); });
      });
    }
    container.querySelector('#cat-search').addEventListener('input', Utils.debounce(function (e) { state.search = e.target.value.trim(); load(true); }, 300));
    Api.call('public.categories', {}).then(function (c) { if (container.isConnected) container.querySelector('#cat-chips').innerHTML = ui.chips(c.categories, state.category_id, '#/shop/catalog'); });
    return load(true);
  }
  return { render: render };
})();
