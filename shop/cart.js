/**
 * shop/cart.js - Keranjang: ubah jumlah di tempat, hapus, ringkasan, tombol checkout selalu terlihat.
 */
window.Modules = window.Modules || {};
Modules.cart = (function () {
  function render(container) { draw(container); return Promise.resolve(); }
  function draw(container) {
    var items = window.Cart.getItems(), esc = Utils.escapeHtml;
    if (items.length === 0) { container.innerHTML = '<h1 class="shop-title">Keranjang</h1><div class="empty-state"><p>Keranjang masih kosong.</p><a class="btn btn-primary" href="#/shop/catalog">Mulai Belanja</a></div>'; if (window.Layout && Layout.updateCartBadge) Layout.updateCartBadge(); return; }
    container.innerHTML = '<h1 class="shop-title">Keranjang</h1>' + items.map(function (l) {
      return '<div class="cart-row" data-row="' + esc(l.product_id) + '"><div class="cart-info"><div class="cart-name">' + esc(l.product_name) + '</div><div class="muted">' + Utils.formatCurrency(l.selling_price) + ' / item</div></div>' +
        '<div class="cart-side"><div class="stepper"><button type="button" data-dec="' + esc(l.product_id) + '" aria-label="Kurangi">&minus;</button><span>' + l.qty + '</span><button type="button" data-inc="' + esc(l.product_id) + '" aria-label="Tambah">+</button></div>' +
        '<div class="cart-line">' + Utils.formatCurrency(l.qty * l.selling_price) + '</div><button type="button" class="link-btn" data-del="' + esc(l.product_id) + '">Hapus</button></div></div>';
    }).join('') +
      '<div class="cart-summary"><div class="row"><span>Subtotal (' + window.Cart.count() + ' barang)</span><strong>' + Utils.formatCurrency(window.Cart.subtotal()) + '</strong></div><p class="muted">Ongkir dan promo dihitung saat checkout.</p></div>' +
      '<div class="sticky-cta"><a href="#/shop/checkout" class="btn btn-primary btn-block">Lanjut ke Checkout</a></div>';
    if (window.Layout && Layout.updateCartBadge) Layout.updateCartBadge();
    container.addEventListener('click', onClick);
    function onClick(e) {
      var t = e.target.closest('[data-inc],[data-dec],[data-del]'); if (!t) return;
      container.removeEventListener('click', onClick);
      var id = t.getAttribute('data-inc') || t.getAttribute('data-dec') || t.getAttribute('data-del');
      var line = window.Cart.getItems().filter(function (l) { return l.product_id === id; })[0]; if (!line) { draw(container); return; }
      if (t.hasAttribute('data-del')) window.Cart.remove(id); else window.Cart.setQty(id, line.qty + (t.hasAttribute('data-inc') ? 1 : -1));
      draw(container);
    }
  }
  return { render: render };
})();
