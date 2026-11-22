/**
 * shop/checkout.js - Form checkout: pilih PICKUP/DELIVERY, isi data (jika delivery), metode bayar.
 */
window.Modules = window.Modules || {};
Modules.checkout = (function () {
  function render(container) {
    var buyNow = /[?&]now=1/.test(location.hash), items = window.Cart.getItems();
    if (buyNow) { try { items = JSON.parse(sessionStorage.getItem('azqia_buynow') || '[]'); } catch (e) { items = []; } }
    var subtotal = items.reduce(function (s, l) { return s + l.qty * l.selling_price; }, 0);
    var prof = window.CustAuth.profile() || {}, last = window.MyOrders.lastContact();
    var esc = Utils.escapeHtml;
    if (items.length === 0) { container.innerHTML = '<div class="empty-state"><p>Keranjang kosong.</p><a class="btn btn-primary" href="#/shop/catalog">Belanja Dulu</a></div>'; return Promise.resolve(); }

    container.innerHTML = '<h1>Checkout</h1>' +
      (buyNow ? '<div class="card"><strong>Beli Sekarang</strong>: ' + esc(items[0] ? items[0].product_name : '') + ' x' + (items[0] ? items[0].qty : 0) + '<div class="muted">Isi keranjang lain tidak ikut dipesan.</div></div>' : '') +
      '<div class="card"><strong>Subtotal</strong>: ' + Utils.formatCurrency(subtotal) + '</div>' +
      '<form id="checkout-form">' +
      '<div class="field"><label>Metode Pengambilan</label><select name="fulfillment_type" id="fulfillment"><option value="PICKUP">Ambil di Toko</option><option value="DELIVERY">Diantar (Delivery)</option></select></div>' +
      '<div class="field"><label>Nama</label><input name="customer_name" required value="' + esc(prof.name || last.name) + '"></div>' +
      '<div class="field"><label>No. WhatsApp</label><input name="customer_phone" type="tel" inputmode="tel" placeholder="08xxxxxxxxxx" required value="' + esc(prof.phone_display || last.phone) + '"></div>' +
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
        if (buyNow) { try { sessionStorage.removeItem('azqia_buynow'); } catch (e) {} } else window.Cart.clear();
        window.MyOrders.add({ order_number: result.order_number, verify: String(fd.customer_phone || '').replace(/\D/g, '').slice(-4), name: fd.customer_name, phone: fd.customer_phone, date: new Date().toISOString(), total: result.grand_total, fulfillment_type: fd.fulfillment_type, payment_method: fd.payment_method, items: items.map(function (l) { return { product_name: l.product_name, qty: l.qty }; }) });
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
