/**
 * internal/login.js - Login Pemilik/Pengelola.
 */
window.Modules = window.Modules || {};
Modules.login = {
  render: function (container) {
    if (Auth.isLoggedIn()) { Router.navigate(Auth.homePath()); return; }
    var EYE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>';
    container.innerHTML =
      '<div class="card login-card">' +
      '<img src="assets/icons/tokoqia-app-icon-192.png" alt="TOKOQIA" class="login-logo">' +
      '<h1 class="login-title">Masuk</h1>' +
      '<form id="login-form">' +
      '<div class="field"><label>Username</label><input name="username" required autocomplete="username" autocapitalize="none"></div>' +
      '<div class="field"><label>Password</label><div class="pw-wrap"><input name="password" id="pw" type="password" required autocomplete="current-password"><button type="button" class="pw-eye" id="pw-eye" aria-label="Lihat password" aria-pressed="false">' + EYE + '</button></div></div>' +
      '<button class="btn btn-primary btn-block" type="submit">Masuk</button>' +
      '</form>' +
      '<div id="login-error" class="login-error" role="alert"></div>' +
      '<p class="login-help">Lupa kata sandi? <a href="#" id="forgot-link" class="login-forgot">Hubungi pemilik</a>.</p>' +
      (window.AZQIA_ENTRY === 'kasir' ? '<button type="button" class="btn btn-outline btn-block" id="btn-install" style="margin-top:6px;">Pasang \"Kasir AZQIA\" di layar utama</button><p class="hint" id="install-hint" style="display:none;text-align:left;"></p>' : '') +
      '</div>';
    document.getElementById('pw-eye').addEventListener('click', function () {
      var i = document.getElementById('pw'), show = i.type === 'password'; i.type = show ? 'text' : 'password'; this.setAttribute('aria-pressed', show ? 'true' : 'false'); this.setAttribute('aria-label', show ? 'Sembunyikan password' : 'Lihat password');
    });

    // "Lupa kata sandi": nomor WhatsApp toko diambil dari info toko (publik). Tautan baru aktif setelah nomor diketahui.
    var forgot = document.getElementById('forgot-link'), ownerWa = '';
    function forgotHref() {
      var u = (document.querySelector('#login-form [name=username]') || {}).value || '';
      return Utils.waLink(ownerWa) + '?text=' + encodeURIComponent('Halo, saya lupa kata sandi TOKOQIA.' + (u ? ' Username saya: ' + u : ''));
    }
    function loadOwner() {
      return Api.call('public.storeInfo', {}).then(function (si) {
        ownerWa = (si && si.store_contact) || '';
        if (ownerWa) { forgot.href = forgotHref(); forgot.target = '_blank'; forgot.rel = 'noopener'; }
      }).catch(function () {});
    }
    loadOwner();
    forgot.addEventListener('click', function (e) {
      if (ownerWa) { forgot.href = forgotHref(); return; } // biarkan tautan WhatsApp terbuka
      e.preventDefault();
      var box = document.getElementById('login-error');
      box.textContent = 'Memuat nomor pemilik... coba ketuk lagi sebentar lagi.';
      loadOwner().then(function () { box.textContent = ownerWa ? 'Nomor pemilik siap. Ketuk "Hubungi pemilik" sekali lagi.' : 'Nomor pemilik belum tersedia. Periksa koneksi internet lalu coba lagi.'; });
    });

    var inst = document.getElementById('btn-install');
    if (inst) inst.addEventListener('click', function () {
      var hint = document.getElementById('install-hint');
      if (window.__installEv) { window.__installEv.prompt(); return; }
      hint.style.display = 'block';
      hint.textContent = /iphone|ipad|ipod/i.test(navigator.userAgent) ? 'iPhone: ketuk tombol Bagikan (kotak berpanah) di Safari, lalu "Tambah ke Layar Utama".' : 'Android: buka menu browser (tiga titik) lalu "Instal aplikasi" atau "Tambahkan ke Layar Utama".';
    });
    document.getElementById('login-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var fd = new FormData(e.target);
      var btn = e.target.querySelector('button');
      btn.disabled = true; btn.textContent = 'Memproses...';
      Auth.login(fd.get('username'), fd.get('password')).then(function () {
        Router.navigate(Auth.homePath());
        Router.render();
      }).catch(function (err) {
        document.getElementById('login-error').textContent = err.message;
        btn.disabled = false; btn.textContent = 'Masuk';
      });
    });
  }
};
