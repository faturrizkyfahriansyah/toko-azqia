/**
 * shop/cart.js - Halaman keranjang belanja.
 */
window.Modules = window.Modules || {};
Modules.cart = (function () {
  function render(container) {
    renderInner(container);
    return Promise.resolve();
  }
  function renderInner(container) {
    var items = window.Cart.getItems();
    if (items.length === 0) {
      container.innerHTML = '<h1>Keranjang</h1><div class="empty-state"><p>Keranjang masih kosong.</p><a class="btn btn-primary" href="#/shop/catalog">Mulai Belanja</a></div>';
      return;
    }
    container.innerHTML = '<h1>Keranjang</h1>' +
      items.map(function (l) {
        return '<div class="cart-item"><div style="flex:1;"><div style="font-weight:600;">' + Utils.escapeHtml(l.product_name) + '</div>' +
          '<div class="muted">' + Utils.formatCurrency(l.selling_price) + '</div></div>' +
          '<div class="qty-control"><button data-dec="' + l.product_id + '">-</button><span>' + l.qty + '</span><button data-inc="' + l.product_id + '">+</button></div></div>';
      }).join('') +
      '<div class="row" style="margin-top:14px;"><strong>Subtotal</strong><strong style="color:var(--red);">' + Utils.formatCurrency(window.Cart.subtotal()) + '</strong></div>' +
      '<a href="#/shop/checkout" class="btn btn-primary btn-block" style="margin-top:14px;">Lanjut ke Checkout</a>';
    Utils.qsa('[data-inc]', container).forEach(function (b) {
      b.addEventListener('click', function () {
        var id = b.getAttribute('data-inc');
        var line = window.Cart.getItems().filter(function (l) { return l.product_id === id; })[0];
        window.Cart.setQty(id, line.qty + 1); renderInner(container); Router.render();
      });
    });
    Utils.qsa('[data-dec]', container).forEach(function (b) {
      b.addEventListener('click', function () {
        var id = b.getAttribute('data-dec');
        var line = window.Cart.getItems().filter(function (l) { return l.product_id === id; })[0];
        window.Cart.setQty(id, line.qty - 1); renderInner(container); Router.render();
      });
    });
  }
  return { render: render };
})();
