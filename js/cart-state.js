/**
 * js/cart-state.js - keranjang belanja toko online, disimpan di localStorage perangkat
 * pembeli (bukan data sensitif - wajar disimpan di browser, situs statis biasa, bukan Artifact).
 */
window.Cart = (function () {
  var KEY = 'azqia_cart';

  function read() {
    try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch (e) { return []; }
  }
  function write(items) { localStorage.setItem(KEY, JSON.stringify(items)); }

  function getItems() { return read(); }
  function count() { return read().reduce(function (s, l) { return s + l.qty; }, 0); }
  function add(product, qty) {
    var items = read();
    var line = items.filter(function (l) { return l.product_id === product.product_id; })[0];
    if (line) { line.qty += (qty || 1); } else {
      items.push({ product_id: product.product_id, product_name: product.product_name, selling_price: Number(product.selling_price), qty: qty || 1 });
    }
    write(items);
  }
  function setQty(productId, qty) {
    var items = read();
    if (qty <= 0) { items = items.filter(function (l) { return l.product_id !== productId; }); }
    else { items.forEach(function (l) { if (l.product_id === productId) l.qty = qty; }); }
    write(items);
  }
  function remove(productId) { write(read().filter(function (l) { return l.product_id !== productId; })); }
  function clear() { write([]); }
  function subtotal() { return read().reduce(function (s, l) { return s + l.qty * l.selling_price; }, 0); }

  return { getItems: getItems, count: count, add: add, setQty: setQty, remove: remove, clear: clear, subtotal: subtotal };
})();


/**
 * Pesanan saya di perangkat ini (tamu) + sesi akun pelanggan. Hanya localStorage perangkat pembeli:
 * nomor pesanan, 4 digit akhir WA (untuk verifikasi pelacakan), ringkasan item. Bukan data sensitif.
 */
window.MyOrders = (function () {
  var KEY = 'azqia_my_orders', MAX = 30;
  function read() { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch (e) { return []; } }
  function write(a) { try { localStorage.setItem(KEY, JSON.stringify(a.slice(0, MAX))); } catch (e) {} }
  function list() { return read(); }
  function add(o) {
    var a = read().filter(function (x) { return x.order_number !== o.order_number; });
    a.unshift(o); write(a);
  }
  function lastContact() { var a = read()[0]; return a ? { name: a.name || '', phone: a.phone || '' } : { name: '', phone: '' }; }
  return { list: list, add: add, lastContact: lastContact };
})();

window.CustAuth = (function () {
  var KEY = 'azqia_cust';
  function read() { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { return null; } }
  function get() { return read(); }
  function token() { var s = read(); return s && s.token ? s.token : ''; }
  function profile() { var s = read(); return s && s.profile ? s.profile : null; }
  function set(token, profile) { try { localStorage.setItem(KEY, JSON.stringify({ token: token, profile: profile })); } catch (e) {} }
  function clear() { try { localStorage.removeItem(KEY); } catch (e) {} }
  return { get: get, token: token, profile: profile, set: set, clear: clear, loggedIn: function () { return !!token(); } };
})();
