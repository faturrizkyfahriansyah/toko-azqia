/**
 * shop/order.js - Halaman konfirmasi setelah checkout.
 */
window.Modules = window.Modules || {};
Modules.order = (function () {
  function render(container) {
    var raw = sessionStorage.getItem('azkia_last_order');
    if (!raw) { container.innerHTML = '<div class="empty-state"><p>Tidak ada pesanan untuk ditampilkan.</p><a class="btn btn-primary" href="#/shop/home">Kembali ke Beranda</a></div>'; return Promise.resolve(); }
    var order = JSON.parse(raw);
    container.innerHTML =
      '<div class="empty-state">' +
      '<h1 style="color:var(--success, #1a7f45);">Pesanan Diterima</h1>' +
      '<p>Nomor pesanan Anda:</p><h2 style="color:var(--red);">' + order.order_number + '</h2>' +
      '<p>Simpan nomor ini untuk melacak status pesanan Anda.</p>' +
      '<a href="#/shop/tracking" class="btn btn-primary">Lacak Pesanan</a> ' +
      '<a href="#/shop/home" class="btn btn-outline">Belanja Lagi</a>' +
      '</div>';
    return Promise.resolve();
  }
  return { render: render };
})();
