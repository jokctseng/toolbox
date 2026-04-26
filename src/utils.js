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

const escapeHtml = (text = '') => String(text)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;');

const inlineMd = (text = '') => escapeHtml(text)
  .replace(/==(.+?)==/g, '<mark>$1</mark>')
  .replace(/\+\+(.+?)\+\+/g, '<u>$1</u>')
  .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  .replace(/\*(.+?)\*/g, '<em>$1</em>')
  .replace(/`(.+?)`/g, '<code>$1</code>')
  .replace(/\[(.+?)\]\((https?:\/\/.+?)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');

// Markdown to HTML for workshop rules/resources. Supports headings, nested lists,
// task lists, blockquotes, highlight (==text==), underline (++text++), and links.
export const mdToHtml = (md = '') => {
  if (!md) return '';
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  const out = [];
  const stack = [];
  let paragraph = [];
  let quote = false;

  const closeParagraph = () => {
    if (!paragraph.length) return;
    out.push(`<p>${inlineMd(paragraph.join(' '))}</p>`);
    paragraph = [];
  };
  const closeListsTo = (level = -1) => {
    while (stack.length > level + 1) out.push(`</${stack.pop()}>`);
  };
  const closeQuote = () => {
    if (quote) {
      closeParagraph();
      closeListsTo();
      out.push('</blockquote>');
      quote = false;
    }
  };

  lines.forEach(raw => {
    const line = raw.replace(/\s+$/, '');
    if (!line.trim()) {
      closeParagraph();
      closeListsTo();
      closeQuote();
      return;
    }

    const quoteMatch = line.match(/^>\s?(.*)$/);
    const contentLine = quoteMatch ? quoteMatch[1] : line;
    if (quoteMatch && !quote) {
      closeParagraph();
      closeListsTo();
      out.push('<blockquote>');
      quote = true;
    }
    if (!quoteMatch) closeQuote();

    const heading = contentLine.match(/^(#{1,4})\s+(.+)$/);
    if (heading) {
      closeParagraph();
      closeListsTo();
      const level = heading[1].length;
      out.push(`<h${level}>${inlineMd(heading[2])}</h${level}>`);
      return;
    }

    const list = contentLine.match(/^(\s*)([-*]|\d+\.)\s+(\[[ xX]\]\s+)?(.+)$/);
    if (list) {
      closeParagraph();
      const level = Math.floor(list[1].replace(/\t/g, '  ').length / 2);
      const type = /^\d+\./.test(list[2]) ? 'ol' : 'ul';
      while (stack.length > level && stack[stack.length - 1] !== type) out.push(`</${stack.pop()}>`);
      while (stack.length <= level) {
        stack.push(type);
        out.push(`<${type}>`);
      }
      const task = list[3];
      const checked = task && /\[[xX]\]/.test(task);
      const checkbox = task ? `<input type="checkbox" disabled ${checked ? 'checked' : ''}> ` : '';
      out.push(`<li>${checkbox}${inlineMd(list[4])}</li>`);
      return;
    }

    closeListsTo();
    paragraph.push(contentLine.trim());
  });

  closeParagraph();
  closeListsTo();
  closeQuote();
  return `<div class="markdown-body">${out.join('\n')}</div>`;
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
