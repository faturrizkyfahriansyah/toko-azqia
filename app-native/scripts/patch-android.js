#!/usr/bin/env node
/**
 * patch-android.js - dijalankan SETELAH "npx cap add android": menambah izin, plugin SPP, dan MainActivity.
 * Idempotent (aman dijalankan ulang). Env: ANDROID_DIR (bawaan ../android), CONFIG (bawaan ../capacitor.config.json).
 */
const fs = require('fs');
const path = require('path');

const ANDROID = path.resolve(process.env.ANDROID_DIR || path.join(__dirname, '..', 'android'));
const CONFIG = path.resolve(process.env.CONFIG || path.join(__dirname, '..', 'capacitor.config.json'));
const PLUGIN_SRC = path.join(__dirname, '..', 'native-src', 'TokoqiaSppPlugin.java'); // folder sumber sengaja bukan "android/" (itu dibuat oleh cap add)
const PLUGIN_TEMPLATE = process.env.PLUGIN_TEMPLATE ? path.resolve(process.env.PLUGIN_TEMPLATE) : PLUGIN_SRC;

const appId = JSON.parse(fs.readFileSync(CONFIG, 'utf8')).appId;
const manifestPath = path.join(ANDROID, 'app', 'src', 'main', 'AndroidManifest.xml');
if (!fs.existsSync(manifestPath)) { console.error('GAGAL: AndroidManifest.xml tidak ditemukan di ' + manifestPath + '. Jalankan "npx cap add android" dulu.'); process.exit(1); }

// 1) Izin
const PERMS = [
  '<uses-permission android:name="android.permission.INTERNET" />',
  '<uses-permission android:name="android.permission.BLUETOOTH" android:maxSdkVersion="30" />',
  '<uses-permission android:name="android.permission.BLUETOOTH_ADMIN" android:maxSdkVersion="30" />',
  '<uses-permission android:name="android.permission.BLUETOOTH_CONNECT" />',
  '<uses-permission android:name="android.permission.BLUETOOTH_SCAN" android:usesPermissionFlags="neverForLocation" />',
  '<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" android:maxSdkVersion="30" />',
  '<uses-permission android:name="android.permission.CAMERA" />',
  '<uses-feature android:name="android.hardware.camera" android:required="false" />',
  '<uses-feature android:name="android.hardware.bluetooth" android:required="false" />'
];
let m = fs.readFileSync(manifestPath, 'utf8');
const missing = PERMS.filter(function (p) {
  const name = (p.match(/android:name="([^"]+)"/) || [])[1];
  return m.indexOf('android:name="' + name + '"') < 0;
});
if (missing.length) {
  if (m.indexOf('<application') < 0) { console.error('GAGAL: tag <application> tidak ditemukan di manifest.'); process.exit(1); }
  m = m.replace('<application', missing.map(function (p) { return '    ' + p; }).join('\n') + '\n\n    <application');
  fs.writeFileSync(manifestPath, m);
}
console.log('Izin ditambahkan: ' + missing.length);

// 2) Plugin SPP + MainActivity (paket mengikuti appId)
const javaDir = path.join(ANDROID, 'app', 'src', 'main', 'java', ...appId.split('.'));
fs.mkdirSync(javaDir, { recursive: true });
let plugin = fs.readFileSync(PLUGIN_TEMPLATE, 'utf8').replace('PACKAGE_PLACEHOLDER', appId);
fs.writeFileSync(path.join(javaDir, 'TokoqiaSppPlugin.java'), plugin);
const kt = path.join(javaDir, 'MainActivity.kt');
if (fs.existsSync(kt)) fs.rmSync(kt);
fs.writeFileSync(path.join(javaDir, 'MainActivity.java'),
  'package ' + appId + ';\n\n' +
  'import android.os.Bundle;\n' +
  'import com.getcapacitor.BridgeActivity;\n\n' +
  'public class MainActivity extends BridgeActivity {\n' +
  '    @Override\n' +
  '    public void onCreate(Bundle savedInstanceState) {\n' +
  '        registerPlugin(TokoqiaSppPlugin.class);\n' +
  '        super.onCreate(savedInstanceState);\n' +
  '    }\n' +
  '}\n');
console.log('Plugin SPP + MainActivity dipasang di ' + path.relative(ANDROID, javaDir));
