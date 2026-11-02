const admin = require('firebase-admin');

if (!admin.apps.length) {
  try {
    // 1. Get the JSON string from Netlify
    const serviceAccountString = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!serviceAccountString) {
      throw new Error("Missing FIREBASE_SERVICE_ACCOUNT environment variable.");
    }
    
    // 2. Parse it safely
    const serviceAccount = JSON.parse(serviceAccountString);
    
    // 3. Fix the newlines in the private key just in case Netlify broke them
    if (serviceAccount.private_key) {
      serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
    }

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
  } catch (error) {
    console.error("FIREBASE INIT ERROR:", error.message);
  }
}

const SUPERADMIN_EMAIL = (process.env.SUPERADMIN_EMAIL || '').trim().toLowerCase();
const SUPERADMIN_UID = (process.env.SUPERADMIN_UID || '').trim();

exports.handler = async (event, context) => {
  // 🔥 CRITICAL FIX FOR NETLIFY TIMEOUTS (502 ERRORS)
  context.callbackWaitsForEmptyEventLoop = false;

  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method not allowed' };

  // Check if Firebase initialized properly
  if (!admin.apps.length) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Server Config Error: Firebase did not initialize. Check JSON formatting.' }) };
  }

  const authHeader = event.headers.authorization || event.headers.Authorization || '';
  const m = authHeader.match(/^Bearer (.+)$/);
  if (!m) return { statusCode: 401, body: JSON.stringify({ error: 'Missing Auth Header' }) };

  let decoded;
  try {
    decoded = await admin.auth().verifyIdToken(m[1]);
  } catch (e) {
    return { statusCode: 401, body: JSON.stringify({ error: `Token Error: ${e.message}` }) };
  }

  const email = (decoded.email || '').toLowerCase();
  const isAuthorizedByEmail = email && email === SUPERADMIN_EMAIL;
  const isAuthorizedByUid = SUPERADMIN_UID && decoded.uid === SUPERADMIN_UID;

  if (!isAuthorizedByEmail && !isAuthorizedByUid) {
    return { statusCode: 403, body: JSON.stringify({ error: 'Access denied. This account is not authorized.' }) };
  }

  // --- DATABASE ACTIONS ---
  let body = {};
  try { body = JSON.parse(event.body || '{}'); } catch {}
  const { action } = body;
  
  try {
    const db  = admin.firestore();
    const col = db.collection('apps');

    switch (action) {
      case 'whoami': return { statusCode: 200, body: JSON.stringify({ ok: true, email }) };
      case 'list': {
        const snap = await col.get();
        const apps = snap.docs.map(d => ({ id: d.id, ...d.data() }))
                             .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
        return { statusCode: 200, body: JSON.stringify({ apps }) };
      }
      case 'add': {
        const ref = await col.add({ name: body.name, url: body.url, visible: true, createdAt: Date.now() });
        return { statusCode: 200, body: JSON.stringify({ ok: true, id: ref.id }) };
      }
      case 'delete': {
        await col.doc(body.id).delete();
        return { statusCode: 200, body: JSON.stringify({ ok: true }) };
      }
      // Add other actions (edit, toggle) here as needed...
      default: return { statusCode: 400, body: JSON.stringify({ error: 'Unknown action' }) };
    }
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Database error: ' + e.message }) };
  }
};
