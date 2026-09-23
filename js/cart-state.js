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
