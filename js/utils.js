/**
 * js/utils.js - helper umum dipakai internal & shop.
 */
window.Utils = (function () {
  function formatCurrency(n) {
    n = Number(n) || 0;
    return 'Rp\u00A0' + Math.round(n).toLocaleString('id-ID'); // spasi tak-terpisah: "Rp 30.000" tidak pecah antar baris
  }
  function formatDate(iso) {
    if (!iso) return '-';
    var d = new Date(iso);
    if (isNaN(d.getTime())) return String(iso);
    return d.toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }
  function formatDateOnly(iso) {
    if (!iso) return '-';
    var d = new Date(iso);
    if (isNaN(d.getTime())) return String(iso);
    return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
  }
  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function qs(sel, root) { return (root || document).querySelector(sel); }
  function qsa(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function el(html) {
    var t = document.createElement('template');
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
  }
  function debounce(fn, wait) {
    var timer;
    return function () {
      var args = arguments, ctx = this;
      clearTimeout(timer);
      timer = setTimeout(function () { fn.apply(ctx, args); }, wait || 300);
    };
  }

  var toastWrap;
  function toast(message, type) {
    if (!toastWrap) {
      toastWrap = document.createElement('div');
      toastWrap.className = 'toast-wrap';
      document.body.appendChild(toastWrap);
    }
    var node = el('<div class="toast ' + (type || 'info') + '">' + escapeHtml(message) + '</div>');
    toastWrap.appendChild(node);
    setTimeout(function () { node.remove(); }, 3600);
  }

  function openModal(innerHtml) {
    var backdrop = el('<div class="modal-backdrop"><div class="modal">' + innerHtml + '</div></div>');
    document.body.appendChild(backdrop);
    backdrop.addEventListener('click', function (e) { if (e.target === backdrop) closeModal(); });
    document.body.style.overflow = 'hidden';
    return backdrop;
  }
  function closeModal() {
    qsa('.modal-backdrop').forEach(function (n) { n.remove(); });
    document.body.style.overflow = '';
  }

  /** Kecilkan foto di perangkat (sisi terpanjang <= maxSide, JPEG) sebelum diunggah: cepat, hemat kuota & ruang Drive. -> {mime, data(base64), dataUrl, bytes} */
  function resizeImage(file, maxSide, quality) {
    maxSide = maxSide || 800; quality = quality || 0.8;
    return new Promise(function (resolve, reject) {
      var img = new Image(), url = URL.createObjectURL(file);
      img.onload = function () {
        var w = img.naturalWidth, h = img.naturalHeight, k = Math.min(1, maxSide / Math.max(w, h));
        var cv = document.createElement('canvas'); cv.width = Math.max(1, Math.round(w * k)); cv.height = Math.max(1, Math.round(h * k));
        var c2 = cv.getContext('2d'); c2.fillStyle = '#fff'; c2.fillRect(0, 0, cv.width, cv.height); c2.drawImage(img, 0, 0, cv.width, cv.height);
        var q = quality, dataUrl = cv.toDataURL('image/jpeg', q);
        while (dataUrl.length * 0.75 > 450 * 1024 && q > 0.35) { q -= 0.1; dataUrl = cv.toDataURL('image/jpeg', q); }
        URL.revokeObjectURL(url);
        resolve({ mime: 'image/jpeg', data: dataUrl.split(',')[1], dataUrl: dataUrl, bytes: Math.round(dataUrl.length * 0.75) });
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('Berkas bukan gambar yang dapat dibaca.')); };
      img.src = url;
    });
  }

  /** Nomor Indonesia -> 0856-9476-5370 (angka 0 di depan yang hilang karena disimpan sebagai angka dipulihkan). */
  function formatPhoneId(raw) {
    var d = String(raw || '').replace(/\D/g, ''); if (!d) return '';
    if (d.indexOf('62') === 0) d = '0' + d.slice(2); else if (d.charAt(0) === '8') d = '0' + d;
    return d.replace(/^(\d{4})(\d{4})(\d+)$/, '$1-$2-$3');
  }
  function waLink(raw) {
    var d = String(raw || '').replace(/\D/g, ''); if (d.indexOf('0') === 0) d = '62' + d.slice(1); else if (d.charAt(0) === '8') d = '62' + d;
    return 'https://wa.me/' + d;
  }

  /** Foto produk di Google Drive (berkas dibagikan "siapa pun dengan tautan"). */
  function photoUrl(id, w) { return 'https://drive.google.com/thumbnail?id=' + encodeURIComponent(id) + '&sz=w' + (w || 300); }

  /**
   * Tabel padat di HP: tampilkan kolom paling penting (nama + maksimal 2 kolom: uang/status/stok/tanggal), sisanya di LEMBAR RINCIAN
   * yang naik dari bawah saat baris diketuk (semua kolom + tombol aksi baris). Berlaku otomatis untuk semua tabel >= 4 kolom
   * tanpa kolom gabungan/isian. Di layar lebar tabel tidak berubah.
   */
  var CT_GROUPS = [/total|harga|jumlah|sisa|nominal|omzet|saldo|tagihan|nilai/i, /status/i, /stok|qty|terbayar|masuk|keluar/i, /tgl|tanggal|waktu|periode/i];
  function ctPick(heads) {
    var vis = heads.map(function () { return false; }); vis[0] = true; var left = 2;
    var ok = function (i) { return i > 0 && !vis[i] && heads[i] && !/^(aksi|opsi|#)$/i.test(heads[i]); };
    CT_GROUPS.forEach(function (re) { if (left <= 0) return; for (var i = 1; i < heads.length; i++) { if (ok(i) && re.test(heads[i])) { vis[i] = true; left--; return; } } });
    for (var i = 1; i < heads.length && left > 0; i++) if (ok(i)) { vis[i] = true; left--; }
    return vis;
  }
  function ctOpenSheet(tr, heads) {
    var tds = qsa(':scope > td', tr), title = (tds[0] ? tds[0].textContent : '').trim(), rows = '';
    tds.forEach(function (td, i) { if (i === 0 || !heads[i]) return; var v = td.textContent.trim(); if (!v || /^(aksi|opsi)$/i.test(heads[i])) return; rows += '<div class="ct-sr"><span class="ct-sl">' + escapeHtml(heads[i]) + '</span><span class="ct-sv">' + escapeHtml(v) + '</span></div>'; });
    var acts = qsa('button, a[href]', tr);
    var m = openModal('<h3>' + escapeHtml(title || 'Rincian') + '</h3><div class="ct-sheet">' + rows + '</div>' + (acts.length ? '<div class="ct-acts">' + acts.map(function (a, i) { return '<button type="button" class="btn ' + (i === 0 ? 'btn-primary' : 'btn-outline') + ' btn-block" data-ct-act="' + i + '">' + escapeHtml(a.textContent.trim() || 'Buka') + '</button>'; }).join('') + '</div>' : ''));
    qsa('[data-ct-act]', m).forEach(function (b) { b.addEventListener('click', function () { var target = acts[Number(b.getAttribute('data-ct-act'))]; closeModal(); setTimeout(function () { target.click(); }, 60); }); });
  }
  function cardifyTables(root) {
    qsa('table', root || document).forEach(function (t) {
      if (t.classList.contains('no-card') || t.closest('.receipt-preview')) return;
      var heads = qsa('thead th', t).map(function (h) { return h.textContent.trim(); });
      if (heads.length < 4 || t.querySelector('td[colspan], input, select, textarea')) return;
      var vis = ctPick(heads);
      t.classList.add('ct');
      qsa('thead th', t).forEach(function (th, i) { th.classList.toggle('ct-hide', !vis[i]); });
      qsa('tbody tr', t).forEach(function (tr) { tr.classList.add('ct-row'); qsa(':scope > td', tr).forEach(function (td, i) { td.classList.toggle('ct-hide', !vis[i]); if (heads[i]) td.setAttribute('data-label', heads[i]); }); });
      if (!t.__ct) {
        t.__ct = true;
        t.addEventListener('click', function (e) {
          if (!window.matchMedia || !window.matchMedia('(max-width: 640px)').matches) return;
          var tr = e.target.closest('tbody tr.ct-row'); if (!tr || !t.contains(tr)) return;
          if (e.target.closest('button, a, input, select')) return;
          ctOpenSheet(tr, qsa('thead th', t).map(function (h) { return h.textContent.trim(); }));
        });
      }
    });
  }
  (function watchTables() {
    var tick = null;
    function run() { tick = null; cardifyTables(document); }
    function arm() { if (typeof MutationObserver === 'undefined' || !document.body) return; new MutationObserver(function () { if (!tick) tick = setTimeout(run, 40); }).observe(document.body, { childList: true, subtree: true }); run(); }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', arm); else arm();
  })();

  function showLoading(container) {
    container.innerHTML = '<div class="spinner"></div><div class="loading-hint" hidden>Masih memuat&hellip; koneksi mungkin lambat.</div>';
    setTimeout(function () { var h = container.querySelector && container.querySelector('.loading-hint'); if (h) h.hidden = false; }, 6000);
  }

  /**
   * Pemetaan TAMPILAN saja untuk status pesanan online (Bagian 6 audit "STATUS PESANAN ONLINE").
   * Nilai status internal di backend (20_OnlineOrders.gs ORDER_STATUS_FLOW) TIDAK berubah -
   * fungsi ini hanya menerjemahkan kode internal ke label rapi + warna badge konsisten untuk UI.
   */
  var ORDER_STATUS_MAP = {
    'MENUNGGU PEMBAYARAN': { label: 'Menunggu Pembayaran', cls: 'grey' },
    'MENUNGGU KONFIRMASI': { label: 'Menunggu Konfirmasi', cls: 'gold' },
    'DIPROSES': { label: 'Diproses', cls: 'blue' },
    'DIPERSIAPKAN': { label: 'Dipersiapkan', cls: 'blue' },
    'SIAP DIAMBIL': { label: 'Siap Diambil', cls: 'gold' },
    'DALAM PENGANTARAN': { label: 'Dalam Pengantaran', cls: 'blue' },
    'SELESAI': { label: 'Selesai', cls: 'green' },
    'DIBATALKAN': { label: 'Dibatalkan', cls: 'red' }
  };
  function orderStatusInfo(status) {
    return ORDER_STATUS_MAP[status] || { label: status || '-', cls: 'grey' };
  }
  function orderStatusBadge(status) {
    var info = orderStatusInfo(status);
    return '<span class="badge ' + info.cls + '">' + escapeHtml(info.label) + '</span>';
  }

  return {
    formatCurrency: formatCurrency, formatDate: formatDate, formatDateOnly: formatDateOnly,
    escapeHtml: escapeHtml, qs: qs, qsa: qsa, el: el, debounce: debounce,
    toast: toast, openModal: openModal, closeModal: closeModal, showLoading: showLoading, photoUrl: photoUrl, formatPhoneId: formatPhoneId, waLink: waLink, cardifyTables: cardifyTables, resizeImage: resizeImage,
    orderStatusInfo: orderStatusInfo, orderStatusBadge: orderStatusBadge
  };
})();
