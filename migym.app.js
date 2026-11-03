// ==========================================
// 1. FIREBASE INITIALIZATION & SECURE FETCH
// ==========================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// ⚠️ IMPORTANT: Replace this with your actual Firebase Config from Firebase Console
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// Secure Fetch Wrapper (Adds Bearer Token to every request)
async function secureFetch(endpoint, method = 'GET', body = null) {
  const user = auth.currentUser;
  if (!user) throw new Error("Not logged in");

  const token = await user.getIdToken(true); 
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };

  const res = await fetch(`/api/${endpoint}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : null
  });

  if (!res.ok) {
    let errData = { error: 'Request failed' };
    try { errData = await res.json(); } catch(e) {}
    throw new Error(errData.error || `HTTP ${res.status}`);
  }
  return res.json();
}

// ==========================================
// 2. STATE & UTILITIES
// ==========================================
const state = {
  role: 'guest', // 'guest', 'superadmin', 'gymowner', 'member'
  route: 'dashboard',
  query: '',
  cart: [],
  data: { gyms: [], members: [], products: [] } // Populated via API
};

const $ = (s, r=document) => r.querySelector(s);
const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));
const esc = s => String(s??'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money = n => 'Rs. ' + Number(n||0).toLocaleString('en-IN', {maximumFractionDigits:2});
const today = () => new Date().toISOString().split('T')[0];

function toast(msg, type='') {
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.textContent = msg;
  $('#toast').appendChild(t);
  setTimeout(() => t.remove(), 3000);
}

function closeModal() {
  $('#modalRoot').innerHTML = '';
}

// ==========================================
// 3. AUTHENTICATION & LOGIN
// ==========================================
$('#togglePwBtn').addEventListener('click', () => {
  const pw = $('#loginPw');
  pw.type = pw.type === 'password' ? 'text' : 'password';
});

$('#loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = e.target.email.value;
  const password = e.target.password.value;
  const btn = e.target.querySelector('button[type="submit"]');
  const errBox = $('#loginError');
  
  btn.disabled = true;
  btn.textContent = 'Signing in...';
  errBox.style.display = 'none';

  try {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    
    // In a real app, you would ask the backend for the user's role here
    // For this demo, we simulate the role based on the email
    if (email === 'cupncare@gmail.com') state.role = 'superadmin';
    else if (email.includes('gym')) state.role = 'gymowner';
    else state.role = 'member';
    
    $('#authRoot').style.display = 'none';
    $('#appRoot').style.display = 'grid';
    render();
  } catch (err) {
    errBox.textContent = err.message.replace('Firebase: ', '');
    errBox.style.display = 'block';
  } finally {
    btn.disabled = false;
    btn.textContent = 'Sign In';
  }
});

$('#btnLogout').addEventListener('click', () => {
  signOut(auth).then(() => {
    state.role = 'guest';
    $('#authRoot').style.display = 'flex';
    $('#appRoot').style.display = 'none';
    $('#loginForm').reset();
  });
});

onAuthStateChanged(auth, (user) => {
  if (!user) {
    $('#authRoot').style.display = 'flex';
    $('#appRoot').style.display = 'none';
  }
});

// ==========================================
// 4. VIEW RENDERERS
// ==========================================
const VIEWMETA = {
  'dashboard': { t: 'Dashboard', s: 'Your gym overview' },
  'members': { t: 'Members', s: 'Registrations & access control' },
  'products': { t: 'Shop', s: 'Inventory' },
  'm-home': { t: 'My Gym', s: 'Membership overview' }
};

function renderNav() {
  const navMap = {
    superadmin: [
      { id: 'dashboard', label: 'Platform', icon: 'grid' },
      { id: 'gyms', label: 'Gyms', icon: 'building' }
    ],
    gymowner: [
      { id: 'dashboard', label: 'Dashboard', icon: 'grid' },
      { id: 'members', label: 'Members', icon: 'users' },
      { id: 'products', label: 'Shop', icon: 'box' }
    ],
    member: [
      { id: 'm-home', label: 'Home', icon: 'grid' },
      { id: 'm-shop', label: 'Shop', icon: 'box' }
    ]
  };

  const list = navMap[state.role] || [];
  $('#nav').innerHTML = list.map(n => `
    <button class="ni ${state.route === n.id ? 'on' : ''}" data-nav="${n.id}">
      <span>${n.label}</span>
    </button>
  `).join('');

  $$('#nav .ni').forEach(btn => {
    btn.addEventListener('click', () => {
      state.route = btn.dataset.nav;
      render();
    });
  });
}

function renderFoot() {
  if(!auth.currentUser) return;
  $('#sfoot').innerHTML = `
    <div class="av" style="width:32px;height:32px;font-size:12px;background:linear-gradient(135deg,#4d9dff,#3ddc97)">${auth.currentUser.email[0].toUpperCase()}</div>
    <div class="who"><b>${esc(auth.currentUser.email.split('@')[0])}</b><span>${state.role}</span></div>
  `;
}

function statCard(lbl, val, ic, color) {
  return `<div class="stat"><div class="ic" style="color:${color}"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/></svg></div><div><div class="lbl">${lbl}</div><div class="val">${val}</div></div></div>`;
}

function viewDashboard() {
  return `
    <div class="grid g4">
      ${statCard('Members', '8', 'users', '#3ddc97')}
      ${statCard('Pending', '2', 'clock', '#ffb340')}
      ${statCard('Revenue', 'Rs. 1,200', 'dollar', '#c6ff3d')}
      ${statCard('Face Enrolled', '5', 'scan', '#4d9dff')}
    </div>
    <div class="card">
      <div class="ch"><h3>Recent Members</h3></div>
      <div class="tw">
        <table>
          <tbody>
            <tr>
              <td><div class="cm"><div class="av" style="width:32px;height:32px;background:#333">JD</div><div><div class="nm">John Doe</div><div class="em">Fat Loss</div></div></div></td>
              <td><span class="badge acc">Monthly</span></td>
              <td><span class="pill active">Active</span></td>
            </tr>
            <tr>
              <td><div class="cm"><div class="av" style="width:32px;height:32px;background:#444">AS</div><div><div class="nm">Alice Smith</div><div class="em">Muscle Gain</div></div></div></td>
              <td><span class="badge inf">Quarterly</span></td>
              <td><span class="pill pending">Pending</span></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function viewMembers() {
  return `
    <div class="card">
      <div class="ch">
        <h3>Members Directory</h3>
        <div class="sp"></div>
        <button class="btn acc" id="btnAddMember">+ Add Member</button>
      </div>
      <div class="tw">
        <table>
          <thead><tr><th>Member</th><th>Plan</th><th>Status</th></tr></thead>
          <tbody>
            <tr><td><div class="cm"><div class="av" style="width:32px;height:32px;background:#555">MK</div><div><div class="nm">Mike K.</div><div class="em">mike@test.com</div></div></div></td><td>Monthly</td><td><span class="pill active">Active</span></td></tr>
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function viewMHome() {
  return `
    <div class="ban inf">
      <div class="ic"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg></div>
      <div style="flex:1"><h3>Welcome to MiGym Secure</h3><p>Your account is currently in demo mode.</p></div>
    </div>
    <div class="grid g4">
      ${statCard('Days Left', '30', 'clock', '#c6ff3d')}
      ${statCard('Plan', 'Monthly', 'grid', '#4d9dff')}
      ${statCard('Face ID', 'Active', 'scan', '#3ddc97')}
      ${statCard('BMI', '22.5', 'trend', '#a78bfa')}
    </div>
  `;
}

function render() {
  renderNav();
  renderFoot();
  
  const meta = VIEWMETA[state.route] || { t: 'Dashboard', s: '' };
  $('#pgTitle').textContent = meta.t;
  $('#pgSub').textContent = meta.s;

  const views = {
    'dashboard': viewDashboard,
    'members': viewMembers,
    'm-home': viewMHome
  };

  const viewFn = views[state.route] || viewDashboard;
  $('#view').innerHTML = viewFn();

  // Re-bind dynamic buttons
  if (state.route === 'members') {
    $('#btnAddMember')?.addEventListener('click', () => {
      toast('Add member modal would open here');
    });
  }
}

// ==========================================
// 5. REGISTRATION MODALS
// ==========================================
$('#btnRegGym').addEventListener('click', () => {
  $('#modalRoot').innerHTML = `
    <div class="ov" id="modalBg">
      <div class="modal lg">
        <div class="mh">
          <h3>Register Your Gym</h3>
          <div class="sp"></div>
          <button class="ib" id="closeModalBtn">✕</button>
        </div>
        <form id="regGymForm">
          <div class="mb">
            <div class="fg">
              <div class="fl full"><label>Gym Name *</label><input class="inp" name="name" required></div>
              <div class="fl full"><label>Owner Email *</label><input class="inp" type="email" name="email" required></div>
              <div class="fl full"><label>Password *</label><input class="inp" type="password" name="password" required minlength="6"></div>
            </div>
            <div class="upi-box">
              <div class="upi-box-header">Platform Fee Payment</div>
              <div class="upi-amount">Rs. 500</div>
              <div class="upi-id">Pay to Superadmin: <strong>cupncare@upi</strong></div>
              <label class="paid-check" style="margin-top:16px">
                <input type="checkbox" required>
                <span>I have completed the payment of Rs. 500</span>
              </label>
            </div>
          </div>
          <div class="mf">
            <button type="button" class="btn gho" id="cancelModalBtn">Cancel</button>
            <button type="submit" class="btn acc">Submit Registration</button>
          </div>
        </form>
      </div>
    </div>
  `;
  bindModalEvents('#regGymForm', 'gym/register');
});

$('#btnRegMember').addEventListener('click', () => {
  $('#modalRoot').innerHTML = `
    <div class="ov" id="modalBg">
      <div class="modal lg">
        <div class="mh">
          <h3>Register as Member</h3>
          <div class="sp"></div>
          <button class="ib" id="closeModalBtn">✕</button>
        </div>
        <form id="regMemberForm">
          <div class="mb">
            <div class="fg">
              <div class="fl full"><label>Full Name *</label><input class="inp" name="name" required></div>
              <div class="fl full"><label>Email *</label><input class="inp" type="email" name="email" required></div>
              <div class="fl full"><label>Password *</label><input class="inp" type="password" name="password" required minlength="6"></div>
              <div class="fl"><label>Weight (kg)</label><input class="inp" type="number" name="weight" value="70" required></div>
              <div class="fl"><label>Plan</label><select class="inp" name="plan"><option value="monthly">Monthly</option><option value="yearly">Yearly</option></select></div>
            </div>
            <div class="upi-box">
              <div class="upi-box-header">Payment Required</div>
              <div class="upi-amount" id="memFee">Rs. 45</div>
              <label class="paid-check" style="margin-top:16px">
                <input type="checkbox" required>
                <span>I agree to pay this amount at the gym</span>
              </label>
            </div>
          </div>
          <div class="mf">
            <button type="button" class="btn gho" id="cancelModalBtn">Cancel</button>
            <button type="submit" class="btn acc">Create Account</button>
          </div>
        </form>
      </div>
    </div>
  `;
  
  // Update price dynamically
  const planSel = $('#regMemberForm [name="plan"]');
  planSel.addEventListener('change', () => {
    const price = planSel.value === 'monthly' ? '45' : '400';
    $('#memFee').textContent = `Rs. ${price}`;
  });

  bindModalEvents('#regMemberForm', 'member/register');
});

function bindModalEvents(formSelector, endpoint) {
  const closeFn = () => $('#modalRoot').innerHTML = '';
  $('#closeModalBtn')?.addEventListener('click', closeFn);
  $('#cancelModalBtn')?.addEventListener('click', closeFn);
  $('#modalBg')?.addEventListener('click', (e) => { if(e.target.id === 'modalBg') closeFn(); });

  $(formSelector).addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = 'Processing...';

    const fd = new FormData(e.target);
    const data = Object.fromEntries(fd.entries());
    data.weight = parseFloat(data.weight) || 70;

    try {
      // Send data securely to our BFF API
      await secureFetch(endpoint, 'POST', data);
      toast('Registration successful! Please sign in.');
      closeFn();
    } catch (err) {
      toast(err.message, 'err');
      btn.disabled = false;
      btn.textContent = 'Submit';
    }
  });
}
