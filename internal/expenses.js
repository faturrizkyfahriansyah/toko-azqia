/**
 * internal/expenses.js - Pengeluaran toko (listrik, transport, ATK, dsb).
 */
window.Modules = window.Modules || {};
Modules.expenses = (function () {
  function render(container) {
    return Api.call('expense.list', {}).then(function (d) {
      if (!container.isConnected) return;
      container.innerHTML = '<div class="row"><h1>Pengeluaran</h1><button class="btn btn-primary" id="btn-add">+ Pengeluaran</button></div>' +
        '<div class="table-wrap"><table><thead><tr><th>No.</th><th>Tanggal</th><th>Kategori</th><th>Keterangan</th><th>Nominal</th></tr></thead><tbody>' +
        d.expenses.map(function (e) {
          return '<tr><td>' + e.expense_number + '</td><td>' + Utils.formatDateOnly(e.date) + '</td><td>' + Utils.escapeHtml(e.category) + '</td><td>' + Utils.escapeHtml(e.description) + '</td><td>' + Utils.formatCurrency(e.amount) + '</td></tr>';
        }).join('') + '</tbody></table></div>';
      document.getElementById('btn-add').addEventListener('click', openForm);
    });
  }

  function openForm() {
    var m = Utils.openModal('<h3>Pengeluaran Baru</h3><form id="f">' +
      '<div class="field"><label>Kategori</label><select name="category"><option>Listrik</option><option>Transport</option><option>ATK</option><option>Perlengkapan</option><option>Operasional</option><option>Lainnya</option></select></div>' +
      '<div class="field"><label>Keterangan</label><input name="description" required></div>' +
      '<div class="field"><label>Nominal (Rp)</label><input name="amount" type="number" min="1" required></div>' +
      '<div class="field"><label>Metode Bayar</label><select name="payment_method"><option value="CASH">Tunai (mengurangi Kas)</option><option value="TRANSFER">Transfer</option></select></div>' +
      '<button class="btn btn-primary btn-block" type="submit">Simpan</button></form>');
    m.querySelector('#f').addEventListener('submit', function (e) {
      e.preventDefault();
      var fd = Object.fromEntries(new FormData(e.target).entries());
      Api.call('expense.create', fd).then(function () {
        Utils.toast('Pengeluaran dicatat.', 'success'); Utils.closeModal(); Router.render();
      }).catch(function (err) { Utils.toast(err.message, 'error'); });
    });
  }

  return { render: render };
})();
