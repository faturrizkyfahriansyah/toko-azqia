/**
 * internal/wa.js - WhatsApp Center: Percakapan (inbox + riwayat + balas), Ikhtisar, Pengaturan Bot, Monitor.
 * Desktop: 3 panel. Tablet: 2 panel (info = lembar). Mobile: bertahap (daftar -> percakapan -> info).
 * Tidak pernah menampilkan kunci/token: hanya status terkonfigurasi (ya/tidak). Nomor ditampilkan dimasker.
 */
window.Modules = window.Modules || {};
Modules.wa = (function () {
  var tab = 'chat', view = 'list', sel = '', filters = { status: '', search: '' }, timer = null;
  var cache = { conv: [], detail: null, messages: [] };

  function esc(s) { return Utils.escapeHtml(String(s === undefined || s === null ? '' : s)); }
  function hhmm(iso) {
    var d = new Date(iso); if (isNaN(d.getTime())) return '';
    var today = new Date().toDateString() === d.toDateString();
    return today ? ('0' + d.getHours()).slice(-2) + '.' + ('0' + d.getMinutes()).slice(-2) : d.getDate() + ' ' + d.toLocaleDateString('id-ID', { month: 'short' });
  }
  function initials(n) { var w = String(n || '?').trim().split(/\s+/); return ((w[0] || '?')[0] + (w[1] ? w[1][0] : '')).toUpperCase(); }
  function chip(status) { var c = status === 'ADMIN' ? 'red' : (status === 'PAUSED' ? '' : 'green'); return '<span class="badge ' + c + '">' + esc(status) + '</span>'; }
  function canEditConfig() { return Auth.isPemilik && Auth.isPemilik(); }
  function stopTimer() { if (timer) { clearInterval(timer); timer = null; } }

  function render(container) {
    stopTimer();
    var tabs = [['chat', 'Percakapan'], ['overview', 'Ikhtisar'], ['bot', 'Bot'], ['monitor', 'Monitor']];
    container.innerHTML = '<h1 class="page-title">WhatsApp</h1><div class="tabs" id="wa-tabs">' + tabs.map(function (t) {
      return '<button data-tab="' + t[0] + '" class="' + (tab === t[0] ? 'active' : '') + '">' + t[1] + '</button>'; }).join('') + '</div><div id="wa-root"></div>';
    Utils.qsa('#wa-tabs [data-tab]', container).forEach(function (b) { b.addEventListener('click', function () { tab = b.getAttribute('data-tab'); render(container); }); });
    var body = container.querySelector('#wa-root');
    var p = tab === 'chat' ? renderChat(body) : tab === 'overview' ? renderOverview(body) : tab === 'bot' ? renderBot(body) : renderMonitor(body);
    return Promise.resolve(p).catch(function (err) { body.innerHTML = '<div class="empty-state"><div class="empty-title">Gagal memuat</div><div class="empty-sub">' + esc(err && err.message) + '</div><button class="btn btn-primary" id="wa-retry">Coba lagi</button></div>'; var b = body.querySelector('#wa-retry'); if (b) b.addEventListener('click', function () { render(container); }); });
  }

  // ================= PERCAKAPAN =================
  function renderChat(body) {
    body.innerHTML = '<div class="wa-layout" id="wa-layout" data-view="' + view + '">' +
      '<section class="wa-pane wa-list-pane"><div class="wa-list-tools"><input id="wa-search" type="search" placeholder="Cari nama / nomor / pesan" value="' + esc(filters.search) + '">' +
      '<div class="period-row" id="wa-filters">' + [['', 'Semua'], ['BOT', 'Bot'], ['ADMIN', 'Admin'], ['PAUSED', 'Jeda']].map(function (f) { return '<button class="chip' + (filters.status === f[0] ? ' active' : '') + '" data-st="' + f[0] + '">' + f[1] + '</button>'; }).join('') + '</div></div>' +
      '<div id="wa-conv-list"><div class="spinner"></div></div></section>' +
      '<section class="wa-pane wa-thread-pane" id="wa-thread"></section>' +
      '<aside class="wa-pane wa-info-pane" id="wa-info"></aside></div>';
    body.querySelector('#wa-search').addEventListener('input', Utils.debounce(function (e) { filters.search = e.target.value.trim(); loadList(); }, 300));
    Utils.qsa('#wa-filters [data-st]', body).forEach(function (b) { b.addEventListener('click', function () { filters.status = b.getAttribute('data-st'); Utils.qsa('#wa-filters .chip', body).forEach(function (x) { x.classList.toggle('active', x === b); }); loadList(); }); });
    drawThread(); drawInfo();
    timer = setInterval(function () { if (!document.getElementById('wa-conv-list')) { stopTimer(); return; } loadList(true); if (sel) loadThread(true); }, 20000);
    return loadList().then(function () { if (sel) return openConv(sel, true); });
  }
  function setView(v) { view = v; var l = document.getElementById('wa-layout'); if (l) l.setAttribute('data-view', v); }
  function loadList(silent) {
    var box = document.getElementById('wa-conv-list'); if (!box) return Promise.resolve();
    return Api.call('wa.conversation.list', { status: filters.status, search: filters.search, limit: 100 }).then(function (d) {
      box = document.getElementById('wa-conv-list'); if (!box) return;
      cache.conv = d.conversations;
      if (!d.conversations.length) { box.innerHTML = '<div class="empty-state"><div class="empty-title">Belum ada percakapan</div><div class="empty-sub">Pesan pelanggan dari WhatsApp akan muncul di sini.</div></div>'; return; }
      box.innerHTML = d.conversations.map(function (c) {
        var nm = c.display_name || c.phone_masked;
        return '<button class="wa-item' + (c.phone_e164 === sel ? ' active' : '') + '" data-ph="' + esc(c.phone_e164) + '"><span class="wa-avatar">' + esc(initials(nm)) + '</span>' +
          '<span class="wa-item-main"><span class="wa-item-top"><strong>' + esc(nm) + '</strong><span class="muted">' + esc(hhmm(c.last_at)) + '</span></span>' +
          '<span class="wa-item-bot"><span class="muted wa-snippet">' + (c.last_direction === 'OUT' ? 'Anda: ' : '') + esc(c.last_message) + '</span>' + (c.unread ? '<span class="badge red">' + c.unread + '</span>' : '') + '</span>' +
          '<span class="wa-item-st">' + chip(c.bot_status) + '</span></span></button>';
      }).join('');
      Utils.qsa('[data-ph]', box).forEach(function (b) { b.addEventListener('click', function () { openConv(b.getAttribute('data-ph')); }); });
    }).catch(function (err) { if (!silent) { box.innerHTML = '<div class="empty-state"><div class="empty-title">Gagal memuat</div><div class="empty-sub">' + esc(err.message) + '</div></div>'; } });
  }
  function openConv(ph, keepView) {
    sel = ph; if (!keepView) setView('thread');
    Utils.qsa('#wa-conv-list .wa-item').forEach(function (x) { x.classList.toggle('active', x.getAttribute('data-ph') === ph); });
    return Promise.all([loadThread(), Api.call('wa.conversation.detail', { phone_e164: ph }).then(function (d) { cache.detail = d; drawInfo(); drawThread(); })]).then(function () {
      return Api.call('wa.conversation.markRead', { phone_e164: ph }).then(function () { loadList(true); });
    }).catch(function (err) { Utils.toast(err.message, 'error'); });
  }
  function loadThread() {
    if (!sel) return Promise.resolve();
    return Api.call('wa.conversation.messages', { phone_e164: sel, limit: 100 }).then(function (d) { cache.messages = d.messages; drawThread(); });
  }
  function bubble(m) {
    var who = m.direction === 'IN' ? 'in' : (m.handled_by === 'ADMIN' ? 'admin' : 'bot');
    var label = m.direction === 'IN' ? '' : '<span class="wa-who">' + (m.handled_by === 'AI' ? 'Asisten AI' : m.handled_by === 'ADMIN' ? 'Admin' : m.handled_by === 'SYSTEM' ? 'Sistem' : 'Bot') + '</span>';
    return '<div class="wa-bubble ' + who + '">' + label + '<div class="wa-text">' + esc(m.text) + '</div><div class="wa-meta">' + esc(hhmm(m.created_at)) + (m.status === 'SEND_FAILED' ? ' &middot; <span class="wa-fail">gagal terkirim</span>' : '') + '</div></div>';
  }
  function drawThread() {
    var box = document.getElementById('wa-thread'); if (!box) return;
    if (!sel) { box.innerHTML = '<div class="empty-state"><div class="empty-title">Pilih percakapan</div><div class="empty-sub">Ketuk salah satu percakapan di daftar.</div></div>'; return; }
    var d = cache.detail || {}, admin = d.bot_status === 'ADMIN';
    var I = (window.Layout && window.Layout.ICONS) || {};
    box.innerHTML = '<div class="wa-thread-head"><button class="back-btn wa-back" id="wa-back" aria-label="Kembali">' + (I.back || '&larr;') + '</button>' +
      '<div class="wa-head-main"><strong>' + esc(d.display_name || d.phone_masked || '') + '</strong><div class="muted">' + esc(d.phone_masked || '') + '</div></div>' + chip(d.bot_status || 'BOT') +
      '<button class="btn btn-secondary btn-sm" id="wa-info-btn">Info</button>' +
      (admin ? '<button class="btn btn-outline btn-sm" id="wa-handback">Kembalikan ke bot</button>' : '<button class="btn btn-primary btn-sm" id="wa-takeover">Ambil alih</button>') + '</div>' +
      '<div class="wa-messages" id="wa-messages">' + (cache.messages.length ? cache.messages.map(bubble).join('') : '<div class="muted" style="text-align:center;padding:20px;">Belum ada pesan.</div>') + '</div>' +
      '<div class="wa-composer">' + (admin ? '<textarea id="wa-text" rows="2" maxlength="1000" placeholder="Tulis balasan..."></textarea><button class="btn btn-primary" id="wa-send">Kirim</button>' : '<div class="wa-lock muted">Bot sedang melayani. Ketuk <strong>Ambil alih</strong> untuk membalas sebagai admin.</div>') + '</div>';
    var ms = box.querySelector('#wa-messages'); ms.scrollTop = ms.scrollHeight;
    box.querySelector('#wa-back').addEventListener('click', function () { setView('list'); });
    box.querySelector('#wa-info-btn').addEventListener('click', function () { setView('info'); });
    var tk = box.querySelector('#wa-takeover'), hb = box.querySelector('#wa-handback'), sd = box.querySelector('#wa-send');
    if (tk) tk.addEventListener('click', function () { tk.disabled = true; Api.call('wa.conversation.takeover', { phone_e164: sel }).then(function () { Utils.toast('Percakapan diambil alih. Bot berhenti membalas.', 'success'); return openConv(sel, true); }).catch(function (e) { tk.disabled = false; Utils.toast(e.message, 'error'); }); });
    if (hb) hb.addEventListener('click', function () { hb.disabled = true; Api.call('wa.conversation.handback', { phone_e164: sel }).then(function () { Utils.toast('Dikembalikan ke bot.', 'success'); return openConv(sel, true); }).catch(function (e) { hb.disabled = false; Utils.toast(e.message, 'error'); }); });
    if (sd) sd.addEventListener('click', function () {
      var ta = box.querySelector('#wa-text'), t = ta.value.trim(); if (!t) { Utils.toast('Tulis pesan dulu.', 'error'); return; }
      sd.disabled = true; sd.textContent = 'Mengirim...';
      Api.call('wa.conversation.reply', { phone_e164: sel, text: t }).then(function () { ta.value = ''; return loadThread(); }).then(function () { loadList(true); }).catch(function (e) { Utils.toast(e.message, 'error'); }).then(function () { var b = document.getElementById('wa-send'); if (b) { b.disabled = false; b.textContent = 'Kirim'; } });
    });
  }
  function drawInfo() {
    var box = document.getElementById('wa-info'); if (!box) return;
    var d = cache.detail; var I = (window.Layout && window.Layout.ICONS) || {};
    if (!sel || !d) { box.innerHTML = '<div class="muted" style="padding:16px;">Info pelanggan muncul di sini.</div>'; return; }
    box.innerHTML = '<div class="wa-thread-head"><button class="back-btn wa-back" id="wa-info-back" aria-label="Kembali">' + (I.back || '&larr;') + '</button><strong>Info pelanggan</strong></div><div class="wa-info-body">' +
      '<div class="wa-kv"><span class="muted">Nama</span><strong>' + esc(d.customer ? d.customer.name : (d.display_name || '-')) + '</strong></div>' +
      '<div class="wa-kv"><span class="muted">Nomor</span><strong>' + esc(d.phone_masked) + '</strong></div>' +
      '<div class="wa-kv"><span class="muted">Status</span>' + chip(d.bot_status) + '</div>' +
      '<div class="wa-kv"><span class="muted">Asisten AI</span><strong>' + (d.ai_enabled ? 'aktif' : 'dimatikan pelanggan') + '</strong></div>' +
      '<div class="wa-kv"><span class="muted">Ditangani</span><strong>' + esc(d.assigned_admin || '-') + '</strong></div>' +
      '<h3>Keranjang</h3>' + (d.cart.lines.length ? d.cart.lines.map(function (l) { return '<div class="wa-kv"><span>' + esc(l.name) + ' x' + l.qty + '</span><strong>' + Utils.formatCurrency(l.subtotal) + '</strong></div>'; }).join('') + '<div class="wa-kv"><span class="muted">Subtotal</span><strong>' + Utils.formatCurrency(d.cart.subtotal) + '</strong></div>' : '<div class="muted">Keranjang kosong.</div>') +
      '<h3>Pesanan</h3>' + (d.orders.length ? d.orders.map(function (o) { return '<a class="wa-order" href="#/internal/orders"><strong>' + esc(o.order_number) + '</strong><span class="muted">' + esc(o.order_status.toLowerCase()) + (o.payment_status === 'PAID' ? ' &middot; lunas' : '') + '</span><span>' + Utils.formatCurrency(o.grand_total) + '</span></a>'; }).join('') : '<div class="muted">Belum ada pesanan.</div>') + '</div>';
    box.querySelector('#wa-info-back').addEventListener('click', function () { setView('thread'); });
  }

  // ================= IKHTISAR =================
  function renderOverview(body) {
    var I = (window.Layout && window.Layout.ICONS) || {};
    body.innerHTML = '<div class="period-row" id="wa-range"><button class="chip active" data-r="today">Hari ini</button><button class="chip" data-r="7d">7 hari</button></div><div id="wa-stats"><div class="spinner"></div></div>';
    function load(r) {
      var to = new Date(), from = new Date(); if (r === '7d') from.setDate(from.getDate() - 6);
      var f = function (d) { return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); };
      return Api.call('wa.stats', { from: f(from), to: f(to) }).then(function (s) {
        document.getElementById('wa-stats').innerHTML = '<div class="stat-grid">' +
          '<div class="stat"><div class="l">Pesan masuk</div><div class="v">' + s.in + '</div></div><div class="stat"><div class="l">Balasan terkirim</div><div class="v">' + s.out + '</div></div>' +
          '<div class="stat"><div class="l">Percakapan</div><div class="v">' + s.conversations + '</div></div><div class="stat' + (s.failed ? ' accent' : '') + '"><div class="l">Gagal</div><div class="v">' + s.failed + '</div></div>' +
          '<div class="stat"><div class="l">Dibalas bot / AI</div><div class="v">' + s.bot_handled + ' / ' + s.ai_handled + '</div></div><div class="stat"><div class="l">Dibalas admin</div><div class="v">' + s.admin_handled + '</div></div>' +
          '<div class="stat green"><div class="l">Pesanan dari WhatsApp</div><div class="v">' + s.orders_from_wa + '</div></div><div class="stat green"><div class="l">Penjualan WhatsApp</div><div class="v">' + Utils.formatCurrency(s.sales_wa_total) + '</div></div></div>' +
          '<div class="hint">Penjualan WhatsApp = penjualan terealisasi (sudah dibayar/diserahkan) pada kanal WhatsApp.</div>';
      });
    }
    Utils.qsa('#wa-range [data-r]', body).forEach(function (b) { b.addEventListener('click', function () { Utils.qsa('#wa-range .chip', body).forEach(function (x) { x.classList.toggle('active', x === b); }); load(b.getAttribute('data-r')); }); });
    return load('today');
  }

  // ================= BOT =================
  function renderBot(body) {
    return Api.call('wa.config.get', {}).then(function (d) {
      var c = d.config, edit = canEditConfig(), dis = edit ? '' : ' disabled';
      function sw(id, label, on, note, off) { return '<div class="switch-row"><div><div class="sw-title">' + label + '</div>' + (note ? '<div class="sw-sub">' + note + '</div>' : '') + '</div><label class="switch"><input type="checkbox" id="' + id + '"' + (on ? ' checked' : '') + (off ? ' disabled' : dis) + '><span class="slider"></span></label></div>'; }
      body.innerHTML = '<div class="card"><h3>Bot</h3>' + sw('cf-bot', 'Bot aktif (membalas pelanggan)', c.wa_bot_enabled === 'on', 'Sakelar darurat: matikan bila ada masalah.') +
        sw('cf-notify', 'Notifikasi status pesanan', c.wa_notify === 'on', 'Pembayaran, siap diambil, dikirim, selesai, dibatalkan.') +
        sw('cf-ai', 'Asisten AI', c.wa_ai_enabled === 'on', d.ai_provider_ready ? 'Hanya mencari produk & menyusun usulan; tidak membuat pesanan.' : 'Belum terhubung: isi AI_BASE_URL, AI_API_KEY, AI_MODEL di Script Properties.', !d.ai_provider_ready) + '</div>' +
        '<div class="card"><h3>Teks & jam</h3><div class="field"><label>Pesan sambutan</label><textarea id="cf-welcome" rows="2"' + dis + '>' + esc(c.wa_welcome_text) + '</textarea></div>' +
        '<div class="field-row"><div class="field"><label>Jam operasional (08:00-21:00)</label><input id="cf-hours" value="' + esc(c.wa_hours) + '"' + dis + '></div><div class="field"><label>Batas kirim per hari</label><input id="cf-cap" type="number" value="' + esc(c.wa_daily_send_cap || 200) + '"' + dis + '></div></div></div>' +
        '<div class="card"><h3>Webhook</h3><div class="field"><label>Mode</label><select id="cf-mode"' + dis + '><option value="capture"' + (c.wa_webhook_mode !== 'parse' ? ' selected' : '') + '>Tangkap (simpan bentuk asli pesan, tanpa membalas)</option><option value="parse"' + (c.wa_webhook_mode === 'parse' ? ' selected' : '') + '>Proses (bot membalas)</option></select></div>' +
        '<div class="hint">Bawaan: <strong>Proses</strong>. Pesan yang bentuknya belum dikenali otomatis disimpan sebagai contoh (tab Monitor) agar pembaca pesan bisa diperbaiki dari data asli.</div></div>' +
        '<div class="card"><h3>Rahasia</h3><div class="muted" style="margin-bottom:6px;">Disimpan di Script Properties (tidak pernah ditampilkan di sini).</div>' +
        Object.keys(d.secrets_configured).map(function (k) { return '<div class="wa-kv"><span>' + esc(k) + '</span><span class="badge ' + (d.secrets_configured[k] ? 'green' : 'red') + '">' + (d.secrets_configured[k] ? 'terpasang' : 'belum') + '</span></div>'; }).join('') +
        '<div class="wa-kv"><span>UNIFIED_SALES</span><span class="badge ' + (d.unified_sales ? 'green' : '') + '">' + (d.unified_sales ? 'nyala' : 'mati') + '</span></div></div>' +
        (edit ? '<button class="btn btn-primary btn-block" id="cf-save">Simpan</button>' : '<div class="hint">Hanya Pemilik yang dapat mengubah pengaturan.</div>');
      var save = body.querySelector('#cf-save');
      if (save) save.addEventListener('click', function () {
        var v = function (id) { return body.querySelector('#' + id); };
        var cfg = { wa_bot_enabled: v('cf-bot').checked ? 'on' : 'off', wa_notify: v('cf-notify').checked ? 'on' : 'off', wa_welcome_text: v('cf-welcome').value, wa_hours: v('cf-hours').value.trim(), wa_daily_send_cap: v('cf-cap').value, wa_webhook_mode: v('cf-mode').value };
        if (d.ai_provider_ready) cfg.wa_ai_enabled = v('cf-ai').checked ? 'on' : 'off';
        save.disabled = true;
        Api.call('wa.config.update', { config: cfg }).then(function () { Utils.toast('Pengaturan disimpan.', 'success'); }).catch(function (e) { Utils.toast(e.message, 'error'); }).then(function () { save.disabled = false; });
      });
    });
  }

  // ================= MONITOR =================
  function renderMonitor(body) {
    return Api.call('wa.monitor.status', {}).then(function (m) {
      var ok = m.configured.api_key && m.configured.sender && m.configured.webhook_token;
      body.innerHTML = (m.warnings || []).map(function (w) { return '<div class="card wa-warn">&#9888; ' + esc(w) + '</div>'; }).join('') + '<div class="stat-grid"><div class="stat"><div class="l">Konfigurasi</div><div class="v">' + (ok ? 'Lengkap' : 'Belum lengkap') + '</div></div><div class="stat"><div class="l">Mode webhook</div><div class="v">' + (m.mode === 'parse' ? 'Proses' : 'Tangkap') + '</div></div>' +
        '<div class="stat"><div class="l">Terkirim hari ini</div><div class="v">' + m.sent_today + ' / ' + m.send_cap + '</div></div><div class="stat"><div class="l">Pesan terakhir masuk</div><div class="v" style="font-size:0.9rem;">' + (m.last_event_at ? esc(Utils.formatDate(m.last_event_at)) : 'belum ada') + '</div></div></div>' +
        '<div class="card"><div class="wa-kv"><span>Bot</span><span class="badge ' + (m.bot_enabled ? 'green' : 'red') + '">' + (m.bot_enabled ? 'aktif' : 'mati') + '</span></div><div class="wa-kv"><span>Status perangkat WhatsApp</span><span class="badge ' + (m.gateway.state === 'CONNECTED' ? 'green' : (m.gateway.state === 'DISCONNECTED' ? 'red' : '')) + '">' + esc({ CONNECTED: 'terhubung', DISCONNECTED: 'TERPUTUS', NOT_CONFIGURED: 'kunci belum diisi', UNKNOWN: 'belum dapat dicek' }[m.gateway.state] || m.gateway.state) + '</span></div></div>' +
        '<h3>Pesan gagal (' + m.failed.length + ')</h3>' + (m.failed.length ? m.failed.map(function (f) { return '<div class="card row"><div><strong>' + esc(f.phone_masked) + '</strong><div class="muted">' + esc(f.direction) + ' &middot; ' + esc(f.status) + ' &middot; ' + esc(hhmm(f.created_at)) + '</div></div><button class="btn btn-secondary btn-sm" data-replay="' + esc(f.message_id) + '">Putar ulang</button></div>'; }).join('') : '<div class="empty-ok">Tidak ada pesan gagal.</div>') +
        (canEditConfig() ? '<h3>Contoh payload webhook (' + m.captured + ')</h3><div class="muted" style="margin-bottom:8px;">Tangkapan bentuk asli pesan dari penyedia, untuk membuat parser yang tepat.</div><div class="field-row"><button class="btn btn-secondary" id="wa-cap-view">Lihat contoh</button><button class="btn btn-outline" id="wa-cap-clear">Hapus contoh</button></div><div id="wa-cap-box"></div>' : '');
      Utils.qsa('[data-replay]', body).forEach(function (b) { b.addEventListener('click', function () { b.disabled = true; Api.call('wa.failed.replay', { message_id: b.getAttribute('data-replay') }).then(function () { Utils.toast('Diputar ulang.', 'success'); render(document.getElementById('wa-root').parentNode); }).catch(function (e) { b.disabled = false; Utils.toast(e.message, 'error'); }); }); });
      var cv = body.querySelector('#wa-cap-view'), cc = body.querySelector('#wa-cap-clear');
      if (cv) cv.addEventListener('click', function () { Api.call('wa.capture.list', {}).then(function (d) {
        var box = document.getElementById('wa-cap-box');
        box.innerHTML = d.captured.length ? '<button class="btn btn-primary btn-sm" id="wa-cap-copy" style="margin:8px 0;">Salin semua</button>' + d.captured.map(function (c, i) { return '<div class="card"><div class="muted">#' + (i + 1) + ' &middot; ' + esc(c.content_type) + '</div><pre class="wa-pre">' + esc(c.raw) + '</pre></div>'; }).join('') : '<div class="empty-ok">Belum ada contoh. Pastikan mode webhook = Tangkap, lalu kirim pesan uji.</div>';
        var cp = document.getElementById('wa-cap-copy');
        if (cp) cp.addEventListener('click', function () { var txt = d.captured.map(function (c) { return c.raw; }).join('\n'); (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(function () { Utils.toast('Disalin.', 'success'); }, function () { Utils.toast('Tidak bisa menyalin otomatis; tekan lama pada teks untuk menyalin.', 'info'); }); });
      }).catch(function (e) { Utils.toast(e.message, 'error'); }); });
      if (cc) cc.addEventListener('click', function () { if (!window.confirm('Hapus semua contoh payload?')) return; Api.call('wa.capture.clear', {}).then(function (d) { Utils.toast(d.cleared + ' contoh dihapus.', 'success'); render(document.getElementById('wa-root').parentNode); }).catch(function (e) { Utils.toast(e.message, 'error'); }); });
    });
  }
  return { render: render };
})();
