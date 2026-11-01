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

const SUPERADMIN_EMAIL = (process.env.SUPERADMIN_EMAIL || 'cupncare@gmail.com').toLowerCase();
const APP_COLLECTION   = 'apps';

const DEFAULT_APPS = [
  { name: 'Cup N Care',         url: 'cupncare/index.html',  visible: true },
  { name: 'AHK Wellness',       url: 'ahk/index.html',       visible: true },
  { name: 'Abdul Hameed Kunhi', url: 'ahk/index.html',       visible: true },
  { name: 'Mi Gym App',         url: 'migym/index.html',     visible: true },
  { name: 'Profile Mi',         url: 'profilemi/index.html', visible: true }
];

const rlMap = new Map();
function rateLimit(ip, max, windowMs) {
  const now   = Date.now();
  const entry = rlMap.get(ip);
  if (!entry || now > entry.reset) {
    rlMap.set(ip, { count: 1, reset: now + windowMs });
    return { ok: true };
  }
  if (entry.count >= max) return { ok: false };
  entry.count++;
  return { ok: true };
}

function json(statusCode, obj) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff'
    },
    body: JSON.stringify(obj)
  };
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

  const ip = (event.headers['x-forwarded-for'] || '').split(',')[0].trim()
          || event.headers['client-ip']
          || 'unknown';
  if (!rateLimit(ip, 60, 60_000).ok) return json(429, { error: 'Too many requests.' });

  const authHeader = event.headers.authorization || event.headers.Authorization || '';
  const m = authHeader.match(/^Bearer (.+)$/);
  if (!m) return json(401, { error: 'Missing Authorization header' });

  let decoded;
  try {
    // 🔥 FIX: Removed the second parameter (true) to prevent Netlify timeouts
    decoded = await admin.auth().verifyIdToken(m[1]);
  } catch (e) {
    return json(401, { error: 'Invalid or expired token' });
  }

  const email = (decoded.email || '').toLowerCase();
  if (email !== SUPERADMIN_EMAIL) return json(403, { error: 'Forbidden' });

  let body = {};
  try { body = JSON.parse(event.body || '{}'); } catch {}
  const { action } = body;
  const db  = admin.firestore();
  const col = db.collection(APP_COLLECTION);

  try {
    switch (action) {
      case 'whoami': return json(200, { ok: true, email });
      case 'test':   return json(200, { message: 'Secure backend online', email });

      case 'list': {
        const snap = await col.get();
        const apps = snap.docs.map(d => {
          const x = d.data();
          return {
            id: d.id,
            name: x.name || '',
            visible: !!x.visible,
            hasUrl: !!x.url,
            createdAt: x.createdAt || 0
          };
        }).sort((a, b) => a.createdAt - b.createdAt);
        return json(200, { apps });
      }

      case 'get-url': {
        if (!body.id) return json(400, { error: 'Missing id' });
        const doc = await col.doc(body.id).get();
        if (!doc.exists) return json(404, { error: 'Not found' });
        return json(200, { url: doc.data().url || '' });
      }

      case 'update-url': {
        if (!body.id || typeof body.url !== 'string' || !body.url.trim())
          return json(400, { error: 'Missing id or url' });
        await col.doc(body.id).update({ url: body.url.trim() });
        return json(200, { ok: true });
      }

      case 'add': {
        const name = String(body.name || '').trim();
        const url  = String(body.url  || '').trim();
        if (!name || !url) return json(400, { error: 'Missing name or url' });
        const ref = await col.add({ name, url, visible: true, createdAt: Date.now() });
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
        for (const a of DEFAULT_APPS) await col.add({ ...a, createdAt: Date.now() });
        return json(200, { ok: true });
      }

      case 'seed': {
        for (const a of DEFAULT_APPS) await col.add({ ...a, createdAt: Date.now() });
        return json(200, { ok: true });
      }

      default: return json(400, { error: 'Unknown action' });
    }
  } catch (e) {
    console.error(e);
    return json(500, { error: 'Internal error' });
  }
};
