/**
 * internal/settings.js - Pengaturan Toko, Ongkir, Konfigurasi Sistem, Audit Log, Backup.
 * (File tambahan di luar daftar minimal spesifikasi awal - digabung di sini untuk kohesi
 * area administrasi Pemilik; lihat README.md bagian "Penyesuaian dari spesifikasi".)
 */
window.Modules = window.Modules || {};
Modules.settings = (function () {
  var activeTab = 'toko';

  function render(container, initialTab) {
    if (initialTab) activeTab = initialTab;
    container.innerHTML = '<h1>Pengaturan & Sistem</h1><div class="tabs">' +
      tabBtn('toko', 'Profil Toko') + tabBtn('ongkir', 'Ongkir') + tabBtn('pembayaran', 'Pembayaran') + tabBtn('printer', 'Printer') +
      tabBtn('audit', 'Audit Log') + tabBtn('backup', 'Backup') + '</div><div id="tab-body"></div>';
    Utils.qsa('[data-tab]', container).forEach(function (b) { b.addEventListener('click', function () { activeTab = b.getAttribute('data-tab'); render(container); }); });
    return renderTab();
  }
  function tabBtn(id, label) { return '<button data-tab="' + id + '" class="' + (activeTab === id ? 'active' : '') + '">' + label + '</button>'; }

  function renderTab() {
    var body = document.getElementById('tab-body');
    if (activeTab === 'toko') return renderToko(body);
    if (activeTab === 'ongkir') return renderOngkir(body);
    if (activeTab === 'pembayaran') return renderPembayaran(body);
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

  function renderPembayaran(body) {
    return Promise.all([Api.call('settings.get', {}), Api.call('bankAccount.list', {})]).then(function (r) {
      var d = r[0]; var banks = r[1].bank_accounts;
      var current = (d.settings && d.settings.qris_image_url) || '';
      body.innerHTML = '<h3>QRIS Toko AZQIA</h3>' +
        '<p class="muted">Upload gambar QRIS milik toko. QRIS ini akan ditampilkan di Kasir (metode QRIS) dan halaman Checkout toko online.</p>' +
        (current ? '<img src="' + current + '" alt="QRIS saat ini" style="max-width:220px;display:block;margin-bottom:12px;border:1px solid var(--border);border-radius:8px;">' : '<p class="hint">Belum ada QRIS terupload.</p>') +
        '<div class="field"><label>Upload Gambar QRIS (PNG/JPG, maks 3MB)</label><input type="file" id="qris-file" accept="image/png,image/jpeg"></div>' +
        '<button class="btn btn-primary" id="qris-upload-btn">Upload QRIS</button>' +
        '<div class="divider"></div><h3>Rekening Transfer Bank</h3><p class="muted">Bisa lebih dari satu rekening, aktif/nonaktifkan sesuai kebutuhan.</p>' +
        '<div id="bank-list">' + banks.map(function (b) {
          var active = String(b.active) === 'true' || b.active === true;
          return '<div class="row" style="padding:8px 0;border-bottom:1px solid var(--border);"><div><strong>' + Utils.escapeHtml(b.bank_name) + '</strong> - ' + Utils.escapeHtml(b.account_number) + '<div class="muted">a.n. ' + Utils.escapeHtml(b.account_holder) + '</div></div>' +
            '<button class="btn btn-outline btn-sm" data-toggle-bank="' + b.bank_account_id + '" data-active="' + active + '">' + (active ? 'Nonaktifkan' : 'Aktifkan') + '</button></div>';
        }).join('') + '</div>' +
        '<div class="field-row" style="margin-top:10px;"><input id="bank-name" placeholder="Nama Bank"><input id="bank-number" placeholder="No. Rekening"><input id="bank-holder" placeholder="Atas Nama"></div>' +
        '<button class="btn btn-outline btn-block" id="bank-add">+ Tambah Rekening</button>';
      body.querySelector('#qris-upload-btn').addEventListener('click', function () {
        var input = body.querySelector('#qris-file');
        if (!input.files || !input.files[0]) { Utils.toast('Pilih file gambar dahulu.', 'error'); return; }
        var file = input.files[0];
        var reader = new FileReader();
        reader.onload = function () {
          var base64 = reader.result.split(',')[1];
          Api.call('qris.upload', { base64: base64, mimeType: file.type }).then(function () {
            Utils.toast('QRIS berhasil diupload.', 'success'); renderTab();
          }).catch(function (err) { Utils.toast(err.message, 'error'); });
        };
        reader.readAsDataURL(file);
      });
      Utils.qsa('[data-toggle-bank]', body).forEach(function (b) {
        b.addEventListener('click', function () {
          Api.call('bankAccount.update', { bank_account_id: b.getAttribute('data-toggle-bank'), active: b.getAttribute('data-active') !== 'true' }).then(function () { renderTab(); });
        });
      });
      body.querySelector('#bank-add').addEventListener('click', function () {
        var bankName = body.querySelector('#bank-name').value.trim();
        var number = body.querySelector('#bank-number').value.trim();
        var holder = body.querySelector('#bank-holder').value.trim();
        if (!bankName || !number || !holder) { Utils.toast('Lengkapi semua kolom rekening.', 'error'); return; }
        Api.call('bankAccount.create', { bank_name: bankName, account_number: number, account_holder: holder }).then(function () {
          Utils.toast('Rekening ditambahkan.', 'success'); renderTab();
        }).catch(function (err) { Utils.toast(err.message, 'error'); });
      });
    });
  }

  function renderPrinter(body) {
    var adapters = window.PrinterManager.availableAdapters();
    var current = window.PrinterManager.getPreferredAdapterName();
    body.innerHTML =
      '<div class="card">' +
      '<h3>Printer: PUTIAN POS RPP02N</h3>' +
      '<div class="stat-list">' +
      '<div class="row"><span>Kertas</span><span>58mm</span></div>' +
      '<div class="row"><span>Lebar Cetak</span><span>48mm / 384 dot</span></div>' +
      '<div class="row"><span>Codepage</span><span>PC850</span></div>' +
      '<div class="row"><span>Protokol</span><span>ESC/POS compatible</span></div>' +
      '</div></div>' +
      '<p>Pilih metode koneksi default untuk perangkat kasir ini:</p>' +
      adapters.map(function (a) {
        return '<div class="card row"><div><strong>' + a.label + '</strong><div class="muted">' + window.PrinterManager.statusLabel(a.id) + '</div></div>' +
          '<button class="btn ' + (current === a.id ? 'btn-primary' : 'btn-outline') + ' btn-sm" data-select="' + a.id + '"' + (!a.available ? ' disabled' : '') + '>' + (current === a.id ? 'Terpilih' : 'Pilih') + '</button></div>';
      }).join('') +
      '<button class="btn btn-secondary btn-block" id="btn-test-print" style="margin-top:10px;">Test Print</button>' +
      '<div id="test-print-status" class="muted" style="margin-top:8px;"></div>' +
      '<p class="hint" style="margin-top:14px;">RPP02N kemungkinan besar memakai Bluetooth Classic/SPP (bukan BLE) berdasarkan pola pairingnya (PIN manual 0000). Web Bluetooth HANYA bisa untuk printer BLE - jika RPP02N tidak muncul saat memilih "Printer Bluetooth BLE", ini bukan error, memang di luar jangkauan Web Bluetooth. Jalur paling mungkin berhasil: pair printer lewat Bluetooth Windows lalu pilih "Windows - Bluetooth COM / USB (Serial)", atau gunakan "Cetak via Browser" di perangkat manapun. Lihat docs/KNOWN_LIMITATIONS.md bagian Printer untuk detail lengkap.</p>';
    Utils.qsa('[data-select]', body).forEach(function (b) {
      b.addEventListener('click', function () { window.PrinterManager.setPreferredAdapterName(b.getAttribute('data-select')); renderTab(); });
    });
    var testBtn = body.querySelector('#btn-test-print');
    var statusEl = body.querySelector('#test-print-status');
    testBtn.addEventListener('click', function () {
      testBtn.disabled = true; testBtn.innerHTML = '<span class="spinner-inline"></span> Mencetak Test Print...';
      statusEl.textContent = '';
      window.PrinterManager.testPrint().then(function () {
        statusEl.innerHTML = '<span class="badge green">Berhasil</span> Perintah cetak terkirim. Periksa hasil fisik di printer.';
      }).catch(function (err) {
        statusEl.innerHTML = '<span class="badge red">Gagal</span> ' + Utils.escapeHtml(err.message);
      }).finally(function () {
        testBtn.disabled = false; testBtn.textContent = 'Test Print';
      });
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
