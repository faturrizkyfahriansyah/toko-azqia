/**
 * internal/users.js - Manajemen Pengguna (HANYA Pemilik - ditegakkan backend juga).
 */
window.Modules = window.Modules || {};
Modules.users = (function () {
  function render(container) {
    return Promise.all([Api.call('user.list', {}), fetchRoles()]).then(function (r) {
      if (!container.isConnected) return;
      container.innerHTML = '<div class="row"><h1>Pengguna</h1><button class="btn btn-primary" id="btn-add">+ Pengguna</button></div><div id="list"></div>';
      renderList(r[0].users, r[1]);
      document.getElementById('btn-add').addEventListener('click', function () { openForm(null, r[1]); });
    });
  }
  // Role tidak punya endpoint sendiri di V1 - dua role sudah tetap (PEMILIK/PENGELOLA), lihat 00_Config.gs ROLE_IDS.
  function fetchRoles() { return Promise.resolve([{ role_id: 'ROLE-PEMILIK', role_name: 'PEMILIK' }, { role_id: 'ROLE-PENGELOLA', role_name: 'PENGELOLA' }]); }

  function renderList(users, roles) {
    var roleName = {}; roles.forEach(function (r) { roleName[r.role_id] = r.role_name; });
    var box = document.getElementById('list');
    box.innerHTML = '<div class="table-wrap"><table><thead><tr><th>Nama</th><th>Username</th><th>Role</th><th>Status</th><th></th></tr></thead><tbody>' +
      users.map(function (u) {
        return '<tr><td>' + Utils.escapeHtml(u.full_name) + '</td><td>' + Utils.escapeHtml(u.username) + '</td><td><span class="badge blue">' + (roleName[u.role_id] || u.role_id) + '</span></td>' +
          '<td>' + (String(u.active) === 'true' || u.active === true ? '<span class="badge green">Aktif</span>' : '<span class="badge grey">Nonaktif</span>') + '</td>' +
          '<td><button class="btn btn-outline btn-sm" data-edit="' + u.user_id + '">Edit</button> <button class="btn btn-outline btn-sm" data-reset="' + u.user_id + '">Reset Password</button></td></tr>';
      }).join('') + '</tbody></table></div>';
    Utils.qsa('[data-edit]', box).forEach(function (b) { b.addEventListener('click', function () { openForm(users.filter(function (u) { return u.user_id === b.getAttribute('data-edit'); })[0], roles); }); });
    Utils.qsa('[data-reset]', box).forEach(function (b) {
      b.addEventListener('click', function () {
        var pass = prompt('Masukkan password baru untuk pengguna ini (minimal 6 karakter):');
        if (!pass) return;
        Api.call('user.resetPassword', { user_id: b.getAttribute('data-reset'), new_password: pass }).then(function () { Utils.toast('Password direset.', 'success'); });
      });
    });
  }

  function openForm(u, roles) {
    var isEdit = !!u; u = u || {};
    var m = Utils.openModal('<h3>' + (isEdit ? 'Edit Pengguna' : 'Pengguna Baru') + '</h3><form id="f">' +
      '<div class="field"><label>Nama Lengkap</label><input name="full_name" value="' + Utils.escapeHtml(u.full_name || '') + '" required></div>' +
      '<div class="field"><label>Username</label><input name="username" value="' + Utils.escapeHtml(u.username || '') + '"' + (isEdit ? ' readonly' : ' required') + '></div>' +
      (isEdit ? '' : '<div class="field"><label>Password Awal</label><input name="password" type="password" required minlength="6"></div>') +
      '<div class="field"><label>Role</label><select name="role_id">' + roles.map(function (r) { return '<option value="' + r.role_id + '"' + (r.role_id === u.role_id ? ' selected' : '') + '>' + r.role_name + '</option>'; }).join('') + '</select></div>' +
      '<div class="field"><label>Telepon</label><input name="phone" value="' + Utils.escapeHtml(u.phone || '') + '"></div>' +
      (isEdit ? '<div class="field"><label>Status</label><select name="active"><option value="true"' + (u.active ? ' selected' : '') + '>Aktif</option><option value="false"' + (!u.active ? ' selected' : '') + '>Nonaktif</option></select></div>' : '') +
      '<button class="btn btn-primary btn-block" type="submit">Simpan</button></form>');
    m.querySelector('#f').addEventListener('submit', function (e) {
      e.preventDefault();
      var payload = Object.fromEntries(new FormData(e.target).entries());
      if (isEdit) { payload.user_id = u.user_id; payload.active = payload.active === 'true'; }
      Api.call(isEdit ? 'user.update' : 'user.create', payload).then(function () {
        Utils.toast('Tersimpan.', 'success'); Utils.closeModal(); Router.render();
      }).catch(function (err) { Utils.toast(err.message, 'error'); });
    });
  }

  return { render: render };
})();
