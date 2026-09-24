/**
 * internal/dashboard.js — Beranda Pengelola (Prompt Final: Beranda + Brand Asset Integration).
 * Struktur: Hero -> Ringkasan -> Kondisi Toko -> Aksi Cepat -> Transaksi Terbaru -> Informasi ->
 * Notifikasi -> Footer kecil. Nama/role TIDAK muncul di header (hanya avatar) - hanya muncul
 * ringkas 1 baris di Hero sesuai spesifikasi ("Fatur · Pemilik").
 *
 * CATATAN JUJUR: baris identitas di Hero memakai nama depan + ROLE ASLI pengguna (data nyata),
 * BUKAN kode karyawan seperti "PGN-001" pada contoh di prompt - sistem ini tidak punya field
 * kode karyawan, dan kami tidak mengarang data itu (lihat PANDUAN_DEPLOY.md).
 */
window.Modules = window.Modules || {};
Modules.dashboard = {
  render: function (container) {
    return Api.call('dashboard.summary', {}).then(function (d) {
      if (!container.isConnected) return;
      var user = Auth.getUser() || {};
      var firstName = (user.full_name || '').trim().split(/\s+/)[0] || 'Pengguna';
      var roleLabel = user.role === 'PEMILIK' ? 'Pemilik' : (user.role || '-');

      container.innerHTML =
        heroHtml(firstName, roleLabel) +
        section('Ringkasan',
          '<div class="kpi-grid">' +
          kpi('Transaksi', d.jumlah_transaksi) +
          kpi('Pendapatan', Utils.formatCurrency(d.penjualan_hari_ini), true) +
          kpi('Pengeluaran', Utils.formatCurrency(d.pengeluaran)) +
          kpi('Laba Kotor', Utils.formatCurrency(d.laba_kotor), true) +
          '</div>') +
        section('Kondisi Toko',
          '<div class="status-grid">' +
          statusCell('Produk Menipis', d.produk_stok_menipis, '#/internal/inventory', d.produk_stok_menipis > 0 ? 'warn' : '') +
          statusCell('Produk Habis', d.produk_habis, '#/internal/inventory', d.produk_habis > 0 ? 'danger' : '') +
          statusCell('Pesanan Baru', d.pesanan_online, '#/internal/orders', '') +
          statusCell('Pesanan Perlu Diproses', d.pesanan_menunggu_diproses, '#/internal/orders', d.pesanan_menunggu_diproses > 0 ? 'warn' : '') +
          statusCell('Promo', d.promo_aktif_count, '#/internal/promos', '') +
          statusCell('Piutang Pelanggan', Utils.formatCurrency(d.piutang_outstanding || 0), '#/internal/receivables', '') +
          '</div>') +
        section('Aksi Cepat',
          '<div class="quick-actions"><div class="secondary-row">' +
          '<a href="#/internal/products" class="btn btn-outline">+ Produk</a>' +
          '<a href="#/internal/purchases" class="btn btn-outline">Barang Masuk</a>' +
          '<a href="#/internal/receivables" class="btn btn-outline">Piutang Pelanggan</a>' +
          '<a href="#/internal/inventory" class="btn btn-outline">Stok</a>' +
          '</div></div>') +
        section('Transaksi Terbaru',
          (d.recent_transactions.length === 0
            ? '<div class="empty-state"><img src="assets/icons/tokoqia-empty-state.png" alt=""><div class="empty-title">Belum ada transaksi hari ini</div></div>'
            : '<div class="stat-list">' + d.recent_transactions.slice(0, 5).map(function (t) {
                return '<div class="row"><span>' + t.sale_number + '</span><span>' + Utils.formatCurrency(t.total) + '</span></div>';
              }).join('') + '</div>'),
          '#/internal/transactions') +
        section('Informasi',
          '<div class="card muted" style="font-size:0.85rem;">Gunakan menu <strong>Test Print</strong> di Pengaturan -> Printer untuk memastikan printer thermal tersambung sebelum toko buka. Data Piutang &amp; Hutang yang jatuh tempo ditandai otomatis di masing-masing menu.</div>') +
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
        if (nd.notifications.length === 0) { box.innerHTML = '<div class="empty-ok">Tidak ada notifikasi baru.</div>'; return; }
        box.innerHTML = '<div class="stat-list">' + nd.notifications.slice(0, 5).map(function (n) {
          return '<div class="row"><span>' + Utils.escapeHtml(n.title) + '</span><span class="muted" style="font-size:0.72rem;">' + Utils.formatDate(n.created_at) + '</span></div>';
        }).join('') + '</div>';
      }).catch(function () {});

      function heroHtml(name, role) {
        return '<div class="greeting"><div class="hello">Hi ' + Utils.escapeHtml(name) + ', Selamat datang &#128075;</div>' +
          '<p class="sub" style="margin-bottom:2px;">Pantau aktivitas dan kondisi TOKO AZQIA hari ini.</p>' +
          '<div class="hero-userline">' + Utils.escapeHtml(name) + ' &middot; ' + Utils.escapeHtml(role) + '</div></div>';
      }
      function section(title, bodyHtml, seeAllHref) {
        return '<div class="section-title"><h2>' + title + '</h2>' + (seeAllHref ? '<a href="' + seeAllHref + '">Lihat semua &rarr;</a>' : '') + '</div>' + bodyHtml;
      }
      function kpi(label, value, accent) {
        return '<div class="kpi' + (accent ? ' accent' : '') + '"><div class="label">' + label + '</div><div class="value">' + value + '</div></div>';
      }
      function statusCell(label, value, href, tone) {
        return '<a class="status-cell' + (tone ? ' ' + tone : '') + '" href="' + href + '"><div class="label">' + label + '</div><div class="value">' + value + '</div></a>';
      }
    });
  }
};
