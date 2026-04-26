import React, { useState, useEffect, useRef } from 'react';
import { db, uid, onBroadcast, broadcast } from '../store.js';
import { mdToHtml, badgeColor, clone, exportCSV } from '../utils.js';
import { Btn, Card, Badge, Tabs, Modal, Spinner, Empty, Progress } from '../components/UI.jsx';
import { useLang } from '../App.jsx';

// ─── helpers ──────────────────────────────────────────────────────────────────
function loadActivities() { return db.get('co_activities', []); }

function saveActivity(act) {
  const list = loadActivities();
  const idx = list.findIndex(a => a.id === act.id);
  if (idx >= 0) list[idx] = act; else list.push(act);
  db.set('co_activities', list);
  broadcast('co_update', {});
}

function useCoActivity(actId) {
  const [act, setAct] = useState(() => loadActivities().find(a => a.id === actId) || null);
  useEffect(() => {
    const unsub = onBroadcast(({ type }) => {
      if (type === 'co_update') setAct(loadActivities().find(a => a.id === actId) || null);
    });
    return unsub;
  }, [actId]);
  return [act, setAct];
}

// ─── Join / Cover ─────────────────────────────────────────────────────────────
function JoinScreen({ onJoin, lang }) {
  const [code, setCode] = useState(() => new URLSearchParams((window.location.hash.split('?')[1] || '')).get('code') || '');
  const [err, setErr] = useState('');

  const join = () => {
    const acts = loadActivities();
    const act = acts.find(a => a.code?.toUpperCase() === code.trim().toUpperCase() && !a.archived);
    if (!act) { setErr(lang === 'zh' ? '找不到此活動或已封存' : 'Activity not found or archived'); return; }
    onJoin(act);
  };

  return (
    <div style={{ maxWidth: 400, margin: '60px auto', padding: 20 }}>
      <Card>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>🌐</div>
          <h2 style={{ fontSize: 20 }}>{lang === 'zh' ? '加入共創工作站' : 'Join Co-creation Station'}</h2>
        </div>
        <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>
          {lang === 'zh' ? '活動代碼' : 'Activity Code'}
        </label>
        <input value={code} onChange={e => setCode(e.target.value.toUpperCase())}
          onKeyDown={e => e.key === 'Enter' && join()}
          placeholder="XXXXXX" maxLength={8}
          style={{
            width: '100%', padding: '10px 14px', fontSize: 22, fontWeight: 700,
            letterSpacing: 4, textAlign: 'center', textTransform: 'uppercase',
            background: 'var(--surface-2)', border: '1px solid var(--border)',
            borderRadius: 8, color: 'var(--text)',
          }} />
        {err && <p style={{ color: 'var(--danger)', fontSize: 13, marginTop: 8 }}>{err}</p>}
        <Btn onClick={join} style={{ width: '100%', justifyContent: 'center', marginTop: 14 }}>
          {lang === 'zh' ? '進入 →' : 'Enter →'}
        </Btn>
      </Card>
    </div>
  );
}

function MarkdownToolbar({ onInsert, lang }) {
  const tools = [
    ['**', 'B', '**粗體**'],
    ['- ', '•', '- 列點'],
    ['- [ ] ', '☐', '- [ ] 待辦'],
    ['==', 'HL', '==高亮=='],
    ['++', 'U', '++底線++'],
    ['> ', '“', '> 引言'],
  ];
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
      {tools.map(([token, label, sample]) => (
        <button key={label} type="button" title={sample} onClick={() => onInsert(token)}
          style={{ minWidth: 30, height: 28, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text)', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
          {label}
        </button>
      ))}
      <span style={{ fontSize: 12, color: 'var(--text-3)', alignSelf: 'center' }}>
        {lang === 'zh' ? '支援 Markdown' : 'Markdown'}
      </span>
    </div>
  );
}

// ─── Resources Tab ────────────────────────────────────────────────────────────
function ResourcesTab({ act, lang }) {
  const [expanded, setExpanded] = useState({});
  const resources = act.resources || [];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {resources.length === 0 ? <Empty>{lang === 'zh' ? '尚無參考資料' : 'No resources yet'}</Empty> : (
        resources.map((r, i) => (
          <Card key={i} style={{ padding: '14px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
              <div style={{ flex: 1 }}>
                {r.type && <Badge color={badgeColor(r.type)} style={{ marginBottom: 6 }}>{r.type}</Badge>}
                <h4 style={{ fontSize: 15, marginBottom: 4 }}>{r.name}</h4>
                {expanded[i] && r.desc && (
                  <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6 }}>{r.desc}</p>
                )}
              </div>
              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                {r.desc && (
                  <Btn size="sm" variant="ghost" onClick={() => setExpanded(e => ({ ...e, [i]: !e[i] }))}>
                    {expanded[i] ? '▲' : '▼'}
                  </Btn>
                )}
                {r.url && (
                  <a href={r.url} target="_blank" rel="noopener noreferrer">
                    <Btn size="sm">↗ {lang === 'zh' ? '開啟' : 'Open'}</Btn>
                  </a>
                )}
              </div>
            </div>
          </Card>
        ))
      )}
    </div>
  );
}

