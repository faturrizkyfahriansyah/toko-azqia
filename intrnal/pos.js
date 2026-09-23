/**
 * internal/pos.js - Kasir (POS). Alur: cari/scan produk -> keranjang -> bayar -> struk.
 */
window.Modules = window.Modules || {};
Modules.pos = (function () {
  var cart = []; // {product_id, product_name, selling_price, qty, discount}

  function findLine(productId) { return cart.filter(function (l) { return l.product_id === productId; })[0]; }
  function addToCart(p) {
    var line = findLine(p.product_id);
    if (line) { line.qty += 1; } else { cart.push({ product_id: p.product_id, product_name: p.product_name, selling_price: Number(p.selling_price), qty: 1, discount: 0 }); }
  }
  function subtotal() { return cart.reduce(function (s, l) { return s + l.qty * l.selling_price - l.discount; }, 0); }

  function render(container) {
    container.innerHTML =
      '<h1>Kasir</h1>' +
      '<div class="search-box"><input id="pos-search" placeholder="Cari nama / SKU / barcode produk..." autofocus></div>' +
      '<div id="pos-results" class="card" style="display:none;max-height:260px;overflow-y:auto;"></div>' +
      '<div class="card"><h3>Keranjang</h3><div id="pos-cart"></div>' +
      '<div class="divider"></div>' +
      '<div class="field"><label>Diskon Transaksi (Rp)</label><input id="pos-discount" type="number" value="0" min="0"></div>' +
      '<div class="row"><strong>Total</strong><strong id="pos-total" style="color:var(--red);font-size:1.2rem;"></strong></div>' +
      '<button class="btn btn-primary btn-block" id="pos-pay" style="margin-top:12px;">Bayar</button>' +
      '</div>';

    var searchInput = document.getElementById('pos-search');
    var doSearch = Utils.debounce(function () {
      var q = searchInput.value.trim();
      var resultsBox = document.getElementById('pos-results');
      if (!q) { resultsBox.style.display = 'none'; return; }
      Api.call('product.list', { search: q, activeOnly: true }).then(function (d) {
        resultsBox.style.display = 'block';
        if (d.products.length === 0) { resultsBox.innerHTML = '<div class="empty-state">Produk tidak ditemukan.</div>'; return; }
        resultsBox.innerHTML = d.products.slice(0, 15).map(function (p) {
          var available = Number(p.current_stock) - Number(p.reserved_stock);
          return '<div class="row" style="padding:8px 0;border-bottom:1px solid var(--border);cursor:pointer;" data-add="' + p.product_id + '">' +
            '<div><div style="font-weight:600;">' + Utils.escapeHtml(p.product_name) + '</div><div class="muted">Stok: ' + available + ' &middot; ' + Utils.formatCurrency(p.selling_price) + '</div></div>' +
            '<button class="btn btn-secondary btn-sm">+ Tambah</button></div>';
        }).join('');
        Utils.qsa('[data-add]', resultsBox).forEach(function (row) {
          row.addEventListener('click', function () {
            var p = d.products.filter(function (x) { return x.product_id === row.getAttribute('data-add'); })[0];
            addToCart(p);
            searchInput.value = ''; resultsBox.style.display = 'none';
            renderCart();
          });
        });
      });
    }, 280);
    searchInput.addEventListener('input', doSearch);

    document.getElementById('pos-discount').addEventListener('input', renderCart);
    document.getElementById('pos-pay').addEventListener('click', openPaymentModal);
    renderCart();
  }

  function renderCart() {
    var box = document.getElementById('pos-cart');
    if (!box) return;
    if (cart.length === 0) { box.innerHTML = '<div class="empty-state">Keranjang kosong. Cari produk di atas.</div>'; }
    else {
      box.innerHTML = cart.map(function (l, idx) {
        return '<div class="cart-item"><div style="flex:1;"><div style="font-weight:600;">' + Utils.escapeHtml(l.product_name) + '</div>' +
          '<div class="muted">' + Utils.formatCurrency(l.selling_price) + ' / item</div></div>' +
          '<div class="qty-control"><button data-dec="' + idx + '">-</button><span>' + l.qty + '</span><button data-inc="' + idx + '">+</button></div>' +
          '<button class="btn btn-ghost btn-sm" data-remove="' + idx + '">Hapus</button></div>';
      }).join('');
      Utils.qsa('[data-inc]', box).forEach(function (b) { b.addEventListener('click', function () { cart[+b.getAttribute('data-inc')].qty++; renderCart(); }); });
      Utils.qsa('[data-dec]', box).forEach(function (b) {
        b.addEventListener('click', function () {
          var l = cart[+b.getAttribute('data-dec')];
          l.qty--; if (l.qty <= 0) cart.splice(+b.getAttribute('data-dec'), 1);
          renderCart();
        });
      });
      Utils.qsa('[data-remove]', box).forEach(function (b) { b.addEventListener('click', function () { cart.splice(+b.getAttribute('data-remove'), 1); renderCart(); }); });
    }
    var discount = Number(document.getElementById('pos-discount').value || 0);
    document.getElementById('pos-total').textContent = Utils.formatCurrency(subtotal() - discount);
  }

  function openPaymentModal() {
    if (cart.length === 0) { Utils.toast('Keranjang masih kosong.', 'error'); return; }
    var discount = Number(document.getElementById('pos-discount').value || 0);
    var total = subtotal() - discount;
    var m = Utils.openModal(
      '<h3>Pembayaran</h3>' +
      '<div class="row"><span>Total Tagihan</span><strong style="font-size:1.3rem;">' + Utils.formatCurrency(total) + '</strong></div>' +
      '<div class="field" style="margin-top:14px;"><label>Metode</label><select id="pay-method"><option value="CASH">Tunai</option><option value="QRIS">QRIS</option><option value="TRANSFER">Transfer</option></select></div>' +
      '<div class="field" id="pay-cash-field"><label>Uang Diterima</label><input id="pay-received" type="number" min="0"></div>' +
      '<div class="row" id="pay-change-row"><span>Kembalian</span><strong id="pay-change">Rp 0</strong></div>' +
      '<button class="btn btn-primary btn-block" id="pay-submit" style="margin-top:14px;">Selesaikan Transaksi</button>'
    );
    var methodSel = m.querySelector('#pay-method');
    var receivedInput = m.querySelector('#pay-received');
    function updateChange() {
      var isCash = methodSel.value === 'CASH';
      m.querySelector('#pay-cash-field').style.display = isCash ? 'block' : 'none';
      m.querySelector('#pay-change-row').style.display = isCash ? 'flex' : 'none';
      var received = Number(receivedInput.value || 0);
      m.querySelector('#pay-change').textContent = Utils.formatCurrency(Math.max(0, received - total));
    }
    methodSel.addEventListener('change', updateChange);
    receivedInput.addEventListener('input', updateChange);
    updateChange();

    m.querySelector('#pay-submit').addEventListener('click', function () {
      var method = methodSel.value;
      var received = method === 'CASH' ? Number(receivedInput.value || 0) : total;
      if (method === 'CASH' && received < total) { Utils.toast('Uang diterima kurang dari total.', 'error'); return; }
      var btn = m.querySelector('#pay-submit'); btn.disabled = true; btn.textContent = 'Memproses...';
      Api.call('pos.createSale', {
        items: cart.map(function (l) { return { product_id: l.product_id, qty: l.qty, discount: l.discount }; }),
        discount: discount, payment: { method: method, amount_received: received }
      }).then(function (result) {
        Utils.closeModal();
        cart = [];
        showReceipt(result.sale_id);
      }).catch(function (err) {
        Utils.toast(err.message, 'error');
        btn.disabled = false; btn.textContent = 'Selesaikan Transaksi';
      });
    });
  }

  function showReceipt(saleId) {
    Api.call('pos.reprintReceipt', { sale_id: saleId }).then(function (data) {
      var m = Utils.openModal(
        '<h3>Transaksi Berhasil</h3>' +
        '<div class="receipt-preview">' + Utils.escapeHtml(window.ReceiptBuilder.buildTextLines(data).join('\n')) + '</div>' +
        '<div class="field-row" style="margin-top:14px;">' +
        '<button class="btn btn-secondary btn-block" id="btn-print">Cetak Struk</button>' +
        '<button class="btn btn-outline btn-block" id="btn-close">Transaksi Baru</button>' +
        '</div>'
      );
      m.querySelector('#btn-print').addEventListener('click', function () {
        window.PrinterManager.print(data).catch(function (e) { Utils.toast(e.message, 'error'); });
      });
      m.querySelector('#btn-close').addEventListener('click', function () { Utils.closeModal(); Router.render(); });
    });
  }

  return { render: render };
})();
