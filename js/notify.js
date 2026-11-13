/**
 * js/notify.js - Nada & notifikasi di perangkat ini: nada (WebAudio, tanpa berkas suara), getar, notifikasi sistem, dan polling lonceng.
 * Pengaturan disimpan per perangkat (localStorage). Notifikasi ke WhatsApp diatur pemilik di halaman Notifikasi (server).
 */
window.Notify = (function () {
  var KEY = 'azqia_notify_prefs', LAST = 'azqia_notify_last';
  var TONES = {   // [frekuensi Hz, mulai (dtk), lama (dtk)]
    kasir: { type: 'triangle', notes: [[1319, 0, 0.09], [1760, 0.09, 0.09], [2093, 0.18, 0.28]] },
    chime: { type: 'sine', notes: [[880, 0, 0.14], [1175, 0.14, 0.32]] },
    bell: { type: 'sine', notes: [[988, 0, 0.3], [784, 0.3, 0.45]] },
    alert: { type: 'square', notes: [[440, 0, 0.16], [330, 0.2, 0.16], [440, 0.4, 0.28]] },
    soft: { type: 'sine', notes: [[660, 0, 0.22]] }
  };
  var TONE_LABEL = { auto: 'Otomatis (beda tiap jenis)', kasir: 'Kasir (cha-ching)', chime: 'Lonceng kecil', bell: 'Bel', alert: 'Peringatan', soft: 'Lembut' };
  var EVENT_TONE = { SALE_DONE: 'kasir', PESANAN_ONLINE_BARU: 'bell', ONLINE_PAID: 'chime', STOK_MENIPIS: 'alert', STOK_HABIS: 'alert', NEGATIVE_STOCK: 'alert', REFUND_PENDING: 'alert', WA_HANDOVER: 'bell', VOID_SALE: 'soft', PIUTANG_BARU: 'soft', DAILY_SUMMARY: 'soft' };
  var ctx = null, timer = null, remembered = {}, started = false;
  var played = [];   // untuk pengujian

  function load() {
    var d = { enabled: true, sound: 'auto', volume: 0.8, vibrate: true, system: false, events: null };
    try { var s = JSON.parse(localStorage.getItem(KEY) || 'null'); if (s) Object.keys(s).forEach(function (k) { d[k] = s[k]; }); } catch (e) {}
    if (!d.events) {   // bawaan per peran: kasir hanya mendengar transaksi; pemilik/pengelola mendengar semua
      d.events = {}; var role = window.Auth && Auth.role ? Auth.role() : '';
      Object.keys(EVENT_TONE).forEach(function (k) { d.events[k] = role === 'KASIR' ? k === 'SALE_DONE' : true; });
    }
    return d;
  }
  function save(p) { try { localStorage.setItem(KEY, JSON.stringify(p)); } catch (e) {} }
  function getPrefs() { return load(); }
  function setPrefs(p) { save(p); }

  function unlock() {   // kebijakan autoplay: AudioContext baru boleh berbunyi setelah ada sentuhan pengguna
    try {
      var AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
      if (!ctx) ctx = new AC();
      if (ctx.state === 'suspended') ctx.resume();
    } catch (e) {}
  }
  function playTone(name, vol) {
    played.push(name);
    try {
      unlock(); if (!ctx) return;
      var t = TONES[name] || TONES.chime, now = ctx.currentTime;
      t.notes.forEach(function (n) {
        var osc = ctx.createOscillator(), g = ctx.createGain();
        osc.type = t.type; osc.frequency.value = n[0];
        g.gain.setValueAtTime(0.0001, now + n[1]); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), now + n[1] + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, now + n[1] + n[2]);
        osc.connect(g); g.connect(ctx.destination); osc.start(now + n[1]); osc.stop(now + n[1] + n[2] + 0.02);
      });
    } catch (e) {}
  }
  /** Bunyi untuk jenis notifikasi tertentu sesuai pengaturan perangkat. */
  function playEvent(eventId, force) {
    var p = load(); if (!p.enabled && !force) return false;
    if (!force && p.events[eventId] === false) return false;
    var tone = p.sound === 'auto' ? (EVENT_TONE[eventId] || 'chime') : p.sound;
    playTone(tone, Math.max(0.05, Math.min(1, p.volume)) * 0.35);
    if (p.vibrate && navigator.vibrate) { try { navigator.vibrate(eventId === 'SALE_DONE' ? [60, 40, 60] : [120, 60, 120]); } catch (e) {} }
    return true;
  }
  function testTone(name) { playTone(name === 'auto' ? 'kasir' : name, Math.max(0.05, Math.min(1, load().volume)) * 0.35); }

  function showSystem(title, body, tag) {
    var p = load(); if (!p.system || !('Notification' in window) || Notification.permission !== 'granted') return;
    try {
      if (navigator.serviceWorker && navigator.serviceWorker.getRegistration) {
        navigator.serviceWorker.getRegistration().then(function (reg) { if (reg && reg.showNotification) reg.showNotification(title, { body: body, tag: tag || 'azqia', icon: 'assets/icons/tokoqia-app-icon-192.png', renotify: true }); else new Notification(title, { body: body, icon: 'assets/icons/tokoqia-app-icon-192.png' }); });
      } else new Notification(title, { body: body });
    } catch (e) {}
  }
  function requestSystemPermission() {
    if (!('Notification' in window)) return Promise.resolve('unsupported');
    return Promise.resolve(Notification.requestPermission());
  }

  /** Nomor transaksi yang dibuat di perangkat ini: bunyinya sudah diputar langsung, jangan diputar lagi saat polling. */
  function rememberSale(num) { remembered[num] = true; }

  function setBell(n) { if (window.Layout && Layout.setBellCount) Layout.setBellCount(n); }
  function poll() {
    if (document.visibilityState === 'hidden' || !window.Auth || !Auth.isLoggedIn() || !window.Offline || !Offline.isOnline()) return Promise.resolve();
    var last = localStorage.getItem(LAST) || '';
    return Api.call('notification.list', last ? { since: last } : {}).then(function (d) {
      setBell(d.unread_count || 0);
      var rows = (d.notifications || []).filter(function (n) { return !last || String(n.created_at) > last; }).sort(function (a, b) { return a.created_at < b.created_at ? -1 : 1; });
      if (!last) { var newest = (d.notifications || [])[0]; localStorage.setItem(LAST, newest ? newest.created_at : new Date().toISOString()); return; }   // pertama kali: jangan memutar riwayat lama
      var rang = 0;
      rows.forEach(function (n) {
        var ev = n.event || n.type, mine = ev === 'SALE_DONE' && Object.keys(remembered).some(function (k) { return String(n.message).indexOf(k) !== -1; });
        if (!mine && rang < 3 && playEvent(ev)) { rang++; showSystem(n.title, String(n.message).split('\n').join(' · '), ev); }
        localStorage.setItem(LAST, n.created_at);
      });
    }).catch(function () {});
  }
  function start() {
    if (started) return; started = true;
    document.addEventListener('click', unlock, { once: true }); document.addEventListener('touchstart', unlock, { once: true });
    timer = setInterval(poll, 20000); poll();
    document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') poll(); });
  }
  return { getPrefs: getPrefs, setPrefs: setPrefs, playEvent: playEvent, testTone: testTone, unlock: unlock, showSystem: showSystem, requestSystemPermission: requestSystemPermission, rememberSale: rememberSale,
    start: start, poll: poll, TONE_LABEL: TONE_LABEL, EVENT_TONE: EVENT_TONE, _played: played };
})();
