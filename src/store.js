// KC Toolbox — Data Store
// Default: localStorage + BroadcastChannel.
// Production: add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to enable
// cross-device sync through the kc_store table described in README.md.

import { supabase, hasSupabaseConfig } from './supabaseClient.js';

const PFX = 'kc_';
const TABLE = 'kc_store';

const local = {
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
};

const remoteEventName = 'kc_remote_sync';
const localEventName = 'kc_local_broadcast';
let remoteReady = false;

const emitRemoteSync = (key = '') => {
  window.dispatchEvent(new CustomEvent(remoteEventName, { detail: { key } }));
};

const pullRemote = async () => {
  if (!supabase) return;
  const { data, error } = await supabase.from(TABLE).select('key,value');
  if (error) {
    console.warn('[KC Toolbox] Supabase pull failed:', error.message);
    return;
  }
  data?.forEach(row => local.set(row.key, row.value));
  remoteReady = true;
  emitRemoteSync();
};

const pushRemote = async (key, value) => {
  if (!supabase) return;
  const { error } = await supabase
    .from(TABLE)
    .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' });
  if (error) console.warn('[KC Toolbox] Supabase push failed:', error.message);
};

const deleteRemote = async (key) => {
  if (!supabase) return;
  const { error } = await supabase.from(TABLE).delete().eq('key', key);
  if (error) console.warn('[KC Toolbox] Supabase delete failed:', error.message);
};

if (hasSupabaseConfig) {
  pullRemote();
  supabase
    .channel('kc-store-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: TABLE }, payload => {
      const key = payload.new?.key || payload.old?.key;
      if (!key) return;
      if (payload.eventType === 'DELETE') local.del(key);
      else local.set(key, payload.new.value);
      emitRemoteSync(key);
    })
    .subscribe(status => {
      if (status === 'SUBSCRIBED' && !remoteReady) pullRemote();
    });
}

export const db = {
  get: (key, def = null) => {
    return local.get(key, def);
  },
  set: (key, val) => {
    const ok = local.set(key, val);
    if (ok) pushRemote(key, val);
    return ok;
  },
  del: (key) => { local.del(key); deleteRemote(key); },
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
  const message = { type, payload, ts: Date.now() };
  getChannel()?.postMessage(message);
  window.dispatchEvent(new CustomEvent(localEventName, { detail: message }));
};

export const onBroadcast = (handler) => {
  const ch = getChannel();
  const onRemoteSync = (event) => {
    const key = event.detail?.key || '';
    handler({ type: 'remote_sync', payload: key, ts: Date.now() });
    if (!key || key.startsWith('qa_')) handler({ type: 'qa_update', payload: key, ts: Date.now() });
    if (!key || key.startsWith('co_')) handler({ type: 'co_update', payload: key, ts: Date.now() });
    if (!key || key === 'queue') handler({ type: 'queue_update', payload: db.get('queue'), ts: Date.now() });
  };
  window.addEventListener(remoteEventName, onRemoteSync);
  const onLocalBroadcast = (event) => handler(event.detail);
  window.addEventListener(localEventName, onLocalBroadcast);
  if (!ch) return () => {
    window.removeEventListener(remoteEventName, onRemoteSync);
    window.removeEventListener(localEventName, onLocalBroadcast);
  };
  const h = (e) => handler(e.data);
  ch.addEventListener('message', h);
  return () => {
    ch.removeEventListener('message', h);
    window.removeEventListener(remoteEventName, onRemoteSync);
    window.removeEventListener(localEventName, onLocalBroadcast);
  };
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
  const bytes = new Uint32Array(1);
  crypto.getRandomValues(bytes);
  const code = String(100000 + (bytes[0] % 900000));
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
