/**
 * native/app-native/src/bridge.js
 * Jembatan TIPIS antara halaman web TOKOQIA dan bagian asli (native) aplikasi. Di-bundle oleh esbuild menjadi
 * www/js/native/bridge.bundle.js dan memasang window.TokoqiaNative. Seluruh logika cetak ada di
 * js/printer/nativeAdapter.js (bisa diuji tanpa perangkat); file ini hanya meneruskan panggilan.
 * BELUM TERBUKTI di perangkat nyata sampai APK/aplikasi dibangun dan dicoba.
 */
import { Capacitor, registerPlugin } from '@capacitor/core';
import { BleClient } from '@capacitor-community/bluetooth-le';

var platform = Capacitor.getPlatform();
var isNative = Capacitor.isNativePlatform();
if (isNative) document.documentElement.classList.add('in-app'); // memicu CSS khusus aplikasi (area aman status bar, sembunyikan tombol pasang)
var Spp = registerPlugin('TokoqiaSpp'); // plugin Java: native-src/TokoqiaSppPlugin.java (hanya Android)

var bleReady = null;
function bleInit() {
  if (!bleReady) bleReady = BleClient.initialize({ androidNeverForLocation: true });
  return bleReady;
}
function toDataView(u8) { return new DataView(u8.buffer, u8.byteOffset, u8.byteLength); }
function toBase64(u8) {
  var s = '';
  for (var i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
  return btoa(s);
}

window.TokoqiaNative = {
  isNative: isNative,
  platform: platform,
  methods: !isNative ? [] : (platform === 'android' ? ['ble', 'spp'] : ['ble']),
  ble: {
    requestDevice: function () { return bleInit().then(function () { return BleClient.requestDevice({}); }); },
    connect: function (id, onDisconnect) { return bleInit().then(function () { return BleClient.connect(id, onDisconnect); }); },
    disconnect: function (id) { return BleClient.disconnect(id); },
    getServices: function (id) { return BleClient.getServices(id); },
    write: function (id, service, characteristic, bytes, withoutResponse) {
      var dv = toDataView(bytes);
      return withoutResponse ? BleClient.writeWithoutResponse(id, service, characteristic, dv) : BleClient.write(id, service, characteristic, dv);
    }
  },
  spp: {
    listBonded: function () { return Spp.listBonded().then(function (r) { return (r && r.devices) || []; }); },
    connect: function (address) { return Spp.connect({ address: address }); },
    write: function (address, bytes) { return Spp.write({ address: address, data: toBase64(bytes) }); },
    disconnect: function (address) { return Spp.disconnect({ address: address }); }
  }
};
