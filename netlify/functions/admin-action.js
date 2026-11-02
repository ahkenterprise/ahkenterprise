const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId:   process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n')
    })
  });
}

const SUPERADMIN_EMAIL = (process.env.SUPERADMIN_EMAIL || '').trim().toLowerCase();
const SUPERADMIN_UID = (process.env.SUPERADMIN_UID || '').trim();

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method not allowed' };

  const authHeader = event.headers.authorization || event.headers.Authorization || '';
  const m = authHeader.match(/^Bearer (.+)$/);
  if (!m) return { statusCode: 401, body: JSON.stringify({ error: 'Missing Auth Header' }) };

  let decoded;
  try {
    decoded = await admin.auth().verifyIdToken(m[1]);
  } catch (e) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Invalid token' }) };
  }

  // Try to find the email (even if Google hides it)
  let rawEmail = decoded.email;
  if (!rawEmail && decoded.firebase?.identities?.email) rawEmail = decoded.firebase.identities.email[0];
  if (!rawEmail && decoded.providerData && decoded.providerData.length > 0) {
    const p = decoded.providerData.find(p => p.email);
    if (p) rawEmail = p.email;
  }
  if (!rawEmail && decoded.uid) {
    try {
      const userRecord = await admin.auth().getUser(decoded.uid);
      rawEmail = userRecord.email;
    } catch (err) {}
  }

  const email = (rawEmail || '').trim().toLowerCase();
  
  // 🔥 SECURE CHECK: Matches either the UID or the Email stored in Netlify
  const isAuthorizedByEmail = email && email === SUPERADMIN_EMAIL;
  const isAuthorizedByUid = SUPERADMIN_UID && decoded.uid === SUPERADMIN_UID;

  if (!isAuthorizedByEmail && !isAuthorizedByUid) {
    // ❌ GENERIC ERROR: Does not reveal your email or UID to hackers!
    return { 
      statusCode: 403, 
      body: JSON.stringify({ 
        error: 'Access denied. This account is not authorized.' 
      }) 
    };
  }

  // ✅ SUCCESS
  return { 
    statusCode: 200, 
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ok: true, message: 'Welcome Admin' }) 
  };
};
