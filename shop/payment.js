/**
 * shop/payment.js - Instruksi pembayaran setelah checkout (QRIS statis / transfer / COD).
 * Konfirmasi pembayaran FINAL selalu dilakukan manual oleh kasir/pengelola di sisi internal.
 */
window.Modules = window.Modules || {};
Modules.payment = (function () {
  function render(container) {
    var raw = sessionStorage.getItem('azqia_last_order');
    if (!raw) { container.innerHTML = '<div class="empty-state"><p>Tidak ada pesanan aktif.</p><a class="btn btn-primary" href="#/shop/home">Kembali ke Beranda</a></div>'; return Promise.resolve(); }
    var order = JSON.parse(raw);
    var html = '<h1>Selesaikan Pembayaran</h1>' +
      '<div class="card"><div class="row"><span>No. Pesanan</span><strong>' + order.order_number + '</strong></div>' +
      '<div class="row"><span>Total Bayar</span><strong style="color:var(--red);">' + Utils.formatCurrency(order.grand_total) + '</strong></div></div>';

    if (order.payment && order.payment.qris_image_url) {
      html += '<div class="card" style="text-align:center;"><img src="' + order.payment.qris_image_url + '" alt="QRIS" style="max-width:260px;width:100%;"><p class="muted">' + Utils.escapeHtml(order.payment.instructions || '') + '</p></div>';
    } else {
      html += '<div class="card"><p>Selesaikan pembayaran sesuai metode yang dipilih. Pesanan Anda akan diproses staf toko setelah pembayaran diverifikasi.</p></div>';
    }
    html += '<a href="#/shop/order" class="btn btn-primary btn-block">Saya Sudah Membayar</a>' +
      '<a href="#/shop/tracking" class="btn btn-outline btn-block" style="margin-top:8px;">Lacak Pesanan Ini</a>';
    container.innerHTML = html;
    return Promise.resolve();
  }
  return { render: render };
})();