// ─── Shared Notes Tab ─────────────────────────────────────────────────────────
function NotesTab({ act, userId, nick, lang }) {
  const [text, setText] = useState('');
  const [groupSel, setGroupSel] = useState('all');
  const [replyTo, setReplyTo] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [noteGroup, setNoteGroup] = useState(act.groups?.[0]?.name || '');

  const notes = db.get(`co_notes_${act.id}`, []);
  const [localNotes, setLocalNotes] = useState(notes);

  useEffect(() => {
    const unsub = onBroadcast(({ type }) => {
      if (type === 'co_update') setLocalNotes(db.get(`co_notes_${act.id}`, []));
    });
    return unsub;
  }, [act.id]);

  const saveNote = (note) => {
    const list = db.get(`co_notes_${act.id}`, []);
    const idx = list.findIndex(n => n.id === note.id);
    if (idx >= 0) list[idx] = note; else list.push(note);
    db.set(`co_notes_${act.id}`, list);
    broadcast('co_update', {});
    setLocalNotes(list);
  };

  const submit = () => {
    if (!text.trim()) return;
    saveNote({ id: uid(), userId, nick, text: text.trim(), likes: 0, group: noteGroup, ts: Date.now(), replies: [], hidden: false });
    setText('');
  };
  const insertMarkdown = (token) => setText(v => {
    if (token === '**') return `${v}**${lang === 'zh' ? '粗體' : 'bold'}**`;
    if (token === '==') return `${v}==${lang === 'zh' ? '高亮' : 'highlight'}==`;
    if (token === '++') return `${v}++${lang === 'zh' ? '底線' : 'underline'}++`;
    return `${v}${v.endsWith('\n') || !v ? '' : '\n'}${token}`;
  });

  const submitReply = (parentId) => {
    if (!replyText.trim()) return;
    const list = db.get(`co_notes_${act.id}`, []);
    const note = list.find(n => n.id === parentId);
    if (!note) return;
    note.replies = [...(note.replies || []), { id: uid(), userId, nick, text: replyText.trim(), ts: Date.now() }];
    db.set(`co_notes_${act.id}`, list);
    broadcast('co_update', {});
    setLocalNotes(db.get(`co_notes_${act.id}`, []));
    setReplyTo(null);
    setReplyText('');
  };

  const toggleLike = (id) => {
    const list = db.get(`co_notes_${act.id}`, []);
    const note = list.find(n => n.id === id);
    if (!note) return;
    const liked = (note.likedBy || []).includes(userId);
    note.likedBy = liked ? note.likedBy.filter(u => u !== userId) : [...(note.likedBy || []), userId];
    note.likes = (note.likedBy || []).length;
    db.set(`co_notes_${act.id}`, list);
    broadcast('co_update', {});
    setLocalNotes(db.get(`co_notes_${act.id}`, []));
  };

  const hasGroups = act.groupsEnabled && (act.groups || []).length > 0;
  const groupTabs = hasGroups ? [
    { key: 'all', label: lang === 'zh' ? '全部' : 'All' },
    ...(act.groups || []).map(g => ({ key: g.name, label: g.name })),
    { key: '__other__', label: lang === 'zh' ? '其他' : 'Other' },
  ] : [];

  const visible = localNotes
    .filter(n => !n.hidden)
    .filter(n => {
      if (!hasGroups || groupSel === 'all') return true;
      if (groupSel === '__other__') return !n.group || !(act.groups || []).map(g => g.name).includes(n.group);
      return n.group === groupSel;
    })
    .sort((a, b) => (b.likes || 0) - (a.likes || 0));

  return (
    <div>
      {hasGroups && (
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 8, marginBottom: 14 }}>
          {groupTabs.map(t => (
            <button key={t.key} onClick={() => setGroupSel(t.key)}
              style={{
                padding: '5px 12px', borderRadius: 20, border: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
                fontSize: 13, fontWeight: groupSel === t.key ? 700 : 400,
                background: groupSel === t.key ? 'var(--accent)' : 'var(--surface-2)',
                color: groupSel === t.key ? '#fff' : 'var(--text-2)',
              }}>{t.label}</button>
          ))}
        </div>
      )}

      <Card style={{ marginBottom: 16 }}>
        <MarkdownToolbar onInsert={insertMarkdown} lang={lang} />
        <textarea value={text} onChange={e => setText(e.target.value)} rows={3}
          placeholder={lang === 'zh' ? '輸入留言…' : 'Write a note…'}
          style={{ width: '100%', padding: '8px 12px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 14, color: 'var(--text)', resize: 'none' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, gap: 10, flexWrap: 'wrap' }}>
          {hasGroups && (
            <select value={noteGroup} onChange={e => setNoteGroup(e.target.value)}
              style={{ padding: '5px 10px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 13, color: 'var(--text)', flex: 1, maxWidth: 180 }}>
              <option value="">{lang === 'zh' ? '選擇分組' : 'Select group'}</option>
              {(act.groups || []).map(g => <option key={g.name} value={g.name}>{g.name}</option>)}
            </select>
          )}
          <Btn onClick={submit}>{lang === 'zh' ? '送出' : 'Submit'}</Btn>
        </div>
      </Card>

      {visible.length === 0 && <Empty>{lang === 'zh' ? '尚無留言' : 'No notes yet'}</Empty>}
      {visible.map(n => (
        <Card key={n.id} style={{ marginBottom: 10 }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', gap: 8, marginBottom: 4, flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>{n.nick}</span>
                {n.group && <Badge color={badgeColor(n.group)}>{n.group}</Badge>}
                <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{new Date(n.ts).toLocaleTimeString()}</span>
              </div>
              <div style={{ fontSize: 14, lineHeight: 1.6 }} dangerouslySetInnerHTML={{ __html: mdToHtml(n.text) }} />
              {n.adminFeedback && (
                <div style={{ marginTop: 8, padding: '8px 10px', background: 'var(--accent-light)', borderRadius: 6 }}>
                  <Badge color="teal">host</Badge>
                  <p style={{ fontSize: 13, marginTop: 4 }}>{n.adminFeedback}</p>
                </div>
              )}

              {/* Replies */}
              {(n.replies || []).map(r => (
                <div key={r.id} style={{ marginTop: 8, paddingLeft: 14, borderLeft: '2px solid var(--border)' }}>
                  <span style={{ fontSize: 12, fontWeight: 600 }}>{r.nick}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-3)', marginLeft: 6 }}>{new Date(r.ts).toLocaleTimeString()}</span>
                  <div style={{ fontSize: 13, lineHeight: 1.5, marginTop: 2 }} dangerouslySetInnerHTML={{ __html: mdToHtml(r.text) }} />
                </div>
              ))}

              {replyTo === n.id && (
                <div style={{ marginTop: 8 }}>
                  <textarea value={replyText} onChange={e => setReplyText(e.target.value)} rows={2}
                    placeholder={lang === 'zh' ? '回覆…' : 'Reply…'}
                    style={{ width: '100%', padding: '6px 10px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 13, color: 'var(--text)', resize: 'none' }} />
                  <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                    <Btn size="sm" onClick={() => submitReply(n.id)}>{lang === 'zh' ? '回覆' : 'Reply'}</Btn>
                    <Btn size="sm" variant="ghost" onClick={() => setReplyTo(null)}>{lang === 'zh' ? '取消' : 'Cancel'}</Btn>
                  </div>
                </div>
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <button onClick={() => toggleLike(n.id)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16 }}>
                {(n.likedBy || []).includes(userId) ? '👍' : '👍🏻'}
              </button>
              <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{n.likes || 0}</span>
              <button onClick={() => setReplyTo(replyTo === n.id ? null : n.id)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--accent)' }}>
                💬
              </button>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

// ─── Strategy Board ───────────────────────────────────────────────────────────
const parseCsvText = (text) => {
  const rows = text.trim().split(/\r?\n/).map(line =>
    line.split(',').map(cell => cell.trim().replace(/^"|"$/g, ''))
  ).filter(row => row.length && row.some(Boolean));
  if (rows.length < 2) return { headers: [], rows: [] };
  const headers = rows[0];
  return {
    headers,
    rows: rows.slice(1).map(row => Object.fromEntries(headers.map((h, i) => [h || `欄位${i + 1}`, row[i] ?? '']))),
  };
};

const parseDataFile = (text, name = '') => {
  if (/\.json$/i.test(name)) {
    const parsed = JSON.parse(text);
    const arr = Array.isArray(parsed) ? parsed : Object.values(parsed).find(Array.isArray) || [];
    const rows = arr.filter(v => v && typeof v === 'object');
    return { headers: [...new Set(rows.flatMap(row => Object.keys(row)))], rows };
  }
  return parseCsvText(text);
};

const numericColumns = (data) => data.headers.filter(h =>
  data.rows.some(row => row[h] !== '' && !Number.isNaN(Number(row[h])))
);

const categoryColumns = (data) => data.headers.filter(h =>
  !numericColumns(data).includes(h) && new Set(data.rows.map(row => row[h]).filter(Boolean)).size <= Math.max(20, data.rows.length * 0.6)
);

const summarizeColumn = (rows, column) => {
  const values = rows.map(row => Number(row[column])).filter(v => !Number.isNaN(v));
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const sum = values.reduce((a, b) => a + b, 0);
  const avg = sum / values.length;
  return {
    count: values.length,
    sum,
    avg,
    min: sorted[0],
    max: sorted[sorted.length - 1],
    q1: sorted[Math.floor((sorted.length - 1) * 0.25)],
    q3: sorted[Math.floor((sorted.length - 1) * 0.75)],
  };
};

const makeBarSvg = (items, title) => {
  const width = 720;
  const rowHeight = 34;
  const height = 72 + items.length * rowHeight;
  const max = Math.max(...items.map(i => i.value), 1);
  const bars = items.map((item, i) => {
    const y = 52 + i * rowHeight;
    const barW = Math.max(4, Math.round((item.value / max) * 420));
    return `<text x="18" y="${y + 18}" font-size="13" fill="currentColor">${escapeXml(String(item.label).slice(0, 26))}</text>
      <rect x="220" y="${y}" width="${barW}" height="22" rx="6" fill="#0d9488"></rect>
      <text x="${230 + barW}" y="${y + 16}" font-size="12" fill="currentColor">${item.value}</text>`;
  }).join('');
  return `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeXml(title)}" style="width:100%;max-width:${width}px;height:auto;background:var(--surface-2);border-radius:12px;padding:10px">
    <text x="18" y="28" font-size="18" font-weight="700" fill="currentColor">${escapeXml(title)}</text>${bars}</svg>`;
};

const escapeXml = (text) => text
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

function StrategyTab({ act, userId, nick, lang }) {
  const [file, setFile] = useState(null);
  const [dataset, setDataset] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [selected, setSelected] = useState([]);
  const [result, setResult] = useState('');
  const [runningIdx, setRunningIdx] = useState(null);
  const [results, setResults] = useState([]);
  const [makePublic, setMakePublic] = useState(false);
  const [pubTitle, setPubTitle] = useState('');
  const [pubDesc, setPubDesc] = useState('');
  const [pubName, setPubName] = useState('');
  const [publishing, setPublishing] = useState(null);

  const charts = (db.get(`co_charts_${act.id}`, [])).filter(c => !c.hidden);
  const datasets = db.get(`co_datasets_${act.id}`, []);

  const handleFile = async (f) => {
    if (!f) return;
    setFile(f);
    setAnalyzing(true);
    setSuggestions([]);
    try {
      const text = await f.text().catch(() => '');
      const data = parseDataFile(text, f.name);
      setDataset(data);
      const nums = numericColumns(data);
      const cats = categoryColumns(data);
      const next = [];
      if (data.rows.length) {
        next.push({
          id: 'profile',
          type: 'profile',
          title: lang === 'zh' ? '資料概況與缺漏檢查' : 'Data Profile and Missing Values',
          desc: lang === 'zh' ? `檢查 ${data.rows.length} 筆資料、${data.headers.length} 個欄位的基本品質。` : `Review ${data.rows.length} rows and ${data.headers.length} columns.`,
        });
      }
      if (nums.length) {
        next.push({
          id: 'stats',
          type: 'stats',
          title: lang === 'zh' ? '數值欄位統計摘要' : 'Numeric Summary',
          desc: lang === 'zh' ? `計算 ${nums.join('、')} 的平均、最小最大值與 Q1/Q3。` : `Calculate average, min/max and Q1/Q3 for ${nums.join(', ')}.`,
        });
      }
      if (cats.length) {
        next.push({
          id: 'freq',
          type: 'freq',
          title: lang === 'zh' ? '類別分布長條圖' : 'Category Distribution Bar Chart',
          desc: lang === 'zh' ? `依 ${cats[0]} 彙整出現次數並生成圖表。` : `Aggregate counts by ${cats[0]} and render a chart.`,
          category: cats[0],
        });
      }
      if (cats.length && nums.length) {
        next.push({
          id: 'grouped',
          type: 'grouped',
          title: lang === 'zh' ? '分組數值比較' : 'Grouped Numeric Comparison',
          desc: lang === 'zh' ? `依 ${cats[0]} 比較 ${nums[0]} 的平均值。` : `Compare average ${nums[0]} by ${cats[0]}.`,
          category: cats[0],
          numeric: nums[0],
        });
      }
      if (nums.length >= 2) {
        next.push({
          id: 'scatter',
          type: 'scatter',
          title: lang === 'zh' ? '雙變項關係圖' : 'Bivariate Scatter Plot',
          desc: lang === 'zh' ? `比較 ${nums[0]} 與 ${nums[1]} 的關係並生成散點圖。` : `Compare ${nums[0]} and ${nums[1]} with a scatter plot.`,
          x: nums[0],
          y: nums[1],
        });
      }
      if (cats.length && nums.length >= 2) {
        next.push({
          id: 'multi',
          type: 'multi',
          title: lang === 'zh' ? '多變項分組摘要' : 'Multivariate Group Summary',
          desc: lang === 'zh' ? `依 ${cats[0]} 同時比較 ${nums.slice(0, 3).join('、')}。` : `Compare ${nums.slice(0, 3).join(', ')} by ${cats[0]}.`,
          category: cats[0],
          numeric: nums.slice(0, 3),
        });
      }
      setSuggestions(next.length ? next : [{
        id: 'summary',
        type: 'summary',
        title: lang === 'zh' ? '文字資料摘要' : 'Text Summary',
        desc: lang === 'zh' ? '此檔案不易解析成表格，先整理可讀摘要。' : 'This file is not tabular; generate a readable summary.',
      }]);
    } catch (e) {
      setSuggestions([{ id: '1', title: lang === 'zh' ? '資料摘要' : 'Data Summary', desc: lang === 'zh' ? '根據上傳資料生成摘要' : 'Generate summary from uploaded data', type: 'summary' }]);
    }
    setAnalyzing(false);
  };

  const runAnalysis = async (suggestion) => {
    if (!file) return;
    setRunningIdx(suggestion.id);
    try {
      const text = await file.text().catch(() => '');
      const data = dataset || parseDataFile(text, file.name);
      let content = '';
      if (suggestion.type === 'profile') {
        const missing = data.headers.map(h => `${h}: ${data.rows.filter(row => !row[h]).length}`).join('<br>');
        content = `<div class="markdown-body"><h3>${lang === 'zh' ? '資料概況' : 'Data Profile'}</h3><p>${data.rows.length} rows, ${data.headers.length} columns.</p><p>${missing}</p></div>`;
      } else if (suggestion.type === 'stats') {
        const rows = numericColumns(data).map(col => {
          const s = summarizeColumn(data.rows, col);
          return `<tr><td>${escapeXml(col)}</td><td>${s.count}</td><td>${s.avg.toFixed(2)}</td><td>${s.min}</td><td>${s.q1}</td><td>${s.q3}</td><td>${s.max}</td></tr>`;
        }).join('');
        content = `<table class="data-table"><thead><tr><th>欄位</th><th>N</th><th>平均</th><th>Min</th><th>Q1</th><th>Q3</th><th>Max</th></tr></thead><tbody>${rows}</tbody></table>`;
      } else if (suggestion.type === 'freq') {
        const counts = {};
        data.rows.forEach(row => { const key = row[suggestion.category] || '(blank)'; counts[key] = (counts[key] || 0) + 1; });
        const items = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([label, value]) => ({ label, value }));
        content = makeBarSvg(items, suggestion.title);
      } else if (suggestion.type === 'grouped') {
        const groups = {};
        data.rows.forEach(row => {
          const key = row[suggestion.category] || '(blank)';
          const value = Number(row[suggestion.numeric]);
          if (Number.isNaN(value)) return;
          groups[key] = groups[key] || [];
          groups[key].push(value);
        });
        const items = Object.entries(groups).map(([label, values]) => ({
          label,
          value: Number((values.reduce((a, b) => a + b, 0) / values.length).toFixed(2)),
        })).sort((a, b) => b.value - a.value).slice(0, 12);
        content = makeBarSvg(items, suggestion.title);
      } else if (suggestion.type === 'scatter') {
        const pts = data.rows.map(row => ({ x: Number(row[suggestion.x]), y: Number(row[suggestion.y]) }))
          .filter(p => !Number.isNaN(p.x) && !Number.isNaN(p.y));
        const maxX = Math.max(...pts.map(p => p.x), 1), maxY = Math.max(...pts.map(p => p.y), 1);
        const circles = pts.slice(0, 300).map(p => {
          const x = 52 + (p.x / maxX) * 600;
          const y = 330 - (p.y / maxY) * 280;
          return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="4" fill="#0d9488" opacity=".72"></circle>`;
        }).join('');
        content = `<svg viewBox="0 0 720 380" style="width:100%;max-width:720px;background:var(--surface-2);border-radius:12px;padding:10px"><text x="24" y="30" font-size="18" font-weight="700" fill="currentColor">${escapeXml(suggestion.title)}</text><line x1="52" y1="330" x2="660" y2="330" stroke="currentColor" opacity=".35"/><line x1="52" y1="50" x2="52" y2="330" stroke="currentColor" opacity=".35"/>${circles}<text x="300" y="365" font-size="12" fill="currentColor">${escapeXml(suggestion.x)}</text><text x="8" y="190" font-size="12" fill="currentColor">${escapeXml(suggestion.y)}</text></svg>`;
      } else if (suggestion.type === 'multi') {
        const groups = {};
        data.rows.forEach(row => {
          const key = row[suggestion.category] || '(blank)';
          groups[key] = groups[key] || {};
          suggestion.numeric.forEach(col => {
            const value = Number(row[col]);
            if (!Number.isNaN(value)) groups[key][col] = [...(groups[key][col] || []), value];
          });
        });
        const rows = Object.entries(groups).slice(0, 20).map(([g, cols]) => `<tr><td>${escapeXml(g)}</td>${suggestion.numeric.map(col => {
          const vals = cols[col] || [];
          const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
          return `<td>${avg.toFixed(2)}</td>`;
        }).join('')}</tr>`).join('');
        content = `<table class="data-table"><thead><tr><th>${escapeXml(suggestion.category)}</th>${suggestion.numeric.map(c => `<th>${escapeXml(c)} avg</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table>`;
      } else {
        content = `<div class="markdown-body"><h3>${escapeXml(file.name)}</h3><p>${escapeXml(text.slice(0, 1200))}</p></div>`;
      }
      setResults(prev => [...prev, { id: uid(), suggestionId: suggestion.id, title: suggestion.title, content, ts: Date.now() }]);
    } catch (e) { }
    setRunningIdx(null);
  };

  const publishResult = (r) => {
    const list = db.get(`co_charts_${act.id}`, []);
    list.push({
      id: uid(), title: pubTitle || r.title, desc: pubDesc, contributor: pubName,
      content: r.content, ts: Date.now(), userId,
    });
    db.set(`co_charts_${act.id}`, list);
    broadcast('co_update', {});
    setPublishing(null);
    setPubTitle(''); setPubDesc(''); setPubName('');
  };

  return (
    <div>
      {/* Upload */}
      <Card style={{ marginBottom: 16 }}>
        <h4 style={{ fontSize: 15, marginBottom: 10 }}>📤 {lang === 'zh' ? '上傳資料' : 'Upload Data'}</h4>
        <p style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 10 }}>
          {lang === 'zh' ? '上傳 CSV/JSON 後，系統會依欄位型態建議統計摘要、長條圖、雙變項散點圖或多變項表格。PDF/ODT/XLSX 目前會先作文字整理；建議轉成 CSV 以取得完整圖表分析。' : 'Upload CSV/JSON to get summaries, bar charts, scatter plots and multivariate tables. PDF/ODT/XLSX are summarized as text for now; convert to CSV for charts.'}
        </p>
        {datasets.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
            <p style={{ fontSize: 13, fontWeight: 700 }}>{lang === 'zh' ? '公用數據資料' : 'Public datasets'}</p>
            {datasets.filter(d => !d.hidden).map(d => (
              <div key={d.id} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: 10, background: 'var(--surface-2)', borderRadius: 8 }}>
                <div style={{ flex: 1 }}>
                  <strong style={{ fontSize: 13 }}>{d.title}</strong>
                  {d.desc && <p style={{ fontSize: 12, color: 'var(--text-2)' }}>{d.desc}</p>}
                </div>
                <Btn size="sm" variant="ghost" onClick={() => handleFile(new File([d.content || ''], `${d.title || 'dataset'}.csv`, { type: 'text/csv' }))}>
                  {lang === 'zh' ? '使用' : 'Use'}
                </Btn>
              </div>
            ))}
          </div>
        )}
        <input type="file" accept=".json,.csv,.pdf,.odt,.xls,.xlsx"
          onChange={e => handleFile(e.target.files[0])}
          style={{ display: 'block', marginBottom: 10 }} />
        {file && <Badge color="teal">{file.name}</Badge>}
        {analyzing && <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}><Spinner /><span style={{ fontSize: 13 }}>{lang === 'zh' ? '分析中…' : 'Analyzing…'}</span></div>}
      </Card>

      {/* Suggestions */}
      {suggestions.length > 0 && (
        <Card style={{ marginBottom: 16 }}>
          <h4 style={{ fontSize: 15, marginBottom: 10 }}>🔍 {lang === 'zh' ? '分析建議' : 'Analysis Suggestions'}</h4>
          {suggestions.map((s) => (
            <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, padding: '10px 12px', background: 'var(--surface-2)', borderRadius: 8 }}>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 14, fontWeight: 600 }}>{s.title}</p>
                <p style={{ fontSize: 12, color: 'var(--text-2)' }}>{s.desc}</p>
              </div>
              <Btn size="sm" loading={runningIdx === s.id} onClick={() => runAnalysis(s)}>
                {lang === 'zh' ? '執行' : 'Run'}
              </Btn>
            </div>
          ))}
        </Card>
      )}

      {/* My results */}
      {results.map((r) => (
        <Card key={r.id} style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 8 }}>
            <h4 style={{ fontSize: 15 }}>{r.title}</h4>
            <Btn size="sm" variant="ghost" onClick={() => setPublishing(r.id)}>
              {lang === 'zh' ? '公開分享' : 'Publish'}
            </Btn>
          </div>
          <div style={{ fontSize: 13, lineHeight: 1.7, color: 'var(--text-2)', overflowX: 'auto' }}
            dangerouslySetInnerHTML={{ __html: r.content.trim().startsWith('<') ? r.content : mdToHtml(r.content) }} />
        </Card>
      ))}

      {/* Public charts */}
      {charts.length > 0 && (
        <div>
          <h4 style={{ fontSize: 15, marginBottom: 10 }}>🌐 {lang === 'zh' ? '公開圖表' : 'Published Charts'}</h4>
          {charts.map(c => (
            <Card key={c.id} style={{ marginBottom: 12 }}>
              {c.title && <h5 style={{ fontSize: 15, marginBottom: 4 }}>{c.title}</h5>}
              {c.desc && <p style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 8 }}>{c.desc}</p>}
              <div style={{ fontSize: 13, lineHeight: 1.7, overflowX: 'auto' }} dangerouslySetInnerHTML={{ __html: c.content.trim().startsWith('<') ? c.content : mdToHtml(c.content) }} />
              {c.contributor && (
                <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 8 }}>
                  — {c.contributor}
                </p>
              )}
              {/* Admin feedback */}
              {(c.comments || []).map((cm, ci) => (
                <div key={ci} style={{ marginTop: 8, padding: '8px 10px', background: 'var(--surface-2)', borderRadius: 6 }}>
                  <Badge color="teal">host</Badge>
                  <p style={{ fontSize: 13, marginTop: 4 }}>{cm.text}</p>
                </div>
              ))}
            </Card>
          ))}
        </div>
      )}

      {/* Publish modal */}
      <Modal open={!!publishing} onClose={() => setPublishing(null)}
        title={lang === 'zh' ? '公開分享圖表' : 'Publish Chart'}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 5 }}>
              {lang === 'zh' ? '圖表標題（選填）' : 'Chart title (optional)'}
            </label>
            <input value={pubTitle} onChange={e => setPubTitle(e.target.value)}
              style={{ width: '100%', padding: '7px 10px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 7, fontSize: 13, color: 'var(--text)' }} />
          </div>
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 5 }}>
              {lang === 'zh' ? '說明（選填）' : 'Description (optional)'}
            </label>
            <textarea value={pubDesc} onChange={e => setPubDesc(e.target.value)} rows={2}
              style={{ width: '100%', padding: '7px 10px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 7, fontSize: 13, color: 'var(--text)', resize: 'none' }} />
          </div>
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 5 }}>
              {lang === 'zh' ? '貢獻者名稱（選填）' : 'Contributor name (optional)'}
            </label>
            <input value={pubName} onChange={e => setPubName(e.target.value)}
              placeholder={nick}
              style={{ width: '100%', padding: '7px 10px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 7, fontSize: 13, color: 'var(--text)' }} />
          </div>
          <Btn onClick={() => {
            const r = results.find(r => r.id === publishing);
            if (r) publishResult(r);
          }}>{lang === 'zh' ? '確認公開' : 'Publish'}</Btn>
        </div>
      </Modal>
    </div>
  );
}

