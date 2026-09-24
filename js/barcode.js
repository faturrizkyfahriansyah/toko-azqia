/**
 * js/barcode.js - Render barcode (untuk cetak label) & scan barcode lewat kamera HP.
 * Memakai library CDN publik (situs statis biasa, bukan Claude Artifact, jadi CDN eksternal
 * aman dipakai): JsBarcode (render CODE128) dan html5-qrcode (scan kamera). Dimuat LAZY
 * (baru di-load saat benar-benar dipakai) supaya halaman lain tidak menunggu skrip ini.
 */
window.BarcodeTools = (function () {
  var jsBarcodeLoaded = null;
  var html5QrcodeLoaded = null;
  var qrcodeLoaded = null;

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
  /** Untuk GENERATE QR (beda dari html5-qrcode yang untuk SCAN via kamera). Dipakai cetak struk/label/test print. */
  function ensureQrGenerator() {
    if (window.QRCode) return Promise.resolve();
    if (!qrcodeLoaded) qrcodeLoaded = loadScript('https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js');
    return qrcodeLoaded;
  }

  /** Render barcode CODE128 ke elemen <svg> yang diberikan. */
  function renderTo(svgEl, value) {
    return ensureJsBarcode().then(function () {
      window.JsBarcode(svgEl, value, { format: 'CODE128', width: 2, height: 60, displayValue: true, fontSize: 14, margin: 8 });
    });
  }

  /** Generate QR code sebagai <canvas> tersembunyi (dipakai untuk print, bukan untuk scan kamera). */
  function renderQrToCanvas(value, size) {
    return ensureQrGenerator().then(function () {
      return new Promise(function (resolve, reject) {
        var holder = document.createElement('div');
        holder.style.position = 'fixed'; holder.style.left = '-9999px'; holder.style.top = '-9999px';
        document.body.appendChild(holder);
        try {
          new window.QRCode(holder, { text: value, width: size || 128, height: size || 128, correctLevel: window.QRCode.CorrectLevel.M });
          setTimeout(function () {
            var canvas = holder.querySelector('canvas');
            var img = holder.querySelector('img');
            if (canvas) {
              document.body.removeChild(holder);
              resolve(canvas);
            } else if (img) {
              // Fallback jika browser render sebagai <img> (jarang) - gambar ke canvas manual.
              var c = document.createElement('canvas');
              c.width = size || 128; c.height = size || 128;
              c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
              document.body.removeChild(holder);
              resolve(c);
            } else {
              document.body.removeChild(holder);
              reject(new Error('QR gagal dirender.'));
            }
          }, 60);
        } catch (e) { document.body.removeChild(holder); reject(e); }
      });
    });
  }

  /** Render barcode CODE128 sebagai <canvas> tersembunyi (untuk print raster, bukan tampilan layar). */
  function renderBarcodeToCanvas(value, heightPx) {
    return ensureJsBarcode().then(function () {
      var canvas = document.createElement('canvas');
      window.JsBarcode(canvas, value, { format: 'CODE128', width: 2, height: heightPx || 50, displayValue: true, fontSize: 12, margin: 4 });
      return canvas;
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

  return { renderTo: renderTo, startCameraScan: startCameraScan, renderQrToCanvas: renderQrToCanvas, renderBarcodeToCanvas: renderBarcodeToCanvas };
})();
