// config.js — Fides Sacrarium Firebase Config

const firebaseConfig = {
    apiKey: "AIzaSyAwT3G3d_UDjy7F6CMkIa6G-kJJsNXkges",
    authDomain: "fidessacrarium.firebaseapp.com",
    projectId: "fidessacrarium",
    storageBucket: "fidessacrarium.firebasestorage.app",
    messagingSenderId: "302230560956",
    appId: "1:302230560956:web:9548a26cf23b04dfa030b9"
};

// Initialize Firebase (guard against double-init)
if (!firebase.apps || !firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const auth = firebase.auth();
const db = firebase.database();

let currentUserData = null;

// ── THEME ─────────────────────────────────────────────
function initTheme() {
    const saved = localStorage.getItem('fides_theme');
    const theme = saved || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    document.body.setAttribute('data-theme', theme);
}
function toggleGlobalTheme() {
    const current = document.body.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    document.body.setAttribute('data-theme', next);
    localStorage.setItem('fides_theme', next);
}
document.addEventListener('DOMContentLoaded', initTheme);

// ── RANK ──────────────────────────────────────────────
// Delegates to score.js (Fides.getRank) — the single 15-tier source of truth.
function getRank(score) {
    if (window.Fides && Fides.getRank) return Fides.getRank(score);
    return { name: "Seeker", icon: "🕯️", color: "#9A8A74", pct: 0 };
}

// ── SCORE UPDATER ─────────────────────────────────────
function addScore(type) {
    const user = auth.currentUser;
    if (!user) return;
    let points = 0, statKey = '', histEntry = {};
    const now = Date.now();
    switch(type) {
        case 'bible':  points = 2;  statKey = 'bibleDrawn';        histEntry = { type, points, label: 'Bible verse drawn', ts: now }; break;
        case 'chess':  points = 10; statKey = 'chessPlayed';       histEntry = { type, points, label: 'Chess match played', ts: now }; break;
        case 'lectio': points = 15; statKey = 'lectioCompleted';   histEntry = { type, points, label: 'Lectio Divina completed', ts: now }; break;
        case 'prayer': points = 20; statKey = 'prayersCompleted';  histEntry = { type, points, label: 'Prayer completed', ts: now }; break;
        case 'rosary': points = 40; statKey = 'rosaryCompleted';   histEntry = { type, points, label: 'Rosary completed', ts: now }; break;
    }
    const userRef = db.ref('users/' + user.uid);
    userRef.child('stats').transaction(stats => {
        if (!stats) stats = {};
        stats[statKey] = (stats[statKey] || 0) + 1;
        stats.score = (stats.score || 0) + points;
        return stats;
    });
    userRef.child('history').push(histEntry);
}

// ── AUTH GUARD (call on protected pages) ──────────────
function requireAuth(callback) {
    auth.onAuthStateChanged(user => {
        if (!user) {
            window.location.href = 'auth.html?redirect=' + encodeURIComponent(window.location.pathname);
        } else {
            db.ref('users/' + user.uid + '/profile').once('value').then(snap => {
                currentUserData = snap.val();
                if (callback) callback(user, currentUserData);
            });
        }
    });
}

// ── MINISTRY GUARD (songbook = CG only) ──────────────
function requireMinistry(allowed, callback) {
    requireAuth((user, profile) => {
        if (!profile || !allowed.includes(profile.ministry)) {
            window.location.href = 'index.html?accessDenied=1';
        } else {
            if (callback) callback(user, profile);
        }
    });
}
