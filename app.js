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

let adminAppsCache = [];
let refreshTimer = null;

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
  
  refreshAdminList();
  if (refreshTimer) clearInterval(refreshTimer);
  refreshTimer = setInterval(refreshAdminList, 5000);
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

async function refreshAdminList() {
  try {
    const data = await callAdmin('list');
    adminAppsCache = data.apps || [];
    renderAdminList();
  } catch (e) {
    console.warn('List refresh failed:', e.message);
  }
}

function renderAdminList() {
  const list = $('adminLinksList');
  list.innerHTML = '';

  if (!adminAppsCache.length) {
    const empty = document.createElement('p');
    empty.className = 'empty-state';
    empty.textContent = 'No apps yet. Click "Seed Default Apps" below.';
    list.appendChild(empty);
    $('seedBtn').style.display = 'block';
    return;
  }
  $('seedBtn').style.display = 'none';

  adminAppsCache.forEach(link => {
    const item = document.createElement('div');
    item.className = 'admin-link-item' + (link.visible ? '' : ' hidden-link');

    const info = document.createElement('div');
    info.className = 'admin-link-info';
    const strong = document.createElement('strong');
    strong.textContent = link.name;
    const small = document.createElement('small');
    small.textContent = link.visible ? '● Visible' : '○ Hidden';
    info.append(strong, small);

    const editBtn = document.createElement('button');
    editBtn.className = 'action-btn edit-btn';
    editBtn.textContent = '✏️';
    editBtn.title = 'Edit URL';
    editBtn.addEventListener('click', () => handleEditUrl(link));

    const toggleBtn = document.createElement('button');
    toggleBtn.className = 'action-btn ' + (link.visible ? 'toggle-btn' : 'toggle-btn is-hidden');
    toggleBtn.textContent = link.visible ? '👁️' : '🙈';
    toggleBtn.title = link.visible ? 'Hide' : 'Show';
    toggleBtn.addEventListener('click', () => handleToggle(link));

    const delBtn = document.createElement('button');
    delBtn.className = 'action-btn delete-btn';
    delBtn.textContent = '🗑️';
    delBtn.title = 'Delete';
    delBtn.addEventListener('click', () => handleDelete(link));

    item.append(info, editBtn, toggleBtn, delBtn);
    list.appendChild(item);
  });
}

async function handleEditUrl(link) {
  try {
    const r = await callAdmin('get-url', { id: link.id });
    const currentUrl = r.url || '';
    const newUrl = prompt(`Edit URL for "${link.name}":`, currentUrl);
    if (newUrl === null) return;
    const trimmed = newUrl.trim();
    if (!trimmed || trimmed === currentUrl) return;

    await callAdmin('update-url', { id: link.id, url: trimmed });
    refreshAdminList();
  } catch (e) { alert("Failed to update URL: " + e.message); }
}

async function handleToggle(link) {
  try {
    await callAdmin('toggle', { id: link.id, visible: !link.visible });
    refreshAdminList();
  } catch (e) { alert("Failed to update: " + e.message); }
}

async function handleDelete(link) {
  if (!confirm(`Remove "${link.name}" from the list?`)) return;
  try {
    await callAdmin('delete', { id: link.id });
    refreshAdminList();
  } catch (e) { alert("Failed to delete: " + e.message); }
}

async function handleAdd() {
  const name = $('newLinkName').value.trim();
  const url  = $('newLinkUrl').value.trim();
  if (!name || !url) return alert("Please fill in both fields.");
  
  const btn = $('addLinkBtn');
  const original = btn.textContent;
  btn.disabled = true; btn.textContent = '⏳ Adding...';
  
  try {
    await callAdmin('add', { name, url });
    $('newLinkName').value = '';
    $('newLinkUrl').value  = '';
    refreshAdminList();
  } catch (e) {
    alert("Failed to add: " + e.message);
  } finally {
    btn.disabled = false; btn.textContent = original;
  }
}

async function handleReset() {
  if (!confirm("Reset all apps to defaults? This cannot be undone.")) return;
  const btn = $('resetBtn');
  const original = btn.textContent;
  btn.disabled = true; btn.textContent = '⏳ Resetting...';
  
  try {
    await callAdmin('reset');
    refreshAdminList();
  } catch (e) { alert("Reset failed: " + e.message); }
  finally { btn.disabled = false; btn.textContent = original; }
}

async function handleSeed() {
  const btn = $('seedBtn');
  const original = btn.textContent;
  btn.disabled = true; btn.textContent = '⏳ Seeding...';
  
  try {
    await callAdmin('seed');
    refreshAdminList();
  } catch (e) { alert("Seed failed: " + e.message); }
  finally { btn.disabled = false; btn.textContent = original; }
}

async function handleLogout() {
  if (refreshTimer) { clearInterval(refreshTimer); refreshTimer = null; }
  try { await auth.signOut(); } catch {}
  showLoginScreen();
  $('adminModal').style.display = 'none';
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

async function testSecureApi() {
  const btn = $('testApiBtn');
  const original = btn.textContent;
  btn.disabled = true; btn.textContent = '⏳ Testing...';
  
  try {
    const data = await callAdmin('test');
    alert(`✅ Backend reachable\n\nMessage: ${data.message}`);
  } catch (e) {
    alert(`❌ Backend failed: ${e.message}`);
  } finally {
    btn.disabled = false; btn.textContent = original;
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
$('addLinkBtn').addEventListener('click', handleAdd);
$('resetBtn').addEventListener('click', handleReset);
$('seedBtn').addEventListener('click', handleSeed);
$('logoutBtn').addEventListener('click', handleLogout);
$('testApiBtn').addEventListener('click', testSecureApi);

let tapCount = 0, tapTimer;
$('secretLogo').addEventListener('click', () => {
  tapCount++;
  clearTimeout(tapTimer);
  tapTimer = setTimeout(() => { tapCount = 0; }, 2000);
  if (tapCount >= 5) { tapCount = 0; adminModal.style.display = 'flex'; }
});

if (isConfigured) onAuthStateChanged(auth, handleAuthState);
