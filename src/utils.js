// KC Toolbox — Utility Functions

export const pad2 = n => String(n).padStart(2, '0');

export const toSeconds = (h, m, s) => (parseInt(h)||0)*3600 + (parseInt(m)||0)*60 + (parseInt(s)||0);

export const fromSeconds = (total) => ({
  h: Math.floor(total / 3600),
  m: Math.floor((total % 3600) / 60),
  s: total % 60,
});

export const formatTime = (secs) => {
  const { h, m, s } = fromSeconds(Math.max(0, secs));
  return h > 0 ? `${pad2(h)}:${pad2(m)}:${pad2(s)}` : `${pad2(m)}:${pad2(s)}`;
};

export const formatDateTime = (dt) => {
  if (!dt) return '';
  return new Date(dt).toLocaleString('zh-TW', { month:'numeric', day:'numeric', hour:'2-digit', minute:'2-digit' });
};

// Sound synthesis via Web Audio API
let _actx = null;
const actx = () => {
  if (!_actx) _actx = new (window.AudioContext || window.webkitAudioContext)();
  return _actx;
};

export const playSound = (type = 'bell') => {
  try {
    const ctx = actx();
    const g = ctx.createGain();
    g.connect(ctx.destination);

    if (type === 'bell') {
      [0, 0.1, 0.2].forEach(delay => {
        const o = ctx.createOscillator();
        o.type = 'sine';
        o.frequency.value = 880;
        o.connect(g);
        g.gain.setValueAtTime(0.4, ctx.currentTime + delay);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + 0.6);
        o.start(ctx.currentTime + delay);
        o.stop(ctx.currentTime + delay + 0.6);
      });
    } else if (type === 'beep') {
      const o = ctx.createOscillator();
      o.type = 'square';
      o.frequency.value = 660;
      o.connect(g);
      g.gain.setValueAtTime(0.3, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      o.start(); o.stop(ctx.currentTime + 0.3);
    } else if (type === 'alarm') {
      let t = ctx.currentTime;
      for (let i = 0; i < 6; i++) {
        const o = ctx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.setValueAtTime(440 + (i % 2) * 220, t);
        o.connect(g);
        g.gain.setValueAtTime(0.25, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
        o.start(t); o.stop(t + 0.2);
        t += 0.22;
      }
    }
  } catch(e) {}
};

// Simple markdown to HTML (subset)
export const mdToHtml = (md = '') => {
  if (!md) return '';
  return md
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>')
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/^(?!<[hul])(.+)$/gm, '<p>$1</p>')
    .replace(/<p><\/p>/g, '');
};

// Parse CSV / newline text for queue import
export const parseNameList = (text) => {
  return text.split(/[\n,]+/)
    .map(s => s.trim())
    .filter(Boolean);
};

// Generate a short readable room code
export const genCode = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({length: 6}, () => chars[Math.floor(Math.random() * chars.length)]).join('');
};

// Word frequency map
export const wordFrequency = (entries) => {
  const freq = {};
  entries.forEach(e => {
    const key = e.trim().toLowerCase();
    if (key) freq[key] = (freq[key] || 0) + 1;
  });
  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .map(([word, count]) => ({ word, count }));
};

// Badge color assignment (deterministic, no custom colors)
const BADGE_COLORS = ['teal', 'amber', 'info', 'success', 'danger', 'neutral'];
export const badgeColor = (str) => {
  let h = 0;
  for (const c of str) h = (h * 31 + c.charCodeAt(0)) & 0xffff;
  return BADGE_COLORS[h % BADGE_COLORS.length];
};

// Export to CSV
export const exportCSV = (rows, filename) => {
  const csv = rows.map(r =>
    r.map(cell => {
      const s = String(cell ?? '').replace(/"/g, '""');
      return /[,"\n]/.test(s) ? `"${s}"` : s;
    }).join(',')
  ).join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename + '.csv';
  a.click();
  URL.revokeObjectURL(a.href);
};

// Deep clone
export const clone = obj => JSON.parse(JSON.stringify(obj));

// Clamp
export const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
