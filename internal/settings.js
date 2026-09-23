/**
 * internal/settings.js - Pengaturan Toko, Ongkir, Konfigurasi Sistem, Audit Log, Backup.
 * (File tambahan di luar daftar minimal spesifikasi awal - digabung di sini untuk kohesi
 * area administrasi Pemilik; lihat README.md bagian "Penyesuaian dari spesifikasi".)
 */
window.Modules = window.Modules || {};
Modules.settings = (function () {
  var activeTab = 'toko';

  function render(container) {
    container.innerHTML = '<h1>Pengaturan & Sistem</h1><div class="tabs">' +
      tabBtn('toko', 'Profil Toko') + tabBtn('ongkir', 'Ongkir') + tabBtn('printer', 'Printer') +
      tabBtn('audit', 'Audit Log') + tabBtn('backup', 'Backup') + '</div><div id="tab-body"></div>';
    Utils.qsa('[data-tab]', container).forEach(function (b) { b.addEventListener('click', function () { activeTab = b.getAttribute('data-tab'); render(container); }); });
    return renderTab();
  }
  function tabBtn(id, label) { return '<button data-tab="' + id + '" class="' + (activeTab === id ? 'active' : '') + '">' + label + '</button>'; }

  function renderTab() {
    var body = document.getElementById('tab-body');
    if (activeTab === 'toko') return renderToko(body);
    if (activeTab === 'ongkir') return renderOngkir(body);
    if (activeTab === 'printer') return renderPrinter(body);
    if (activeTab === 'audit') return renderAudit(body);
    return renderBackup(body);
  }

  function renderToko(body) {
    return Api.call('settings.get', {}).then(function (d) {
      var s = d.settings || {};
      body.innerHTML = '<form id="f">' +
        settingField('store_name', 'Nama Toko', s.store_name) + settingField('store_tagline', 'Tagline', s.store_tagline) +
        settingField('store_address', 'Alamat Toko', s.store_address) + settingField('store_contact', 'Kontak (Telepon/WA)', s.store_contact) +
        settingField('store_hours', 'Jam Operasional', s.store_hours) +
        '<button class="btn btn-primary btn-block" type="submit">Simpan Semua</button></form>';
      body.querySelector('#f').addEventListener('submit', function (e) {
        e.preventDefault();
        var fd = Object.fromEntries(new FormData(e.target).entries());
        Promise.all(Object.keys(fd).map(function (k) { return Api.call('settings.update', { key: k, value: fd[k] }); }))
          .then(function () { Utils.toast('Pengaturan toko disimpan.', 'success'); })
          .catch(function (err) { Utils.toast(err.message, 'error'); });
      });
    });
  }
  function settingField(name, label, value) {
    return '<div class="field"><label>' + label + '</label><input name="' + name + '" value="' + Utils.escapeHtml(value || '') + '"></div>';
  }

  function renderOngkir(body) {
    return Api.call('delivery.get', {}).then(function (d) {
      var s = d.settings;
      body.innerHTML = '<form id="f">' +
        '<div class="field"><label>Aktifkan Delivery</label><select name="delivery_enabled"><option value="true"' + (s.delivery_enabled ? ' selected' : '') + '>Aktif</option><option value="false"' + (!s.delivery_enabled ? ' selected' : '') + '>Nonaktif</option></select></div>' +
        settingField('flat_fee', 'Ongkir Flat (Rp)', s.flat_fee) + settingField('free_shipping_minimum', 'Gratis Ongkir Minimal Belanja (Rp)', s.free_shipping_minimum) +
        settingField('estimated_delivery', 'Estimasi Waktu Antar', s.estimated_delivery) + settingField('delivery_hours', 'Jam Layanan Delivery', s.delivery_hours) +
        '<button class="btn btn-primary btn-block" type="submit">Simpan</button></form>';
      body.querySelector('#f').addEventListener('submit', function (e) {
        e.preventDefault();
        Api.call('delivery.update', Object.fromEntries(new FormData(e.target).entries())).then(function () { Utils.toast('Pengaturan ongkir disimpan.', 'success'); });
      });
    });
  }

  function renderPrinter(body) {
    var adapters = window.PrinterManager.availableAdapters();
    var current = window.PrinterManager.getPreferredAdapterName();
    body.innerHTML = '<p>Pilih metode cetak struk default untuk perangkat kasir ini.</p>' +
      adapters.map(function (a) {
        return '<div class="card row"><div><strong>' + a.label + '</strong><div class="muted">' + (a.available ? 'Tersedia di perangkat ini' : 'Tidak didukung di browser/perangkat ini') + '</div></div>' +
          '<button class="btn ' + (current === a.id ? 'btn-primary' : 'btn-outline') + ' btn-sm" data-select="' + a.id + '"' + (!a.available ? ' disabled' : '') + '>' + (current === a.id ? 'Terpilih' : 'Pilih') + '</button></div>';
      }).join('') +
      '<p class="hint">Printer Bluetooth thermal (mis. PUTIAN 583-01) menggunakan Web Bluetooth - hanya berfungsi jika printer memakai profil BLE dan browser mendukungnya (Chrome/Edge Android/Desktop). Safari/iOS tidak mendukung Web Bluetooth sama sekali - gunakan Cetak via Browser di perangkat tersebut. Lihat docs/USER_GUIDE.md bagian Printer.</p>';
    Utils.qsa('[data-select]', body).forEach(function (b) {
      b.addEventListener('click', function () { window.PrinterManager.setPreferredAdapterName(b.getAttribute('data-select')); renderTab(); });
    });
  }

  function renderAudit(body) {
    return Api.call('audit.log.list', { limit: 100 }).then(function (d) {
      body.innerHTML = '<div class="table-wrap"><table><thead><tr><th>Waktu</th><th>Aksi</th><th>Modul</th><th>Entitas</th></tr></thead><tbody>' +
        d.logs.map(function (l) { return '<tr><td>' + Utils.formatDate(l.timestamp) + '</td><td>' + l.action + '</td><td>' + l.module + '</td><td>' + l.entity_type + ' ' + l.entity_id + '</td></tr>'; }).join('') +
        '</tbody></table></div>';
    }).catch(function (err) { body.innerHTML = '<div class="empty-state">' + Utils.escapeHtml(err.message) + '</div>'; });
  }

  function renderBackup(body) {
    return Api.call('system.backup.list', {}).then(function (d) {
      body.innerHTML = '<button class="btn btn-primary" id="run-backup">Jalankan Backup Sekarang</button>' +
        '<div class="table-wrap" style="margin-top:12px;"><table><thead><tr><th>Nama File</th><th>Dibuat</th><th></th></tr></thead><tbody>' +
        d.backups.map(function (f) { return '<tr><td>' + Utils.escapeHtml(f.name) + '</td><td>' + Utils.formatDate(f.created_at) + '</td><td><a href="' + f.url + '" target="_blank">Buka</a></td></tr>'; }).join('') +
        '</tbody></table></div>' +
        '<p class="hint">Backup otomatis harian berjalan jika trigger sudah dipasang (installDailyTriggers() - lihat docs/DEPLOYMENT.md TAHAP 21).</p>';
      body.querySelector('#run-backup').addEventListener('click', function () {
        Utils.toast('Membuat backup, mohon tunggu...', 'info');
        Api.call('system.backup.run', {}).then(function () { Utils.toast('Backup berhasil dibuat.', 'success'); renderTab(); }).catch(function (err) { Utils.toast(err.message, 'error'); });
      });
    }).catch(function (err) { body.innerHTML = '<div class="empty-state">' + Utils.escapeHtml(err.message) + '</div>'; });
  }

  return { render: render };
})();
