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
const APP_COLLECTION = 'apps';

const DEFAULT_APPS = [
  { name: 'Cup N Care',         url: 'cupncare/index.html',  visible: true },
  { name: 'AHK Wellness',       url: 'ahk/index.html',       visible: true },
  { name: 'Abdul Hameed Kunhi', url: 'ahk/index.html',       visible: true },
  { name: 'Mi Gym App',         url: 'migym/index.html',     visible: true },
  { name: 'Profile Mi',         url: 'profilemi/index.html', visible: true },
  { name: 'AHK Book World',     url: 'ahkbookworld/index.html', visible: true }
];

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

  // 🔥 AUTHENTICATION CHECK
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
    return { statusCode: 403, body: JSON.stringify({ error: 'Access denied. This account is not authorized.' }) };
  }

  // --- DATABASE ACTIONS ---
  let body = {};
  try { body = JSON.parse(event.body || '{}'); } catch {}
  const { action } = body;
  const db  = admin.firestore();
  const col = db.collection(APP_COLLECTION);

  try {
    switch (action) {
      case 'whoami': return { statusCode: 200, body: JSON.stringify({ ok: true, email }) };
      case 'test':   return { statusCode: 200, body: JSON.stringify({ message: 'Secure backend online', email }) };

      case 'list': {
        const snap = await col.get();
        const apps = snap.docs.map(d => {
          const x = d.data();
          return { id: d.id, name: x.name || '', visible: !!x.visible, hasUrl: !!x.url, createdAt: x.createdAt || 0 };
        }).sort((a, b) => a.createdAt - b.createdAt);
        return { statusCode: 200, body: JSON.stringify({ apps }) };
      }

      case 'get-url': {
        if (!body.id) return { statusCode: 400, body: JSON.stringify({ error: 'Missing id' }) };
        const doc = await col.doc(body.id).get();
        if (!doc.exists) return { statusCode: 404, body: JSON.stringify({ error: 'Not found' }) };
        return { statusCode: 200, body: JSON.stringify({ url: doc.data().url || '' }) };
      }

      case 'update-url': {
        if (!body.id || !body.url) return { statusCode: 400, body: JSON.stringify({ error: 'Missing id or url' }) };
        await col.doc(body.id).update({ url: body.url.trim() });
        return { statusCode: 200, body: JSON.stringify({ ok: true }) };
      }

      case 'add': {
        const name = String(body.name || '').trim();
        const url  = String(body.url  || '').trim();
        if (!name || !url) return { statusCode: 400, body: JSON.stringify({ error: 'Missing name or url' }) };
        const ref = await col.add({ name, url, visible: true, createdAt: Date.now() });
        return { statusCode: 200, body: JSON.stringify({ ok: true, id: ref.id }) };
      }

      case 'toggle': {
        if (!body.id) return { statusCode: 400, body: JSON.stringify({ error: 'Missing id' }) };
        await col.doc(body.id).update({ visible: !!body.visible });
        return { statusCode: 200, body: JSON.stringify({ ok: true }) };
      }

      case 'delete': {
        if (!body.id) return { statusCode: 400, body: JSON.stringify({ error: 'Missing id' }) };
        await col.doc(body.id).delete();
        return { statusCode: 200, body: JSON.stringify({ ok: true }) };
      }

      case 'reset': {
        const snap  = await col.get();
        const batch = db.batch();
        snap.docs.forEach(d => batch.delete(d.ref));
        await batch.commit();
        for (const a of DEFAULT_APPS) await col.add({ ...a, createdAt: Date.now() });
        return { statusCode: 200, body: JSON.stringify({ ok: true }) };
      }

      case 'seed': {
        for (const a of DEFAULT_APPS) await col.add({ ...a, createdAt: Date.now() });
        return { statusCode: 200, body: JSON.stringify({ ok: true }) };
      }

      default: return { statusCode: 400, body: JSON.stringify({ error: 'Unknown action' }) };
    }
  } catch (e) {
    console.error(e);
    return { statusCode: 500, body: JSON.stringify({ error: 'Internal error' }) };
  }
};
