/**
 * internal/profile.js - Profil akun sendiri, ganti password, dan PIN (Bagian 23 AKUN).
 */
window.Modules = window.Modules || {};
Modules.profile = (function () {
  function render(container) {
    return Api.call('profile.get', {}).then(function (d) {
      if (!container.isConnected) return;
      container.innerHTML = '<h1>Profil</h1>' +
        '<div class="card"><h3>Data Diri</h3><form id="profile-form">' +
        '<div class="field"><label>Nama Lengkap</label><input name="full_name" value="' + Utils.escapeHtml(d.full_name) + '" required></div>' +
        '<div class="field"><label>Username</label><input value="' + Utils.escapeHtml(d.username) + '" disabled></div>' +
        '<div class="field"><label>Telepon</label><input name="phone" value="' + Utils.escapeHtml(d.phone || '') + '"></div>' +
        '<div class="field"><label>Role</label><input value="' + Utils.escapeHtml(d.role) + '" disabled></div>' +
        '<button class="btn btn-primary btn-block" type="submit">Simpan</button></form></div>' +
        '<div class="card"><h3>Ganti Password</h3><form id="password-form">' +
        '<div class="field"><label>Password Saat Ini</label><input name="current_password" type="password" required></div>' +
        '<div class="field"><label>Password Baru</label><input name="new_password" type="password" required minlength="6"></div>' +
        '<button class="btn btn-secondary btn-block" type="submit">Ganti Password</button></form></div>' +
        '<div class="card"><h3>PIN Keamanan</h3><p class="muted">PIN 6 digit dipakai sebagai konfirmasi tambahan untuk aksi sensitif (mis. Void transaksi). ' + (d.has_pin ? 'PIN sudah aktif.' : 'PIN belum diatur.') + '</p><form id="pin-form">' +
        '<div class="field"><label>Password Saat Ini</label><input name="current_password" type="password" required></div>' +
        '<div class="field"><label>PIN Baru (6 digit)</label><input name="pin" pattern="\\d{6}" maxlength="6" required></div>' +
        '<button class="btn btn-outline btn-block" type="submit">' + (d.has_pin ? 'Ganti PIN' : 'Aktifkan PIN') + '</button></form></div>';

      container.querySelector('#profile-form').addEventListener('submit', function (e) {
        e.preventDefault();
        var fd = Object.fromEntries(new FormData(e.target).entries());
        Api.call('profile.update', fd).then(function () {
          var u = Auth.getUser(); u.name = fd.full_name; localStorage.setItem('azqia_user', JSON.stringify(u));
          Utils.toast('Profil disimpan.', 'success'); Router.render();
        }).catch(function (err) { Utils.toast(err.message, 'error'); });
      });
      container.querySelector('#password-form').addEventListener('submit', function (e) {
        e.preventDefault();
        var fd = Object.fromEntries(new FormData(e.target).entries());
        Api.call('profile.changePassword', fd).then(function () {
          Utils.toast('Password berhasil diganti.', 'success'); e.target.reset();
        }).catch(function (err) { Utils.toast(err.message, 'error'); });
      });
      container.querySelector('#pin-form').addEventListener('submit', function (e) {
        e.preventDefault();
        var fd = Object.fromEntries(new FormData(e.target).entries());
        Api.call('profile.setPin', fd).then(function () {
          Utils.toast('PIN disimpan.', 'success'); e.target.reset(); Router.render();
        }).catch(function (err) { Utils.toast(err.message, 'error'); });
      });
    });
  }
  return { render: render };
})();
