/**
 * shop/catalog.js - Katalog produk publik, pencarian & filter kategori.
 */
window.Modules = window.Modules || {};
Modules.catalog = (function () {
  function parseQuery() {
    var hash = location.hash.split('?')[1] || '';
    var params = {};
    hash.split('&').forEach(function (kv) { var p = kv.split('='); if (p[0]) params[p[0]] = decodeURIComponent(p[1] || ''); });
    return params;
  }

  function render(container) {
    var q = parseQuery();
    container.innerHTML =
      '<h1>Katalog Produk</h1>' +
      '<div class="search-box"><input id="cat-search" placeholder="Cari produk..." value="' + Utils.escapeHtml(q.search || '') + '"></div>' +
      '<div id="cat-list"></div>';
    document.getElementById('cat-search').addEventListener('input', Utils.debounce(function (e) { load({ search: e.target.value, category_id: q.category }); }, 300));
    return load({ category_id: q.category });
  }

  function load(params) {
    var box = document.getElementById('cat-list');
    Utils.showLoading(box);
    return Api.call('public.products', params).then(function (d) {
      if (d.products.length === 0) { box.innerHTML = '<div class="empty-state">Produk tidak ditemukan.</div>'; return; }
      box.innerHTML = '<div class="stack">' + d.products.map(function (p) {
        return '<div class="card row"><div><div style="font-weight:700;">' + Utils.escapeHtml(p.product_name) + '</div>' +
          '<div class="muted">' + Utils.formatCurrency(p.selling_price) + '</div>' +
          (!p.available ? '<span class="badge grey">Stok habis</span>' : (p.minimum_stock_reached ? '<span class="badge gold">Stok terbatas</span>' : '')) + '</div>' +
          (p.available ? '<button class="btn btn-secondary btn-sm" data-add="' + p.product_id + '">+ Keranjang</button>' : '') + '</div>';
      }).join('') + '</div>';
      Utils.qsa('[data-add]', box).forEach(function (b) {
        b.addEventListener('click', function () {
          var p = d.products.filter(function (x) { return x.product_id === b.getAttribute('data-add'); })[0];
          window.Cart.add(p, 1);
          Utils.toast('Ditambahkan ke keranjang.', 'success');
          Router.render();
        });
      });
    });
  }

  return { render: render };
})();
