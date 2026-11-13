/**
 * shop/ui.js - Komponen bersama website pelanggan: kartu produk, kisi, lembar detail, chip kategori.
 * Perubahan keranjang memperbarui kartu itu saja (tanpa memuat ulang halaman/data).
 */
window.Modules = window.Modules || {};
Modules.shopui = (function () {
  var HUES = ['#d81324', '#0b3d91', '#1a7f45', '#b5750b', '#6a2c91', '#0f766e'];
  function esc(s) { return Utils.escapeHtml(String(s === undefined || s === null ? '' : s)); }
  function hue(catId) { var h = 0, s = String(catId || ''); for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 997; return HUES[h % HUES.length]; }
  function inCart(id) { var l = window.Cart.getItems().filter(function (x) { return x.product_id === id; })[0]; return l ? l.qty : 0; }
  function price(p) {
    return '<span class="p-now">' + Utils.formatCurrency(p.promo_price || p.selling_price) + '</span>' + (p.promo_price ? ' <s class="p-old">' + Utils.formatCurrency(p.selling_price) + '</s>' : '');
  }
  function actHtml(p) {
    if (!p.available) return '<span class="badge grey">Stok habis</span>';
    var q = inCart(p.product_id);
    return q > 0
      ? '<div class="stepper" data-id="' + esc(p.product_id) + '"><button type="button" data-dec="' + esc(p.product_id) + '" aria-label="Kurangi">&minus;</button><span>' + q + '</span><button type="button" data-inc="' + esc(p.product_id) + '" aria-label="Tambah">+</button></div>'
      : '<button type="button" class="btn btn-primary btn-sm" data-add="' + esc(p.product_id) + '">+ Keranjang</button>';
  }
  function card(p) {
    return '<article class="p-card" data-card="' + esc(p.product_id) + '"><button type="button" class="p-open" data-open="' + esc(p.product_id) + '">' +
      '<span class="p-tile" style="background:' + hue(p.category_id) + '">' + (p.photo_id ? '<img class="p-img" loading="lazy" alt="" src="' + Utils.photoUrl(p.photo_id, 360) + '" onerror="this.remove()">' : '') + '<span class="p-ini">' + esc(String(p.product_name || '?').charAt(0).toUpperCase()) + '</span></span>' +
      '<span class="p-name">' + esc(p.product_name) + '</span><span class="p-price">' + price(p) + '</span></button>' +
      '<div class="p-foot">' + (p.available && p.minimum_stock_reached ? '<span class="badge gold">Terbatas</span>' : '') + '<span class="p-act" data-act="' + esc(p.product_id) + '">' + actHtml(p) + '</span></div></article>';
  }
  function grid(products) { return '<div class="p-grid">' + products.map(card).join('') + '</div>'; }
  function chips(categories, activeId, hrefBase) {
    return '<div class="shop-chips"><a class="shop-chip' + (!activeId ? ' active' : '') + '" href="' + hrefBase + '">Semua</a>' +
      categories.map(function (c) { return '<a class="shop-chip' + (activeId === c.category_id ? ' active' : '') + '" href="' + hrefBase + '?category=' + encodeURIComponent(c.category_id) + '">' + esc(c.category_name) + '</a>'; }).join('') + '</div>';
  }
  function refreshAct(root, p) { var el = root.querySelector('[data-act="' + p.product_id + '"]'); if (el) el.innerHTML = actHtml(p); }
  function badge() { if (window.Layout && Layout.updateCartBadge) Layout.updateCartBadge(); }

  function openDetail(p, root) {
    var qty = Math.max(1, inCart(p.product_id) || 1);
    var m = Utils.openModal('<div class="p-detail"><span class="p-tile big" style="background:' + hue(p.category_id) + '">' + (p.photo_id ? '<img class="p-img" alt="" src="' + Utils.photoUrl(p.photo_id, 600) + '" onerror="this.remove()">' : '') + '<span class="p-ini">' + esc(String(p.product_name || '?').charAt(0).toUpperCase()) + '</span></span>' +
      '<h3>' + esc(p.product_name) + '</h3><div class="p-price big">' + price(p) + '</div>' +
      (p.brand ? '<div class="muted">' + esc(p.brand) + '</div>' : '') +
      '<div style="margin:8px 0;">' + (!p.available ? '<span class="badge grey">Stok habis</span>' : (p.minimum_stock_reached ? '<span class="badge gold">Stok terbatas</span>' : '<span class="badge green">Tersedia</span>')) + '</div>' +
      (p.available ? '<div class="stepper big" id="d-step"><button type="button" id="d-dec" aria-label="Kurangi">&minus;</button><span id="d-qty">' + qty + '</span><button type="button" id="d-inc" aria-label="Tambah">+</button></div>' +
        '<button type="button" class="btn btn-primary btn-block" id="d-add" style="margin-top:12px;">Masukkan ke Keranjang</button>' : '') + '</div>');
    if (!p.available) return;
    m.querySelector('#d-dec').addEventListener('click', function () { qty = Math.max(1, qty - 1); m.querySelector('#d-qty').textContent = qty; });
    m.querySelector('#d-inc').addEventListener('click', function () { qty = Math.min(99, qty + 1); m.querySelector('#d-qty').textContent = qty; });
    m.querySelector('#d-add').addEventListener('click', function () {
      var cur = inCart(p.product_id); window.Cart.setQty(p.product_id, 0); window.Cart.add(p, cur ? qty : qty);
      if (root) refreshAct(root, p); badge(); Utils.toast('Ditambahkan ke keranjang.', 'success'); Utils.closeModal && Utils.closeModal();
    });
  }

  /** Pasang interaksi pada kontainer (delegasi): tambah/kurang/buka detail. byId: peta produk yang sedang ditampilkan. */
  function wire(root, getById) {
    if (root.__shopWired) return; root.__shopWired = true;
    root.addEventListener('click', function (e) {
      var t = e.target.closest('[data-add],[data-inc],[data-dec],[data-open]'); if (!t) return;
      var id = t.getAttribute('data-add') || t.getAttribute('data-inc') || t.getAttribute('data-dec') || t.getAttribute('data-open'), p = getById(id); if (!p) return;
      if (t.hasAttribute('data-open')) { openDetail(p, root); return; }
      var q = inCart(id);
      if (t.hasAttribute('data-add')) window.Cart.add(p, 1);
      else if (t.hasAttribute('data-inc')) window.Cart.setQty(id, Math.min(99, q + 1));
      else window.Cart.setQty(id, q - 1);
      refreshAct(root, p); badge();
    });
  }
  return { card: card, grid: grid, chips: chips, wire: wire, esc: esc, hue: hue };
})();
