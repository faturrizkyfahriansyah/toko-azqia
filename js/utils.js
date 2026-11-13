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

  /** Foto produk di Google Drive (berkas dibagikan "siapa pun dengan tautan"). */
  function photoUrl(id, w) { return 'https://drive.google.com/thumbnail?id=' + encodeURIComponent(id) + '&sz=w' + (w || 300); }

  /** Tabel -> kartu pada layar sempit: setiap sel diberi label dari judul kolom (CSS table.cardify). Berlaku untuk SEMUA halaman. */
  function cardifyTables(root) {
    qsa('table', root || document).forEach(function (t) {
      if (t.getAttribute('data-card') === '1' || t.classList.contains('no-card') || t.closest('.receipt-preview')) return;
      if (t.querySelector('td[colspan]')) return;
      var heads = qsa('thead th', t).map(function (h) { return h.textContent.trim(); });
      if (!heads.length) return;
      qsa('tbody tr', t).forEach(function (tr) { qsa('td', tr).forEach(function (td, i) { if (heads[i]) td.setAttribute('data-label', heads[i]); }); });
      t.classList.add('cardify'); t.setAttribute('data-card', '1');
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
    toast: toast, openModal: openModal, closeModal: closeModal, showLoading: showLoading, photoUrl: photoUrl, cardifyTables: cardifyTables, resizeImage: resizeImage,
    orderStatusInfo: orderStatusInfo, orderStatusBadge: orderStatusBadge
  };
})();
