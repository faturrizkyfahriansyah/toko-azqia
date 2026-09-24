/**
 * internal/login.js - Login Pemilik/Pengelola.
 */
window.Modules = window.Modules || {};
Modules.login = {
  render: function (container) {
    if (Auth.isLoggedIn()) { Router.navigate('#/internal/dashboard'); return; }
    container.innerHTML =
      '<div class="card" style="margin-top:32px;text-align:center;">' +
      '<img src="assets/icons/tokoqia-primary.png" alt="TOKOQIA" style="width:88px;height:auto;margin:8px auto 12px;display:block;">' +
      '<h1 style="color:var(--red);margin-bottom:2px;">TOKOQIA</h1>' +
      '<p class="muted" style="margin-bottom:2px;">TOKO AZQIA</p>' +
      '<p style="margin-bottom:16px;">Masuk sebagai Pemilik atau Pengelola</p>' +
      '<form id="login-form" style="text-align:left;">' +
      '<div class="field"><label>Username</label><input name="username" required autocomplete="username"></div>' +
      '<div class="field"><label>Password</label><input name="password" type="password" required autocomplete="current-password"></div>' +
      '<button class="btn btn-primary btn-block" type="submit">Masuk</button>' +
      '</form>' +
      '<div id="login-error" class="muted" style="color:var(--red);margin-top:10px;"></div>' +
      '</div>';

    document.getElementById('login-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var fd = new FormData(e.target);
      var btn = e.target.querySelector('button');
      btn.disabled = true; btn.textContent = 'Memproses...';
      Auth.login(fd.get('username'), fd.get('password')).then(function () {
        Router.navigate('#/internal/dashboard');
        Router.render();
      }).catch(function (err) {
        document.getElementById('login-error').textContent = err.message;
        btn.disabled = false; btn.textContent = 'Masuk';
      });
    });
  }
};
