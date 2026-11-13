/**
 * internal/reconcile.js - Rekonsiliasi data (Orders <-> Sales <-> Payments <-> Stok <-> Kas <-> Laporan). Hanya membaca.
 */
window.Modules = window.Modules || {};
Modules.reconcile = (function () {
  function esc(s) { return Utils.escapeHtml(String(s === undefined || s === null ? '' : s)); }
  var LABEL = { OK: 'Sesuai', MISMATCH: 'TIDAK SESUAI', INFO: 'Perlu tindakan', SKIPPED: 'Dilewati' };
  var BADGE = { OK: 'green', MISMATCH: 'red', INFO: 'gold', SKIPPED: '' };

  function render(container) {
    container.innerHTML = '<div class="row"><h1>Rekonsiliasi Data</h1><button class="btn btn-primary" id="rc-run">Jalankan</button></div>' +
      '<p class="muted">Memeriksa kecocokan pesanan, penjualan, pembayaran, stok, kas, dan laporan. Hanya membaca &mdash; tidak mengubah data.</p><div id="rc-body"><div class="empty-state"><div class="empty-sub">Tekan <strong>Jalankan</strong> untuk memeriksa.</div></div></div>';
    var btn = container.querySelector('#rc-run');
    function run() {
      var body = container.querySelector('#rc-body'); btn.disabled = true; btn.textContent = 'Memeriksa...'; Utils.showLoading(body);
      return Api.call('system.reconcile', {}, { timeoutMs: 60000 }).then(function (d) {
        var s = d.summary;
        body.innerHTML = '<div class="stat-grid"><div class="stat green"><div class="l">Sesuai</div><div class="v">' + s.ok + '</div></div><div class="stat' + (s.mismatch ? ' accent' : '') + '"><div class="l">Tidak sesuai</div><div class="v">' + s.mismatch + '</div></div>' +
          '<div class="stat"><div class="l">Perlu tindakan</div><div class="v">' + s.info + '</div></div><div class="stat"><div class="l">Dilewati</div><div class="v">' + s.skipped + '</div></div></div>' +
          '<div class="hint">' + d.counts.orders + ' pesanan &middot; ' + d.counts.sales + ' penjualan &middot; ' + d.counts.payments + ' pembayaran &middot; ' + d.counts.stock_movements + ' mutasi stok &middot; ' + d.counts.cash_movements + ' mutasi kas &middot; ' + (d.duration_ms / 1000).toFixed(1).replace('.', ',') + ' dtk' + (d.unified_sales ? '' : ' &middot; penjualan terpadu MATI') + '</div>' +
          (s.mismatch ? '<div class="card wa-warn">&#9888; Ada data yang tidak sesuai. Jangan menghapus apa pun; kirim hasil ini ke pengembang.</div>' : '<div class="empty-ok">Semua pemeriksaan wajib sesuai.</div>') +
          d.checks.map(function (c) {
            return '<div class="rc-check ' + c.status + '"><div class="rc-head"><span>' + esc(c.id) + ' &middot; ' + esc(c.name) + '</span><span class="badge ' + BADGE[c.status] + '">' + LABEL[c.status] + '</span></div>' +
              '<div class="muted">' + esc(c.detail) + '</div>' + (c.sample && c.sample.length ? '<ul class="rc-sample">' + c.sample.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>' : '') + '</div>';
          }).join('');
      }).catch(function (err) {
        body.innerHTML = '<div class="empty-state"><h2>Gagal memeriksa</h2><p>' + esc(err.message) + '</p></div>';
      }).then(function () { btn.disabled = false; btn.textContent = 'Jalankan ulang'; });
    }
    btn.addEventListener('click', run);
  }
  return { render: render };
})();
