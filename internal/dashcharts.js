/**
 * internal/dashcharts.js - Grafik Beranda (Pemilik/Pengelola): tren penjualan, komposisi kanal, produk terlaris.
 * Digambar dengan SVG biasa (tanpa pustaka). Data dari dashboard.charts (tanpa laba/HPP).
 */
window.Modules = window.Modules || {};
Modules.dashCharts = (function () {
  var PERIODS = [['today', 'Hari ini'], ['7d', '7 hari'], ['30d', '30 hari'], ['month', 'Bulan ini']];
  var COLORS = { KASIR: '#d81324', WEBSITE: '#2563eb', WHATSAPP: '#16a34a', LAINNYA: '#d97706' };
  var esc = function (s) { return Utils.escapeHtml(String(s === undefined || s === null ? '' : s)); };
  var rp = function (v) { return Utils.formatCurrency(Number(v) || 0); };
  function short(v) { v = Number(v) || 0; return v >= 1e6 ? (Math.round(v / 1e5) / 10) + ' jt' : (v >= 1e3 ? Math.round(v / 1e3) + ' rb' : String(v)); }

  function bars(series) {
    var W = 320, H = 130, padL = 6, padB = 20, padT = 14, max = Math.max.apply(null, series.map(function (s) { return s.sales; }).concat([1]));
    var n = series.length, gap = n > 15 ? 2 : 6, bw = (W - padL * 2 - gap * (n - 1)) / n, out = '';
    series.forEach(function (s, i) {
      var h = Math.max(s.sales > 0 ? 2 : 0, (H - padB - padT) * s.sales / max), x = padL + i * (bw + gap), y = H - padB - h;
      out += '<rect x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + h.toFixed(1) + '" rx="2" fill="' + (i === n - 1 ? '#d81324' : '#f0a3ab') + '"><title>' + esc(s.date) + ': ' + esc(rp(s.sales)) + ' (' + s.tx + ' transaksi)</title></rect>';
      if (n <= 8 || i % Math.ceil(n / 6) === 0 || i === n - 1) out += '<text x="' + (x + bw / 2).toFixed(1) + '" y="' + (H - 6) + '" text-anchor="middle" font-size="9" fill="#6b7280">' + esc(series[i].date.substring(8, 10) + '/' + series[i].date.substring(5, 7)) + '</text>';
    });
    out += '<text x="' + padL + '" y="9" font-size="9" fill="#6b7280">maks ' + esc(short(max)) + '</text>';
    return '<svg viewBox="0 0 ' + W + ' ' + H + '" class="dc-bars" role="img" aria-label="Grafik penjualan harian">' + out + '</svg>';
  }
  function donut(channels, total) {
    if (!channels.length || !total) return '<div class="muted" style="padding:18px 0;text-align:center;">Belum ada penjualan.</div>';
    var C = 2 * Math.PI * 15.9155, off = 0, arcs = '';
    channels.forEach(function (c) { var p = c.sales / total * 100; arcs += '<circle cx="21" cy="21" r="15.9155" fill="none" stroke="' + COLORS[c.key] + '" stroke-width="6" stroke-dasharray="' + p.toFixed(2) + ' ' + (100 - p).toFixed(2) + '" stroke-dashoffset="' + (25 - off).toFixed(2) + '"></circle>'; off += p; });
    var legend = channels.map(function (c) { return '<div class="dc-leg"><span class="dc-sw" style="background:' + COLORS[c.key] + '"></span><span class="dc-ln">' + esc(c.label) + '</span><span class="dc-lv">' + Math.round(c.sales / total * 100) + '%</span></div>'; }).join('');
    return '<div class="dc-donut"><svg viewBox="0 0 42 42" role="img" aria-label="Komposisi penjualan per kanal"><circle cx="21" cy="21" r="15.9155" fill="none" stroke="#eef0f3" stroke-width="6"></circle>' + arcs + '<text x="21" y="22.5" text-anchor="middle" font-size="5" font-weight="700" fill="#202428">' + esc(short(total)) + '</text></svg><div>' + legend + '</div></div>';
  }
  function draw(box, d, period) {
    var t = d.totals, delta = t.prev_sales > 0 ? Math.round((t.sales - t.prev_sales) / t.prev_sales * 100) : null;
    var chips = PERIODS.map(function (p) { return '<button class="chip' + (p[0] === period ? ' active' : '') + '" data-p="' + p[0] + '">' + p[1] + '</button>'; }).join('');
    var top = d.top.length ? d.top.map(function (x, i) { return '<div class="dc-top"><span class="dc-rk">' + (i + 1) + '</span><span class="dc-tn">' + esc(x.name) + '</span><span class="dc-tq">' + x.qty + '</span><span class="dc-tv">' + esc(rp(x.revenue)) + '</span></div>'; }).join('') : '<div class="muted">Belum ada penjualan pada periode ini.</div>';
    box.innerHTML = '<div class="chip-row" id="dc-chips" style="margin:0 0 10px;">' + chips + '</div>' +
      '<div class="dc-kpis"><div class="dc-kpi"><div class="l">Penjualan</div><div class="v">' + esc(rp(t.sales)) + '</div>' + (delta !== null ? '<div class="s ' + (delta >= 0 ? 'up' : 'down') + '">' + (delta >= 0 ? '+' : '') + delta + '% vs periode lalu</div>' : '<div class="s muted">&nbsp;</div>') + '</div>' +
      '<div class="dc-kpi"><div class="l">Transaksi</div><div class="v">' + t.tx + '</div><div class="s muted">Rata-rata ' + esc(rp(t.avg)) + '</div></div></div>' +
      '<div class="card dc-card"><div class="dc-h">Tren penjualan</div>' + bars(d.series) + '</div>' +
      '<div class="card dc-card"><div class="dc-h">Komposisi kanal</div>' + donut(d.channels, t.sales) + '</div>' +
      '<div class="card dc-card"><div class="dc-h">Produk terlaris</div><div class="dc-top dc-thead"><span class="dc-rk">#</span><span class="dc-tn">Produk</span><span class="dc-tq">Terjual</span><span class="dc-tv">Omzet</span></div>' + top + '</div>';
    Utils.qsa('#dc-chips [data-p]', box).forEach(function (b) { b.addEventListener('click', function () { render(box, b.getAttribute('data-p')); }); });
  }
  function render(box, period) {
    period = period || '7d';
    return Api.call('dashboard.charts', { period: period }).then(function (d) { if (box.isConnected) draw(box, d, period); })
      .catch(function (e) { if (box.isConnected) box.innerHTML = '<div class="muted">Grafik belum dapat dimuat (' + esc(e.message) + ').</div>'; });
  }
  return { render: render };
})();
