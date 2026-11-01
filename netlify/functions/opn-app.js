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

const APP_COLLECTION = 'apps';

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

function redirect(location) {
  return {
    statusCode: 302,
    headers: { Location: location, 'Cache-Control': 'no-store' },
    body: ''
  };
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') return { statusCode: 405, body: 'Method not allowed' };

  const ip = (event.headers['x-forwarded-for'] || '').split(',')[0].trim()
          || event.headers['client-ip']
          || 'unknown';
  if (!rateLimit(ip, 15, 60_000).ok) return redirect('/?err=ratelimit');

  const name = (event.queryStringParameters?.name || '').trim();
  if (!name || name.length < 2) return redirect('/?err=invalid');

  try {
    const db  = admin.firestore();
    const col = db.collection(APP_COLLECTION);

    const snap = await col
      .where('name', '==', name)
      .where('visible', '==', true)
      .limit(1)
      .get();

    if (snap.empty) {
      await new Promise(r => setTimeout(r, 120));
      console.warn('open-app miss:', { ip, name });
      return redirect('/?err=notfound');
    }

    const url  = snap.docs[0].data().url || '';
    const dest = /^https?:\/\//i.test(url) ? url : '/' + url.replace(/^\/+/, '');
    return redirect(dest);
  } catch (e) {
    console.error(e);
    return redirect('/?err=server');
  }
};
