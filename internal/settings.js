/**
 * internal/settings.js - Pengaturan sebagai DAFTAR MENU halaman pendek (satu topik per halaman).
 * Halaman: Profil toko, Jam buka, Ongkir, Pembayaran, Printer, Struk, (Harga grosir -> halaman Harga & Satuan),
 * serta Audit Log dan Backup (hanya peran yang berhak).
 * Alamat: #/internal/settings            -> daftar menu
 *         #/internal/settings?p=printer  -> satu halaman
 *         #/internal/audit , #/internal/backup -> langsung ke halaman itu
 */
window.Modules = window.Modules || {};
Modules.settings = (function () {
  var PAGES = {
    profil: 'Profil Toko', jam: 'Jam Buka', ongkir: 'Ongkir', pembayaran: 'Pembayaran',
    printer: 'Printer', struk: 'Struk', audit: 'Audit Log', backup: 'Backup'
  };

  function pageFromHash(initial) {
    if (initial === 'audit' || initial === 'backup') return initial;
    var m = /[?&]p=([a-z]+)/.exec(location.hash || '');
    return m && PAGES[m[1]] ? m[1] : '';
  }

  function render(container, initial) {
    var page = pageFromHash(initial);
    if (!page) return renderMenu(container);
    container.innerHTML = '<div class="sub-head"><a class="sub-back" href="' + (page === 'audit' || page === 'backup' ? '#/internal/menu' : '#/internal/settings') + '" aria-label="Kembali">&#8249;</a><h1 class="page-title">' + PAGES[page] + '</h1></div><div id="tab-body"><div class="spinner"></div></div>';
    var body = container.querySelector('#tab-body');
    var fn = { profil: renderProfil, jam: renderJam, ongkir: renderOngkir, pembayaran: renderPembayaran, printer: renderPrinter, struk: renderStruk, audit: renderAudit, backup: renderBackup }[page];
    return Promise.resolve(fn(body)).catch(function (err) { failView(body, err, function () { render(container, initial); }); });
  }

  function failView(body, err, retry) {
    if (!body || !body.isConnected) return;
    body.innerHTML = '<div class="empty-state"><div class="empty-title">Gagal memuat</div><div class="empty-sub">' + Utils.escapeHtml((err && err.message) || 'Coba lagi.') + '</div><button class="btn btn-primary" id="set-retry">Coba lagi</button></div>';
    var b = body.querySelector('#set-retry'); if (b) b.addEventListener('click', retry);
  }

  // ---------- daftar menu ----------
  function renderMenu(container) {
    var I = (window.Layout && Layout.ICONS) || {};
    function can() { return !!(window.Auth && Auth.isPemilik && Auth.isPemilik()); }   // Audit Log & Backup: hanya Pemilik
    var main = [
      ['#/internal/settings?p=profil', 'Profil Toko', 'Nama, alamat, kontak', I.home],
      ['#/internal/settings?p=jam', 'Jam Buka', 'Jam operasional toko', I.clipboard],
      ['#/internal/settings?p=ongkir', 'Ongkir', 'Antar ke rumah & biaya', I.truck],
      ['#/internal/settings?p=pembayaran', 'Pembayaran', 'QRIS & rekening bank', I.wallet],
      ['#/internal/settings?p=printer', 'Printer', 'Hubungkan & tes cetak', I.receipt],
      ['#/internal/settings?p=struk', 'Struk', 'Tampilan struk belanja', I.invoice],
      ['#/internal/prices', 'Harga Grosir', 'Harga & satuan jual', I.tag]
    ];
    var more = [['#/internal/notifications', 'Notifikasi', 'Nada & pengingat', I.bell]];
    if (can()) more.push(['#/internal/audit', 'Audit Log', 'Riwayat perubahan data', I.shield]);
    if (can()) more.push(['#/internal/backup', 'Backup', 'Salinan data otomatis', I.cloud]);
    function list(rows) {
      return '<div class="menu-list">' + rows.map(function (r) {
        return '<a class="menu-item" href="' + r[0] + '"><span class="menu-ic">' + (r[3] || '') + '</span><span class="menu-tx">' + r[1] + '<small class="menu-sub">' + r[2] + '</small></span><span class="menu-go">' + (I.chevron || '&#8250;') + '</span></a>';
      }).join('') + '</div>';
    }
    container.innerHTML = '<h1 class="page-title">Pengaturan</h1><div class="menu-group-label">TOKO</div>' + list(main) + '<div class="menu-group-label">LAINNYA</div>' + list(more);
  }

  // ---------- helpers form ----------
  function field(name, label, value, opts) {
    opts = opts || {};
    return '<div class="field"><label>' + label + '</label><input name="' + name + '" value="' + Utils.escapeHtml(value == null ? '' : value) + '"' +
      (opts.type ? ' type="' + opts.type + '"' : '') + (opts.mode ? ' inputmode="' + opts.mode + '"' : '') + (opts.ph ? ' placeholder="' + Utils.escapeHtml(opts.ph) + '"' : '') + '></div>';
  }
  function switchRow(id, title, sub, checked) {
    return '<div class="switch-row"><div><div class="sw-title">' + title + '</div>' + (sub ? '<div class="sw-sub">' + sub + '</div>' : '') + '</div>' +
      '<label class="switch"><input type="checkbox" id="' + id + '"' + (checked ? ' checked' : '') + '><span class="slider"></span></label></div>';
  }
  function segRow(label, options, cur, name) {
    return '<div class="set-seg"><div class="set-seg-l">' + label + '</div><div class="seg">' + options.map(function (o) {
      return '<button type="button" class="' + (cur === o.value ? 'on' : '') + '" data-rs="' + name + '" data-rs-value="' + o.value + '">' + o.label + '</button>';
    }).join('') + '</div></div>';
  }

  // ---------- Profil Toko & Jam Buka ----------
  function saveKeys(form, keys, okMsg) {
    var fd = Object.fromEntries(new FormData(form).entries());
    var btn = form.querySelector('[type=submit]'); if (btn) btn.disabled = true;
    return Promise.all(keys.map(function (k) { return Api.call('settings.update', { key: k, value: fd[k] == null ? '' : fd[k] }); }))
      .then(function () { Utils.toast(okMsg, 'success'); })
      .catch(function (err) { Utils.toast(err.message, 'error'); })
      .then(function () { if (btn) btn.disabled = false; });
  }
  function renderProfil(body) {
    return Api.call('settings.get', {}).then(function (d) {
      var s = d.settings || {};
      body.innerHTML = '<form id="f" class="card">' +
        field('store_name', 'Nama Toko', s.store_name) + field('store_tagline', 'Tagline', s.store_tagline) +
        field('store_address', 'Alamat Toko', s.store_address) + field('store_contact', 'Kontak (Telepon/WA)', s.store_contact, { mode: 'tel' }) +
        '<button class="btn btn-primary btn-block" type="submit">Simpan</button></form>';
      body.querySelector('#f').addEventListener('submit', function (e) { e.preventDefault(); saveKeys(e.target, ['store_name', 'store_tagline', 'store_address', 'store_contact'], 'Profil toko disimpan.'); });
    });
  }
  function renderJam(body) {
    return Api.call('settings.get', {}).then(function (d) {
      var s = d.settings || {};
      body.innerHTML = '<form id="f" class="card">' + field('store_hours', 'Jam Operasional', s.store_hours, { ph: 'Contoh: Setiap hari 07.00 - 21.00' }) +
        '<p class="hint">Teks ini tampil di bagian bawah toko online. Jam layanan antar diatur terpisah di menu Ongkir.</p>' +
        '<button class="btn btn-primary btn-block" type="submit">Simpan</button></form>';
      body.querySelector('#f').addEventListener('submit', function (e) { e.preventDefault(); saveKeys(e.target, ['store_hours'], 'Jam buka disimpan.'); });
    });
  }

  // ---------- Ongkir ----------
  function renderOngkir(body) {
    return Api.call('delivery.get', {}).then(function (d) {
      var s = d.settings || {};
      body.innerHTML = '<form id="f" class="card">' +
        switchRow('delivery_on', 'Layanan antar', 'Pembeli bisa memilih diantar saat checkout', !!s.delivery_enabled) +
        '<div style="height:10px"></div>' +
        field('flat_fee', 'Ongkir flat (Rp)', s.flat_fee, { mode: 'numeric' }) + field('free_shipping_minimum', 'Gratis ongkir minimal belanja (Rp)', s.free_shipping_minimum, { mode: 'numeric' }) +
        field('estimated_delivery', 'Estimasi waktu antar', s.estimated_delivery, { ph: 'Contoh: 1-2 jam' }) + field('delivery_hours', 'Jam layanan antar', s.delivery_hours, { ph: 'Contoh: 08.00 - 20.00' }) +
        '<button class="btn btn-primary btn-block" type="submit">Simpan</button></form>';
      body.querySelector('#f').addEventListener('submit', function (e) {
        e.preventDefault();
        var p = Object.fromEntries(new FormData(e.target).entries());
        p.delivery_enabled = body.querySelector('#delivery_on').checked ? 'true' : 'false';
        Api.call('delivery.update', p).then(function () { Utils.toast('Pengaturan ongkir disimpan.', 'success'); }).catch(function (err) { Utils.toast(err.message, 'error'); });
      });
    });
  }

  // ---------- Pembayaran ----------
  function renderPembayaran(body) {
    return Promise.all([Api.call('settings.get', {}), Api.call('bankAccount.list', {})]).then(function (r) {
      var d = r[0], banks = r[1].bank_accounts || [];
      var current = (d.settings && d.settings.qris_image_url) || '';
      body.innerHTML =
        '<div class="card"><div class="set-h">QRIS</div>' +
        '<div class="qris-box">' + (current ? '<img alt="QRIS toko" id="qris-img">' : '') + '<div class="qris-empty"' + (current ? ' hidden' : '') + '>Belum ada QRIS</div></div>' +
        '<input type="file" id="qris-file" accept="image/png,image/jpeg" hidden>' +
        '<button class="btn btn-primary btn-block" id="qris-pick">' + (current ? 'Ganti QRIS' : 'Unggah QRIS') + '</button>' +
        '<p class="hint">PNG atau JPG, maksimal 3 MB. Tampil di Kasir (metode QRIS) dan checkout toko online.</p></div>' +
        '<div class="card"><div class="row"><div class="set-h" style="margin:0;">Rekening bank</div><button class="btn btn-outline btn-sm" id="bank-add">+ Rekening</button></div>' +
        (banks.length ? banks.map(function (b) {
          var active = String(b.active) === 'true' || b.active === true;
          return '<div class="switch-row"><div><div class="sw-title">' + Utils.escapeHtml(b.bank_name) + ' &middot; ' + Utils.escapeHtml(b.account_number) + '</div><div class="sw-sub">a.n. ' + Utils.escapeHtml(b.account_holder) + (active ? '' : ' &middot; nonaktif') + '</div></div>' +
            '<label class="switch"><input type="checkbox" data-bank="' + b.bank_account_id + '"' + (active ? ' checked' : '') + '><span class="slider"></span></label></div>';
        }).join('') : '<div class="empty-sub" style="padding:14px 0;">Belum ada rekening. Tambahkan agar pembeli bisa transfer.</div>') + '</div>';
      var img = body.querySelector('#qris-img');
      if (img) Utils.bindQris(img, current, function () { img.remove(); var e = body.querySelector('.qris-empty'); e.hidden = false; e.textContent = 'QRIS tidak dapat dimuat. Periksa koneksi, atau unggah ulang.'; });
      var file = body.querySelector('#qris-file');
      body.querySelector('#qris-pick').addEventListener('click', function () { file.click(); });
      file.addEventListener('change', function () {
        if (!file.files || !file.files[0]) return;
        var f = file.files[0];
        if (f.size > 3 * 1024 * 1024) { Utils.toast('Gambar lebih dari 3 MB.', 'error'); return; }
        var rd = new FileReader();
        rd.onload = function () {
          Utils.toast('Mengunggah QRIS...', 'info');
          Api.call('qris.upload', { base64: String(rd.result).split(',')[1], mimeType: f.type }).then(function () { Utils.toast('QRIS tersimpan.', 'success'); renderPembayaran(body); })
            .catch(function (err) { Utils.toast(err.message, 'error'); });
        };
        rd.readAsDataURL(f);
      });
      Utils.qsa('[data-bank]', body).forEach(function (c) {
        c.addEventListener('change', function () {
          Api.call('bankAccount.update', { bank_account_id: c.getAttribute('data-bank'), active: c.checked }).then(function () { renderPembayaran(body); })
            .catch(function (err) { c.checked = !c.checked; Utils.toast(err.message, 'error'); });
        });
      });
      body.querySelector('#bank-add').addEventListener('click', function () {
        var m = Utils.openModal('<h3>Tambah Rekening</h3><form id="bf">' + field('bank_name', 'Nama bank', '', { ph: 'Contoh: BCA' }) + field('account_number', 'Nomor rekening', '', { mode: 'numeric' }) + field('account_holder', 'Atas nama', '') +
          '<button class="btn btn-primary btn-block" type="submit">Simpan</button></form>');
        m.querySelector('#bf').addEventListener('submit', function (e) {
          e.preventDefault();
          var p = Object.fromEntries(new FormData(e.target).entries());
          if (!p.bank_name.trim() || !p.account_number.trim() || !p.account_holder.trim()) { Utils.toast('Lengkapi semua kolom.', 'error'); return; }
          Api.call('bankAccount.create', p).then(function () { Utils.closeModal(); Utils.toast('Rekening ditambahkan.', 'success'); renderPembayaran(body); }).catch(function (err) { Utils.toast(err.message, 'error'); });
        });
      });
    });
  }

  // ---------- Printer ----------
  /** Di dalam aplikasi TOKOQIA (APK/iPhone): pilih printer Bluetooth langsung. Tidak ada jalur browser. */
  function renderNativePrinter(body) {
    var NA = window.PrinterNativeAdapter, st = NA.status(), sel = st.selected, rs = window.ReceiptBuilder.getReceiptSettings();
    var hasSpp = st.methods.indexOf('spp') >= 0;
    var mLabel = { ble: 'Bluetooth LE', spp: 'Bluetooth Classic (SPP)' };
    body.innerHTML =
      '<div class="card pr-status"><span class="pr-dot ' + (sel ? 'ok' : 'warn') + '"></span>' +
      '<div class="pr-title">' + (sel ? Utils.escapeHtml(sel.name) : 'Belum ada printer') + '</div>' +
      '<p class="hint" style="margin:4px 0 14px;">' + (sel ? mLabel[sel.method] + ' &middot; tersambung otomatis saat mencetak. Pastikan printer menyala.' : 'Pilih printer di bawah. Struk dikirim langsung ke printer, tanpa dialog browser.') + '</p>' +
      '<div class="field-row"><button class="btn btn-primary btn-block" id="np-test"' + (sel ? '' : ' disabled') + '>Tes Cetak</button>' +
      (sel ? '<button class="btn btn-outline btn-block" id="np-forget">Lupakan</button>' : '') + '</div>' +
      '<div id="np-status" class="muted" style="margin-top:8px;"></div></div>' +
      '<div class="card"><div class="row"><div><div class="set-h" style="margin:0;">Cetak otomatis setelah bayar</div><div class="muted">Struk langsung dikirim ke printer begitu pembayaran berhasil.</div></div>' +
      '<button class="btn ' + (window.PrinterManager.getAutoPrint() ? 'btn-primary' : 'btn-outline') + ' btn-sm" id="np-auto">' + (window.PrinterManager.getAutoPrint() ? 'Aktif' : 'Mati') + '</button></div></div>' +
      '<div class="card"><div class="set-h">Pilih printer</div>' +
      (hasSpp ? '<button class="btn btn-secondary btn-block" id="np-spp">Printer yang sudah dipasangkan (Bluetooth Classic)</button><div id="np-spp-list" style="margin:8px 0;"></div>' : '') +
      '<button class="btn ' + (hasSpp ? 'btn-outline' : 'btn-secondary') + ' btn-block" id="np-ble" style="margin-top:8px;">Cari printer Bluetooth LE</button>' +
      '<p class="hint" style="margin-bottom:0;">' + (hasSpp ? 'Android: pasangkan printer dulu di Pengaturan Bluetooth HP (PIN 0000), lalu pilih di daftar pertama. Bila printer Anda BLE, pakai tombol kedua.' : 'iPhone hanya bisa tersambung ke printer BLE atau printer berlogo MFi. Printer Bluetooth Classic biasa tidak akan muncul.') + '</p></div>' +
      '<details class="collapsible"><summary>Lanjutan (teknis)</summary><div class="collapsible-body">' +
      '<div class="card"><div class="set-h">Format teks ke printer</div>' +
      segRow('Akhir baris', [{ value: 'CRLF', label: 'CRLF' }, { value: 'LF', label: 'LF' }], rs.lineEnding, 'lineEnding') +
      '<div class="field"><label>Lebar karakter - font normal</label><input type="number" id="rs-charwidth" value="' + rs.charWidth + '" min="16" max="64"></div>' +
      '<div class="field"><label>Lebar karakter - font kecil</label><input type="number" id="rs-condensedwidth" value="' + rs.condensedWidth + '" min="16" max="80"></div>' +
      '<div class="field"><label>Baris kosong di akhir struk</label><input type="number" id="rs-feedlines" value="' + rs.feedLines + '" min="0" max="10"></div>' +
      '<div class="field"><label>Ukuran paket Bluetooth LE (byte)</label><input type="number" id="np-chunk" value="' + NA.chunkSize() + '" min="20" max="512"><div class="hint">Bawaan 20 paling aman. Naikkan (mis. 100) hanya bila cetak terlalu lambat dan printer tetap normal.</div></div>' +
      '<button class="btn btn-outline btn-sm" id="np-save">Simpan</button></div></div></details>';

    var again = function () { renderNativePrinter(body); };
    var statusEl = body.querySelector('#np-status');
    Utils.qsa('[data-rs]', body).forEach(function (b) { b.addEventListener('click', function () { var p = {}; p[b.getAttribute('data-rs')] = b.getAttribute('data-rs-value'); window.ReceiptBuilder.setReceiptSettings(p); again(); }); });
    body.querySelector('#np-save').addEventListener('click', function () {
      window.ReceiptBuilder.setReceiptSettings({
        charWidth: Math.max(16, Math.min(64, Number(body.querySelector('#rs-charwidth').value) || 32)),
        condensedWidth: Math.max(16, Math.min(80, Number(body.querySelector('#rs-condensedwidth').value) || 42)),
        feedLines: Math.max(0, Math.min(10, Number(body.querySelector('#rs-feedlines').value) || 4))
      });
      NA.setChunkSize(Math.max(20, Math.min(512, Number(body.querySelector('#np-chunk').value) || 20)));
      Utils.toast('Disimpan.', 'success');
    });
    body.querySelector('#np-auto').addEventListener('click', function () { window.PrinterManager.setAutoPrint(!window.PrinterManager.getAutoPrint()); again(); });
    var bleBtn = body.querySelector('#np-ble');
    bleBtn.addEventListener('click', function () {
      bleBtn.disabled = true; statusEl.textContent = '';
      NA.pickBle().then(function () { Utils.toast('Printer dipilih.', 'success'); again(); })
        .catch(function (err) { statusEl.innerHTML = '<span class="badge red">Gagal</span> ' + Utils.escapeHtml(err.message); bleBtn.disabled = false; });
    });
    var sppBtn = body.querySelector('#np-spp');
    if (sppBtn) sppBtn.addEventListener('click', function () {
      var list = body.querySelector('#np-spp-list'); list.innerHTML = '<span class="spinner-inline"></span> Memuat...'; statusEl.textContent = '';
      NA.listBonded().then(function (devs) {
        if (!devs || !devs.length) { list.innerHTML = '<div class="muted">Belum ada perangkat Bluetooth yang dipasangkan. Pasangkan printer di Pengaturan Bluetooth HP (PIN 0000), lalu coba lagi.</div>'; return; }
        list.innerHTML = devs.map(function (d, i) {
          return '<div class="row lrow" style="padding:8px 0;"><div><strong>' + Utils.escapeHtml(d.name || d.address) + '</strong><div class="muted">' + Utils.escapeHtml(d.address) + '</div></div><button class="btn btn-primary btn-sm" data-spp="' + i + '">Pilih</button></div>';
        }).join('');
        Utils.qsa('[data-spp]', list).forEach(function (b) { b.addEventListener('click', function () { NA.selectSpp(devs[Number(b.getAttribute('data-spp'))]); Utils.toast('Printer dipilih.', 'success'); again(); }); });
      }).catch(function (err) { list.innerHTML = ''; statusEl.innerHTML = '<span class="badge red">Gagal</span> ' + Utils.escapeHtml(err.message); });
    });
    var forget = body.querySelector('#np-forget');
    if (forget) forget.addEventListener('click', function () { NA.disconnect().then(function () { NA.setSelection(null); Utils.toast('Printer dilupakan.', 'success'); again(); }); });
    var testBtn = body.querySelector('#np-test');
    testBtn.addEventListener('click', function () {
      testBtn.disabled = true; testBtn.innerHTML = '<span class="spinner-inline"></span> Mengirim...'; statusEl.textContent = '';
      window.PrinterManager.testPrint().then(function () { statusEl.innerHTML = '<span class="badge green">Terkirim</span> Periksa kertas di printer. Bila tidak keluar, cek printer menyala dan kertas ada.'; })
        .catch(function (err) { statusEl.innerHTML = '<span class="badge red">Gagal</span> ' + Utils.escapeHtml(err.message); })
        .then(function () { testBtn.disabled = false; testBtn.textContent = 'Tes Cetak'; });
    });
    return Promise.resolve();
  }

  function renderPrinter(body) {
    if (window.PrinterNativeAdapter && window.PrinterNativeAdapter.isAvailable()) return renderNativePrinter(body);
    var adapters = window.PrinterManager.availableAdapters();
    var current = window.PrinterManager.getPreferredAdapterName();
    var rs = window.ReceiptBuilder.getReceiptSettings();
    return Promise.all([window.PrinterManager.detectCapabilities(), window.PrinterSerialAdapter.hasGrantedPort(), window.PrinterLocalBridgeAdapter.checkAvailability()]).then(function (res) {
      var cap = res[0], serialGranted = res[1], bridgeUp = res[2], serialConnected = window.PrinterSerialAdapter.isConnected();
      var st;
      if (current !== 'auto') st = { cls: 'warn', title: 'Metode dipilih manual', sub: 'Memakai metode manual dari Lanjutan. Pilih "Otomatis" di sana untuk kembali.' };
      else if (serialConnected) st = { cls: 'ok', title: 'Printer terhubung', sub: 'Struk langsung tercetak, tanpa dialog.' };
      else if (serialGranted) st = { cls: 'ok', title: 'Printer siap', sub: 'Tersambung otomatis saat mencetak. Pastikan printer menyala.' };
      else if (bridgeUp) st = { cls: 'ok', title: 'Terhubung (Bridge)', sub: 'Struk dicetak lewat TOKOQIA Local Print Bridge.' };
      else st = { cls: 'warn', title: 'Belum terhubung', sub: cap.webSerial ? 'Saat ini struk dicetak lewat dialog cetak browser. Tekan Hubungkan agar langsung tercetak.' : 'Perangkat ini tidak bisa tersambung langsung ke printer. Struk dicetak lewat dialog cetak browser dan tetap berfungsi.' };

      body.innerHTML =
        '<div class="card pr-status"><span class="pr-dot ' + st.cls + '"></span><div class="pr-title">' + st.title + '</div><p class="hint" style="margin:4px 0 14px;">' + st.sub + '</p>' +
        '<div class="field-row"><button class="btn btn-primary btn-block" id="btn-connect"' + (!cap.webSerial ? ' disabled' : '') + '>Hubungkan</button><button class="btn btn-secondary btn-block" id="btn-test-print">Tes Cetak</button></div>' +
        '<div id="serial-msg" class="muted" style="margin-top:8px;"></div><div id="test-print-status" class="muted" style="margin-top:6px;"></div>' +
        ((serialConnected || serialGranted) ? '<button class="btn btn-ghost btn-sm" id="btn-serial-off" style="margin-top:6px;">Putuskan printer</button>' : '') + '</div>' +
        '<p class="hint">Printer: PUTIAN POS RPP02N, kertas 58mm. Bluetooth: pair dulu di pengaturan Bluetooth perangkat (PIN 0000), lalu tekan Hubungkan dan pilih RPP02N.</p>' +
        '<details class="collapsible"' + (window.__printerAdv ? ' open' : '') + '><summary>Lanjutan (teknis)</summary><div class="collapsible-body">' +
        '<p class="hint" style="margin-top:0;">Hanya dibuka bila ada masalah sambungan. Biarkan "Otomatis" untuk pemakaian normal.</p>' +
        adapters.map(function (a) {
          return '<div class="card row"><div><strong>' + a.label + '</strong><div class="muted">' + window.PrinterManager.statusLabel(a.id) + '</div></div>' +
            '<button class="btn ' + (current === a.id ? 'btn-primary' : 'btn-outline') + ' btn-sm" data-select="' + a.id + '"' + (!a.available ? ' disabled' : '') + '>' + (current === a.id ? 'Terpilih' : 'Pilih') + '</button></div>';
        }).join('') +
        '<div class="card"><div class="set-h">Format teks ke printer</div><p class="hint" style="margin-top:0;">Jika baris teks menempel di kertas asli, coba ganti Akhir Baris.</p>' +
        segRow('Akhir baris', [{ value: 'CRLF', label: 'CRLF' }, { value: 'LF', label: 'LF' }], rs.lineEnding, 'lineEnding') +
        '<div class="field"><label>Lebar karakter - font normal</label><input type="number" id="rs-charwidth" value="' + rs.charWidth + '" min="16" max="64"></div>' +
        '<div class="field"><label>Lebar karakter - font kecil</label><input type="number" id="rs-condensedwidth" value="' + rs.condensedWidth + '" min="16" max="80"></div>' +
        '<div class="field"><label>Baris kosong di akhir struk</label><input type="number" id="rs-feedlines" value="' + rs.feedLines + '" min="0" max="10"></div>' +
        '<button class="btn btn-outline btn-sm" id="btn-save-format">Simpan format</button></div>' +
        '<div class="card"><div class="set-h">Lebar kertas (cetak via browser)</div>' +
        '<div class="seg"><button type="button" class="' + (window.PrinterBrowserAdapter.getPaperWidth() === '58' ? 'on' : '') + '" data-paper="58">58 mm</button><button type="button" class="' + (window.PrinterBrowserAdapter.getPaperWidth() === '80' ? 'on' : '') + '" data-paper="80">80 mm</button></div></div>' +
        '<div class="card"><div class="set-h">Kemampuan perangkat ini</div>' + capRow('Web Bluetooth (BLE)', cap.webBluetooth) + capRow('Web Serial (Bluetooth SPP / USB)', cap.webSerial) + capRow('Local Bridge', cap.localBridge) + capRow('Cetak via browser', cap.browserPrint) + '</div>' +
        '<div class="card"><div class="set-h">Local Print Bridge (komputer)</div><p class="hint" style="margin-top:0;">Alternatif untuk komputer: jalankan <code>node bridge.js</code> dulu. Tidak dipakai di HP.</p>' +
        '<div id="bridge-port-list" class="muted">' + (cap.localBridge ? 'Tekan "Cari printer" untuk memuat daftar port.' : 'Bridge belum aktif.') + '</div>' +
        '<div class="field-row" style="margin-top:10px;"><button class="btn btn-outline btn-sm" id="btn-bridge-scan"' + (!cap.localBridge ? ' disabled' : '') + '>Cari printer</button><button class="btn btn-outline btn-sm" id="btn-bridge-disconnect"' + (!cap.localBridge ? ' disabled' : '') + '>Putuskan</button></div></div>' +
        '</div></details>';

      function capRow(label, ok) { return '<div class="row" style="padding:6px 0;"><span>' + label + '</span><span class="badge ' + (ok ? 'green' : 'grey') + '">' + (ok ? 'Tersedia' : 'Tidak ada') + '</span></div>'; }
      var again = function () { window.__printerAdv = true; renderPrinter(body); };
      Utils.qsa('[data-select]', body).forEach(function (b) { b.addEventListener('click', function () { window.PrinterManager.setPreferredAdapterName(b.getAttribute('data-select')); again(); }); });
      Utils.qsa('[data-paper]', body).forEach(function (b) { b.addEventListener('click', function () { window.PrinterBrowserAdapter.setPaperWidth(b.getAttribute('data-paper')); again(); }); });
      Utils.qsa('[data-rs]', body).forEach(function (b) { b.addEventListener('click', function () { var p = {}; p[b.getAttribute('data-rs')] = b.getAttribute('data-rs-value'); window.ReceiptBuilder.setReceiptSettings(p); again(); }); });
      body.querySelector('#btn-save-format').addEventListener('click', function () {
        window.ReceiptBuilder.setReceiptSettings({
          charWidth: Math.max(16, Math.min(64, Number(body.querySelector('#rs-charwidth').value) || 32)),
          condensedWidth: Math.max(16, Math.min(80, Number(body.querySelector('#rs-condensedwidth').value) || 42)),
          feedLines: Math.max(0, Math.min(10, Number(body.querySelector('#rs-feedlines').value) || 4))
        });
        Utils.toast('Format disimpan.', 'success');
      });

      var serialMsg = body.querySelector('#serial-msg'), connectBtn = body.querySelector('#btn-connect');
      connectBtn.addEventListener('click', function () {
        connectBtn.disabled = true; connectBtn.textContent = 'Menunggu pilihan...'; serialMsg.textContent = '';
        window.PrinterSerialAdapter.pair('any').then(function () { Utils.toast('Printer terhubung.', 'success'); window.__printerAdv = false; renderPrinter(body); })
          .catch(function (err) {
            serialMsg.innerHTML = '<span class="badge red">Gagal</span> ' + Utils.escapeHtml(err.message) + ' Jika daftar kosong, perangkat/browser ini belum bisa tersambung langsung ke RPP02N; struk tetap bisa dicetak lewat dialog cetak browser.';
            connectBtn.disabled = false; connectBtn.textContent = 'Hubungkan';
          });
      });
      var offBtn = body.querySelector('#btn-serial-off');
      if (offBtn) offBtn.addEventListener('click', function () { window.PrinterSerialAdapter.disconnect().then(function () { Utils.toast('Koneksi printer diputuskan.', 'success'); renderPrinter(body); }); });

      var scanBtn = body.querySelector('#btn-bridge-scan'), disconnectBtn = body.querySelector('#btn-bridge-disconnect'), portListEl = body.querySelector('#bridge-port-list');
      scanBtn.addEventListener('click', function () {
        portListEl.innerHTML = '<span class="spinner-inline"></span> Mencari...';
        window.PrinterLocalBridgeAdapter.listPrinters().then(function (ports) {
          if (ports.length === 0) { portListEl.textContent = 'Tidak ada port terdeteksi. Pastikan printer sudah di-pair lewat Bluetooth Windows (PIN 0000).'; return; }
          portListEl.innerHTML = ports.map(function (p) {
            return '<div class="row" style="padding:6px 0;"><span>' + Utils.escapeHtml(p.path) + (p.manufacturer ? ' (' + Utils.escapeHtml(p.manufacturer) + ')' : '') + '</span><button class="btn btn-primary btn-sm" data-connect="' + Utils.escapeHtml(p.path) + '">Hubungkan</button></div>';
          }).join('');
          Utils.qsa('[data-connect]', portListEl).forEach(function (b) {
            b.addEventListener('click', function () {
              var path = b.getAttribute('data-connect'); b.disabled = true; b.textContent = 'Menghubungkan...';
              window.PrinterLocalBridgeAdapter.connect(path).then(function () { Utils.toast('Terhubung ke ' + path + '.', 'success'); })
                .catch(function (err) { Utils.toast(err.message, 'error'); b.disabled = false; b.textContent = 'Hubungkan'; });
            });
          });
        }).catch(function (err) { portListEl.textContent = err.message; });
      });
      disconnectBtn.addEventListener('click', function () { window.PrinterLocalBridgeAdapter.disconnect().then(function () { Utils.toast('Printer diputuskan.', 'success'); }); });

      var testBtn = body.querySelector('#btn-test-print'), statusEl = body.querySelector('#test-print-status');
      testBtn.addEventListener('click', function () {
        testBtn.disabled = true; testBtn.innerHTML = '<span class="spinner-inline"></span> Mencetak...'; statusEl.textContent = '';
        window.PrinterManager.testPrint().then(function () { statusEl.innerHTML = '<span class="badge green">Terkirim</span> Periksa hasilnya di printer.'; })
          .catch(function (err) { statusEl.innerHTML = '<span class="badge red">Gagal</span> ' + Utils.escapeHtml(err.message); })
          .then(function () { testBtn.disabled = false; testBtn.textContent = 'Tes Cetak'; });
      });
    });
  }

  // ---------- Struk: pratinjau di atas, saklar berkelompok, tersimpan otomatis di perangkat ini ----------
  function renderStruk(body) {
    var rs = window.ReceiptBuilder.getReceiptSettings();
    var size = [{ value: 'normal', label: 'Normal' }, { value: 'condensed', label: 'Kecil' }];
    body.innerHTML =
      '<div class="card struk-prev"><iframe id="receipt-preview-frame" title="Pratinjau struk"></iframe><p class="hint" style="text-align:center;margin:8px 0 0;">Contoh data, bukan transaksi asli</p></div>' +
      '<div class="card"><div class="set-h">Logo</div>' + switchRow('rs-logo-show', 'Tampilkan logo', '', rs.logoShow) +
      segRow('Ukuran logo', [{ value: 'small', label: 'Kecil' }, { value: 'medium', label: 'Sedang' }, { value: 'large', label: 'Besar' }], rs.logoSize, 'logoSize') + '</div>' +
      '<div class="card"><div class="set-h">Header</div>' + switchRow('rs-header-tagline', 'Tagline', '', rs.headerShowTagline) + switchRow('rs-header-address', 'Alamat toko', '', rs.headerShowAddress) +
      segRow('Ukuran huruf', size, rs.headerFontSize, 'headerFontSize') + '</div>' +
      '<div class="card"><div class="set-h">Info transaksi</div><p class="hint" style="margin:0;">Nomor dan tanggal selalu tampil.</p>' + switchRow('rs-info-cashier', 'Nama kasir', '', rs.infoShowCashier) +
      segRow('Ukuran huruf', size, rs.infoFontSize, 'infoFontSize') + '</div>' +
      '<div class="card"><div class="set-h">Footer</div>' + switchRow('rs-footer-thanks', 'Ucapan terima kasih', '', rs.footerShowThanks) + switchRow('rs-footer-storename', 'Nama toko', '', rs.footerShowStoreName) + switchRow('rs-footer-copyright', 'Baris hak cipta', '', rs.footerShowCopyright) +
      segRow('Ukuran huruf', size, rs.footerFontSize, 'footerFontSize') + '</div>' +
      '<p class="hint">Perubahan tersimpan otomatis di perangkat ini. Perangkat kasir lain memakai pengaturannya sendiri.</p>';
    function preview() {
      var frame = body.querySelector('#receipt-preview-frame'); if (!frame) return;
      var mm = window.PrinterBrowserAdapter.getPaperWidth();
      frame.srcdoc = '<html><head><meta charset="utf-8">' + window.PrinterBrowserAdapter.styleFor(mm) + '</head><body>' + window.ReceiptBuilder.buildHtml(window.ReceiptBuilder.buildSampleReceiptData()) + '</body></html>';
    }
    preview();
    var map = { 'rs-logo-show': 'logoShow', 'rs-header-tagline': 'headerShowTagline', 'rs-header-address': 'headerShowAddress', 'rs-info-cashier': 'infoShowCashier', 'rs-footer-thanks': 'footerShowThanks', 'rs-footer-storename': 'footerShowStoreName', 'rs-footer-copyright': 'footerShowCopyright' };
    Object.keys(map).forEach(function (id) {
      body.querySelector('#' + id).addEventListener('change', function (e) { var p = {}; p[map[id]] = e.target.checked; window.ReceiptBuilder.setReceiptSettings(p); preview(); });
    });
    Utils.qsa('[data-rs]', body).forEach(function (b) {
      b.addEventListener('click', function () {
        var p = {}; p[b.getAttribute('data-rs')] = b.getAttribute('data-rs-value'); window.ReceiptBuilder.setReceiptSettings(p);
        Utils.qsa('[data-rs="' + b.getAttribute('data-rs') + '"]', body).forEach(function (x) { x.classList.toggle('on', x === b); });
        preview();
      });
    });
  }

  // ---------- Audit & Backup ----------
  function renderAudit(body) {
    return Api.call('audit.log.list', { limit: 100 }).then(function (d) {
      if (!d.logs.length) { body.innerHTML = '<div class="empty-state"><div class="empty-sub">Belum ada riwayat.</div></div>'; return; }
      body.innerHTML = '<div class="table-wrap"><table><thead><tr><th>Aksi</th><th>Modul</th><th>Waktu</th><th>Entitas</th></tr></thead><tbody>' +
        d.logs.map(function (l) { return '<tr><td>' + Utils.escapeHtml(l.action) + '</td><td>' + Utils.escapeHtml(l.module) + '</td><td>' + Utils.formatDate(l.timestamp) + '</td><td>' + Utils.escapeHtml((l.entity_type || '') + ' ' + (l.entity_id || '')) + '</td></tr>'; }).join('') + '</tbody></table></div>';
    });
  }
  function renderBackup(body) {
    return Api.call('system.backup.list', {}).then(function (d) {
      body.innerHTML = '<button class="btn btn-primary btn-block" id="run-backup">Backup sekarang</button>' +
        (d.backups.length ? '<div class="menu-list" style="margin-top:12px;">' + d.backups.map(function (f) {
          return '<a class="menu-item" href="' + Utils.escapeHtml(f.url) + '" target="_blank" rel="noopener"><span class="menu-tx">' + Utils.escapeHtml(f.name) + '<small class="menu-sub">' + Utils.formatDate(f.created_at) + '</small></span><span class="menu-go">Buka</span></a>';
        }).join('') + '</div>' : '<div class="empty-state"><div class="empty-sub">Belum ada backup.</div></div>') +
        '<p class="hint">Backup otomatis harian berjalan bila trigger sudah dipasang (installDailyTriggers).</p>';
      body.querySelector('#run-backup').addEventListener('click', function () {
        Utils.toast('Membuat backup, mohon tunggu...', 'info');
        Api.call('system.backup.run', {}).then(function () { Utils.toast('Backup berhasil dibuat.', 'success'); renderBackup(body); }).catch(function (err) { Utils.toast(err.message, 'error'); });
      });
    });
  }

  return { render: render };
})();
