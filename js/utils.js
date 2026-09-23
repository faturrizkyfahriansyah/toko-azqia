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

  return {
    formatCurrency: formatCurrency, formatDate: formatDate, formatDateOnly: formatDateOnly,
    escapeHtml: escapeHtml, qs: qs, qsa: qsa, el: el, debounce: debounce,
    toast: toast, openModal: openModal, closeModal: closeModal, showLoading: showLoading
  };
})();
