/**
 * js/whatsnew.js - Jendela "Yang baru" seperti di Play Store: setelah ada pembaruan, pengguna melihat apa saja yang berubah (sekali).
 * Sumber: version.json di situs (diedit saat rilis). Halaman belanja (index.html) memakai catatan "shop", halaman staf/kasir memakai "internal".
 * Pemasangan pertama (belum pernah melihat versi apa pun) TIDAK menampilkan apa-apa; hanya mencatat versi. Gagal memuat = diam (tidak mengganggu).
 */
(function () {
  var KEY = 'azqia_seen_ver';
  function get() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }
  function put(v) { try { localStorage.setItem(KEY, v); } catch (e) {} }
  function audience() { return /kasir\.html|staff\.html/.test(location.pathname) ? 'internal' : 'shop'; }
  function show(v) {
    var notes = (v.notes && v.notes[audience()]) || [];
    if (!notes.length || !window.Utils || !Utils.openModal) { put(v.version); return; }
    var esc = Utils.escapeHtml;
    var m = Utils.openModal('<div class="whatsnew"><h3>Yang baru</h3><div class="muted" style="margin-bottom:8px;">Versi ' + esc(v.version) + '</div><ul>' +
      notes.map(function (n) { return '<li>' + esc(n) + '</li>'; }).join('') + '</ul><button type="button" class="btn btn-primary btn-block" id="wn-ok">Mengerti</button></div>');
    var done = function () { put(v.version); Utils.closeModal(); };
    m.querySelector('#wn-ok').addEventListener('click', done);
    m.addEventListener('click', function (e) { if (e.target === m) put(v.version); });
  }
  function check() {
    fetch('version.json', { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (v) {
      if (!v || !v.version) return;
      var seen = get();
      if (seen === null) { put(v.version); return; }     // pemasangan pertama: tidak perlu "yang baru"
      if (seen !== v.version) show(v);
    }).catch(function () {});
  }
  window.addEventListener('load', function () { setTimeout(check, 1500); });
})();