// ─── Dashboard Tab ────────────────────────────────────────────────────────────
const VOTE_OPTIONS = ['resolved', 'partial', 'unresolved'];
const VOTE_LABELS = {
  zh: { resolved: '✅ 完全解決', partial: '🔶 部分解決', unresolved: '❌ 未解決' },
  en: { resolved: '✅ Resolved', partial: '🔶 Partial', unresolved: '❌ Unresolved' },
};
const VOTE_COLORS = { resolved: '#16a34a', partial: '#d97706', unresolved: '#dc2626' };

function DashboardTab({ act, userId, lang }) {
  const [filterGroup, setFilterGroup] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [newQ, setNewQ] = useState('');
  const [newQGroup, setNewQGroup] = useState('');

  const questions = db.get(`co_dashboard_${act.id}`, act.dashboardQuestions || []);
  const [localQs, setLocalQs] = useState(questions);
  const votes = db.get(`co_dash_votes_${act.id}`, {});
  const [localVotes, setLocalVotes] = useState(votes);

  useEffect(() => {
    const unsub = onBroadcast(({ type }) => {
      if (type === 'co_update') {
        setLocalQs(db.get(`co_dashboard_${act.id}`, act.dashboardQuestions || []));
        setLocalVotes(db.get(`co_dash_votes_${act.id}`, {}));
      }
    });
    return unsub;
  }, [act.id]);

  const vote = (qId, option) => {
    const v = clone(localVotes);
    if (!v[qId]) v[qId] = {};
    v[qId][userId] = option;
    db.set(`co_dash_votes_${act.id}`, v);
    broadcast('co_update', {});
    setLocalVotes(v);
  };

  const submitQ = () => {
    if (!newQ.trim() || !act.allowUserQuestions) return;
    const parts = newQ.split('-').map(s => s.trim());
    const parsed = parts.length >= 3
      ? { group: parts[0], num: parts[1], text: parts.slice(2).join('-').trim() }
      : { group: newQGroup, num: '', text: newQ.trim() };
    const list = db.get(`co_dashboard_${act.id}`, act.dashboardQuestions || []);
    const groupItems = list.filter(q => (q.group || '') === (parsed.group || ''));
    const nextNum = parsed.num || String(groupItems.length + 1).padStart(2, '0');
    list.push({ id: uid(), text: parsed.text, num: nextNum, group: parsed.group, ts: Date.now(), userSubmitted: true });
    db.set(`co_dashboard_${act.id}`, list);
    broadcast('co_update', {});
    setLocalQs(db.get(`co_dashboard_${act.id}`, []));
    setNewQ(''); setNewQGroup('');
  };

  const hasGroups = act.groupsEnabled && (act.groups || []).length > 0;

  const tally = (qId) => {
    const qVotes = Object.values(localVotes[qId] || {});
    return {
      resolved: qVotes.filter(v => v === 'resolved').length,
      partial: qVotes.filter(v => v === 'partial').length,
      unresolved: qVotes.filter(v => v === 'unresolved').length,
      total: qVotes.length,
    };
  };
  const statusOf = (qId) => {
    const t = tally(qId);
    if (t.resolved >= t.partial && t.resolved >= t.unresolved) return 'resolved';
    if (t.partial >= t.resolved && t.partial >= t.unresolved) return 'partial';
    return 'unresolved';
  };
  const stats = localQs.reduce((acc, q) => {
    acc[statusOf(q.id)] += 1;
    return acc;
  }, { resolved: 0, partial: 0, unresolved: 0 });

  const sorted = [...localQs]
    .filter(q => filterGroup === 'all' || q.group === filterGroup)
    .filter(q => filterStatus === 'all' || statusOf(q.id) === filterStatus)
    .sort((a, b) => {
      const ta = tally(a.id), tb = tally(b.id);
      if (tb.resolved !== ta.resolved) return tb.resolved - ta.resolved;
      if (tb.partial !== ta.partial) return tb.partial - ta.partial;
      if (ta.unresolved !== tb.unresolved) return ta.unresolved - tb.unresolved;
      return a.ts - b.ts;
    });

  const groups = [...new Set(localQs.map(q => q.group).filter(Boolean))];

  return (
    <div>
      <Card style={{ marginBottom: 12, padding: '12px 14px' }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          {VOTE_OPTIONS.map(opt => (
            <Badge key={opt} color={opt === 'resolved' ? 'green' : opt === 'partial' ? 'amber' : 'red'}>
              {VOTE_LABELS[lang][opt]}: {stats[opt]}
            </Badge>
          ))}
          <Btn size="sm" variant="ghost" onClick={() => {
            const rows = [[lang === 'zh' ? '分組' : 'Group', lang === 'zh' ? '編號' : 'No.', lang === 'zh' ? '問題' : 'Question', 'Resolved', 'Partial', 'Unresolved', lang === 'zh' ? '狀態' : 'Status']];
            localQs.forEach(q => {
              const t = tally(q.id);
              rows.push([q.group || '', q.num || '', q.text, t.resolved, t.partial, t.unresolved, VOTE_LABELS[lang][statusOf(q.id)]]);
            });
            exportCSV(rows, `${new Date().toISOString().slice(0, 10)}_Dashboard_Report`);
          }}>{lang === 'zh' ? '匯出結果' : 'Export'}</Btn>
        </div>
      </Card>
      {/* Group filter */}
      {groups.length > 0 && (
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 8, marginBottom: 14 }}>
          {[{ key: 'all', label: lang === 'zh' ? '全部' : 'All' }, ...groups.map(g => ({ key: g, label: g }))].map(t => (
            <button key={t.key} onClick={() => setFilterGroup(t.key)}
              style={{
                padding: '5px 12px', borderRadius: 20, border: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
                fontSize: 13, fontWeight: filterGroup === t.key ? 700 : 400,
                background: filterGroup === t.key ? 'var(--accent)' : 'var(--surface-2)',
                color: filterGroup === t.key ? '#fff' : 'var(--text-2)',
              }}>{t.label}</button>
          ))}
        </div>
      )}
      <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 8, marginBottom: 14 }}>
        {[{ key: 'all', label: lang === 'zh' ? '全部狀態' : 'All status' }, ...VOTE_OPTIONS.map(opt => ({ key: opt, label: VOTE_LABELS[lang][opt] }))].map(t => (
          <button key={t.key} onClick={() => setFilterStatus(t.key)}
            style={{
              padding: '5px 12px', borderRadius: 20, border: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
              fontSize: 13, fontWeight: filterStatus === t.key ? 700 : 400,
              background: filterStatus === t.key ? 'var(--accent)' : 'var(--surface-2)',
              color: filterStatus === t.key ? '#fff' : 'var(--text-2)',
            }}>{t.label}</button>
        ))}
      </div>

      {/* User submit new question */}
      {act.allowUserQuestions && (
        <Card style={{ marginBottom: 16 }}>
          <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>
            ➕ {lang === 'zh' ? '提交問題' : 'Submit Question'}
          </h4>
          <p style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 8 }}>
            {lang === 'zh' ? '格式：分組-編號-問題（分組與編號選填）' : 'Format: Group-Number-Question (group and number optional)'}
          </p>
          <textarea value={newQ} onChange={e => setNewQ(e.target.value)} rows={2}
            placeholder={lang === 'zh' ? '例：設計-01-如何解決現有流程痛點？' : 'e.g. Design-01-How to solve current pain points?'}
            style={{ width: '100%', padding: '8px 10px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 7, fontSize: 13, color: 'var(--text)', resize: 'none' }} />
          {hasGroups && (
            <select value={newQGroup} onChange={e => setNewQGroup(e.target.value)}
              style={{ marginTop: 8, padding: '7px 10px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 7, fontSize: 13, color: 'var(--text)', width: '100%' }}>
              <option value="">{lang === 'zh' ? '未指定分組（或用 分組-編號-問題 格式）' : 'No group (or use Group-Number-Question)'}</option>
              {(act.groups || []).map(g => <option key={g.name} value={g.name}>{g.name}</option>)}
            </select>
          )}
          <Btn size="sm" onClick={submitQ} style={{ marginTop: 8 }}>{lang === 'zh' ? '提交' : 'Submit'}</Btn>
        </Card>
      )}

      {sorted.length === 0 && <Empty>{lang === 'zh' ? '尚無問題清單' : 'No questions yet'}</Empty>}
      {sorted.map(q => {
        const t = tally(q.id);
        const myVote = (localVotes[q.id] || {})[userId];
        const total = Math.max(t.total, 1);
        return (
          <Card key={q.id} style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'space-between', flexWrap: 'wrap', marginBottom: 10 }}>
              <div style={{ flex: 1, minWidth: 200 }}>
                {q.group && <Badge color={badgeColor(q.group)} style={{ marginBottom: 6 }}>{q.group}</Badge>}
                <p style={{ fontSize: 14, lineHeight: 1.5 }}>{q.num ? `${q.num}. ` : ''}{q.text}</p>
              </div>
              {/* Vote buttons */}
              <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                {VOTE_OPTIONS.map(opt => (
                  <button key={opt} onClick={() => vote(q.id, opt)}
                    style={{
                      padding: '5px 12px', borderRadius: 20, border: '2px solid', cursor: 'pointer', fontSize: 12,
                      borderColor: myVote === opt ? VOTE_COLORS[opt] : 'var(--border)',
                      background: myVote === opt ? VOTE_COLORS[opt] + '22' : 'var(--surface-2)',
                      color: myVote === opt ? VOTE_COLORS[opt] : 'var(--text-2)',
                      fontWeight: myVote === opt ? 700 : 400,
                    }}>
                    {VOTE_LABELS[lang][opt]}
                  </button>
                ))}
              </div>
            </div>
            {/* Progress bars */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {VOTE_OPTIONS.map(opt => (
                <div key={opt} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 11, color: 'var(--text-3)', minWidth: 18 }}>{t[opt]}</span>
                  <div style={{ flex: 1, background: 'var(--surface-2)', borderRadius: 4, height: 6, overflow: 'hidden' }}>
                    <div style={{ width: `${(t[opt] / total) * 100}%`, height: '100%', background: VOTE_COLORS[opt], borderRadius: 4, transition: 'width 0.3s' }} />
                  </div>
                </div>
              ))}
            </div>
          </Card>
        );
      })}
    </div>
  );
}

