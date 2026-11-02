const admin = require('firebase-admin');

if (!admin.apps.length) {
  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
  } catch (error) {
    console.error("Error parsing Firebase credentials", error);
  }
}

const SUPERADMIN_EMAIL = (process.env.SUPERADMIN_EMAIL || '').trim().toLowerCase();
const SUPERADMIN_UID = (process.env.SUPERADMIN_UID || '').trim();
const APP_COLLECTION = 'apps';

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method not allowed' };

  const authHeader = event.headers.authorization || event.headers.Authorization || '';
  const m = authHeader.match(/^Bearer (.+)$/);
  if (!m) return { statusCode: 401, body: JSON.stringify({ error: 'Missing Auth Header' }) };

  let decoded;
  try {
    // 🔥 We removed the 'true' check and are showing the exact error if it fails
    decoded = await admin.auth().verifyIdToken(m[1]);
  } catch (e) {
    return { statusCode: 401, body: JSON.stringify({ error: `Token Error: ${e.message}` }) };
  }

  // Try to find the email
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
  const isAuthorizedByEmail = email && email === SUPERADMIN_EMAIL;
  const isAuthorizedByUid = SUPERADMIN_UID && decoded.uid === SUPERADMIN_UID;

  if (!isAuthorizedByEmail && !isAuthorizedByUid) {
    return { statusCode: 403, body: JSON.stringify({ error: 'Access denied.' }) };
  }

  // Handle basic action request
  return { 
    statusCode: 200, 
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ok: true, message: 'Welcome Admin', email }) 
  };
};
