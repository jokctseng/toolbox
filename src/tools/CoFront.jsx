import React, { useState, useEffect, useRef } from 'react';
import { db, uid, onBroadcast, broadcast } from '../store.js';
import { mdToHtml, badgeColor, clone } from '../utils.js';
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
  const [code, setCode] = useState('');
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
              <p style={{ fontSize: 14, lineHeight: 1.6 }}>{n.text}</p>
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
                  <p style={{ fontSize: 13, lineHeight: 1.5, marginTop: 2 }}>{r.text}</p>
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
function StrategyTab({ act, userId, nick, lang }) {
  const [file, setFile] = useState(null);
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

  const handleFile = async (f) => {
    if (!f) return;
    setFile(f);
    setAnalyzing(true);
    setSuggestions([]);
    try {
      // Read file as text/base64
      const text = await f.text().catch(() => '');
      const prompt = `You are a data analyst. Based on this file content (name: ${f.name}, type: ${f.type}), suggest 3-5 analyses or chart types that would be useful. Respond ONLY with JSON:
{"suggestions":[{"id":"1","title":"Analysis Title","desc":"What this shows","type":"bar|line|pie|table|summary"}]}

File content preview:
${text.slice(0, 2000)}`;

      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 1000, messages: [{ role: 'user', content: prompt }] }),
      });
      const data = await res.json();
      const raw = data.content?.find(c => c.type === 'text')?.text || '';
      const parsed = JSON.parse(raw.replace(/```json|```/g, '').trim());
      setSuggestions(parsed.suggestions || []);
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
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514', max_tokens: 1000,
          messages: [{ role: 'user', content: `Perform this analysis on the data: "${suggestion.title} - ${suggestion.desc}"\n\nFile: ${file.name}\nContent:\n${text.slice(0, 3000)}\n\nProvide a clear, concise analysis result in markdown format.` }],
        }),
      });
      const data = await res.json();
      const content = data.content?.find(c => c.type === 'text')?.text || '';
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
          {lang === 'zh' ? '支援 JSON, CSV, PDF, ODT, XLS, XLSX' : 'Supports JSON, CSV, PDF, ODT, XLS, XLSX'}
        </p>
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
          <div style={{ fontSize: 13, lineHeight: 1.7, color: 'var(--text-2)' }}
            dangerouslySetInnerHTML={{ __html: mdToHtml(r.content) }} />
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
              <div style={{ fontSize: 13, lineHeight: 1.7 }} dangerouslySetInnerHTML={{ __html: mdToHtml(c.content) }} />
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
    const list = db.get(`co_dashboard_${act.id}`, act.dashboardQuestions || []);
    list.push({ id: uid(), text: newQ.trim(), group: newQGroup, ts: Date.now(), userSubmitted: true });
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

  const sorted = [...localQs]
    .filter(q => filterGroup === 'all' || q.group === filterGroup)
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
                <p style={{ fontSize: 14, lineHeight: 1.5 }}>{q.text}</p>
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
