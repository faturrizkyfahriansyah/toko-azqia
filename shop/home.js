/**
 * shop/home.js - Beranda toko online.
 */
window.Modules = window.Modules || {};
Modules.home = (function () {
  function render(container) {
    return Promise.all([Api.call('public.storeInfo', {}), Api.call('public.categories', {}), Api.call('public.products', {})]).then(function (r) {
      var store = r[0], categories = r[1].categories, products = r[2].products;
      container.innerHTML =
        '<div class="card" style="text-align:center;background:var(--surface-muted);border:none;">' +
        '<h1 style="color:var(--red);">' + Utils.escapeHtml(store.store_name) + '</h1>' +
        '<p>' + Utils.escapeHtml(store.store_tagline) + '</p>' +
        (store.store_address ? '<p class="muted">' + Utils.escapeHtml(store.store_address) + '</p>' : '') +
        '<a href="#/shop/catalog" class="btn btn-primary">Lihat Semua Produk</a></div>' +
        '<h2 style="margin-top:20px;">Kategori</h2>' +
        '<div class="field-row" style="flex-wrap:wrap;">' +
        categories.map(function (c) { return '<a class="badge blue" style="padding:8px 14px;margin:0 6px 8px 0;" href="#/shop/catalog?category=' + c.category_id + '">' + Utils.escapeHtml(c.category_name) + '</a>'; }).join('') +
        '</div>' +
        '<h2 style="margin-top:16px;">Produk</h2>' +
        '<div class="stack">' + products.slice(0, 12).map(productCard).join('') + '</div>';
      wireAddButtons(container, products);
    });
  }
  function productCard(p) {
    return '<div class="card row"><div><div style="font-weight:700;">' + Utils.escapeHtml(p.product_name) + '</div>' +
      '<div class="muted">' + Utils.formatCurrency(p.selling_price) + '</div>' +
      (!p.available ? '<span class="badge grey">Stok habis</span>' : '') + '</div>' +
      (p.available ? '<button class="btn btn-secondary btn-sm" data-add="' + p.product_id + '">+ Keranjang</button>' : '') + '</div>';
  }
  function wireAddButtons(container, products) {
    Utils.qsa('[data-add]', container).forEach(function (b) {
      b.addEventListener('click', function () {
        var p = products.filter(function (x) { return x.product_id === b.getAttribute('data-add'); })[0];
        window.Cart.add(p, 1);
        Utils.toast('Ditambahkan ke keranjang.', 'success');
        Router.render();
      });
    });
  }
  return { render: render };
})();
