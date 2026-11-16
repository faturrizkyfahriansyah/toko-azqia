/**
 * shop/account.js - Tab Akun. Akun pelanggan (masuk/daftar, alamat, riwayat) menyusul di fase berikutnya;
 * sementara: informasi toko, bantuan, dan kontak. Berbelanja tidak memerlukan akun.
 */
window.Modules = window.Modules || {};
Modules.shopaccount = (function () {
  var esc = function (s) { return Utils.escapeHtml(String(s === undefined || s === null ? '' : s)); };
  function render(container) {
    container.innerHTML = '<h1 class="shop-title">Akun</h1>' +
      '<div class="card"><h3 style="margin-top:0;">Belanja tanpa akun</h3><p class="muted" style="margin:0;">Anda tidak perlu mendaftar untuk berbelanja. Masuk dan daftar akun (riwayat pesanan, alamat tersimpan, favorit) akan tersedia segera.</p></div>' +
      '<div id="acc-info"></div>' +
      '<div class="menu-group-label">BANTUAN</div><div class="menu-list">' +
      '<a class="menu-item" href="#/shop/orders"><span class="menu-tx">Cek status pesanan</span><span class="menu-go">' + Layout.ICONS.chevron + '</span></a>' +
      '<a class="menu-item" href="#/shop/catalog"><span class="menu-tx">Lihat semua produk</span><span class="menu-go">' + Layout.ICONS.chevron + '</span></a></div>';
    return Api.call('public.storeInfo', {}).then(function (s) {
      var rows = [];
      if (s.store_address) rows.push(['Alamat', esc(s.store_address)]);
      if (s.store_hours) rows.push(['Jam buka', esc(s.store_hours)]);
      if (s.store_contact) rows.push(['WhatsApp', '<a href="' + Utils.waLink(s.store_contact) + '" target="_blank" rel="noopener">' + Utils.formatPhoneId(s.store_contact) + '</a>']);
      var box = container.querySelector('#acc-info'); if (!box) return;
      box.innerHTML = rows.length ? '<div class="menu-group-label">TOKO</div><div class="menu-list">' + rows.map(function (r) { return '<div class="menu-item static"><span class="menu-tx"><span class="muted" style="display:block;font-size:0.75rem;">' + r[0] + '</span>' + r[1] + '</span></div>'; }).join('') + '</div>' : '';
    }).catch(function () {});
  }
  return { render: render };
})();
