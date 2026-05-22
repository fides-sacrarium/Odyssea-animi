// score.js — Fides Sacrarium · unified scoring & rank system
// Single source of truth for ranks + writing scores to the Realtime Database.
// Safe to include on any page (guards against double Firebase init).
(function (global) {
  'use strict';

  var FIREBASE_CONFIG = {
    apiKey: "AIzaSyAwT3G3d_UDjy7F6CMkIa6G-kJJsNXkges",
    authDomain: "fidessacrarium.firebaseapp.com",
    projectId: "fidessacrarium",
    storageBucket: "fidessacrarium.firebasestorage.app",
    messagingSenderId: "302230560956",
    appId: "1:302230560956:web:9548a26cf23b04dfa030b9"
  };

  // Ensure Firebase is initialised (guarded — harmless if already done elsewhere).
  if (typeof firebase !== 'undefined' && (!firebase.apps || !firebase.apps.length)) {
    try { firebase.initializeApp(FIREBASE_CONFIG); } catch (e) { /* already initialised */ }
  }

  // ── RANKS ────────────────────────────────────────────────
  // 15 tiers — a pilgrim's road from the first spark of faith to sainthood.
  var RANKS = [
    { name: 'Seeker',        icon: '🕯️', color: '#9A8A74', min: 0,     blurb: 'The first spark of devotion.' },
    { name: 'Catechumen',    icon: '📖', color: '#A0785A', min: 60,    blurb: 'Learning the way of faith.' },
    { name: 'Novice',        icon: '🌱', color: '#8AA86E', min: 150,   blurb: 'Tender roots take hold.' },
    { name: 'Pilgrim',       icon: '🧭', color: '#6FA89C', min: 320,   blurb: 'Walking the sacred road.' },
    { name: 'Almsgiver',     icon: '🪙', color: '#CD7F32', min: 560,   blurb: 'Mercy poured out freely.' },
    { name: 'Acolyte',       icon: '🔥', color: '#D8985C', min: 880,   blurb: 'Tending the holy flame.' },
    { name: 'Lector',        icon: '📜', color: '#C9A96E', min: 1280,  blurb: 'Proclaiming the Word.' },
    { name: 'Cantor',        icon: '🎼', color: '#BFA6D4', min: 1780,  blurb: 'Singing Heaven’s praise.' },
    { name: 'Evangelist',    icon: '🕊️', color: '#A6B6C6', min: 2400,  blurb: 'Bearing the good news.' },
    { name: 'Confessor',     icon: '⛪', color: '#AEC4DA', min: 3200,  blurb: 'A steadfast witness of truth.' },
    { name: 'Defender',      icon: '🛡️', color: '#C4A060', min: 4300,  blurb: 'Guardian of the faith.' },
    { name: 'Contemplative', icon: '🌙', color: '#9DB4E2', min: 5800,  blurb: 'Resting in holy silence.' },
    { name: 'Mystic',        icon: '🔮', color: '#A07AB8', min: 7800,  blurb: 'Touched by the divine.' },
    { name: 'Apostle',       icon: '👑', color: '#9DE0FF', min: 10400, blurb: 'Sent out to all nations.' },
    { name: 'Saintly',       icon: '✨', color: '#FFD700', min: 14000, blurb: 'A soul aflame with grace.' }
  ];

  // Returns the rank for a score, with progress (%) toward the next tier.
  function getRank(score) {
    score = Math.max(0, Math.floor(Number(score) || 0));
    var idx = 0;
    for (var i = 0; i < RANKS.length; i++) { if (score >= RANKS[i].min) idx = i; }
    var cur = RANKS[idx];
    var next = RANKS[idx + 1] || null;
    var pct = next ? ((score - cur.min) / (next.min - cur.min)) * 100 : 100;
    pct = Math.max(0, Math.min(100, pct));
    return {
      name: cur.name, icon: cur.icon, color: cur.color, blurb: cur.blurb,
      min: cur.min, index: idx, total: RANKS.length, pct: pct,
      next: next, nextName: next ? next.name : null,
      nextMin: next ? next.min : cur.min,
      toNext: next ? Math.max(0, next.min - score) : 0
    };
  }

  // ── AUTH READINESS ───────────────────────────────────────
  // Resolves with the signed-in user. Waits for Firebase to restore the
  // session if it hasn't yet (fixes scores being lost right after load).
  function ready(cb) {
    if (typeof firebase === 'undefined' || !firebase.apps || !firebase.apps.length) { cb(null); return; }
    var a = firebase.auth();
    if (a.currentUser) { cb(a.currentUser); return; }
    var unsub = a.onAuthStateChanged(function (u) {
      if (typeof unsub === 'function') unsub();
      cb(u || null);
    });
  }

  // ── AWARD SCORE ──────────────────────────────────────────
  // opts: { type, statKey, points, label, extra:{}, extraStats:{} }
  // Writes to users/$uid/stats (score + counters) and users/$uid/history.
  function award(opts) {
    opts = opts || {};
    var points = Math.round(Number(opts.points) || 0);
    return new Promise(function (resolve) {
      ready(function (user) {
        if (!user) {
          console.warn('[score] no signed-in user — activity not recorded:', opts.type);
          resolve(false);
          return;
        }
        var ref = firebase.database().ref('users/' + user.uid);

        // stats — transaction creates the node if it does not exist yet.
        ref.child('stats').transaction(function (s) {
          s = s || {};
          s.score = (s.score || 0) + points;
          if (opts.statKey) s[opts.statKey] = (s[opts.statKey] || 0) + 1;
          if (opts.extraStats) {
            for (var k in opts.extraStats) { s[k] = (s[k] || 0) + opts.extraStats[k]; }
          }
          s.lastActivity = Date.now();
          return s;
        }).catch(function (e) { console.error('[score] stats error:', e); });

        // history — an append-only ledger of every action.
        var entry = { type: opts.type || 'activity', points: points, label: opts.label || '', ts: Date.now() };
        if (opts.extra) { for (var k2 in opts.extra) entry[k2] = opts.extra[k2]; }
        ref.child('history').push(entry)
          .then(function () { resolve(true); })
          .catch(function (e) { console.error('[score] history error:', e); resolve(false); });
      });
    });
  }

  global.Fides = {
    RANKS: RANKS,
    getRank: getRank,
    ready: ready,
    award: award
  };
})(window);
