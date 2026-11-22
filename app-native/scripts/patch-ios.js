#!/usr/bin/env node
/** patch-ios.js - setelah "npx cap add ios": tambah teks izin Bluetooth & kamera di Info.plist. Idempotent. Env: PLIST. */
const fs = require('fs');
const path = require('path');
const PLIST = path.resolve(process.env.PLIST || path.join(__dirname, '..', 'ios', 'App', 'App', 'Info.plist'));
if (!fs.existsSync(PLIST)) { console.error('GAGAL: Info.plist tidak ditemukan di ' + PLIST + '. Jalankan "npx cap add ios" dulu.'); process.exit(1); }
const ADD = {
  NSBluetoothAlwaysUsageDescription: 'TOKOQIA memakai Bluetooth untuk mencetak struk ke printer.',
  NSBluetoothPeripheralUsageDescription: 'TOKOQIA memakai Bluetooth untuk mencetak struk ke printer.',
  NSCameraUsageDescription: 'TOKOQIA memakai kamera untuk memindai barcode produk.'
};
let s = fs.readFileSync(PLIST, 'utf8'), added = 0;
Object.keys(ADD).forEach(function (k) {
  if (s.indexOf('<key>' + k + '</key>') >= 0) return;
  const i = s.lastIndexOf('</dict>');
  if (i < 0) { console.error('GAGAL: Info.plist tidak valid.'); process.exit(1); }
  s = s.slice(0, i) + '\t<key>' + k + '</key>\n\t<string>' + ADD[k] + '</string>\n' + s.slice(i);
  added++;
});
fs.writeFileSync(PLIST, s);
console.log('Info.plist: ' + added + ' kunci izin ditambahkan.');
