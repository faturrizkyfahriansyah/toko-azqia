/**
 * internal/users.js - Manajemen Pengguna (HANYA Pemilik - ditegakkan backend juga).
 */
window.Modules = window.Modules || {};
Modules.users = (function () {
  function render(container) {
    return Promise.all([Api.call('user.list', {}), fetchRoles()]).then(function (r) {
      if (!container.isConnected) return;
      container.innerHTML = '<div class="row"><h1 class="page-title" style="margin:0;">Pengguna</h1><button class="btn btn-primary" id="btn-add">+ Pengguna</button></div><div id="list" style="margin-top:12px;"></div>';
      renderList(r[0].users, r[1]);
      document.getElementById('btn-add').addEventListener('click', function () { openForm(null, r[1]); });
    });
  }
  // Role tidak punya endpoint sendiri di V1 - dua role sudah tetap (PEMILIK/PENGELOLA), lihat 00_Config.gs ROLE_IDS.
  function fetchRoles() { return Promise.resolve([{ role_id: 'ROLE-PEMILIK', role_name: 'PEMILIK' }, { role_id: 'ROLE-PENGELOLA', role_name: 'PENGELOLA' }, { role_id: 'ROLE-KASIR', role_name: 'KASIR' }, { role_id: 'ROLE-PETUGAS_GUDANG', role_name: 'PETUGAS_GUDANG' }, { role_id: 'ROLE-ADMIN_WA', role_name: 'ADMIN_WA' }]); }

  var ROLE_LABEL = { PEMILIK: 'Pemilik', PENGELOLA: 'Pengelola', KASIR: 'Kasir', PETUGAS_GUDANG: 'Petugas Gudang', ADMIN_WA: 'Admin WhatsApp' };
  function renderList(users, roles) {
    var roleName = {}; roles.forEach(function (r) { roleName[r.role_id] = r.role_name; });
    var box = document.getElementById('list');
    box.innerHTML = '<div class="lcard">' + users.map(function (u) {
      var on = String(u.active) === 'true' || u.active === true, rn = roleName[u.role_id] || u.role_id;
      return '<div class="lrow" data-u="' + u.user_id + '" style="cursor:pointer;"><div class="lr-main"><div class="lr-name">' + Utils.escapeHtml(u.full_name) + '</div><div class="lr-sub">@' + Utils.escapeHtml(u.username) + ' &middot; ' + Utils.escapeHtml(ROLE_LABEL[rn] || rn) + '</div></div><span class="badge ' + (on ? 'green' : 'grey') + '">' + (on ? 'Aktif' : 'Nonaktif') + '</span></div>';
    }).join('') + '</div>';
    Utils.qsa('[data-u]', box).forEach(function (row) {
      row.addEventListener('click', function () {
        var u = users.filter(function (x) { return x.user_id === row.getAttribute('data-u'); })[0];
        var m = Utils.openModal('<h3>' + Utils.escapeHtml(u.full_name) + '</h3><p class="muted" style="margin-top:0;">@' + Utils.escapeHtml(u.username) + '</p>' +
          '<button class="btn btn-primary btn-block" id="u-edit">Ubah data</button><button class="btn btn-outline btn-block" id="u-reset" style="margin-top:8px;">Atur ulang password</button>');
        m.querySelector('#u-edit').addEventListener('click', function () { Utils.closeModal(); openForm(u, roles); });
        m.querySelector('#u-reset').addEventListener('click', function () { Utils.closeModal(); resetForm(u); });
      });
    });
  }
  function resetForm(u) {
    var m = Utils.openModal('<h3>Password baru</h3><p class="muted" style="margin-top:0;">Untuk ' + Utils.escapeHtml(u.full_name) + '. Minimal 6 karakter.</p><form id="rf"><div class="field"><div class="pw-wrap"><input name="pw" type="password" minlength="6" required autocomplete="new-password" placeholder="Password baru"><button type="button" class="pw-toggle" aria-label="Tampilkan password">Lihat</button></div></div><button class="btn btn-primary btn-block" type="submit">Simpan</button></form>');
    var inp = m.querySelector('[name=pw]'); m.querySelector('.pw-toggle').addEventListener('click', function (e) { inp.type = inp.type === 'password' ? 'text' : 'password'; e.target.textContent = inp.type === 'password' ? 'Lihat' : 'Sembunyi'; });
    m.querySelector('#rf').addEventListener('submit', function (e) {
      e.preventDefault();
      Api.call('user.resetPassword', { user_id: u.user_id, new_password: inp.value }).then(function () { Utils.closeModal(); Utils.toast('Password diatur ulang.', 'success'); }).catch(function (err) { Utils.toast(err.message, 'error'); });
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
