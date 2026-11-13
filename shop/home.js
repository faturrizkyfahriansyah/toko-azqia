/**
 * shop/home.js - Beranda toko online: sambutan, pencarian, kategori, produk pilihan, info toko.
 */
window.Modules = window.Modules || {};
Modules.home = (function () {
  function render(container) {
    // Kerangka tampil SEGERA; data menyusul (tidak ada layar kosong menunggu 3 permintaan).
    container.innerHTML = '<section class="shop-hero"><div class="skel skel-line" style="width:60%;height:26px;"></div><div class="skel skel-line" style="width:80%;margin-top:10px;"></div></section>';
    return Promise.all([Api.call('public.storeInfo', {}), Api.call('public.categories', {}), Api.call('public.products', {})]).then(function (r) {
      if (!container.isConnected) return;
      var store = r[0], categories = r[1].categories, products = r[2].products, byId = {};
      products.forEach(function (p) { byId[p.product_id] = p; });
      var ui = Modules.shopui, esc = ui.esc;
      container.innerHTML =
        '<section class="shop-hero"><div class="shop-hero-name">' + esc(store.store_name) + '</div><p>' + esc(store.store_tagline) + '</p>' +
        '<form class="shop-search" id="home-search"><input type="search" name="q" placeholder="Cari produk..." aria-label="Cari produk"><button type="submit" class="btn btn-primary">Cari</button></form></section>' +
        (categories.length ? '<h2 class="shop-h">Kategori</h2>' + ui.chips(categories, '', '#/shop/catalog') : '') +
        '<div class="row shop-h-row"><h2 class="shop-h">Produk</h2><a href="#/shop/catalog">Lihat semua &rarr;</a></div>' +
        (products.length ? ui.grid(products.slice(0, 8)) : '<div class="empty-state">Belum ada produk.</div>') +
        '<div class="card shop-info">' + (store.store_address ? '<div><strong>Alamat</strong><br>' + esc(store.store_address) + '</div>' : '') + (store.store_hours ? '<div><strong>Jam buka</strong><br>' + esc(store.store_hours) + '</div>' : '') + (store.store_contact ? '<div><strong>Kontak</strong><br>' + esc(store.store_contact) + '</div>' : '') + '</div>';
      ui.wire(container, function (id) { return byId[id]; });
      container.querySelector('#home-search').addEventListener('submit', function (e) { e.preventDefault(); var q = e.target.q.value.trim(); location.hash = '#/shop/catalog' + (q ? '?search=' + encodeURIComponent(q) : ''); });
    });
  }
  return { render: render };
})();
