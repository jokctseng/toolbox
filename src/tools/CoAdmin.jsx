import React, { useState, useEffect, useCallback } from 'react';
import {
  db, uid, broadcast,
  generateOTP, verifyOTP, checkSession, createSession, destroySession,
} from '../store.js';
import { mdToHtml, badgeColor, clone, exportCSV } from '../utils.js';
import {
  Btn, Card, Modal, Inp, Toggle, Badge, Tabs, Confirm, SectionHead, Empty, Spinner,
} from '../components/UI.jsx';
import { useLang } from '../App.jsx';
import AdminLogin from '../components/AdminLogin.jsx';

// ─── helpers ──────────────────────────────────────────────────────────────────
const MAX_ACTIVITIES = 3;
const genCode = () => Math.random().toString(36).slice(2, 8).toUpperCase();

function loadActivities() { return db.get('co_activities', []); }
function saveActivities(list) { db.set('co_activities', list); broadcast('co_update', {}); }
function saveActivity(act) {
  const list = loadActivities();
  const idx = list.findIndex(a => a.id === act.id);
  if (idx >= 0) list[idx] = act; else list.push(act);
  saveActivities(list);
}

function blankActivity(lang) {
  return {
    id: uid(),
    code: genCode(),
    name: lang === 'zh' ? '新共創工作站' : 'New Co-creation Station',
    organizer: '',
    startTime: '',
    endTime: '',
    archived: false,
    rules: '',
    resources: [],
    groupsEnabled: false,
    groups: [],
    allowUserQuestions: false,
    dashboardQuestions: [],
  };
}

const BADGE_COLORS = ['teal', 'blue', 'amber', 'green', 'purple', 'red'];
function autoBadgeColor(type, idx) {
  return BADGE_COLORS[idx % BADGE_COLORS.length];
}

// ─── OTP Login ────────────────────────────────────────────────────────────────
function OTPLogin({ onLogin }) {
  const { lang } = useLang();
  const [phase, setPhase] = useState('request');
  const [otp, setOtp] = useState('');
  const [genOtp, setGenOtp] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  const requestOTP = async () => {
    setLoading(true);
    const code = await generateOTP('co_admin');
    setGenOtp(code);
    setPhase('enter');
    setLoading(false);
  };

  const verify = async () => {
    setLoading(true);
    const ok = await verifyOTP(otp.trim(), 'co_admin');
    setLoading(false);
    if (ok) { createSession('co_admin'); onLogin(); }
    else setErr(lang === 'zh' ? '密碼錯誤或已過期' : 'Invalid or expired code');
  };

  return (
    <div style={{ maxWidth: 400, margin: '80px auto', padding: 20 }}>
      <Card>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>🔐</div>
          <h2 style={{ fontSize: 20 }}>{lang === 'zh' ? '共創工作站後台' : 'Co-creation Admin'}</h2>
        </div>
        {phase === 'request' ? (
          <>
            <p style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 16, lineHeight: 1.6 }}>
              {lang === 'zh' ? '點選下方按鈕產生一次性登入密碼（僅顯示一次）。' : 'Click below to generate a one-time password. It will only be shown once.'}
            </p>
            <Btn onClick={requestOTP} loading={loading} style={{ width: '100%', justifyContent: 'center' }}>
              {lang === 'zh' ? '產生一次性密碼' : 'Generate OTP'}
            </Btn>
          </>
        ) : (
          <>
            <div style={{ background: 'var(--warm-light)', border: '1px solid var(--warm)', borderRadius: 10, padding: 16, marginBottom: 16, textAlign: 'center' }}>
              <p style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 4 }}>
                {lang === 'zh' ? '你的一次性密碼（僅顯示一次）' : 'Your OTP (shown once only)'}
              </p>
              <div style={{ fontSize: 32, fontWeight: 700, letterSpacing: 8, color: 'var(--warm)', fontFamily: 'monospace' }}>{genOtp}</div>
            </div>
            <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>
              {lang === 'zh' ? '輸入密碼' : 'Enter OTP'}
            </label>
            <input value={otp} onChange={e => setOtp(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && verify()} maxLength={6} placeholder="000000"
              style={{ width: '100%', padding: '10px 14px', fontSize: 22, letterSpacing: 6, textAlign: 'center', fontFamily: 'monospace', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)' }} />
            {err && <p style={{ color: 'var(--danger)', fontSize: 13, marginTop: 8 }}>{err}</p>}
            <Btn onClick={verify} loading={loading} style={{ width: '100%', justifyContent: 'center', marginTop: 14 }}>
              {lang === 'zh' ? '驗證登入' : 'Verify & Login'}
            </Btn>
          </>
        )}
      </Card>
    </div>
  );
}

