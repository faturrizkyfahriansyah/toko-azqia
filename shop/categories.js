/**
 * shop/categories.js - Tab Kategori: daftar kategori, ketuk untuk melihat produknya.
 */
window.Modules = window.Modules || {};
Modules.shopcategories = (function () {
  function render(container) {
    container.innerHTML = '<h1 class="shop-title">Kategori</h1><div id="cat-list"></div>';
    var box = container.querySelector('#cat-list'); Utils.showLoading(box);
    return Api.call('public.categories', {}).then(function (d) {
      var cats = d.categories || [];
      box.innerHTML = '<div class="menu-list"><a class="menu-item" href="#/shop/catalog"><span class="menu-ic cat-all">&#9776;</span><span class="menu-tx">Semua Produk</span><span class="menu-go">' + Layout.ICONS.chevron + '</span></a>' +
        cats.map(function (c) { return '<a class="menu-item" href="#/shop/catalog?category=' + encodeURIComponent(c.category_id) + '"><span class="menu-ic cat-ini">' + Utils.escapeHtml(String(c.category_name || '?').charAt(0).toUpperCase()) + '</span><span class="menu-tx">' + Utils.escapeHtml(c.category_name) + '</span><span class="menu-go">' + Layout.ICONS.chevron + '</span></a>'; }).join('') + '</div>';
    }).catch(function (e) { box.innerHTML = '<div class="empty-state"><div class="empty-title">Tidak dapat memuat kategori</div><div class="empty-sub">' + Utils.escapeHtml(e.message) + '</div></div>'; });
  }
  return { render: render };
})();
