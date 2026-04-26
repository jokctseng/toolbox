// KC Toolbox — Data Store
// Demo: localStorage + BroadcastChannel (same browser)
// Production: Replace with Supabase (see README for instructions)

const PFX = 'kc_';

export const db = {
  get: (key, def = null) => {
    try {
      const v = localStorage.getItem(PFX + key);
      return v !== null ? JSON.parse(v) : def;
    } catch { return def; }
  },
  set: (key, val) => {
    try { localStorage.setItem(PFX + key, JSON.stringify(val)); return true; }
    catch { return false; }
  },
  del: (key) => { try { localStorage.removeItem(PFX + key); } catch {} },
  keys: (prefix = '') => {
    try {
      return Object.keys(localStorage)
        .filter(k => k.startsWith(PFX + prefix))
        .map(k => k.slice(PFX.length));
    } catch { return []; }
  },
  clear: (prefix = '') => {
    db.keys(prefix).forEach(k => db.del(k));
  },
};

// BroadcastChannel for cross-tab real-time sync
let _channel = null;
const getChannel = () => {
  if (!_channel && typeof BroadcastChannel !== 'undefined') {
    _channel = new BroadcastChannel('kc_sync');
  }
  return _channel;
};

export const broadcast = (type, payload) => {
  getChannel()?.postMessage({ type, payload, ts: Date.now() });
};

export const onBroadcast = (handler) => {
  const ch = getChannel();
  if (!ch) return () => {};
  const h = (e) => handler(e.data);
  ch.addEventListener('message', h);
  return () => ch.removeEventListener('message', h);
};

// OTP system (client-side, hash-based)
const OTP_KEY = 'otp_store';

async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256',
    new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function generateOTP(namespace = 'default') {
  const code = String(Math.floor(100000 + Math.random() * 900000));
  const hash = await sha256(code + namespace);
  const expiry = Date.now() + 24 * 60 * 60 * 1000; // 24h
  const store = db.get(OTP_KEY, {});
  store[namespace] = { hash, expiry };
  db.set(OTP_KEY, store);
  return code; // Only show to admin generating it
}

export async function verifyOTP(code, namespace = 'default') {
  const store = db.get(OTP_KEY, {});
  const entry = store[namespace];
  if (!entry || Date.now() > entry.expiry) return false;
  const hash = await sha256(code + namespace);
  return hash === entry.hash;
}

export function checkSession(namespace = 'default') {
  const sessions = db.get('sessions', {});
  const s = sessions[namespace];
  if (!s) return false;
  if (Date.now() > s.expiry) {
    delete sessions[namespace];
    db.set('sessions', sessions);
    return false;
  }
  return true;
}

export function createSession(namespace = 'default') {
  const sessions = db.get('sessions', {});
  sessions[namespace] = { expiry: Date.now() + 8 * 60 * 60 * 1000 }; // 8h session
  db.set('sessions', sessions);
}

export function destroySession(namespace = 'default') {
  const sessions = db.get('sessions', {});
  delete sessions[namespace];
  db.set('sessions', sessions);
}

// Unique ID generator
export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

// Auto-archive Q&A activities (10 days after end)
export function checkAndArchive() {
  const activities = db.get('qa_activities', []);
  const now = Date.now();
  let changed = false;
  activities.forEach(a => {
    if (!a.archived && a.endTime && (now - new Date(a.endTime).getTime()) > 10 * 24 * 60 * 60 * 1000) {
      a.archived = true;
      changed = true;
    }
  });
  if (changed) db.set('qa_activities', activities);
}