// ─── Root ──────────────────────────────────────────────────────────────────────
export default function CoFront() {
  const { lang } = useLang();
  const [joined, setJoined] = useState(null);
  const [tab, setTab] = useState('rules');

  const [act, setAct] = useCoActivity(joined?.id);
  const userId = db.get('user_id') || uid();
  useEffect(() => { db.set('user_id', userId); }, []);

  if (!joined) {
    return <JoinScreen lang={lang} onJoin={(a) => { setJoined(a); }} />;
  }

  const liveAct = act || joined;
  const tabs = [
    { key: 'rules', label: lang === 'zh' ? '規則' : 'Rules' },
    { key: 'resources', label: lang === 'zh' ? '參考資料' : 'Resources' },
    { key: 'notes', label: lang === 'zh' ? '共筆' : 'Shared Notes' },
    { key: 'strategy', label: lang === 'zh' ? '戰略板' : 'Strategy Board' },
    { key: 'dashboard', label: lang === 'zh' ? '共創儀表板' : 'Dashboard' },
  ];

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '24px 16px' }}>
      {/* Cover */}
      <Card style={{ marginBottom: 20, padding: '24px 28px', background: 'linear-gradient(135deg, var(--accent-light), var(--surface))' }}>
        <div style={{ fontSize: 36, marginBottom: 8 }}>🌐</div>
        <h1 style={{ fontSize: 22, marginBottom: 4 }}>{liveAct.name}</h1>
        {liveAct.organizer && (
          <p style={{ fontSize: 14, color: 'var(--text-2)' }}>
            {lang === 'zh' ? '主辦單位：' : 'Organizer: '}{liveAct.organizer}
          </p>
        )}
        {liveAct.startTime && (
          <p style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 4 }}>
            {new Date(liveAct.startTime).toLocaleDateString()}
            {liveAct.endTime ? ` – ${new Date(liveAct.endTime).toLocaleDateString()}` : ''}
          </p>
        )}
      </Card>

      <Tabs tabs={tabs} active={tab} onChange={setTab} style={{ marginBottom: 20 }} />

      {tab === 'rules' && (
        <Card>
          {liveAct.rules ? (
            <div style={{ fontSize: 14, lineHeight: 1.8 }} dangerouslySetInnerHTML={{ __html: mdToHtml(liveAct.rules) }} />
          ) : (
            <Empty>{lang === 'zh' ? '尚無規則說明' : 'No rules posted yet'}</Empty>
          )}
        </Card>
      )}

      {tab === 'resources' && <ResourcesTab act={liveAct} lang={lang} />}
      {tab === 'notes' && <NotesTab act={liveAct} userId={userId} nick={db.get('user_nick', 'User')} lang={lang} />}
      {tab === 'strategy' && <StrategyTab act={liveAct} userId={userId} nick={db.get('user_nick', 'User')} lang={lang} />}
      {tab === 'dashboard' && <DashboardTab act={liveAct} userId={userId} lang={lang} />}
    </div>
  );
}
