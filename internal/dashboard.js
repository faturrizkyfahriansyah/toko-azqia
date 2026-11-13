/**
 * internal/dashboard.js - Beranda (V3 Fase 2).
 * Struktur: Hero (pendapatan hari ini) -> Kondisi Toko (kartu berikon) -> Aksi Cepat ->
 * Transaksi Terbaru -> Notifikasi -> footer kecil. Nama & role hanya di sapaan Hero.
 * Semua angka dibaca dari backend dengan fallback 0 (tidak pernah menampilkan "undefined").
 */
window.Modules = window.Modules || {};
Modules.dashboard = {
  render: function (container) {
    return Api.call('dashboard.summary', {}).then(function (d) {
      if (!container.isConnected) return;
      var I = (window.Layout && window.Layout.ICONS) || {};
      var user = Auth.getUser() || {};
      var firstName = String(user.full_name || user.name || '').trim().split(/\s+/)[0] || 'Pengguna';
      var roleLabel = user.role === 'PEMILIK' ? 'Pemilik' : (user.role || '');
      var n = function (v) { return Number(v) || 0; };
      var rp = function (v) { return Utils.formatCurrency(n(v)); };

      function tile(label, value, href, icon, tone) {
        return '<a class="tile ' + (tone || '') + '" href="' + href + '"><span class="ic">' + (icon || '') + '</span>' +
          '<span class="tx"><div class="l">' + label + '</div><div class="v">' + value + '</div></span></a>';
      }
      function qa(label, href, icon, color) {
        return '<a class="qa ' + (color || '') + '" href="' + href + '"><span class="ic">' + (icon || '') + '</span>' + label + '</a>';
      }
      function section(title, bodyHtml, seeAllHref) {
        return '<div class="section-title"><h2>' + title + '</h2>' + (seeAllHref ? '<a href="' + seeAllHref + '">Lihat semua &rarr;</a>' : '') + '</div>' + bodyHtml;
      }
      function dateBadge(iso) {
        var dt = new Date(iso);
        if (isNaN(dt.getTime())) return '<div class="date-badge"><span class="d">-</span><span class="m">&nbsp;</span></div>';
        return '<div class="date-badge"><span class="d">' + dt.getDate() + '</span><span class="m">' + dt.toLocaleDateString('id-ID', { month: 'short' }) + '</span></div>';
      }

      var recent = (d.recent_transactions || []).slice(0, 5);
      container.innerHTML =
        '<div class="hero-card">' +
        '<div class="hero-hello">Hi, ' + Utils.escapeHtml(firstName) + '</div>' +
        (roleLabel ? '<div class="hero-role">' + Utils.escapeHtml(roleLabel) + ' &middot; TOKO AZQIA</div>' : '') +
        (d.penjualan_hari_ini !== undefined ? '<div class="hero-label">Pendapatan Hari Ini</div><div class="hero-value">' + rp(d.penjualan_hari_ini) + '</div>' : '') +
        '<div class="hero-metrics">' +
        (d.jumlah_transaksi !== undefined ? '<div class="m"><div class="l">Transaksi</div><div class="v">' + n(d.jumlah_transaksi) + '</div></div>' : '') +
        (d.laba_kotor !== undefined ? '<div class="m"><div class="l">Laba Kotor</div><div class="v">' + rp(d.laba_kotor) + '</div></div>' : '') +
        (d.pengeluaran !== undefined ? '<div class="m"><div class="l">Pengeluaran</div><div class="v">' + rp(d.pengeluaran) + '</div></div>' : '') +
        '</div></div>' +

        section('Kondisi Toko',
          '<div class="tile-grid">' +
          (d.produk_stok_menipis !== undefined ? tile('Produk Menipis', n(d.produk_stok_menipis), '#/internal/inventory', I.alert, n(d.produk_stok_menipis) > 0 ? 'warn' : '') : '') +
          (d.produk_habis !== undefined ? tile('Produk Habis', n(d.produk_habis), '#/internal/inventory', I.box, n(d.produk_habis) > 0 ? 'danger' : '') : '') +
          (d.pesanan_online !== undefined ? tile('Pesanan Baru', n(d.pesanan_online), '#/internal/orders', I.bag, 'info') : '') +
          (d.pesanan_menunggu_diproses !== undefined ? tile('Perlu Diproses', n(d.pesanan_menunggu_diproses), '#/internal/orders', I.truck, n(d.pesanan_menunggu_diproses) > 0 ? 'warn' : '') : '') +
          (d.promo_aktif_count !== undefined ? tile('Promo Aktif', n(d.promo_aktif_count), '#/internal/promos', I.tagPromo, 'ok') : '') +
          (d.piutang_outstanding !== undefined ? tile('Piutang Pelanggan', rp(d.piutang_outstanding), '#/internal/receivables', I.card, n(d.piutang_outstanding) > 0 ? 'info' : '') : '') +
          '</div>') +

        section('Aksi Cepat',
          '<div class="qa-grid">' +
          (Auth.canAccess('#/internal/products') ? qa('Tambah Produk', '#/internal/products', I.plus, '') : '') +
          (Auth.canAccess('#/internal/purchases') ? qa('Barang Masuk', '#/internal/purchases', I.inbox, 'c-blue') : '') +
          (Auth.canAccess('#/internal/receivables') ? qa('Piutang', '#/internal/receivables', I.card, 'c-gold') : '') +
          (Auth.canAccess('#/internal/inventory') ? qa('Stok', '#/internal/inventory', I.clipboard, 'c-green') : '') +
          (Auth.role() === 'KASIR' ? qa('Kasir', '#/internal/pos', I.plus, '') : '') +
          (Auth.role() === 'ADMIN_WA' ? qa('WhatsApp', '#/internal/whatsapp', I.bag, 'c-green') : '') +
          '</div>') +

        section('Transaksi Terbaru',
          (recent.length === 0
            ? '<div class="empty-state"><img src="assets/icons/tokoqia-empty-state.png" alt=""><div class="empty-title">Belum ada transaksi</div><div class="empty-sub">Transaksi dari Kasir akan muncul di sini.</div></div>'
            : recent.map(function (t) {
                return '<a class="tx-card" href="#/internal/transactions" style="color:inherit;">' + dateBadge(t.sale_date) +
                  '<div class="main"><div class="no">' + Utils.escapeHtml(t.sale_number) + '</div><div class="amt">' + rp(t.total) + '</div></div></a>';
              }).join('')),
          '#/internal/transactions') +

        section('Notifikasi', '<div id="dash-notif-list"><div class="spinner"></div></div>') +
        '<div class="footer-mini">' +
        '<strong>TOKO AZQIA</strong><br>' +
        'Melayani Kebutuhan,<br>Membangun Kepercayaan.<br><br>' +
        'Kp. Kecok, RT/RW 004/001,<br>Ds. Jeungjing, Kec. Cisoka,<br>Kab. Tangerang, Banten 15730<br><br>' +
        'Developer by TOKOQIA<br>Developer by Patriski Marionsha' +
        '</div>';

      Api.call('notification.list', {}).then(function (nd) {
        var box = document.getElementById('dash-notif-list');
        if (!box) return;
        var list = (nd && nd.notifications) || [];
        if (list.length === 0) { box.innerHTML = '<div class="empty-ok">Tidak ada notifikasi baru.</div>'; return; }
        box.innerHTML = '<div class="stat-list">' + list.slice(0, 5).map(function (x) {
          return '<div class="row"><span>' + Utils.escapeHtml(x.title) + '</span><span class="muted" style="font-size:0.72rem;">' + Utils.formatDate(x.created_at) + '</span></div>';
        }).join('') + '</div>';
      }).catch(function () {
        var box = document.getElementById('dash-notif-list');
        if (box) box.innerHTML = '<div class="empty-ok">Tidak ada notifikasi baru.</div>';
      });
    });
  }
};
