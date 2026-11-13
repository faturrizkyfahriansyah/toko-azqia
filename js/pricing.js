/**
 * js/pricing.js - Harga jual eceran/grosir. CERMINAN PERSIS dari backend (68_Catalog: wholesaleApplies / sellPriceFor).
 * Server tetap otoritatif; fungsi ini hanya agar kasir melihat harga yang sama (dan bekerja saat offline).
 * Aturan (Pengaturan -> Harga): OFF | CUSTOMER (pelanggan bertipe GROSIR) | QTY (jumlah >= minimal per satuan) | CUSTOMER_OR_QTY.
 * Satuan yang tidak punya harga grosir selalu eceran.
 */
window.Pricing = (function () {
  function num(v) { var n = Number(v); return isFinite(n) ? n : 0; }
  function hasWholesale(unit) { return unit && unit.wholesale_price !== null && unit.wholesale_price !== undefined && unit.wholesale_price !== '' && num(unit.wholesale_price) > 0; }
  function retail(product, unit) {
    if (unit && unit.selling_price !== null && unit.selling_price !== undefined && unit.selling_price !== '') return num(unit.selling_price);
    return num(product.selling_price) * (unit ? (num(unit.conversion_to_base) || 1) : 1);
  }
  function applies(rule, customerType, unit, qty) {
    if (!hasWholesale(unit)) return false;
    var minQty = num(unit.wholesale_min_qty), byCustomer = String(customerType || '').toUpperCase() === 'GROSIR', byQty = minQty > 0 && qty >= minQty;
    if (rule === 'CUSTOMER') return byCustomer;
    if (rule === 'QTY') return byQty;
    if (rule === 'CUSTOMER_OR_QTY') return byCustomer || byQty;
    return false;
  }
  /** -> { price, retail, wholesale } */
  function unitPrice(product, unit, qty, customerType, rule) {
    var r = retail(product, unit), w = applies(rule, customerType, unit, qty);
    var price = w ? Math.min(num(unit.wholesale_price), r) : r;
    return { price: price, retail: r, wholesale: w && price < r };
  }
  return { unitPrice: unitPrice, applies: applies, retail: retail };
})();
