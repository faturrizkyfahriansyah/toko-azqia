/**
 * js/utils.js - helper umum dipakai internal & shop.
 */
window.Utils = (function () {
  function formatCurrency(n) {
    n = Number(n) || 0;
    return 'Rp ' + Math.round(n).toLocaleString('id-ID');
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

  function showLoading(container) {
    container.innerHTML = '<div class="spinner"></div>';
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
    toast: toast, openModal: openModal, closeModal: closeModal, showLoading: showLoading,
    orderStatusInfo: orderStatusInfo, orderStatusBadge: orderStatusBadge
  };
})();
