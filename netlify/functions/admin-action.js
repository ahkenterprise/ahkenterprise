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

  // 🔥 Try to find the email in every possible place Google might put it
  let rawEmail = decoded.email;
  if (!rawEmail && decoded.firebase?.identities?.email) {
    rawEmail = decoded.firebase.identities.email[0];
  }
  if (!rawEmail && decoded.providerData && decoded.providerData.length > 0) {
    const provider = decoded.providerData.find(p => p.email);
    if (provider) rawEmail = provider.email;
  }

  const email = (rawEmail || '').trim().toLowerCase();
  
  if (email !== SUPERADMIN_EMAIL) {
    return { 
      statusCode: 403, 
      body: JSON.stringify({ 
        error: `Access Denied!\n\nGoogle Account: [${email}]\nNetlify Variable: [${SUPERADMIN_EMAIL}]` 
      }) 
    };
  }

  return { 
    statusCode: 200, 
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ok: true, message: 'Welcome Admin' }) 
  };
};
