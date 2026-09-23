/**
 * js/barcode.js - Render barcode (untuk cetak label) & scan barcode lewat kamera HP.
 * Memakai library CDN publik (situs statis biasa, bukan Claude Artifact, jadi CDN eksternal
 * aman dipakai): JsBarcode (render CODE128) dan html5-qrcode (scan kamera). Dimuat LAZY
 * (baru di-load saat benar-benar dipakai) supaya halaman lain tidak menunggu skrip ini.
 */
window.BarcodeTools = (function () {
  var jsBarcodeLoaded = null;
  var html5QrcodeLoaded = null;

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = src; s.onload = resolve; s.onerror = function () { reject(new Error('Gagal memuat ' + src)); };
      document.head.appendChild(s);
    });
  }
  function ensureJsBarcode() {
    if (window.JsBarcode) return Promise.resolve();
    if (!jsBarcodeLoaded) jsBarcodeLoaded = loadScript('https://cdnjs.cloudflare.com/ajax/libs/jsbarcode/3.11.6/JsBarcode.all.min.js');
    return jsBarcodeLoaded;
  }
  function ensureHtml5Qrcode() {
    if (window.Html5Qrcode) return Promise.resolve();
    if (!html5QrcodeLoaded) html5QrcodeLoaded = loadScript('https://cdnjs.cloudflare.com/ajax/libs/html5-qrcode/2.3.8/html5-qrcode.min.js');
    return html5QrcodeLoaded;
  }

  /** Render barcode CODE128 ke elemen <svg> yang diberikan. */
  function renderTo(svgEl, value) {
    return ensureJsBarcode().then(function () {
      window.JsBarcode(svgEl, value, { format: 'CODE128', width: 2, height: 60, displayValue: true, fontSize: 14, margin: 8 });
    });
  }

  /**
   * Mulai scan kamera. elementId = id div kosong tempat preview kamera ditampilkan.
   * onResult(text) dipanggil sekali saat barcode terbaca, lalu scanner otomatis dihentikan.
   * Mengembalikan Promise yang resolve dengan instance scanner (untuk stop() manual jika perlu).
   */
  function startCameraScan(elementId, onResult, onError) {
    return ensureHtml5Qrcode().then(function () {
      var scanner = new window.Html5Qrcode(elementId);
      var stopped = false;
      function stopSafely() {
        if (stopped) return Promise.resolve();
        stopped = true;
        return scanner.stop().catch(function () {});
      }
      return scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 150 } },
        function (decodedText) { stopSafely().then(function () { onResult(decodedText); }); },
        function () { /* frame tanpa barcode - abaikan, ini dipanggil terus-menerus */ }
      ).then(function () { return { instance: scanner, stop: stopSafely }; })
        .catch(function (err) {
          if (onError) onError(err);
          throw err;
        });
    });
  }

  return { renderTo: renderTo, startCameraScan: startCameraScan };
})();
