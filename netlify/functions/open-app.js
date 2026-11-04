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

const APP_COLLECTION = 'apps';

// --- In-memory rate limiter (per instance; best-effort) ---
const rlMap     = new Map();
let   lastSweep = 0;

function rateLimit(ip, max, windowMs) {
  const now = Date.now();

  if (now - lastSweep > 300_000) {
    for (const [k, v] of rlMap) if (now > v.reset) rlMap.delete(k);
    lastSweep = now;
  }

  const entry = rlMap.get(ip);
  if (!entry || now > entry.reset) {
    rlMap.set(ip, { count: 1, reset: now + windowMs });
    return { ok: true };
  }
  if (entry.count >= max) return { ok: false };
  entry.count++;
  return { ok: true };
}

function redirect(location) {
  return {
    statusCode: 302,
    headers: { Location: location, 'Cache-Control': 'no-store' },
    body: ''
  };
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') return { statusCode: 405, body: 'Method not allowed' };

  const ip =
    event.headers['x-nf-client-connection-ip'] ||
    (event.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
    'unknown';

  if (!rateLimit(ip, 15, 60_000).ok) return redirect('/?err=ratelimit');

  const name = (event.queryStringParameters?.name || '').trim();
  if (!name || name.length < 2) return redirect('/?err=invalid');

  try {
    const db  = admin.firestore();
    const col = db.collection(APP_COLLECTION);

    const snap = await col
      .where('nameLower', '==', name.toLowerCase())
      .where('visible', '==', true)
      .limit(1)
      .get();

    if (snap.empty) {
      await new Promise(r => setTimeout(r, 120)); // timing obfuscation
      console.warn('open-app miss:', { ip, name });
      return redirect('/?err=notfound');
    }

    const rawUrl = (snap.docs[0].data().url || '').trim();

    // Reject empty or absolute/external URLs — internal paths only
    if (!rawUrl || /^https?:\/\//i.test(rawUrl)) {
      console.warn('open-app: invalid url blocked:', { ip, name });
      return redirect('/?err=invalid');
    }

    const dest = '/' + rawUrl.replace(/^\/+/, '');
    return redirect(dest);
  } catch (e) {
    console.error('Database error:', e);
    return redirect('/?err=server');
  }
};
