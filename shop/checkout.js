/**
 * shop/checkout.js - Form checkout: pilih PICKUP/DELIVERY, isi data (jika delivery), metode bayar.
 */
window.Modules = window.Modules || {};
Modules.checkout = (function () {
  function render(container) {
    var items = window.Cart.getItems();
    if (items.length === 0) { container.innerHTML = '<div class="empty-state"><p>Keranjang kosong.</p><a class="btn btn-primary" href="#/shop/catalog">Belanja Dulu</a></div>'; return Promise.resolve(); }

    container.innerHTML = '<h1>Checkout</h1>' +
      '<div class="card"><strong>Subtotal</strong>: ' + Utils.formatCurrency(window.Cart.subtotal()) + '</div>' +
      '<form id="checkout-form">' +
      '<div class="field"><label>Metode Pengambilan</label><select name="fulfillment_type" id="fulfillment"><option value="PICKUP">Ambil di Toko</option><option value="DELIVERY">Diantar (Delivery)</option></select></div>' +
      '<div class="field"><label>Nama</label><input name="customer_name" required></div>' +
      '<div class="field"><label>No. WhatsApp</label><input name="customer_phone" type="tel" inputmode="tel" placeholder="08xxxxxxxxxx" required></div>' +
      '<div id="delivery-fields" style="display:none;">' +
      '<div class="field"><label>Alamat Pengantaran</label><textarea name="delivery_address" rows="3"></textarea></div>' +
      '</div>' +
      '<div class="field"><label>Metode Pembayaran</label><select name="payment_method" id="pay-method"></select></div>' +
      '<div class="field"><label>Catatan (opsional)</label><input name="notes"></div>' +
      '<button class="btn btn-primary btn-block" type="submit">Buat Pesanan</button>' +
      '</form>';

    var fulfillSel = document.getElementById('fulfillment');
    var deliveryFields = document.getElementById('delivery-fields');
    var paySel = document.getElementById('pay-method');
    // Kunci idempotensi: satu per halaman checkout; dipakai ulang bila tombol ditekan lagi (mencegah pesanan ganda).
    var idemKey = (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : ('K' + Date.now() + Math.random().toString(16).slice(2));
    function drawPayOptions() {
      var delivery = fulfillSel.value === 'DELIVERY';
      paySel.innerHTML = (delivery ? '<option value="COD">Bayar di Tempat (COD)</option>' : '<option value="TUNAI">Tunai di Toko</option>') +
        '<option value="QRIS">QRIS</option><option value="TRANSFER">Transfer Bank</option>';
    }
    drawPayOptions();
    fulfillSel.addEventListener('change', function () {
      var isDelivery = fulfillSel.value === 'DELIVERY';
      deliveryFields.style.display = isDelivery ? 'block' : 'none';
      Utils.qsa('input,textarea', deliveryFields).forEach(function (i) { i.required = isDelivery; });
      drawPayOptions();
    });

    document.getElementById('checkout-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var fd = Object.fromEntries(new FormData(e.target).entries());
      fd.items = items.map(function (l) { return { product_id: l.product_id, qty: l.qty }; });
      fd.idempotency_key = idemKey;
      var btn = e.target.querySelector('button'); btn.disabled = true; btn.textContent = 'Memproses...';
      Api.call('public.checkout', fd).then(function (result) {
        window.Cart.clear();
        result.payment_method = fd.payment_method;
        sessionStorage.setItem('azqia_last_order', JSON.stringify(result));
        Router.navigate('#/shop/payment');
        Router.render();
      }).catch(function (err) {
        Utils.toast(err.message, 'error');
        btn.disabled = false; btn.textContent = 'Buat Pesanan';
      });
    });
    return Promise.resolve();
  }
  return { render: render };
})();
