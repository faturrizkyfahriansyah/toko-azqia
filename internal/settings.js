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
    // Kalau satu tab gagal dimuat (mis. server lambat), tab lain tetap bisa dibuka - jangan sampai seluruh halaman diganti pesan error.
    return Promise.resolve(renderTab()).catch(function (err) {
      var tb = document.getElementById('tab-body');
      if (tb) tb.innerHTML = '<div class="empty-state"><div class="empty-title">Gagal memuat</div><div class="empty-sub">' + Utils.escapeHtml((err && err.message) || 'Coba lagi.') + '</div></div>';
    });
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

  /**
   * Pengaturan -> Printer (V3, DISEDERHANAKAN).
   * Yang tampil di layar utama cuma: status + [Hubungkan Printer] + [Test Print].
   * Sistem memilih sendiri jalur terbaik di belakang layar (Serial -> Bridge -> Browser).
   * Semua pilihan teknis ada di bagian lipat "Pengaturan Lanjutan" - tidak mengganggu.
   */
  function renderPrinter(body) {
    body.innerHTML = '<div class="spinner"></div>';
    var adapters = window.PrinterManager.availableAdapters();
    var current = window.PrinterManager.getPreferredAdapterName();
    var rs = window.ReceiptBuilder.getReceiptSettings();
    return Promise.all([
      window.PrinterManager.detectCapabilities(),
      window.PrinterSerialAdapter.hasGrantedPort(),
      window.PrinterLocalBridgeAdapter.checkAvailability()
    ]).then(function (res) {
      var cap = res[0], serialGranted = res[1], bridgeUp = res[2];
      var serialConnected = window.PrinterSerialAdapter.isConnected();

      var st;
      if (current !== 'auto') {
        st = { cls: 'warn', title: 'Metode dipilih manual', sub: 'Sedang memakai metode manual dari Pengaturan Lanjutan. Pilih "Otomatis" di sana untuk kembali ke mode sederhana.' };
      } else if (serialConnected) {
        st = { cls: 'ok', title: 'Printer terhubung', sub: 'Struk langsung tercetak ke printer, tanpa dialog.' };
      } else if (serialGranted) {
        st = { cls: 'ok', title: 'Printer siap', sub: 'Tersambung otomatis saat mencetak. Pastikan printer menyala.' };
      } else if (bridgeUp) {
        st = { cls: 'ok', title: 'Printer terhubung (Bridge)', sub: 'Struk dicetak lewat TOKOQIA Local Print Bridge.' };
      } else {
        st = { cls: 'warn', title: 'Belum terhubung ke printer', sub: cap.webSerial
          ? 'Saat ini struk dicetak lewat dialog cetak browser. Klik "Hubungkan Printer" supaya struk langsung tercetak.'
          : 'Browser/perangkat ini tidak bisa tersambung langsung ke printer. Struk dicetak lewat dialog cetak browser - tetap berfungsi.' };
      }

      body.innerHTML =
        '<div class="card">' +
        '<div class="status-line"><span class="status-dot ' + st.cls + '"></span><span class="status-title">' + st.title + '</span></div>' +
        '<p class="hint" style="margin:0 0 12px;">' + st.sub + '</p>' +
        '<div class="field-row">' +
        '<button class="btn btn-primary btn-block" id="btn-connect"' + (!cap.webSerial ? ' disabled' : '') + '>Hubungkan Printer</button>' +
        '<button class="btn btn-secondary btn-block" id="btn-test-print">Test Print</button>' +
        '</div>' +
        '<div id="serial-msg" class="muted" style="margin-top:8px;"></div>' +
        '<div id="test-print-status" class="muted" style="margin-top:6px;"></div>' +
        ((serialConnected || serialGranted) ? '<button class="btn btn-ghost btn-sm" id="btn-serial-off" style="margin-top:6px;">Putuskan printer</button>' : '') +
        '</div>' +
        '<p class="hint" style="margin:0 0 12px;">Printer: PUTIAN POS RPP02N, kertas 58mm. Bluetooth: pair dulu di pengaturan Bluetooth perangkat (PIN 0000), lalu klik Hubungkan Printer dan pilih RPP02N.</p>' +

        '<details class="collapsible"><summary>Tampilan Struk (logo, header, footer)</summary><div class="collapsible-body">' +
        '<div class="card"><h3 style="font-size:0.85rem;">Pratinjau</h3>' +
        '<p class="hint" style="margin-top:0;">Gambaran struk dengan pengaturan di bawah (data contoh, bukan transaksi asli).</p>' +
        '<div style="display:flex;justify-content:center;background:#ddd;padding:14px;border-radius:8px;">' +
        '<iframe id="receipt-preview-frame" title="Pratinjau struk" style="border:none;width:240px;height:440px;background:#fff;box-shadow:0 1px 4px rgba(0,0,0,0.2);"></iframe></div></div>' +

        '<div class="card"><h3 style="font-size:0.85rem;">1. Logo</h3>' +
        checkboxRow('rs-logo-show', 'Tampilkan logo di struk', rs.logoShow) +
        receiptSettingRow('Ukuran Logo', [{ value: 'small', label: 'Kecil' }, { value: 'medium', label: 'Sedang' }, { value: 'large', label: 'Besar' }], rs.logoSize, 'logoSize') +
        '</div>' +

        '<div class="card"><h3 style="font-size:0.85rem;">2. Header (Nama Toko, Tagline, Alamat)</h3>' +
        checkboxRow('rs-header-tagline', 'Tampilkan tagline', rs.headerShowTagline) +
        checkboxRow('rs-header-address', 'Tampilkan alamat toko', rs.headerShowAddress) +
        receiptSettingRow('Ukuran Font', [{ value: 'normal', label: 'Normal' }, { value: 'condensed', label: 'Kecil' }], rs.headerFontSize, 'headerFontSize') +
        '</div>' +

        '<div class="card"><h3 style="font-size:0.85rem;">3. Info Transaksi (No. / Tanggal / Kasir)</h3>' +
        '<p class="hint" style="margin-top:0;">Nomor transaksi & tanggal selalu tampil.</p>' +
        checkboxRow('rs-info-cashier', 'Tampilkan nama kasir', rs.infoShowCashier) +
        receiptSettingRow('Ukuran Font', [{ value: 'normal', label: 'Normal' }, { value: 'condensed', label: 'Kecil' }], rs.infoFontSize, 'infoFontSize') +
        '</div>' +

        '<div class="card"><h3 style="font-size:0.85rem;">4. Footer</h3>' +
        checkboxRow('rs-footer-thanks', 'Tampilkan ucapan terima kasih', rs.footerShowThanks) +
        checkboxRow('rs-footer-storename', 'Tampilkan nama toko di footer', rs.footerShowStoreName) +
        checkboxRow('rs-footer-copyright', 'Tampilkan baris hak cipta', rs.footerShowCopyright) +
        receiptSettingRow('Ukuran Font', [{ value: 'normal', label: 'Normal' }, { value: 'condensed', label: 'Kecil' }], rs.footerFontSize, 'footerFontSize') +
        '</div>' +
        '<button class="btn btn-primary btn-block" id="btn-save-receipt-settings">Simpan Pengaturan Struk</button>' +
        '</div></details>' +

        '<details class="collapsible"><summary>Pengaturan Lanjutan (teknis)</summary><div class="collapsible-body">' +
        '<p class="hint" style="margin-top:0;">Hanya perlu dibuka kalau ada masalah sambungan. Biarkan "Otomatis" untuk pemakaian normal.</p>' +
        adapters.map(function (a) {
          return '<div class="card row"><div><strong>' + a.label + '</strong><div class="muted">' + window.PrinterManager.statusLabel(a.id) + '</div></div>' +
            '<button class="btn ' + (current === a.id ? 'btn-primary' : 'btn-outline') + ' btn-sm" data-select="' + a.id + '"' + (!a.available ? ' disabled' : '') + '>' + (current === a.id ? 'Terpilih' : 'Pilih') + '</button></div>';
        }).join('') +
        '<div class="card"><h3 style="font-size:0.85rem;">Format Teks ke Printer</h3>' +
        '<p class="hint" style="margin-top:0;">Kalau baris teks menempel tanpa jeda di kertas asli, coba ganti "Akhir Baris".</p>' +
        receiptSettingRow('Akhir Baris', [{ value: 'CRLF', label: 'CRLF (disarankan)' }, { value: 'LF', label: 'LF saja' }], rs.lineEnding, 'lineEnding') +
        '<div class="field" style="margin-bottom:8px;"><label>Lebar Karakter - Font Normal</label><input type="number" id="rs-charwidth" value="' + rs.charWidth + '" min="16" max="64" style="max-width:120px;"></div>' +
        '<div class="field" style="margin-bottom:8px;"><label>Lebar Karakter - Font Kecil</label><input type="number" id="rs-condensedwidth" value="' + rs.condensedWidth + '" min="16" max="80" style="max-width:120px;"></div>' +
        '<div class="field" style="margin-bottom:0;"><label>Baris Feed di Akhir Struk</label><input type="number" id="rs-feedlines" value="' + rs.feedLines + '" min="0" max="10" style="max-width:120px;"></div>' +
        '<button class="btn btn-outline btn-sm" id="btn-save-format" style="margin-top:10px;">Simpan Format</button></div>' +
        '<div class="card"><h3 style="font-size:0.85rem;">Lebar Kertas (Cetak via Browser)</h3>' +
        '<div class="field-row">' +
        '<button class="btn ' + (window.PrinterBrowserAdapter.getPaperWidth() === '58' ? 'btn-primary' : 'btn-outline') + ' btn-sm" data-paper="58">58mm</button>' +
        '<button class="btn ' + (window.PrinterBrowserAdapter.getPaperWidth() === '80' ? 'btn-primary' : 'btn-outline') + ' btn-sm" data-paper="80">80mm</button>' +
        '</div></div>' +
        '<div class="card"><h3 style="font-size:0.85rem;">Kemampuan Perangkat Ini</h3><div class="stat-list">' +
        capRow('Web Bluetooth (BLE)', cap.webBluetooth) + capRow('Web Serial (Bluetooth SPP / USB)', cap.webSerial) +
        capRow('Local Bridge (node bridge.js)', cap.localBridge) + capRow('Cetak via Browser', cap.browserPrint) +
        '</div></div>' +
        '<div class="card" id="bridge-panel"><h3 style="font-size:0.85rem;">TOKOQIA Local Print Bridge (komputer)</h3>' +
        '<p class="hint">Alternatif untuk komputer: jalankan <code>node bridge.js</code> dulu. Tidak dipakai di HP.</p>' +
        '<div id="bridge-port-list" class="muted">' + (cap.localBridge ? 'Klik "Cari Printer" untuk memuat daftar port.' : 'Bridge belum aktif.') + '</div>' +
        '<div class="field-row" style="margin-top:10px;">' +
        '<button class="btn btn-outline btn-sm" id="btn-bridge-scan"' + (!cap.localBridge ? ' disabled' : '') + '>Cari Printer</button>' +
        '<button class="btn btn-outline btn-sm" id="btn-bridge-disconnect"' + (!cap.localBridge ? ' disabled' : '') + '>Putuskan</button>' +
        '</div></div>' +
        '</div></details>';

      function capRow(label, ok) {
        return '<div class="row"><span>' + label + '</span><span class="badge ' + (ok ? 'green' : 'grey') + '">' + (ok ? '\u2713 Tersedia' : '\u2715 Tidak tersedia') + '</span></div>';
      }
      function receiptSettingRow(label, options, cur, name) {
        return '<div class="field" style="margin-bottom:8px;"><label>' + label + '</label><div class="field-row">' +
          options.map(function (o) {
            return '<button class="btn btn-sm ' + (cur === o.value ? 'btn-primary' : 'btn-outline') + '" data-rs="' + name + '" data-rs-value="' + o.value + '">' + o.label + '</button>';
          }).join('') + '</div></div>';
      }
      function checkboxRow(id, label, checked) {
        return '<label style="display:flex;align-items:center;gap:8px;font-size:0.85rem;font-weight:600;margin-bottom:8px;"><input type="checkbox" id="' + id + '"' + (checked ? ' checked' : '') + '> ' + label + '</label>';
      }
      function keepOpen(sel) { /* setelah render ulang, buka lagi bagian lipat yang tadi sedang dipakai */
        var d = body.querySelectorAll('details.collapsible')[sel]; if (d) d.open = true;
      }
      function renderReceiptPreview() {
        var frame = body.querySelector('#receipt-preview-frame');
        if (!frame) return;
        var mm = window.PrinterBrowserAdapter.getPaperWidth();
        frame.srcdoc = '<html><head><meta charset="utf-8">' + window.PrinterBrowserAdapter.styleFor(mm) + '</head><body>' +
          window.ReceiptBuilder.buildHtml(window.ReceiptBuilder.buildSampleReceiptData()) + '</body></html>';
      }
      renderReceiptPreview();
      if (window.__printerOpenSection !== undefined) { keepOpen(window.__printerOpenSection); window.__printerOpenSection = undefined; }

      Utils.qsa('[data-select]', body).forEach(function (b) {
        b.addEventListener('click', function () { window.__printerOpenSection = 1; window.PrinterManager.setPreferredAdapterName(b.getAttribute('data-select')); renderTab(); });
      });
      Utils.qsa('[data-paper]', body).forEach(function (b) {
        b.addEventListener('click', function () { window.__printerOpenSection = 1; window.PrinterBrowserAdapter.setPaperWidth(b.getAttribute('data-paper')); renderTab(); });
      });
      Utils.qsa('[data-rs]', body).forEach(function (b) {
        b.addEventListener('click', function () {
          var patch = {}; patch[b.getAttribute('data-rs')] = b.getAttribute('data-rs-value');
          window.ReceiptBuilder.setReceiptSettings(patch);
          // pilihan tampilan struk -> bagian 0 ; format teks printer -> bagian 1
          window.__printerOpenSection = (b.getAttribute('data-rs') === 'lineEnding') ? 1 : 0;
          renderTab();
        });
      });
      var saveRsBtn = body.querySelector('#btn-save-receipt-settings');
      if (saveRsBtn) saveRsBtn.addEventListener('click', function () {
        window.ReceiptBuilder.setReceiptSettings({
          logoShow: body.querySelector('#rs-logo-show').checked,
          headerShowTagline: body.querySelector('#rs-header-tagline').checked,
          headerShowAddress: body.querySelector('#rs-header-address').checked,
          infoShowCashier: body.querySelector('#rs-info-cashier').checked,
          footerShowThanks: body.querySelector('#rs-footer-thanks').checked,
          footerShowStoreName: body.querySelector('#rs-footer-storename').checked,
          footerShowCopyright: body.querySelector('#rs-footer-copyright').checked
        });
        renderReceiptPreview();
        Utils.toast('Pengaturan struk disimpan. Coba Test Print untuk melihat hasilnya.', 'success');
      });
      var saveFmtBtn = body.querySelector('#btn-save-format');
      if (saveFmtBtn) saveFmtBtn.addEventListener('click', function () {
        window.ReceiptBuilder.setReceiptSettings({
          charWidth: Math.max(16, Math.min(64, Number(body.querySelector('#rs-charwidth').value) || 32)),
          condensedWidth: Math.max(16, Math.min(80, Number(body.querySelector('#rs-condensedwidth').value) || 42)),
          feedLines: Math.max(0, Math.min(10, Number(body.querySelector('#rs-feedlines').value) || 4))
        });
        Utils.toast('Format disimpan.', 'success');
      });

      // ---- Hubungkan Printer: SATU tombol. Dialog pemilih port hanya muncul dari sini (butuh klik langsung). ----
      var serialMsg = body.querySelector('#serial-msg');
      var connectBtn = body.querySelector('#btn-connect');
      if (connectBtn) connectBtn.addEventListener('click', function () {
        connectBtn.disabled = true; connectBtn.textContent = 'Menunggu pilihan...';
        serialMsg.textContent = '';
        window.PrinterSerialAdapter.pair('any').then(function () {
          Utils.toast('Printer terhubung.', 'success');
          renderTab();
        }).catch(function (err) {
          serialMsg.innerHTML = '<span class="badge red">Gagal</span> ' + Utils.escapeHtml(err.message) +
            ' Jika daftar kosong ("Tidak ada perangkat yang kompatibel"), perangkat/browser ini belum bisa tersambung langsung ke RPP02N - struk tetap bisa dicetak lewat dialog cetak browser.';
          connectBtn.disabled = false; connectBtn.textContent = 'Hubungkan Printer';
        });
      });
      var offBtn = body.querySelector('#btn-serial-off');
      if (offBtn) offBtn.addEventListener('click', function () {
        window.PrinterSerialAdapter.disconnect().then(function () { Utils.toast('Koneksi printer diputuskan.', 'success'); renderTab(); });
      });

      var scanBtn = body.querySelector('#btn-bridge-scan');
      var disconnectBtn = body.querySelector('#btn-bridge-disconnect');
      var portListEl = body.querySelector('#bridge-port-list');
      if (scanBtn) scanBtn.addEventListener('click', function () {
        portListEl.innerHTML = '<span class="spinner-inline"></span> Mencari...';
        window.PrinterLocalBridgeAdapter.listPrinters().then(function (ports) {
          if (ports.length === 0) { portListEl.textContent = 'Tidak ada port terdeteksi. Pastikan printer sudah di-pair lewat Bluetooth Windows (PIN 0000).'; return; }
          portListEl.innerHTML = ports.map(function (p) {
            return '<div class="row" style="padding:6px 0;"><span>' + Utils.escapeHtml(p.path) + (p.manufacturer ? ' (' + Utils.escapeHtml(p.manufacturer) + ')' : '') + '</span>' +
              '<button class="btn btn-primary btn-sm" data-connect="' + Utils.escapeHtml(p.path) + '">Hubungkan</button></div>';
          }).join('');
          Utils.qsa('[data-connect]', portListEl).forEach(function (b) {
            b.addEventListener('click', function () {
              var path = b.getAttribute('data-connect');
              b.disabled = true; b.textContent = 'Menghubungkan...';
              window.PrinterLocalBridgeAdapter.connect(path).then(function () {
                Utils.toast('Terhubung ke ' + path + '.', 'success');
              }).catch(function (err) {
                Utils.toast(err.message, 'error'); b.disabled = false; b.textContent = 'Hubungkan';
              });
            });
          });
        }).catch(function (err) { portListEl.textContent = err.message; });
      });
      if (disconnectBtn) disconnectBtn.addEventListener('click', function () {
        window.PrinterLocalBridgeAdapter.disconnect().then(function () { Utils.toast('Printer diputuskan.', 'success'); });
      });

      var testBtn = body.querySelector('#btn-test-print');
      var statusEl = body.querySelector('#test-print-status');
      testBtn.addEventListener('click', function () {
        testBtn.disabled = true; testBtn.innerHTML = '<span class="spinner-inline"></span> Mencetak...';
        statusEl.textContent = '';
        window.PrinterManager.testPrint().then(function () {
          statusEl.innerHTML = '<span class="badge green">Berhasil</span> Perintah cetak terkirim. Periksa hasilnya di printer.';
        }).catch(function (err) {
          statusEl.innerHTML = '<span class="badge red">Gagal</span> ' + Utils.escapeHtml(err.message);
        }).finally(function () {
          testBtn.disabled = false; testBtn.textContent = 'Test Print';
        });
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