// ─── Activity List ─────────────────────────────────────────────────────────────
function ActivityList({ onEdit, onLogout }) {
  const { lang } = useLang();
  const [activities, setActivities] = useState(() => loadActivities().filter(a => !a.archived));
  const [delConfirm, setDelConfirm] = useState(null);

  const refresh = () => setActivities(loadActivities().filter(a => !a.archived));

  const createNew = () => {
    if (activities.length >= MAX_ACTIVITIES) return;
    const act = blankActivity(lang);
    saveActivity(act);
    refresh();
    onEdit(act.id);
  };

  const deleteAct = (id) => {
    saveActivities(loadActivities().filter(a => a.id !== id));
    refresh();
  };

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '24px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 10 }}>
        <h2 style={{ fontSize: 22 }}>⚙️ {lang === 'zh' ? '共創工作站後台' : 'Co-creation Admin'}</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <Btn variant="ghost" size="sm" onClick={onLogout}>{lang === 'zh' ? '登出' : 'Logout'}</Btn>
          <Btn onClick={createNew} disabled={activities.length >= MAX_ACTIVITIES}>
            + {lang === 'zh' ? '新增活動' : 'New Activity'}
          </Btn>
        </div>
      </div>

      {activities.length === 0 ? (
        <Empty>{lang === 'zh' ? '尚無活動，點選「新增活動」開始' : 'No activities yet.'}</Empty>
      ) : activities.map(act => (
        <Card key={act.id} style={{ marginBottom: 12, padding: '16px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ flex: 1 }}>
              <h3 style={{ fontSize: 16, marginBottom: 4 }}>{act.name}</h3>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <Badge color="teal">📋 {act.code}</Badge>
                {act.organizer && <Badge color="blue">{act.organizer}</Badge>}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <Btn size="sm" variant="ghost" onClick={() => window.open(`#/cocreate?code=${act.code}`, '_blank')}>
                {lang === 'zh' ? '前台' : 'Front'}↗
              </Btn>
              <Btn size="sm" onClick={() => onEdit(act.id)}>{lang === 'zh' ? '編輯' : 'Edit'}</Btn>
              <Btn size="sm" variant="danger" onClick={() => setDelConfirm(act.id)}>✕</Btn>
            </div>
          </div>
        </Card>
      ))}

      {activities.length >= MAX_ACTIVITIES && (
        <p style={{ fontSize: 13, color: 'var(--text-3)', textAlign: 'center', marginTop: 12 }}>
          {lang === 'zh' ? `已達上限 ${MAX_ACTIVITIES} 個活動` : `Max ${MAX_ACTIVITIES} activities reached`}
        </p>
      )}

      <Confirm
        open={!!delConfirm}
        message={lang === 'zh' ? '確定刪除此活動？' : 'Delete this activity?'}
        onConfirm={() => { deleteAct(delConfirm); setDelConfirm(null); }}
        onCancel={() => setDelConfirm(null)}
      />
    </div>
  );
}

// ─── Resource Editor ──────────────────────────────────────────────────────────
function ResourceEditor({ items, onChange, lang }) {
  const add = () => onChange([...items, { id: uid(), type: '', name: '', url: '', desc: '' }]);
  const update = (id, f, v) => onChange(items.map(i => i.id === id ? { ...i, [f]: v } : i));
  const remove = (id) => onChange(items.filter(i => i.id !== id));
  const move = (idx, dir) => {
    const arr = [...items];
    const to = idx + dir;
    if (to < 0 || to >= arr.length) return;
    [arr[idx], arr[to]] = [arr[to], arr[idx]];
    onChange(arr);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {items.map((item, idx) => (
        <div key={item.id} style={{ background: 'var(--surface-2)', borderRadius: 8, padding: 12, border: '1px solid var(--border)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr auto', gap: 8, marginBottom: 8 }}>
            <div>
              <input value={item.type} onChange={e => update(item.id, 'type', e.target.value)}
                placeholder={lang === 'zh' ? '標籤' : 'Tag'}
                style={{ width: '100%', padding: '5px 8px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 12, color: 'var(--text)' }} />
              {item.type && <Badge color={BADGE_COLORS[idx % BADGE_COLORS.length]} style={{ marginTop: 4 }}>{item.type}</Badge>}
            </div>
            <input value={item.name} onChange={e => update(item.id, 'name', e.target.value)}
              placeholder={lang === 'zh' ? '資料標題 *' : 'Title *'}
              style={{ padding: '5px 8px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 13, color: 'var(--text)' }} />
            <div style={{ display: 'flex', gap: 2 }}>
              <button onClick={() => move(idx, -1)} disabled={idx === 0}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, opacity: idx === 0 ? 0.3 : 1 }}>↑</button>
              <button onClick={() => move(idx, 1)} disabled={idx === items.length - 1}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, opacity: idx === items.length - 1 ? 0.3 : 1 }}>↓</button>
              <button onClick={() => remove(item.id)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', fontSize: 14 }}>✕</button>
            </div>
          </div>
          <input value={item.url} onChange={e => update(item.id, 'url', e.target.value)}
            placeholder="https://..."
            style={{ width: '100%', padding: '5px 8px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 13, color: 'var(--text)', display: 'block', marginBottom: 6 }} />
          <input value={item.desc} onChange={e => update(item.id, 'desc', e.target.value)}
            placeholder={lang === 'zh' ? '說明（hover顯示）' : 'Description (tooltip)'}
            style={{ width: '100%', padding: '5px 8px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 12, color: 'var(--text)', display: 'block' }} />
        </div>
      ))}
      <Btn size="sm" variant="ghost" onClick={add}>+ {lang === 'zh' ? '新增資料' : 'Add Resource'}</Btn>
    </div>
  );
}

// ─── Group Editor ─────────────────────────────────────────────────────────────
function GroupEditor({ groups, onChange, lang }) {
  const add = () => onChange([...groups, { id: uid(), name: '' }]);
  const update = (id, v) => onChange(groups.map(g => g.id === id ? { ...g, name: v } : g));
  const remove = (id) => onChange(groups.filter(g => g.id !== id));
  const move = (idx, dir) => {
    const arr = [...groups];
    const to = idx + dir;
    if (to < 0 || to >= arr.length) return;
    [arr[idx], arr[to]] = [arr[to], arr[idx]];
    onChange(arr);
  };
  return (
    <div>
      {groups.map((g, idx) => (
        <div key={g.id} style={{ display: 'flex', gap: 6, marginBottom: 8, alignItems: 'center' }}>
          <input value={g.name} onChange={e => update(g.id, e.target.value)}
            placeholder={`${lang === 'zh' ? '分組名稱' : 'Group name'} ${idx + 1}`}
            style={{ flex: 1, padding: '6px 10px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 13, color: 'var(--text)' }} />
          <button onClick={() => move(idx, -1)} disabled={idx === 0}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, opacity: idx === 0 ? 0.3 : 1 }}>↑</button>
          <button onClick={() => move(idx, 1)} disabled={idx === groups.length - 1}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, opacity: idx === groups.length - 1 ? 0.3 : 1 }}>↓</button>
          <button onClick={() => remove(g.id)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', fontSize: 14 }}>✕</button>
        </div>
      ))}
      <Btn size="sm" variant="ghost" onClick={add}>+ {lang === 'zh' ? '新增分組' : 'Add Group'}</Btn>
    </div>
  );
}

// ─── Dashboard Admin ──────────────────────────────────────────────────────────
function DashboardAdmin({ act, updateAct, lang }) {
  const [bulk, setBulk] = useState('');
  const [editIdx, setEditIdx] = useState(null);
  const [editText, setEditText] = useState('');
  const [editGroup, setEditGroup] = useState('');
  const questions = act.dashboardQuestions || [];
  const userQs = db.get(`co_dashboard_${act.id}`, []).filter(q => q.userSubmitted);

  const parseBulk = () => {
    const lines = bulk.trim().split('\n').filter(Boolean);
    const parsed = lines.map(line => {
      const parts = line.split('-');
      if (parts.length >= 3) return { id: uid(), group: parts[0].trim(), num: parts[1].trim(), text: parts.slice(2).join('-').trim(), ts: Date.now() };
      return { id: uid(), group: '', num: '', text: line.trim(), ts: Date.now() };
    });
    updateAct({ dashboardQuestions: [...questions, ...parsed] });
    setBulk('');
  };

  const deleteQ = (id) => updateAct({ dashboardQuestions: questions.filter(q => q.id !== id) });
  const saveEdit = () => {
    updateAct({ dashboardQuestions: questions.map((q, i) => i === editIdx ? { ...q, text: editText, group: editGroup } : q) });
    setEditIdx(null);
  };

  const moveUserQ = (q) => {
    const list = db.get(`co_dashboard_${act.id}`, []);
    const idx = list.findIndex(i => i.id === q.id);
    if (idx >= 0) { list[idx].userSubmitted = false; db.set(`co_dashboard_${act.id}`, list); }
    updateAct({ dashboardQuestions: [...questions, { ...q, userSubmitted: false }] });
  };

  return (
    <div>
      <SectionHead>{lang === 'zh' ? '問題清單' : 'Question List'}</SectionHead>

      {/* Bulk import */}
      <Card style={{ marginBottom: 14 }}>
        <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
          {lang === 'zh' ? '批量上傳（格式：分組-編號-問題）' : 'Bulk import (format: Group-Number-Question)'}
        </p>
        <textarea value={bulk} onChange={e => setBulk(e.target.value)} rows={4}
          placeholder={lang === 'zh' ? '設計-01-如何改善現有流程？\n技術-02-資料安全如何確保？' : 'Design-01-How to improve the workflow?\nTech-02-How to ensure data security?'}
          style={{ width: '100%', padding: '8px 10px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 7, fontSize: 13, color: 'var(--text)', resize: 'vertical' }} />
        <Btn size="sm" onClick={parseBulk} style={{ marginTop: 8 }}>
          {lang === 'zh' ? '匯入' : 'Import'}
        </Btn>
      </Card>

      <Toggle
        label={lang === 'zh' ? '允許使用者提交問題' : 'Allow users to submit questions'}
        checked={act.allowUserQuestions}
        onChange={v => updateAct({ allowUserQuestions: v })} />

      {questions.length === 0 && <Empty style={{ marginTop: 12 }}>{lang === 'zh' ? '尚無問題' : 'No questions yet'}</Empty>}
      {questions.map((q, idx) => (
        <div key={q.id} style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8, padding: '8px 12px', background: 'var(--surface-2)', borderRadius: 8 }}>
          {editIdx === idx ? (
            <div style={{ flex: 1, display: 'flex', gap: 6 }}>
              <select value={editGroup} onChange={e => setEditGroup(e.target.value)}
                style={{ padding: '4px 8px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 5, fontSize: 12, color: 'var(--text)' }}>
                <option value="">{lang === 'zh' ? '（無分組）' : '(No group)'}</option>
                {(act.groups || []).map(g => <option key={g.name} value={g.name}>{g.name}</option>)}
              </select>
              <input value={editText} onChange={e => setEditText(e.target.value)}
                style={{ flex: 1, padding: '4px 8px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 5, fontSize: 13, color: 'var(--text)' }} />
              <Btn size="sm" onClick={saveEdit}>✓</Btn>
              <Btn size="sm" variant="ghost" onClick={() => setEditIdx(null)}>✕</Btn>
            </div>
          ) : (
            <>
              {q.group && <Badge color={badgeColor(q.group)}>{q.group}</Badge>}
              <span style={{ flex: 1, fontSize: 13 }}>{q.text}</span>
              <Btn size="sm" variant="ghost" onClick={() => { setEditIdx(idx); setEditText(q.text); setEditGroup(q.group || ''); }}>
                {lang === 'zh' ? '編輯' : 'Edit'}
              </Btn>
              <Btn size="sm" variant="danger" onClick={() => deleteQ(q.id)}>✕</Btn>
            </>
          )}
        </div>
      ))}

      {userQs.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-2)', marginBottom: 8 }}>
            {lang === 'zh' ? '使用者提交的問題' : 'User-submitted questions'}
          </p>
          {userQs.map(q => (
            <div key={q.id} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '8px 12px', background: 'var(--warm-light)', borderRadius: 8, marginBottom: 6, border: '1px solid var(--warm)' }}>
              <span style={{ flex: 1, fontSize: 13 }}>{q.text}</span>
              <Btn size="sm" onClick={() => moveUserQ(q)}>{lang === 'zh' ? '加入清單' : 'Add'}</Btn>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Notes Admin ──────────────────────────────────────────────────────────────
function NotesAdmin({ act, lang }) {
  const notes = db.get(`co_notes_${act.id}`, []);
  const [localNotes, setLocalNotes] = useState(notes);
  const [feedbackId, setFeedbackId] = useState(null);
  const [feedbackText, setFeedbackText] = useState('');

  const refreshNotes = () => setLocalNotes(db.get(`co_notes_${act.id}`, []));

  const updateNote = (id, patch) => {
    const list = db.get(`co_notes_${act.id}`, []);
    const idx = list.findIndex(n => n.id === id);
    if (idx >= 0) { list[idx] = { ...list[idx], ...patch }; db.set(`co_notes_${act.id}`, list); broadcast('co_update', {}); }
    refreshNotes();
  };

  const deleteNote = (id) => {
    const list = db.get(`co_notes_${act.id}`, []).filter(n => n.id !== id);
    db.set(`co_notes_${act.id}`, list);
    broadcast('co_update', {});
    refreshNotes();
  };

  const submitFeedback = () => {
    if (!feedbackText.trim()) return;
    updateNote(feedbackId, { adminFeedback: feedbackText.trim() });
    setFeedbackId(null);
    setFeedbackText('');
  };

  const groups = (act.groups || []).map(g => g.name);

  return (
    <div>
      <SectionHead>{lang === 'zh' ? '共筆管理' : 'Notes Management'}</SectionHead>
      {localNotes.length === 0 ? <Empty>{lang === 'zh' ? '尚無留言' : 'No notes yet'}</Empty> : (
        localNotes.map(n => (
          <Card key={n.id} style={{ marginBottom: 10, opacity: n.hidden ? 0.5 : 1 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', gap: 8, marginBottom: 4, flexWrap: 'wrap', alignItems: 'center' }}>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{n.nick}</span>
                  {n.group && <Badge color={badgeColor(n.group)}>{n.group}</Badge>}
                  {n.hidden && <Badge color="red">{lang === 'zh' ? '已隱藏' : 'Hidden'}</Badge>}
                  <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{new Date(n.ts).toLocaleString()}</span>
                </div>
                <p style={{ fontSize: 14 }}>{n.text}</p>
                {n.adminFeedback && (
                  <div style={{ marginTop: 6, padding: '6px 10px', background: 'var(--accent-light)', borderRadius: 6, fontSize: 13 }}>
                    <Badge color="teal">host</Badge> {n.adminFeedback}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <Btn size="sm" variant="ghost" onClick={() => { setFeedbackId(n.id); setFeedbackText(n.adminFeedback || ''); }}>
                  💬
                </Btn>
                {groups.length > 0 && (
                  <select value={n.group || ''} onChange={e => updateNote(n.id, { group: e.target.value })}
                    style={{ padding: '3px 6px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 5, fontSize: 11, color: 'var(--text)' }}>
                    <option value="">{lang === 'zh' ? '移至分組…' : 'Move to…'}</option>
                    {groups.map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                )}
                <Btn size="sm" variant="ghost" onClick={() => updateNote(n.id, { hidden: !n.hidden })}>
                  {n.hidden ? '👁️' : '🙈'}
                </Btn>
                <Btn size="sm" variant="danger" onClick={() => deleteNote(n.id)}>✕</Btn>
              </div>
            </div>
          </Card>
        ))
      )}

      <Modal open={!!feedbackId} onClose={() => setFeedbackId(null)}
        title={lang === 'zh' ? '新增/編輯回饋' : 'Add/Edit Feedback'}>
        <textarea value={feedbackText} onChange={e => setFeedbackText(e.target.value)} rows={3}
          placeholder={lang === 'zh' ? '給使用者的回饋…' : 'Feedback to user…'}
          style={{ width: '100%', padding: '8px 12px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 7, fontSize: 13, color: 'var(--text)', resize: 'vertical' }} />
        <Btn onClick={submitFeedback} style={{ marginTop: 10 }}>{lang === 'zh' ? '送出回饋' : 'Submit'}</Btn>
      </Modal>
    </div>
  );
}

// ─── Charts Admin ─────────────────────────────────────────────────────────────
function ChartsAdmin({ act, lang }) {
  const charts = db.get(`co_charts_${act.id}`, []);
  const [localCharts, setLocalCharts] = useState(charts);
  const [commentId, setCommentId] = useState(null);
  const [commentText, setCommentText] = useState('');
  const [manualOpen, setManualOpen] = useState(false);
  const [manual, setManual] = useState({ title: '', desc: '', content: '' });

  const refreshCharts = () => setLocalCharts(db.get(`co_charts_${act.id}`, []));

  const updateChart = (id, patch) => {
    const list = db.get(`co_charts_${act.id}`, []);
    const idx = list.findIndex(c => c.id === id);
    if (idx >= 0) { list[idx] = { ...list[idx], ...patch }; db.set(`co_charts_${act.id}`, list); broadcast('co_update', {}); }
    refreshCharts();
  };

  const submitComment = () => {
    if (!commentText.trim()) return;
    const list = db.get(`co_charts_${act.id}`, []);
    const c = list.find(c => c.id === commentId);
    if (c) { c.comments = [...(c.comments || []), { id: uid(), text: commentText.trim(), ts: Date.now() }]; }
    db.set(`co_charts_${act.id}`, list);
    broadcast('co_update', {});
    refreshCharts();
    setCommentId(null);
    setCommentText('');
  };

  const addManualChart = () => {
    if (!manual.title.trim() && !manual.content.trim()) return;
    const list = db.get(`co_charts_${act.id}`, []);
    list.push({
      id: uid(),
      title: manual.title.trim() || (lang === 'zh' ? '手動新增圖表' : 'Manual Chart'),
      desc: manual.desc.trim(),
      content: manual.content.trim(),
      contributor: 'host',
      ts: Date.now(),
    });
    db.set(`co_charts_${act.id}`, list);
    broadcast('co_update', {});
    setManual({ title: '', desc: '', content: '' });
    setManualOpen(false);
    refreshCharts();
  };

  const deleteChart = (id) => {
    const list = db.get(`co_charts_${act.id}`, []).filter(c => c.id !== id);
    db.set(`co_charts_${act.id}`, list);
    broadcast('co_update', {});
    refreshCharts();
  };

  return (
    <div>
      <SectionHead
        title={lang === 'zh' ? '戰略板管理' : 'Strategy Board Management'}
        actions={<Btn size="sm" onClick={() => setManualOpen(true)}>+ {lang === 'zh' ? '新增公開成果' : 'Add Result'}</Btn>}
      />
      {localCharts.length === 0 ? <Empty>{lang === 'zh' ? '尚無公開圖表' : 'No published charts yet'}</Empty> : (
        localCharts.map(c => (
          <Card key={c.id} style={{ marginBottom: 12, opacity: c.hidden ? 0.5 : 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
              <div style={{ flex: 1 }}>
                <h4 style={{ fontSize: 14, marginBottom: 4 }}>{c.title || lang === 'zh' ? '（無標題）' : '(No title)'}</h4>
                {c.contributor && <p style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 6 }}>by {c.contributor}</p>}
                {c.desc && <p style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 8 }}>{c.desc}</p>}
                {(c.comments || []).map((cm, ci) => (
                  <div key={ci} style={{ padding: '6px 10px', background: 'var(--accent-light)', borderRadius: 6, marginBottom: 4 }}>
                    <Badge color="teal">host</Badge>
                    <span style={{ fontSize: 13, marginLeft: 6 }}>{cm.text}</span>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <Btn size="sm" variant="ghost" onClick={() => { setCommentId(c.id); setCommentText(''); }}>💬</Btn>
                <Btn size="sm" variant="ghost" onClick={() => updateChart(c.id, { hidden: !c.hidden })}>
                  {c.hidden ? '👁️' : '🙈'}
                </Btn>
                <Btn size="sm" variant="danger" onClick={() => deleteChart(c.id)}>✕</Btn>
              </div>
            </div>
          </Card>
        ))
      )}

      <Modal open={!!commentId} onClose={() => setCommentId(null)}
        title={lang === 'zh' ? '新增標註說明' : 'Add Comment'}>
        <textarea value={commentText} onChange={e => setCommentText(e.target.value)} rows={3}
          placeholder={lang === 'zh' ? '標註說明或回饋…' : 'Annotation or feedback…'}
          style={{ width: '100%', padding: '8px 12px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 7, fontSize: 13, color: 'var(--text)', resize: 'vertical' }} />
        <Btn onClick={submitComment} style={{ marginTop: 10 }}>{lang === 'zh' ? '送出' : 'Submit'}</Btn>
      </Modal>

      <Modal open={manualOpen} onClose={() => setManualOpen(false)}
        title={lang === 'zh' ? '新增公開成果' : 'Add Published Result'}
        footer={<div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <Btn variant="ghost" onClick={() => setManualOpen(false)}>{lang === 'zh' ? '取消' : 'Cancel'}</Btn>
          <Btn onClick={addManualChart}>{lang === 'zh' ? '新增' : 'Add'}</Btn>
        </div>}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Inp label={lang === 'zh' ? '標題' : 'Title'} value={manual.title} onChange={v => setManual(m => ({ ...m, title: v }))} />
          <Inp label={lang === 'zh' ? '說明' : 'Description'} value={manual.desc} onChange={v => setManual(m => ({ ...m, desc: v }))} />
          <Inp multiline rows={6} label={lang === 'zh' ? '內容（支援 Markdown 或貼上 SVG/表格 HTML）' : 'Content (Markdown or SVG/table HTML)'} value={manual.content} onChange={v => setManual(m => ({ ...m, content: v }))} />
        </div>
      </Modal>
    </div>
  );
}

// ─── Activity Editor ──────────────────────────────────────────────────────────
function ActivityEditor({ actId, onBack }) {
  const { lang } = useLang();
  const [act, setAct] = useState(() => {
    const a = loadActivities().find(a => a.id === actId);
    return a ? clone(a) : blankActivity(lang);
  });
  const [tab, setTab] = useState('basic');
  const [saved, setSaved] = useState(false);

  const updateAct = useCallback((patch) => setAct(prev => ({ ...prev, ...patch })), []);

  useEffect(() => {
    const t = setTimeout(() => { saveActivity(act); setSaved(true); setTimeout(() => setSaved(false), 1500); }, 800);
    return () => clearTimeout(t);
  }, [act]);

  const TABS = [
    { key: 'basic', label: lang === 'zh' ? '基本設定' : 'Basic' },
    { key: 'rules', label: lang === 'zh' ? '規則' : 'Rules' },
    { key: 'resources', label: lang === 'zh' ? '參考資料' : 'Resources' },
    { key: 'notes', label: lang === 'zh' ? '共筆' : 'Notes' },
    { key: 'strategy', label: lang === 'zh' ? '戰略板' : 'Strategy' },
    { key: 'dashboard', label: lang === 'zh' ? '儀表板' : 'Dashboard' },
  ];

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '24px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        <Btn variant="ghost" size="sm" onClick={onBack}>← {lang === 'zh' ? '返回' : 'Back'}</Btn>
        <h2 style={{ fontSize: 20, flex: 1 }}>{act.name}</h2>
        <Badge color="teal">📋 {act.code}</Badge>
        {saved && <Badge color="green">✓ {lang === 'zh' ? '已儲存' : 'Saved'}</Badge>}
      </div>

      <Tabs tabs={TABS} active={tab} onChange={setTab} style={{ marginBottom: 20 }} />

      {tab === 'basic' && (
        <Card>
          <SectionHead>{lang === 'zh' ? '活動資訊' : 'Activity Info'}</SectionHead>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 5 }}>
                {lang === 'zh' ? '活動名稱 *' : 'Activity Name *'}
              </label>
              <Inp value={act.name} onChange={v => updateAct({ name: v })} />
            </div>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 5 }}>
                {lang === 'zh' ? '主辦單位' : 'Organizer'}
              </label>
              <Inp value={act.organizer} onChange={v => updateAct({ organizer: v })} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 5 }}>
                  {lang === 'zh' ? '開始時間' : 'Start Time'}
                </label>
                <input type="datetime-local" value={act.startTime} onChange={e => updateAct({ startTime: e.target.value })}
                  style={{ padding: '7px 10px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 7, fontSize: 13, color: 'var(--text)', width: '100%' }} />
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 5 }}>
                  {lang === 'zh' ? '結束時間' : 'End Time'}
                </label>
                <input type="datetime-local" value={act.endTime} onChange={e => updateAct({ endTime: e.target.value })}
                  style={{ padding: '7px 10px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 7, fontSize: 13, color: 'var(--text)', width: '100%' }} />
              </div>
            </div>
            <div style={{ padding: 16, background: 'var(--surface-2)', borderRadius: 10, border: '1px solid var(--border)' }}>
              <p style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 4 }}>
                {lang === 'zh' ? '前台入口代碼' : 'Front-end entry code'}
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 28, fontWeight: 700, letterSpacing: 6, fontFamily: 'monospace', color: 'var(--accent)' }}>{act.code}</span>
                <Btn size="sm" variant="ghost" onClick={() => updateAct({ code: genCode() })}>
                  🔀 {lang === 'zh' ? '重新產生' : 'Regenerate'}
                </Btn>
              </div>
            </div>
          </div>
        </Card>
      )}

      {tab === 'rules' && (
        <Card>
          <SectionHead>{lang === 'zh' ? '規則設定' : 'Rules'}</SectionHead>
          <p style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 10 }}>
            {lang === 'zh' ? '支援 Markdown 格式' : 'Supports Markdown format'}
          </p>
          <textarea value={act.rules} onChange={e => updateAct({ rules: e.target.value })}
            rows={10} placeholder="# 規則&#10;&#10;- 第一條..."
            style={{ width: '100%', padding: '10px 12px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, color: 'var(--text)', resize: 'vertical', fontFamily: 'monospace' }} />
          {act.rules && (
            <div style={{ marginTop: 12, padding: 14, background: 'var(--surface-2)', borderRadius: 8, fontSize: 13, lineHeight: 1.7 }}
              dangerouslySetInnerHTML={{ __html: mdToHtml(act.rules) }} />
          )}
        </Card>
      )}

      {tab === 'resources' && (
        <Card>
          <SectionHead>{lang === 'zh' ? '參考資料' : 'Resources'}</SectionHead>
          <ResourceEditor items={act.resources || []} onChange={v => updateAct({ resources: v })} lang={lang} />
        </Card>
      )}

      {tab === 'notes' && (
        <div>
          <Card style={{ marginBottom: 14 }}>
            <SectionHead>{lang === 'zh' ? '共筆設定' : 'Notes Settings'}</SectionHead>
            <Toggle label={lang === 'zh' ? '啟用分組功能' : 'Enable grouping'}
              checked={act.groupsEnabled} onChange={v => updateAct({ groupsEnabled: v })} />
            {act.groupsEnabled && (
              <div style={{ marginTop: 12 }}>
                <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
                  {lang === 'zh' ? '分組設定（可拖動排序）' : 'Group settings (drag to reorder)'}
                </p>
                <GroupEditor groups={act.groups || []} onChange={v => updateAct({ groups: v })} lang={lang} />
              </div>
            )}
          </Card>
          <NotesAdmin act={act} lang={lang} />
        </div>
      )}

      {tab === 'strategy' && <ChartsAdmin act={act} lang={lang} />}

      {tab === 'dashboard' && (
        <Card>
          <DashboardAdmin act={act} updateAct={updateAct} lang={lang} />
        </Card>
      )}
    </div>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────
export default function CoAdmin() {
  const [authed, setAuthed] = useState(() => checkSession('co_admin'));
  const [editId, setEditId] = useState(null);
  const { lang } = useLang();

  if (!authed) return <AdminLogin namespace="co_admin" lang={lang} title={lang === 'zh' ? '共創工作站後台' : 'Co-creation Admin'} onLogin={() => setAuthed(true)} />;
  if (editId) return <ActivityEditor actId={editId} onBack={() => setEditId(null)} />;
  return (
    <ActivityList
      onEdit={setEditId}
      onLogout={() => { destroySession('co_admin'); setAuthed(false); }}
    />
  );
}
