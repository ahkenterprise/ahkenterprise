import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getAuth, GoogleAuthProvider, signInWithPopup,
  onAuthStateChanged, signOut as fbSignOut,
  setPersistence, browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

const firebaseConfig = {
  apiKey:            "AIzaSyDXG4MmHYKd5VRC3XZy4qOpcEfQV-iJDkY",
  authDomain:        "apponsale-c11f3.firebaseapp.com",
  projectId:         "apponsale-c11f3",
  storageBucket:     "apponsale-c11f3.firebasestorage.app",
  messagingSenderId: "701953325146",
  appId:             "1:701953325146:web:82d8dd70db61be07108063",
  measurementId:     "G-H3SWJ1ECME"
};

const ADMIN_FN_URL = "/.netlify/functions/admin-action";
const OPEN_FN_URL  = "/open-app"; 

const isConfigured = !Object.values(firebaseConfig)
  .some(v => !v || String(v).includes('PASTE'));

let auth = null, provider = null;
if (isConfigured) {
  const fbApp = initializeApp(firebaseConfig);
  auth = getAuth(fbApp);
  setPersistence(auth, browserLocalPersistence).catch(console.error);
  provider = new GoogleAuthProvider();
  provider.addScope('email');
  provider.addScope('profile');
  // 🔥 Forces Google to show the consent screen every time
  provider.setCustomParameters({ prompt: 'consent select_account' });
}

const $ = id => document.getElementById(id);

async function callAdmin(action, payload = {}) {
  const user = auth && auth.currentUser;
  if (!user) { const e = new Error('Not signed in.'); e.status = 401; throw e; }
  
  const idToken = await user.getIdToken(true);
  const res = await fetch(ADMIN_FN_URL, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
    body:    JSON.stringify({ action, ...payload })
  });
  
  let data = {};
  try { data = await res.json(); } catch {}
  
  if (!res.ok) {
    const e = new Error(data.error || `Server Error (Status: ${res.status})`);
    e.status = res.status;
    throw e;
  }
  return data;
}

function showLoginScreen() {
  $('authLoading').style.display         = 'none';
  $('authSection').style.display         = 'block';
  $('adminContentSection').style.display = 'none';
  $('authError').style.display           = 'none';
}

function showAdminPanel(user) {
  $('authLoading').style.display         = 'none';
  $('authSection').style.display         = 'none';
  $('adminContentSection').style.display = 'block';

  const fallbackAvatar = 'data:image/svg+xml;utf8,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">' +
    '<circle cx="50" cy="50" r="50" fill="#e62e3c"/>' +
    '<text x="50" y="58" text-anchor="middle" fill="#fff" font-size="42" font-family="Arial">A</text></svg>'
  );
  $('adminAvatar').src = user.photoURL || fallbackAvatar;
  $('adminName').textContent         = user.displayName || 'Admin';
  $('adminEmailDisplay').textContent = user.email || 'Admin';

  $('adminModal').style.display = 'flex';
}

async function handleAuthState(user) {
  if (!user) { showLoginScreen(); return; }

  $('authLoading').style.display = 'block';
  $('authSection').style.display = 'none';

  try {
    await callAdmin('whoami'); 
    showAdminPanel(user);
  } catch (e) {
    await auth.signOut().catch(() => {});
    showLoginScreen();
    const el = $('authError');
    el.textContent = e.message; 
    el.style.display = 'block';
  }
}

async function handleGoogleSignIn() {
  $('authError').style.display   = 'none';
  $('authSection').style.display = 'none';
  $('authLoading').style.display = 'block';
  
  try {
    await signInWithPopup(auth, provider);
  } catch (e) {
    $('authLoading').style.display = 'none';
    $('authSection').style.display = 'block';
    const el = $('authError');
    el.textContent = e.message || "Sign-in failed.";
    el.style.display = 'block';
  }
}

function searchAndOpenApp() {
  const name = $('searchAppInput').value.trim();
  if (!name) return alert('Please enter an app name.');
  window.location.href = `${OPEN_FN_URL}?name=${encodeURIComponent(name)}`;
}

const optionsModal = $('optionsModal');
const adminModal   = $('adminModal');

$('openOptionsBtn').addEventListener('click', () => {
  optionsModal.style.display = 'flex';
  $('searchError').style.display = 'none';
  $('searchAppInput').value = '';
});
$('closeOptions').addEventListener('click', () => optionsModal.style.display = 'none');
$('closeAdmin').addEventListener('click', () => adminModal.style.display = 'none');
$('searchOpenBtn').addEventListener('click', searchAndOpenApp);
$('googleSignInBtn').addEventListener('click', handleGoogleSignIn);

let tapCount = 0, tapTimer;
$('secretLogo').addEventListener('click', () => {
  tapCount++;
  clearTimeout(tapTimer);
  tapTimer = setTimeout(() => { tapCount = 0; }, 2000);
  if (tapCount >= 5) { tapCount = 0; adminModal.style.display = 'flex'; }
});

if (isConfigured) onAuthStateChanged(auth, handleAuthState);
