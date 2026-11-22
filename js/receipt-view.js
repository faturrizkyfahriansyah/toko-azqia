/**
 * js/receipt-view.js - Struk di layar (kertas putih ala struk) + BAGIKAN (gambar PNG / teks), tanpa perlu printer.
 * Memakai data struk yang SAMA dengan printer (pos.reprintReceipt / Offline.buildReceipt), jadi isinya selalu identik dengan cetakan.
 * Tidak memakai pustaka luar: gambar dibuat dengan canvas.
 */
window.ReceiptView = (function () {
  var esc = function (s) { return window.Utils ? Utils.escapeHtml(s) : String(s); };
  function rp(n) { return 'Rp' + Math.round(Number(n) || 0).toLocaleString('id-ID'); }
  function label(m) { return { CASH: 'Tunai', QRIS: 'QRIS', TRANSFER: 'Transfer', HUTANG: 'Hutang' }[m] || m; }
  function dateText(iso) { return window.Utils ? Utils.formatDate(iso) : String(iso || ''); }

  /** Satu model dipakai untuk layar, gambar, dan teks -> ketiganya pasti sama. */
  function model(d) {
    var m = { head: [], meta: [], items: [], totals: [], pays: [], status: '', foot: [] };
    m.head.push(d.store_name || 'TOKO AZQIA'); if (d.store_tagline) m.head.push(d.store_tagline); if (d.store_address) m.head.push(d.store_address);
    m.meta.push(['No.', d.sale_number || '-'], ['Tanggal', dateText(d.date)]);
    if (d.cashier_name) m.meta.push(['Kasir', d.cashier_name]);
    if (d.customer_name) m.meta.push(['Pelanggan', d.customer_name]);
    (d.items || []).forEach(function (it) { m.items.push({ name: it.name, qty: it.qty + (it.unit ? ' ' + it.unit : '') + ' x ' + rp(it.unit_price), sub: rp(it.subtotal) }); });
    m.totals.push(['Subtotal', rp(d.subtotal)]); if (d.discount) m.totals.push(['Diskon', '-' + rp(d.discount)]);
    m.total = ['TOTAL', rp(d.total)];
    var pays = d.payments || [];
    if (pays.length > 1) pays.forEach(function (p) { m.pays.push([label(p.method), rp(p.amount)]); });
    else if (pays[0]) {
      var p = pays[0];
      if (p.method === 'CASH') { m.pays.push(['Tunai', rp(p.amount)], ['Kembali', rp(p.change || 0)]); }
      else if (p.method === 'HUTANG') { m.pays.push(['Hutang', rp(p.amount)]); }
      else m.pays.push([label(p.method), rp(p.amount)]);
    }
    var hutang = pays.length === 1 && pays[0].method === 'HUTANG';
    m.status = d.status === 'VOID' ? 'DIBATALKAN' : (hutang || pays.some(function (p) { return p.status === 'PENDING'; }) ? 'BELUM LUNAS' : 'LUNAS');
    if (d.footer_line1) m.foot.push(d.footer_line1); if (d.footer_line2) m.foot.push(d.footer_line2);
    if (d.copyright) m.copy = d.copyright;
    return m;
  }

  /** Kertas struk di layar. */
  function html(d) {
    var m = model(d), h = '<div class="rcpt-paper"><div class="rcpt-head"><strong>' + esc(m.head[0]) + '</strong>';
    m.head.slice(1).forEach(function (t) { h += '<span>' + esc(t) + '</span>'; });
    h += '</div><hr>' + m.meta.map(function (r) { return '<div class="rcpt-row"><span>' + esc(r[0]) + '</span><span>' + esc(r[1]) + '</span></div>'; }).join('') + '<hr>';
    m.items.forEach(function (it) { h += '<div class="rcpt-item"><div>' + esc(it.name) + '</div><div class="rcpt-row"><span>' + esc(it.qty) + '</span><span>' + esc(it.sub) + '</span></div></div>'; });
    h += '<hr>' + m.totals.map(function (r) { return '<div class="rcpt-row"><span>' + esc(r[0]) + '</span><span>' + esc(r[1]) + '</span></div>'; }).join('');
    h += '<div class="rcpt-row rcpt-total"><span>' + esc(m.total[0]) + '</span><span>' + esc(m.total[1]) + '</span></div><hr>';
    h += m.pays.map(function (r) { return '<div class="rcpt-row"><span>' + esc(r[0]) + '</span><span>' + esc(r[1]) + '</span></div>'; }).join('');
    h += '<div class="rcpt-status ' + (m.status === 'LUNAS' ? 'ok' : 'warn') + '">' + esc(m.status) + '</div><hr>';
    h += '<div class="rcpt-foot">' + m.foot.map(function (t) { return '<span>' + esc(t) + '</span>'; }).join('') + (m.copy ? '<small>' + esc(m.copy) + '</small>' : '') + '</div></div>';
    return h;
  }

  /** Teks polos (untuk dibagikan sebagai pesan / disalin). */
  function text(d) {
    var m = model(d), L = [];
    L.push(m.head[0]); m.head.slice(1).forEach(function (t) { L.push(t); });
    L.push('--------------------------------');
    m.meta.forEach(function (r) { L.push(r[0] + ': ' + r[1]); });
    L.push('--------------------------------');
    m.items.forEach(function (it) { L.push(it.name); L.push('  ' + it.qty + ' = ' + it.sub); });
    L.push('--------------------------------');
    m.totals.forEach(function (r) { L.push(r[0] + ': ' + r[1]); });
    L.push(m.total[0] + ': ' + m.total[1]);
    m.pays.forEach(function (r) { L.push(r[0] + ': ' + r[1]); });
    L.push('Status: ' + m.status);
    L.push('--------------------------------');
    m.foot.forEach(function (t) { L.push(t); });
    return L.join('\n');
  }

  /** Gambar PNG struk (canvas). Resolve dengan Blob. */
  function toBlob(d) {
    return new Promise(function (resolve, reject) {
      try {
        var m = model(d), S = 2, W = 360, PAD = 22, MONO = '"Courier New", ui-monospace, monospace', SANS = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
        var cv = document.createElement('canvas'), c = cv.getContext('2d');
        function font(px, bold, fam) { c.font = (bold ? 'bold ' : '') + (px * S) + 'px ' + (fam || MONO); }
        function wrapLines(t, px, bold, maxW) {
          font(px, bold); var words = String(t).split(/\s+/), out = [], cur = '';
          words.forEach(function (w) { var test = cur ? cur + ' ' + w : w; if (c.measureText(test).width <= maxW * S || !cur) cur = test; else { out.push(cur); cur = w; } });
          if (cur) out.push(cur); return out;
        }
        function pass(draw) {
          var y = 40, inner = W - 2 * PAD;
          function center(t, px, bold, color) { wrapLines(t, px, bold, inner).forEach(function (l) { if (draw) { font(px, bold); c.fillStyle = color || '#111'; c.textAlign = 'center'; c.fillText(l, (W / 2) * S, y * S); } y += px * 1.4; }); }
          function row(a, b, px, bold, color) {
            if (draw) { font(px, bold); c.fillStyle = color || '#111'; c.textAlign = 'left'; c.fillText(a, PAD * S, y * S); c.textAlign = 'right'; c.fillText(b, (W - PAD) * S, y * S); } y += px * 1.45;
          }
          function rule() { if (draw) { c.strokeStyle = '#999'; c.setLineDash([5 * S, 4 * S]); c.lineWidth = S; c.beginPath(); c.moveTo(PAD * S, y * S); c.lineTo((W - PAD) * S, y * S); c.stroke(); c.setLineDash([]); } y += 14; }
          center(m.head[0], 19, true); m.head.slice(1).forEach(function (t) { center(t, 12, false, '#444'); }); y += 4; rule();
          m.meta.forEach(function (r) { row(r[0], r[1], 12.5); }); y += 2; rule();
          m.items.forEach(function (it) { wrapLines(it.name, 13, true, inner).forEach(function (l) { if (draw) { font(13, true); c.fillStyle = '#111'; c.textAlign = 'left'; c.fillText(l, PAD * S, y * S); } y += 13 * 1.4; }); row(it.qty, it.sub, 12.5); y += 3; });
          rule(); m.totals.forEach(function (r) { row(r[0], r[1], 13); }); y += 3; row(m.total[0], m.total[1], 17, true); y += 2; rule();
          m.pays.forEach(function (r) { row(r[0], r[1], 13); }); y += 6;
          if (draw) { font(14, true, SANS); c.fillStyle = m.status === 'LUNAS' ? '#15803d' : '#b45309'; c.textAlign = 'center'; c.fillText(m.status, (W / 2) * S, y * S); } y += 22; rule();
          m.foot.forEach(function (t) { center(t, 13, true); }); if (m.copy) { y += 2; center(m.copy, 10.5, false, '#777'); }
          return y + 26;
        }
        font(12, false); var H = Math.ceil(pass(false));
        cv.width = W * S; cv.height = (H + 28) * S; c = cv.getContext('2d');
        c.fillStyle = '#eef0f3'; c.fillRect(0, 0, cv.width, cv.height);
        // kertas putih bergerigi di bawah
        c.fillStyle = '#fff'; c.beginPath(); c.moveTo(8 * S, 8 * S); c.lineTo((W - 8) * S, 8 * S); c.lineTo((W - 8) * S, (H) * S);
        var teeth = 18, tw = (W - 16) / teeth; for (var i = 0; i < teeth; i++) { c.lineTo((W - 8 - tw * (i + 0.5)) * S, (H + 9) * S); c.lineTo((W - 8 - tw * (i + 1)) * S, H * S); }
        c.closePath(); c.fill();
        pass(true);
        cv.toBlob(function (b) { b ? resolve(b) : reject(new Error('Gagal membuat gambar struk.')); }, 'image/png');
      } catch (e) { reject(e); }
    });
  }

  function fileName(d) { return 'struk-' + String(d.sale_number || 'toko').replace(/[^A-Za-z0-9_-]/g, '') + '.png'; }

  function download(blob, name) {
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  }

  /**
   * Bagikan struk. Urutan: lembar bagikan bawaan HP dengan GAMBAR -> dengan TEKS -> panel cadangan (onFallback) bila perangkat tidak mendukung.
   * Mengembalikan Promise<'image'|'text'|'fallback'|'cancel'>.
   */
  function share(d, onFallback) {
    var title = 'Struk ' + (d.store_name || 'TOKO AZQIA') + ' ' + (d.sale_number || ''), txt = text(d);
    function isCancel(e) { return e && (e.name === 'AbortError' || /cancel/i.test(String(e.message || ''))); }
    return toBlob(d).catch(function () { return null; }).then(function (blob) {
      var file = null; try { if (blob) file = new File([blob], fileName(d), { type: 'image/png' }); } catch (e) { file = null; }
      if (file && navigator.canShare && navigator.canShare({ files: [file] }) && navigator.share) {
        return navigator.share({ files: [file], title: title, text: title }).then(function () { return 'image'; }, function (e) { if (isCancel(e)) return 'cancel'; throw e; });
      }
      if (navigator.share) return navigator.share({ title: title, text: txt }).then(function () { return 'text'; }, function (e) { if (isCancel(e)) return 'cancel'; throw e; });
      throw new Error('no-share');
    }).catch(function (e) { if (onFallback) onFallback(); return 'fallback'; });
  }

  /** Cadangan bila lembar bagikan tidak tersedia: unduh gambar, kirim teks lewat WhatsApp, salin teks. */
  function fallbackActions(d) {
    return {
      download: function () { return toBlob(d).then(function (b) { download(b, fileName(d)); }); },
      whatsapp: function () { window.open('https://wa.me/?text=' + encodeURIComponent(text(d)), '_blank'); },
      copy: function () { return (navigator.clipboard && navigator.clipboard.writeText ? navigator.clipboard.writeText(text(d)) : Promise.reject(new Error('x'))); }
    };
  }

  return { html: html, text: text, toBlob: toBlob, share: share, fallbackActions: fallbackActions, model: model };
})();
