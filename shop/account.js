/**
 * shop/account.js - Tab Akun: masuk/daftar akun pelanggan (nomor WhatsApp + kata sandi, dibuktikan kode WhatsApp),
 * lupa kata sandi, profil, dan info toko. Belanja tanpa akun (tamu) tetap bisa.
 */
window.Modules = window.Modules || {};
Modules.shopaccount = (function () {
  var esc = function (s) { return Utils.escapeHtml(String(s === undefined || s === null ? '' : s)); };
  var root = null;

  function menuLinks() {
    return '<div class="menu-group-label">PESANAN</div><div class="menu-list">' +
      '<a class="menu-item" href="#/shop/orders"><span class="menu-tx">Pesanan saya</span><span class="menu-go">' + Layout.ICONS.chevron + '</span></a>' +
      '<a class="menu-item" href="#/shop/catalog"><span class="menu-tx">Lihat semua produk</span><span class="menu-go">' + Layout.ICONS.chevron + '</span></a></div>';
  }

  function draw() {
    var p = window.CustAuth.profile();
    if (p && window.CustAuth.loggedIn()) { drawProfile(p); return; }
    drawAuth('login');
  }

  function drawProfile(p) {
    root.querySelector('#acc-main').innerHTML =
      '<div class="card acc-me"><div class="acc-ava">' + esc(String(p.name || '?').charAt(0).toUpperCase()) + '</div><div><strong>' + esc(p.name) + '</strong><div class="muted">' + esc(p.phone_display || p.phone) + '</div></div></div>' +
      menuLinks() + '<button type="button" class="btn btn-outline btn-block" id="acc-logout" style="margin:12px 0;">Keluar</button>';
    root.querySelector('#acc-logout').addEventListener('click', function () { window.CustAuth.clear(); Utils.toast('Anda sudah keluar.', 'success'); draw(); });
  }

  /** mode: login | register | reset. step 1 = isi data, step 2 = kode WhatsApp. */
  function drawAuth(mode, step, keep) {
    step = step || 1; keep = keep || {};
    var titles = { login: 'Masuk', register: 'Daftar Akun', reset: 'Lupa Kata Sandi' };
    var tabs = '<div class="acc-tabs"><button type="button" data-mode="login" class="' + (mode === 'login' ? 'on' : '') + '">Masuk</button><button type="button" data-mode="register" class="' + (mode === 'register' ? 'on' : '') + '">Daftar</button></div>';
    var f = '';
    if (mode === 'login') {
      f = field('phone', 'No. WhatsApp', 'tel', '08xxxxxxxxxx', keep.phone) + field('password', 'Kata sandi', 'password', '', '') +
        '<button class="btn btn-primary btn-block" type="submit">Masuk</button><p style="text-align:center;margin:10px 0 0;"><a href="#" id="acc-forgot" class="login-forgot">Lupa kata sandi?</a></p>';
    } else if (step === 1) {
      f = (mode === 'register' ? field('name', 'Nama', 'text', 'Nama Anda', keep.name) : '') + field('phone', 'No. WhatsApp', 'tel', '08xxxxxxxxxx', keep.phone) +
        field('password', mode === 'register' ? 'Kata sandi (min. 6 karakter)' : 'Kata sandi baru (min. 6 karakter)', 'password', '', '') +
        '<button class="btn btn-primary btn-block" type="submit">Kirim kode ke WhatsApp</button>' +
        (mode === 'reset' ? '<p style="text-align:center;margin:10px 0 0;"><a href="#" id="acc-back" class="login-forgot">Kembali ke Masuk</a></p>' : '');
    } else {
      f = '<p class="muted" style="margin-top:0;">Kode 6 digit sudah dikirim ke WhatsApp <strong>' + esc(keep.phone) + '</strong>. Berlaku 10 menit.</p>' + field('code', 'Kode verifikasi', 'text', '123456', '', 'inputmode="numeric" maxlength="6" autocomplete="one-time-code"') +
        '<button class="btn btn-primary btn-block" type="submit">' + (mode === 'register' ? 'Daftar' : 'Simpan kata sandi baru') + '</button>' +
        '<p style="text-align:center;margin:10px 0 0;"><a href="#" id="acc-resend" class="login-forgot">Kirim ulang kode</a> &middot; <a href="#" id="acc-edit" class="login-forgot">Ubah data</a></p>';
    }
    root.querySelector('#acc-main').innerHTML = (mode !== 'reset' ? tabs : '') + '<form id="acc-form" class="card"><h3 style="margin-top:0;">' + titles[mode] + '</h3>' + f + '</form>' +
      '<div class="card"><h3 style="margin-top:0;">Belanja tanpa akun</h3><p class="muted" style="margin:0;">Anda tidak wajib mendaftar. Dengan akun, riwayat semua pesanan Anda terlihat di perangkat mana pun.</p></div>';

    var main = root.querySelector('#acc-main');
    Array.prototype.forEach.call(main.querySelectorAll('[data-mode]'), function (b) { b.addEventListener('click', function () { drawAuth(b.getAttribute('data-mode')); }); });
    var forgot = main.querySelector('#acc-forgot'); if (forgot) forgot.addEventListener('click', function (e) { e.preventDefault(); drawAuth('reset', 1, { phone: val('phone') }); });
    var back = main.querySelector('#acc-back'); if (back) back.addEventListener('click', function (e) { e.preventDefault(); drawAuth('login'); });
    var edit = main.querySelector('#acc-edit'); if (edit) edit.addEventListener('click', function (e) { e.preventDefault(); drawAuth(mode, 1, keep); });
    var resend = main.querySelector('#acc-resend'); if (resend) resend.addEventListener('click', function (e) { e.preventDefault(); sendCode(mode, keep, function () { Utils.toast('Kode baru dikirim.', 'success'); }); });

    main.querySelector('#acc-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var fd = Object.fromEntries(new FormData(e.target).entries()), btn = e.target.querySelector('button[type=submit]');
      if (mode === 'login') {
        busy(btn, true);
        Api.call('public.customer.login', { phone: fd.phone, password: fd.password }).then(done).catch(function (err) { busy(btn, false); Utils.toast(err.message, 'error'); });
      } else if (step === 1) {
        var data = { name: fd.name, phone: fd.phone, password: fd.password };
        if (String(fd.password || '').length < 6) { Utils.toast('Kata sandi minimal 6 karakter.', 'error'); return; }
        busy(btn, true);
        sendCode(mode, data, function () { drawAuth(mode, 2, data); }, function () { busy(btn, false); });
      } else {
        busy(btn, true);
        var payload = { phone: keep.phone, password: keep.password, code: fd.code, name: keep.name };
        Api.call(mode === 'register' ? 'public.customer.register' : 'public.customer.reset', payload).then(done).catch(function (err) { busy(btn, false); Utils.toast(err.message, 'error'); });
      }
    });
    function done(res) {
      window.CustAuth.set(res.token, res.profile);
      Utils.toast('Berhasil.', 'success');
      if (window.Layout && Layout.updateCartBadge) Layout.updateCartBadge();
      draw();
    }
    function val(n) { var el = main.querySelector('[name=' + n + ']'); return el ? el.value : ''; }
  }

  function sendCode(mode, data, ok, fail) {
    Api.call('public.customer.otp', { phone: data.phone, purpose: mode === 'reset' ? 'RESET' : 'REGISTER' }).then(function () { ok(); }).catch(function (err) { Utils.toast(err.message, 'error'); if (fail) fail(); });
  }
  function busy(btn, on) { if (!btn) return; btn.disabled = on; if (on) { btn.setAttribute('data-t', btn.textContent); btn.textContent = 'Memproses...'; } else if (btn.getAttribute('data-t')) btn.textContent = btn.getAttribute('data-t'); }
  function field(name, label, type, ph, v, extra) {
    return '<div class="field"><label>' + label + '</label><input name="' + name + '" type="' + type + '" placeholder="' + esc(ph) + '" value="' + esc(v || '') + '" required ' + (extra || '') + '></div>';
  }

  function render(container) {
    root = container;
    container.innerHTML = '<h1 class="shop-title">Akun</h1><div id="acc-main"></div><div id="acc-info"></div>';
    draw();
    // sesi tersimpan dicek ke server; token tidak berlaku lagi -> kembali ke Masuk
    if (window.CustAuth.loggedIn()) {
      Api.call('public.customer.me', { token: window.CustAuth.token() }).then(function (d) { window.CustAuth.set(window.CustAuth.token(), d.profile); }).catch(function (err) { if (err && (err.code === 'AUTH_INVALID')) { window.CustAuth.clear(); if (root === container) draw(); } });
    }
    return Api.call('public.storeInfo', {}).then(function (s) {
      var rows = [];
      if (s.store_address) rows.push(['Alamat', esc(s.store_address)]);
      if (s.store_hours) rows.push(['Jam buka', esc(s.store_hours)]);
      if (s.store_contact) rows.push(['WhatsApp', '<a href="' + Utils.waLink(s.store_contact) + '" target="_blank" rel="noopener">' + Utils.formatPhoneId(s.store_contact) + '</a>']);
      var box = container.querySelector('#acc-info'); if (!box) return;
      box.innerHTML = rows.length ? '<div class="menu-group-label">TOKO</div><div class="menu-list">' + rows.map(function (r) { return '<div class="menu-item static"><span class="menu-tx"><span class="muted" style="display:block;font-size:0.75rem;">' + r[0] + '</span>' + r[1] + '</span></div>'; }).join('') + '</div>' : '';
    }).catch(function () {});
  }
  return { render: render };
})();
