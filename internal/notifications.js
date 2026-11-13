/**
 * internal/notifications.js - Pengaturan notifikasi. (1) Perangkat ini: nada, volume, getar, notifikasi sistem, per jenis (semua peran).
 * (2) WhatsApp ke HP (khusus Pemilik): penerima, jenis, ambang jumlah, jam tenang, laba, tes kirim.
 */
window.Modules = window.Modules || {};
Modules.notifications = (function () {
  function esc(s) { return Utils.escapeHtml(String(s === undefined || s === null ? '' : s)); }
  var LABEL = { SALE_DONE: 'Transaksi kasir berhasil', PESANAN_ONLINE_BARU: 'Pesanan online / WhatsApp baru', ONLINE_PAID: 'Pembayaran pesanan dikonfirmasi', STOK_MENIPIS: 'Stok menipis / habis', NEGATIVE_STOCK: 'Stok negatif (penjualan offline)', REFUND_PENDING: 'Pengembalian dana menunggu', WA_HANDOVER: 'Pelanggan WhatsApp minta admin', VOID_SALE: 'Transaksi dibatalkan (void)', PIUTANG_BARU: 'Piutang baru', DAILY_SUMMARY: 'Ringkasan harian' };
  function sw(id, title, sub, on, dis) { return '<div class="switch-row"><div><div class="sw-title">' + title + '</div>' + (sub ? '<div class="sw-sub">' + sub + '</div>' : '') + '</div><label class="switch"><input type="checkbox" id="' + id + '"' + (on ? ' checked' : '') + (dis ? ' disabled' : '') + '><span class="slider"></span></label></div>'; }

  function deviceSection() {
    var p = Notify.getPrefs(), perm = ('Notification' in window) ? Notification.permission : 'unsupported';
    var permTxt = { granted: 'Diizinkan', denied: 'Ditolak di pengaturan browser', default: 'Belum diminta', unsupported: 'Tidak didukung di perangkat ini' }[perm];
    return '<div class="card"><h3 style="margin-top:0;">Di perangkat ini</h3>' +
      sw('nf-on', 'Bunyikan notifikasi', 'Nada diputar saat ada transaksi/kejadian baru (aplikasi harus terbuka).', p.enabled) +
      '<div class="field"><label>Nada</label><div class="field-row"><select id="nf-sound">' + Object.keys(Notify.TONE_LABEL).map(function (k) { return '<option value="' + k + '"' + (p.sound === k ? ' selected' : '') + '>' + Notify.TONE_LABEL[k] + '</option>'; }).join('') + '</select><button type="button" class="btn btn-outline" id="nf-play">Putar</button></div></div>' +
      '<div class="field"><label>Volume</label><input type="range" id="nf-vol" min="10" max="100" value="' + Math.round(p.volume * 100) + '"></div>' +
      sw('nf-vib', 'Getar', 'Getar singkat bersama nada (bila HP mendukung).', p.vibrate) +
      sw('nf-sys', 'Notifikasi di layar HP', 'Status izin: <strong>' + permTxt + '</strong>. Di iPhone: pasang aplikasi ke Layar Utama dulu.', p.system, perm === 'unsupported') +
      '<h4>Bunyi untuk jenis</h4>' + Object.keys(LABEL).map(function (k) { return sw('nf-ev-' + k, LABEL[k], '', p.events[k] !== false); }).join('') + '</div>';
  }
  function wireDevice(root) {
    function save() {
      var p = Notify.getPrefs(); p.enabled = root.querySelector('#nf-on').checked; p.sound = root.querySelector('#nf-sound').value; p.volume = Number(root.querySelector('#nf-vol').value) / 100; p.vibrate = root.querySelector('#nf-vib').checked; p.system = root.querySelector('#nf-sys').checked;
      Object.keys(LABEL).forEach(function (k) { p.events[k] = root.querySelector('#nf-ev-' + k).checked; });
      Notify.setPrefs(p);
    }
    Utils.qsa('#nf-device input, #nf-device select', root).forEach(function (i) { i.addEventListener('change', save); });
    root.querySelector('#nf-play').addEventListener('click', function () { Notify.unlock(); Notify.testTone(root.querySelector('#nf-sound').value); });
    root.querySelector('#nf-sys').addEventListener('change', function (e) {
      if (e.target.checked) Notify.requestSystemPermission().then(function (r) { if (r !== 'granted') { e.target.checked = false; save(); Utils.toast('Izin notifikasi tidak diberikan. Ubah di pengaturan browser/HP.', 'error'); } else { save(); Notify.showSystem('TOKO AZQIA', 'Notifikasi di layar HP aktif.', 'test'); } });
    });
  }
  function waSection(s) {
    s = s || {}; s.catalog = s.catalog || []; s.events = s.events || {};
    var rows = s.catalog.map(function (e) {
      var c = s.events[e.id] || { inapp: true, wa: true, min_amount: 0 };
      return '<div class="nf-ev"><div class="nf-ev-name">' + e.emoji + ' ' + esc(e.label) + '</div><div class="nf-ev-ctl"><label><input type="checkbox" data-ev="' + e.id + '" data-k="inapp"' + (c.inapp ? ' checked' : '') + '> Aplikasi</label><label><input type="checkbox" data-ev="' + e.id + '" data-k="wa"' + (c.wa ? ' checked' : '') + '> WhatsApp</label>' +
        (e.id === 'SALE_DONE' ? '<label>Min. Rp<input type="number" inputmode="numeric" min="0" data-ev="SALE_DONE" data-k="min_amount" value="' + (c.min_amount || '') + '" placeholder="0"></label>' : '') + '</div></div>';
    }).join('');
    return '<div class="card" id="nf-wa"><h3 style="margin-top:0;">WhatsApp ke HP (Pemilik)</h3>' +
      (s.wa_configured !== false ? '' : '<div class="hint wa-warn">MPWA belum dikonfigurasi (MPWA_API_KEY / MPWA_SENDER di Script Properties). Pesan belum bisa terkirim.</div>') +
      sw('nw-on', 'Kirim notifikasi ke WhatsApp', 'Pesan masuk ke HP dengan nada WhatsApp, walau aplikasi tertutup.', !!s.wa_enabled) +
      '<div class="field"><label>Nomor penerima (maks 5, pisah koma)</label><input id="nw-nums" inputmode="tel" placeholder="0812xxxxxxx, 0855xxxxxxx" value="' + esc(s.numbers || '') + '"></div>' +
      '<div class="field"><label>Jam tenang (WhatsApp ditahan, mis. 22:00-06:00; kosong = tidak ada)</label><input id="nw-quiet" placeholder="22:00-06:00" value="' + esc(s.quiet_hours || '') + '"></div>' +
      sw('nw-profit', 'Sertakan laba pada ringkasan harian', 'Hanya aktifkan bila semua penerima boleh melihat laba.', !!s.include_profit) +
      '<h4>Jenis notifikasi</h4>' + rows +
      '<div class="field-row" style="margin-top:12px;"><button class="btn btn-primary btn-block" id="nw-save">Simpan</button><button class="btn btn-outline btn-block" id="nw-test">Kirim tes</button></div><div id="nw-msg" class="muted" style="margin-top:6px;"></div></div>';
  }
  function wireWa(root) {
    root.querySelector('#nw-save').addEventListener('click', function () {
      var ev = {}; Utils.qsa('[data-ev]', root).forEach(function (i) { var k = i.getAttribute('data-ev'); ev[k] = ev[k] || {}; ev[k][i.getAttribute('data-k')] = i.type === 'checkbox' ? i.checked : Number(i.value || 0); });
      var b = root.querySelector('#nw-save'); b.disabled = true;
      Api.call('notify.settings.update', { wa_enabled: root.querySelector('#nw-on').checked, numbers: root.querySelector('#nw-nums').value, quiet_hours: root.querySelector('#nw-quiet').value.trim(), include_profit: root.querySelector('#nw-profit').checked, events: ev })
        .then(function () { Utils.toast('Pengaturan notifikasi WhatsApp disimpan.', 'success'); }).catch(function (e) { Utils.toast(e.message, 'error'); }).then(function () { b.disabled = false; });
    });
    root.querySelector('#nw-test').addEventListener('click', function () {
      var b = root.querySelector('#nw-test'); b.disabled = true; root.querySelector('#nw-msg').textContent = 'Mengirim...';
      Api.call('notify.test', {}).then(function (r) { root.querySelector('#nw-msg').textContent = r.results.map(function (x) { return x.number_masked + ': ' + (x.ok ? 'terkirim' : 'GAGAL (' + x.error + ')'); }).join(' · '); })
        .catch(function (e) { root.querySelector('#nw-msg').textContent = e.message; }).then(function () { b.disabled = false; });
    });
  }
  function render(container) {
    container.innerHTML = '<h1 class="page-title">Notifikasi</h1><div id="nf-device">' + deviceSection() + '</div><div id="nf-wa-slot"></div>';
    wireDevice(container);
    if (!Auth.isPemilik()) return Promise.resolve();
    return Api.call('notify.settings.get', {}).then(function (s) { var slot = container.querySelector('#nf-wa-slot'); if (!slot) return; slot.innerHTML = waSection(s); wireWa(slot); });
  }
  return { render: render };
})();
