const admin = require('firebase-admin');

if (!admin.apps.length) {
  try {
    if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
      throw new Error("Missing FIREBASE_SERVICE_ACCOUNT in Netlify");
    }

    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

    if (serviceAccount.private_key) {
      serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
    }

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
  } catch (error) {
    console.error("INITIALIZATION FAILED:", error.message);
  }
}

const SUPERADMIN_EMAIL = (process.env.SUPERADMIN_EMAIL || '').trim().toLowerCase();
const SUPERADMIN_UID   = (process.env.SUPERADMIN_UID   || '').trim();
const APP_COLLECTION   = 'apps';

const DEFAULT_APPS = [
  { name: 'Cup N Care',         url: 'cupncare/index.html',     visible: true },
  { name: 'AHK Wellness',       url: 'ahk/index.html',          visible: true },
  { name: 'Abdul Hameed Kunhi', url: 'ahk/index.html',          visible: true },
  { name: 'Mi Gym App',         url: 'migym/index.html',        visible: true },
  { name: 'Profile Mi',         url: 'profilemi/index.html',    visible: true },
  { name: 'AHK Book World',     url: 'ahkbookworld/index.html', visible: true }
];

function json(statusCode, payload) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store'
    },
    body: JSON.stringify(payload)
  };
}

exports.handler = async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false;

  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

  if (!admin.apps.length) {
    return json(500, { error: 'Server Config Error: Firebase did not initialize. Check FIREBASE_SERVICE_ACCOUNT.' });
  }

  const authHeader = event.headers.authorization || event.headers.Authorization || '';
  const m = authHeader.match(/^Bearer (.+)$/);
  if (!m) return json(401, { error: 'Missing Auth Header' });

  let decoded;
  try {
    decoded = await admin.auth().verifyIdToken(m[1]);
  } catch (e) {
    return json(401, { error: `Token Error: ${e.message}` });
  }

  // --- Resolve email (fallbacks) ---
  let rawEmail = decoded.email;
  if (!rawEmail && decoded.firebase?.identities?.email) rawEmail = decoded.firebase.identities.email[0];
  if (!rawEmail && decoded.providerData && decoded.providerData.length > 0) {
    const p = decoded.providerData.find(x => x.email);
    if (p) rawEmail = p.email;
  }
  if (!rawEmail && decoded.uid) {
    try {
      const userRecord = await admin.auth().getUser(decoded.uid);
      rawEmail = userRecord.email;
    } catch (_) {}
  }

  const email              = (rawEmail || '').trim().toLowerCase();
  const isAuthorizedByEmail = email && email === SUPERADMIN_EMAIL;
  const isAuthorizedByUid   = SUPERADMIN_UID && decoded.uid === SUPERADMIN_UID;

  if (!isAuthorizedByEmail && !isAuthorizedByUid) {
    return json(403, { error: 'Access denied. This account is not authorized.' });
  }

  // --- Parse body ---
  let body = {};
  try { body = JSON.parse(event.body || '{}'); } catch {}
  const { action } = body;

  try {
    const db  = admin.firestore();
    const col = db.collection(APP_COLLECTION);

    switch (action) {
      case 'whoami':
        return json(200, { ok: true, email });

      case 'test':
        return json(200, { message: 'Secure backend online', email });

      case 'list': {
        const snap = await col.get();
        const apps = snap.docs
          .map(d => {
            const x = d.data();
            return {
              id: d.id,
              name: x.name || '',
              visible: !!x.visible,
              hasUrl: !!x.url,
              createdAt: x.createdAt || 0
            };
          })
          .sort((a, b) => a.createdAt - b.createdAt);
        return json(200, { apps });
      }

      case 'get-url': {
        if (!body.id) return json(400, { error: 'Missing id' });
        const doc = await col.doc(body.id).get();
        if (!doc.exists) return json(404, { error: 'Not found' });
        return json(200, { url: doc.data().url || '' });
      }

      case 'update-url': {
        const url = String(body.url || '').trim();
        if (!body.id || !url) return json(400, { error: 'Missing id or url' });
        await col.doc(body.id).update({ url });
        return json(200, { ok: true });
      }

      case 'add': {
        const name = String(body.name || '').trim();
        const url  = String(body.url  || '').trim();
        if (!name || !url) return json(400, { error: 'Missing name or url' });
        const ref = await col.add({
          name,
          nameLower: name.toLowerCase(),
          url,
          visible: true,
          createdAt: Date.now()
        });
        return json(200, { ok: true, id: ref.id });
      }

      case 'toggle': {
        if (!body.id) return json(400, { error: 'Missing id' });
        await col.doc(body.id).update({ visible: !!body.visible });
        return json(200, { ok: true });
      }

      case 'delete': {
        if (!body.id) return json(400, { error: 'Missing id' });
        await col.doc(body.id).delete();
        return json(200, { ok: true });
      }

      case 'reset': {
        const snap  = await col.get();
        const batch = db.batch();
        snap.docs.forEach(d => batch.delete(d.ref));
        await batch.commit();
        for (const a of DEFAULT_APPS) {
          await col.add({
            ...a,
            nameLower: a.name.toLowerCase(),
            createdAt: Date.now()
          });
        }
        return json(200, { ok: true });
      }

      case 'seed': {
        for (const a of DEFAULT_APPS) {
          await col.add({
            ...a,
            nameLower: a.name.toLowerCase(),
            createdAt: Date.now()
          });
        }
        return json(200, { ok: true });
      }

      default:
        return json(400, { error: 'Unknown action' });
    }
  } catch (e) {
    console.error('Database error:', e);
    return json(500, { error: 'Database error: ' + e.message });
  }
};
