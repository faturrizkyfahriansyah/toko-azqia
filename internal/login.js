/**
 * internal/login.js - Login Pemilik/Pengelola.
 */
window.Modules = window.Modules || {};
Modules.login = {
  render: function (container) {
    if (Auth.isLoggedIn()) { Router.navigate(Auth.homePath()); return; }
    container.innerHTML =
      '<div class="card" style="margin-top:32px;text-align:center;">' +
      '<img src="assets/icons/tokoqia-app-icon-192.png" alt="TOKOQIA" style="width:84px;height:84px;border-radius:20px;margin:6px auto 12px;display:block;box-shadow:0 6px 16px rgba(216,19,36,0.28);">' +
      '<h1 style="margin-bottom:2px;">TOKO AZQIA</h1>' +
      '<p class="muted" style="margin-bottom:14px;">Melayani Kebutuhan, Membangun Kepercayaan.</p>' +
      '<p style="margin-bottom:4px;font-weight:800;">Masuk Staf</p>' +
      '<p class="muted" style="margin-bottom:16px;font-size:0.84rem;">Pemilik, Pengelola, Kasir, Petugas Gudang, dan Admin WhatsApp masuk di sini. Setelah masuk, Anda langsung diarahkan sesuai peran (Kasir langsung ke layar Kasir).</p>' +
      '<form id="login-form" style="text-align:left;">' +
      '<div class="field"><label>Username</label><input name="username" required autocomplete="username"></div>' +
      '<div class="field"><label>Password</label><input name="password" type="password" required autocomplete="current-password"></div>' +
      '<button class="btn btn-primary btn-block" type="submit">Masuk</button>' +
      '</form>' +
      '<div id="login-error" class="muted" style="color:var(--red);margin-top:10px;"></div>' +
      (window.AZQIA_ENTRY === 'kasir' ? '<button type="button" class="btn btn-outline btn-block" id="btn-install" style="margin-top:14px;">Pasang "Kasir AZQIA" di layar utama</button><p class="hint" id="install-hint" style="display:none;text-align:left;"></p>' : '') +
      '<a href="index.html" class="muted" style="display:block;margin-top:14px;font-size:0.84rem;">&larr; Ke toko pelanggan</a>' +
      '</div>';

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
