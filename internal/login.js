/**
 * internal/login.js - Login Pemilik/Pengelola.
 */
window.Modules = window.Modules || {};
Modules.login = {
  render: function (container) {
    if (Auth.isLoggedIn()) { Router.navigate('#/internal/dashboard'); return; }
    container.innerHTML =
      '<div class="card" style="margin-top:40px;">' +
      '<h1 style="text-align:center;color:var(--red);">TOKO AZQIA</h1>' +
      '<p style="text-align:center;">Masuk sebagai Pemilik atau Pengelola</p>' +
      '<form id="login-form">' +
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
