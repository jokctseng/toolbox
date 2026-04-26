import React, { useState, useEffect, useCallback } from 'react';
import {
  db, uid, broadcast,
  generateOTP, verifyOTP, checkSession, createSession, destroySession, checkAndArchive,
} from '../store.js';
import { exportCSV, clone, mdToHtml, wordFrequency, badgeColor } from '../utils.js';
import {
  Btn, Card, Modal, Inp, NumInp, Toggle, Badge, Tabs, DragList, Confirm, SectionHead, Empty, Spinner, Progress,
} from '../components/UI.jsx';
import { useLang, nav } from '../App.jsx';
import AdminLogin from '../components/AdminLogin.jsx';

// ─── helpers ────────────────────────────────────────────────────────────────
const MAX_ACTIVITIES = 10;
const genCode = () => Math.random().toString(36).slice(2, 8).toUpperCase();

function loadActivities() { return db.get('qa_activities', []); }
function saveActivities(list) {
  db.set('qa_activities', list);
  broadcast('qa_update', {});
}
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
    name: lang === 'zh' ? '新活動' : 'New Activity',
    desc: '',
    endTime: '',
    archived: false,
    rulesEnabled: false,
    rules: '',
    agenda: [],
    resources: [],
    questions: [],
    qna: [],
  };
}

function blankQuestion(type) {
  const base = { id: uid(), type, title: '', desc: '', showResult: true, open: false };
  if (type === 'poll') return { ...base, multiSelect: false, maxSelect: 1, options: ['', ''] };
  if (type === 'wordcloud') return { ...base, multiInput: true, aiGroup: false, groupVote: false, groupVoteMax: 1, groupResult: null };
  if (type === 'idea') return { ...base };
  if (type === 'challenge') return { ...base, hasAnswer: true, showRanking: true, scoreMap: [], questions: [{ id: uid(), text: '', options: [{ text: '', score: 0 }], answer: 0 }] };
  return base;
}

// ─── OTP Login ───────────────────────────────────────────────────────────────
function OTPLogin({ onLogin }) {
  const { lang } = useLang();
  const [phase, setPhase] = useState('request'); // request | enter
  const [otp, setOtp] = useState('');
  const [genOtp, setGenOtp] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  const requestOTP = async () => {
    setLoading(true);
    const code = await generateOTP('qa_admin');
    setGenOtp(code);
    setPhase('enter');
    setLoading(false);
  };

  const verify = async () => {
    setLoading(true);
    const ok = await verifyOTP(otp.trim(), 'qa_admin');
    setLoading(false);
    if (ok) { createSession('qa_admin'); onLogin(); }
    else setErr(lang === 'zh' ? '密碼錯誤或已過期' : 'Invalid or expired code');
  };

  return (
    <div style={{ maxWidth: 400, margin: '80px auto', padding: 20 }}>
      <Card>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>🔐</div>
          <h2 style={{ fontSize: 20 }}>{lang === 'zh' ? 'Q&A 後台' : 'Q&A Admin'}</h2>
        </div>
        {phase === 'request' ? (
          <>
            <p style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 16, lineHeight: 1.6 }}>
              {lang === 'zh' ? '點選下方按鈕產生一次性登入密碼（僅顯示一次）。請確認您是本工具的管理員。' : 'Click below to generate a one-time password. It will only be shown once.'}
            </p>
            <Btn onClick={requestOTP} loading={loading} style={{ width: '100%', justifyContent: 'center' }}>
              {lang === 'zh' ? '產生一次性密碼' : 'Generate OTP'}
            </Btn>
          </>
        ) : (
          <>
            <div style={{
              background: 'var(--warm-light)', border: '1px solid var(--warm)',
              borderRadius: 10, padding: 16, marginBottom: 16, textAlign: 'center',
            }}>
              <p style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 4 }}>
                {lang === 'zh' ? '你的一次性密碼（僅顯示一次）' : 'Your OTP (shown once only)'}
              </p>
              <div style={{ fontSize: 32, fontWeight: 700, letterSpacing: 8, color: 'var(--warm)', fontFamily: 'monospace' }}>
                {genOtp}
              </div>
            </div>
            <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>
              {lang === 'zh' ? '輸入密碼' : 'Enter OTP'}
            </label>
            <input
              value={otp} onChange={e => setOtp(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && verify()}
              maxLength={6} placeholder="000000"
              style={{
                width: '100%', padding: '10px 14px', fontSize: 22, letterSpacing: 6,
                textAlign: 'center', fontFamily: 'monospace',
                background: 'var(--surface-2)', border: '1px solid var(--border)',
                borderRadius: 8, color: 'var(--text)',
              }} />
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

// ─── Activity List ────────────────────────────────────────────────────────────
function ActivityList({ onEdit, onLogout }) {
  const { lang } = useLang();
  const [activities, setActivities] = useState(() => { checkAndArchive(); return loadActivities().filter(a => !a.archived); });
  const [delConfirm, setDelConfirm] = useState(null);

  const refresh = () => { checkAndArchive(); setActivities(loadActivities().filter(a => !a.archived)); };

  const createNew = () => {
    if (activities.length >= MAX_ACTIVITIES) return;
    const act = blankActivity(lang);
    saveActivity(act);
    refresh();
    onEdit(act.id);
  };

  const deleteAct = (id) => {
    const list = loadActivities().filter(a => a.id !== id);
    saveActivities(list);
    refresh();
  };

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '24px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 10 }}>
        <h2 style={{ fontSize: 22 }}>⚙️ {lang === 'zh' ? 'Q&A 後台管理' : 'Q&A Admin'}</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <Btn variant="ghost" size="sm" onClick={onLogout}>
            {lang === 'zh' ? '登出' : 'Logout'}
          </Btn>
          <Btn onClick={createNew} disabled={activities.length >= MAX_ACTIVITIES}>
            + {lang === 'zh' ? '新增活動' : 'New Activity'}
          </Btn>
        </div>
      </div>

      {activities.length === 0 ? (
        <Empty>{lang === 'zh' ? '尚無活動，點選「新增活動」開始' : 'No activities yet. Click "New Activity" to start.'}</Empty>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {activities.map(act => (
            <Card key={act.id} style={{ padding: '16px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 180 }}>
                  <h3 style={{ fontSize: 16, marginBottom: 4 }}>{act.name}</h3>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <Badge color="teal">📋 {act.code}</Badge>
                    {act.endTime && (
                      <Badge color={new Date(act.endTime) < new Date() ? 'red' : 'blue'}>
                        {lang === 'zh' ? '截止' : 'End'}: {new Date(act.endTime).toLocaleDateString()}
                      </Badge>
                    )}
                    <Badge color="gray">
                      {(act.questions || []).length} {lang === 'zh' ? '題' : 'Qs'}
                    </Badge>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <Btn size="sm" variant="ghost" onClick={() => nav(`/qa?code=${act.code}`)}>
                    {lang === 'zh' ? '前台' : 'Front'}↗
                  </Btn>
                  <Btn size="sm" onClick={() => onEdit(act.id)}>
                    {lang === 'zh' ? '編輯' : 'Edit'}
                  </Btn>
                  <Btn size="sm" variant="danger" onClick={() => setDelConfirm(act.id)}>✕</Btn>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {activities.length >= MAX_ACTIVITIES && (
        <p style={{ fontSize: 13, color: 'var(--text-3)', textAlign: 'center', marginTop: 12 }}>
          {lang === 'zh' ? `已達上限 ${MAX_ACTIVITIES} 個活動` : `Max ${MAX_ACTIVITIES} activities reached`}
        </p>
      )}

      <Confirm
        open={!!delConfirm}
        message={lang === 'zh' ? '確定刪除此活動？此操作無法復原。' : 'Delete this activity? This cannot be undone.'}
        onConfirm={() => { deleteAct(delConfirm); setDelConfirm(null); }}
        onCancel={() => setDelConfirm(null)}
      />
    </div>
  );
}

// ─── Agenda Editor ────────────────────────────────────────────────────────────
function AgendaEditor({ items, onChange, lang }) {
  const add = () => onChange([...items, { id: uid(), time: '', duration: '', item: '' }]);
  const update = (id, field, val) => onChange(items.map(i => i.id === id ? { ...i, [field]: val } : i));
  const remove = (id) => onChange(items.filter(i => i.id !== id));

  return (
    <div>
      {items.map((item) => (
        <div key={item.id} style={{ display: 'grid', gridTemplateColumns: '80px 60px 1fr auto', gap: 8, marginBottom: 8, alignItems: 'center' }}>
          <input value={item.time} onChange={e => update(item.id, 'time', e.target.value)}
            placeholder="09:00"
            style={{ padding: '6px 8px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 13, color: 'var(--text)' }} />
          <input value={item.duration} onChange={e => update(item.id, 'duration', e.target.value)}
            placeholder={lang === 'zh' ? '分鐘' : 'min'}
            style={{ padding: '6px 8px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 13, color: 'var(--text)' }} />
          <input value={item.item} onChange={e => update(item.id, 'item', e.target.value)}
            placeholder={lang === 'zh' ? '議程項目' : 'Agenda item'}
            style={{ padding: '6px 8px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 13, color: 'var(--text)', width: '100%' }} />
          <button onClick={() => remove(item.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', fontSize: 16 }}>✕</button>
        </div>
      ))}
      <Btn size="sm" variant="ghost" onClick={add}>+ {lang === 'zh' ? '新增議程' : 'Add Item'}</Btn>
    </div>
  );
}

// ─── Resource Editor ─────────────────────────────────────────────────────────
function ResourceEditor({ items, onChange, lang }) {
  const add = () => onChange([...items, { id: uid(), type: '', name: '', url: '', desc: '' }]);
  const update = (id, field, val) => onChange(items.map(i => i.id === id ? { ...i, [field]: val } : i));
  const remove = (id) => onChange(items.filter(i => i.id !== id));
  const move = (idx, dir) => {
    const to = idx + dir;
    if (to < 0 || to >= items.length) return;
    const arr = [...items];
    [arr[idx], arr[to]] = [arr[to], arr[idx]];
    onChange(arr);
  };

  const COLORS = ['teal', 'blue', 'amber', 'green', 'purple', 'red', 'gray'];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {items.map((item, idx) => (
        <div key={item.id} style={{ background: 'var(--surface-2)', borderRadius: 8, padding: 12, border: '1px solid var(--border)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr', gap: 8, marginBottom: 8 }}>
            <input value={item.type} onChange={e => update(item.id, 'type', e.target.value)}
              placeholder={lang === 'zh' ? '標籤' : 'Tag'}
              style={{ padding: '6px 8px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 13, color: 'var(--text)' }} />
            <input value={item.name} onChange={e => update(item.id, 'name', e.target.value)}
              placeholder={lang === 'zh' ? '顯示名稱 *' : 'Display Name *'}
              style={{ padding: '6px 8px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 13, color: 'var(--text)', width: '100%' }} />
          </div>
          <input value={item.url} onChange={e => update(item.id, 'url', e.target.value)}
            placeholder="https://..."
            style={{ padding: '6px 8px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 13, color: 'var(--text)', width: '100%', marginBottom: 8, display: 'block' }} />
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input value={item.desc} onChange={e => update(item.id, 'desc', e.target.value)}
              placeholder={lang === 'zh' ? '滑鼠移過去的說明（選填）' : 'Tooltip description (optional)'}
              style={{ padding: '6px 8px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 13, color: 'var(--text)', flex: 1 }} />
            <button onClick={() => move(idx, -1)} disabled={idx === 0} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, opacity: idx === 0 ? .35 : 1 }}>↑</button>
            <button onClick={() => move(idx, 1)} disabled={idx === items.length - 1} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, opacity: idx === items.length - 1 ? .35 : 1 }}>↓</button>
            <button onClick={() => remove(item.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', fontSize: 16 }}>✕</button>
          </div>
        </div>
      ))}
      <Btn size="sm" variant="ghost" onClick={add}>+ {lang === 'zh' ? '新增資料' : 'Add Resource'}</Btn>
    </div>
  );
}

// ─── Question Editors ─────────────────────────────────────────────────────────
function PollEditor({ q, onChange, lang }) {
  const updateOpt = (i, val) => {
    const opts = [...q.options];
    opts[i] = val;
    onChange({ ...q, options: opts });
  };
  const addOpt = () => onChange({ ...q, options: [...q.options, ''] });
  const removeOpt = (i) => onChange({ ...q, options: q.options.filter((_, idx) => idx !== i) });
  const moveOpt = (from, to) => {
    const opts = [...q.options];
    const [item] = opts.splice(from, 1);
    opts.splice(to, 0, item);
    onChange({ ...q, options: opts });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <Toggle label={lang === 'zh' ? '允許複選' : 'Multi-select'}
          checked={q.multiSelect} onChange={v => onChange({ ...q, multiSelect: v, maxSelect: v ? q.maxSelect : 1 })} />
        {q.multiSelect && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
            <span style={{ color: 'var(--text-2)' }}>{lang === 'zh' ? '最多選' : 'Max'}</span>
            <NumInp value={q.maxSelect} onChange={v => onChange({ ...q, maxSelect: v })} min={1} max={q.options.length} />
            <span style={{ color: 'var(--text-2)' }}>{lang === 'zh' ? '項' : 'options'}</span>
          </div>
        )}
      </div>
      <div>
        <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-2)', marginBottom: 8 }}>
          {lang === 'zh' ? '選項（可拖動排序）' : 'Options (drag to reorder)'}
        </p>
        {q.options.map((opt, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 6, alignItems: 'center' }}>
            <span style={{ color: 'var(--text-3)', cursor: 'grab', fontSize: 14 }}>⠿</span>
            <input value={opt} onChange={e => updateOpt(i, e.target.value)}
              placeholder={`${lang === 'zh' ? '選項' : 'Option'} ${i + 1}`}
              style={{ flex: 1, padding: '6px 10px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 13, color: 'var(--text)' }} />
            {i > 0 && <button onClick={() => moveOpt(i, i - 1)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14 }}>↑</button>}
            {i < q.options.length - 1 && <button onClick={() => moveOpt(i, i + 1)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14 }}>↓</button>}
            {q.options.length > 2 && <button onClick={() => removeOpt(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', fontSize: 14 }}>✕</button>}
          </div>
        ))}
        <Btn size="sm" variant="ghost" onClick={addOpt}>+ {lang === 'zh' ? '新增選項' : 'Add Option'}</Btn>
      </div>
    </div>
  );
}

function WordCloudEditor({ q, onChange, lang }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <Toggle label={lang === 'zh' ? '允許多次輸入' : 'Allow multiple inputs'} checked={q.multiInput} onChange={v => onChange({ ...q, multiInput: v })} />
      <Toggle label={lang === 'zh' ? '啟動 AI 分組' : 'Enable AI Grouping'} checked={q.aiGroup} onChange={v => onChange({ ...q, aiGroup: v, groupVote: v ? q.groupVote : false })} />
      {q.aiGroup && (
        <Toggle label={lang === 'zh' ? '啟動分組投票' : 'Enable Group Voting'} checked={q.groupVote} onChange={v => onChange({ ...q, groupVote: v })} />
      )}
      {q.aiGroup && q.groupVote && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
          <span style={{ color: 'var(--text-2)' }}>{lang === 'zh' ? '每人可投票數' : 'Votes per person'}</span>
          <NumInp value={q.groupVoteMax || 1} onChange={v => onChange({ ...q, groupVoteMax: v })} min={1} max={20} />
        </div>
      )}
    </div>
  );
}

function IdeaEditor({ q, onChange, lang }) {
  return (
    <p style={{ fontSize: 13, color: 'var(--text-2)' }}>
      {lang === 'zh'
        ? '點子板允許使用者提交公開或私密點子，管理員可查看所有點子並給予留言回饋。'
        : 'Idea board allows users to submit public or private ideas. Admin can view all and provide feedback.'}
    </p>
  );
}

function ChallengeEditor({ q, onChange, lang }) {
  const updateQ = (idx, field, val) => {
    const qs = clone(q.questions);
    qs[idx] = { ...qs[idx], [field]: val };
    onChange({ ...q, questions: qs });
  };
  const updateOpt = (qi, oi, field, val) => {
    const qs = clone(q.questions);
    qs[qi].options[oi] = { ...qs[qi].options[oi], [field]: val };
    onChange({ ...q, questions: qs });
  };
  const addQ = () => {
    if (q.questions.length >= 10) return;
    onChange({ ...q, questions: [...q.questions, { id: uid(), text: '', options: [{ text: '', score: 0 }], answer: 0 }] });
  };
  const removeQ = (idx) => onChange({ ...q, questions: q.questions.filter((_, i) => i !== idx) });
  const addOpt = (qi) => {
    const qs = clone(q.questions);
    qs[qi].options.push({ text: '', score: 0 });
    onChange({ ...q, questions: qs });
  };
  const removeOpt = (qi, oi) => {
    const qs = clone(q.questions);
    qs[qi].options = qs[qi].options.filter((_, i) => i !== oi);
    onChange({ ...q, questions: qs });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <Toggle label={lang === 'zh' ? '有正確解答' : 'Has correct answer'} checked={q.hasAnswer} onChange={v => onChange({ ...q, hasAnswer: v })} />
        <Toggle label={lang === 'zh' ? '顯示排名' : 'Show ranking'} checked={q.showRanking} onChange={v => onChange({ ...q, showRanking: v })} />
      </div>
      {q.questions.map((cq, qi) => (
        <div key={cq.id} style={{ background: 'var(--surface-2)', borderRadius: 10, padding: 12, border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)', minWidth: 24 }}>Q{qi + 1}</span>
            <input value={cq.text} onChange={e => updateQ(qi, 'text', e.target.value)}
              placeholder={lang === 'zh' ? '題目' : 'Question text'}
              style={{ flex: 1, padding: '6px 10px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 13, color: 'var(--text)' }} />
            {q.questions.length > 1 && (
              <button onClick={() => removeQ(qi)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', fontSize: 14 }}>✕</button>
            )}
          </div>
          {cq.options.map((opt, oi) => (
            <div key={oi} style={{ display: 'flex', gap: 6, marginBottom: 6, alignItems: 'center' }}>
              {q.hasAnswer ? (
                <input type="radio" name={`ans_${cq.id}`} checked={cq.answer === oi}
                  onChange={() => updateQ(qi, 'answer', oi)}
                  title={lang === 'zh' ? '正確答案' : 'Correct answer'} />
              ) : (
                <input type="number" value={opt.score} onChange={e => updateOpt(qi, oi, 'score', Number(e.target.value))}
                  style={{ width: 50, padding: '4px 6px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 12, color: 'var(--text)' }} />
              )}
              <input value={opt.text} onChange={e => updateOpt(qi, oi, 'text', e.target.value)}
                placeholder={`${lang === 'zh' ? '選項' : 'Option'} ${oi + 1}`}
                style={{ flex: 1, padding: '5px 9px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 13, color: 'var(--text)' }} />
              {cq.options.length > 1 && (
                <button onClick={() => removeOpt(qi, oi)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', fontSize: 13 }}>✕</button>
              )}
            </div>
          ))}
          <Btn size="sm" variant="ghost" onClick={() => addOpt(qi)}>+ {lang === 'zh' ? '選項' : 'Option'}</Btn>
        </div>
      ))}
      {q.questions.length < 10 && (
        <Btn size="sm" variant="ghost" onClick={addQ}>+ {lang === 'zh' ? '新增題目' : 'Add Sub-question'}</Btn>
      )}

      {/* Score map */}
      <div>
        <Toggle label={lang === 'zh' ? '設置對應結果描述' : 'Set score range descriptions'}
          checked={q.useScoreMap} onChange={v => onChange({ ...q, useScoreMap: v, scoreMap: v ? (q.scoreMap?.length ? q.scoreMap : [{ id: uid(), min: 0, max: 100, label: '', desc: '' }]) : [] })} />
        {q.useScoreMap && (q.scoreMap || []).map((sm, si) => (
          <div key={sm.id} style={{ display: 'grid', gridTemplateColumns: '50px 50px 1fr 1fr auto', gap: 6, marginTop: 8, alignItems: 'center' }}>
            <input type="number" value={sm.min} onChange={e => { const s = clone(q.scoreMap); s[si].min = Number(e.target.value); onChange({ ...q, scoreMap: s }); }}
              style={{ padding: '5px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 5, fontSize: 12, color: 'var(--text)' }} />
            <input type="number" value={sm.max} onChange={e => { const s = clone(q.scoreMap); s[si].max = Number(e.target.value); onChange({ ...q, scoreMap: s }); }}
              style={{ padding: '5px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 5, fontSize: 12, color: 'var(--text)' }} />
            <input value={sm.label} onChange={e => { const s = clone(q.scoreMap); s[si].label = e.target.value; onChange({ ...q, scoreMap: s }); }}
              placeholder={lang === 'zh' ? '稱號' : 'Label'}
              style={{ padding: '5px 8px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 5, fontSize: 12, color: 'var(--text)' }} />
            <input value={sm.desc} onChange={e => { const s = clone(q.scoreMap); s[si].desc = e.target.value; onChange({ ...q, scoreMap: s }); }}
              placeholder={lang === 'zh' ? '描述' : 'Description'}
              style={{ padding: '5px 8px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 5, fontSize: 12, color: 'var(--text)' }} />
            <button onClick={() => onChange({ ...q, scoreMap: q.scoreMap.filter((_, i) => i !== si) })}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', fontSize: 13 }}>✕</button>
          </div>
        ))}
        {q.useScoreMap && (
          <Btn size="sm" variant="ghost" style={{ marginTop: 8 }}
            onClick={() => onChange({ ...q, scoreMap: [...(q.scoreMap || []), { id: uid(), min: 0, max: 100, label: '', desc: '' }] })}>
            + {lang === 'zh' ? '新增區間' : 'Add Range'}
          </Btn>
        )}
      </div>
    </div>
  );
}

const Q_TYPES = [
  { type: 'poll', icon: '📊', zh: '選擇題', en: 'Poll' },
  { type: 'wordcloud', icon: '☁️', zh: '文字雲', en: 'Word Cloud' },
  { type: 'idea', icon: '💡', zh: '點子板', en: 'Idea Board' },
  { type: 'challenge', icon: '🏆', zh: '計分挑戰', en: 'Challenge' },
];

function QuestionEditor({ q, onChange, lang }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Common fields */}
      <div>
        <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 5 }}>
          {lang === 'zh' ? '問題標題 *' : 'Question Title *'}
        </label>
        <input value={q.title} onChange={e => onChange({ ...q, title: e.target.value })}
          style={{ width: '100%', padding: '8px 12px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 14, color: 'var(--text)' }} />
      </div>
      <div>
        <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 5 }}>
          {lang === 'zh' ? '問題說明（選填）' : 'Description (optional)'}
        </label>
        <textarea value={q.desc} onChange={e => onChange({ ...q, desc: e.target.value })} rows={2}
          style={{ width: '100%', padding: '8px 12px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, color: 'var(--text)', resize: 'vertical' }} />
      </div>
      <Toggle label={lang === 'zh' ? '向使用者顯示結果' : 'Show results to users'} checked={q.showResult} onChange={v => onChange({ ...q, showResult: v })} />
      <hr style={{ border: 'none', borderTop: '1px solid var(--border)' }} />
      {q.type === 'poll' && <PollEditor q={q} onChange={onChange} lang={lang} />}
      {q.type === 'wordcloud' && <WordCloudEditor q={q} onChange={onChange} lang={lang} />}
      {q.type === 'idea' && <IdeaEditor q={q} onChange={onChange} lang={lang} />}
      {q.type === 'challenge' && <ChallengeEditor q={q} onChange={onChange} lang={lang} />}
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
  const [editQ, setEditQ] = useState(null);
  const [addQType, setAddQType] = useState(null);
  const [aiLoading, setAiLoading] = useState(null); // question id
  const [aiError, setAiError] = useState('');
  const [exportQ, setExportQ] = useState(null);
  const [saved, setSaved] = useState(false);

  const updateAct = (patch) => setAct(prev => ({ ...prev, ...patch }));

  const save = useCallback(() => {
    saveActivity(act);
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  }, [act]);

  // Auto-save on change
  useEffect(() => {
    const t = setTimeout(() => saveActivity(act), 800);
    return () => clearTimeout(t);
  }, [act]);

  const addQuestion = (type) => {
    if ((act.questions || []).length >= 5) return;
    const q = blankQuestion(type);
    updateAct({ questions: [...(act.questions || []), q] });
    setAddQType(null);
    setEditQ(q.id);
  };

  const updateQuestion = (updated) => {
    updateAct({ questions: act.questions.map(q => q.id === updated.id ? updated : q) });
  };

  const deleteQuestion = (id) => {
    updateAct({ questions: act.questions.filter(q => q.id !== id) });
    if (editQ === id) setEditQ(null);
  };

  const toggleOpen = (id) => {
    updateAct({ questions: act.questions.map(q => q.id === id ? { ...q, open: !q.open } : q) });
  };

  // AI grouping
  const runAIGroup = async (qId) => {
    const q = act.questions.find(q => q.id === qId);
    if (!q) return;
    const entries = db.get(`qa_wc_${act.id}_${qId}`, []);
    if (!entries.length) return;
    const words = entries.map(e => e.text).join('\n');
    setAiLoading(qId);
    setAiError('');
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          messages: [{
            role: 'user',
            content: `You are a workshop facilitator. Group these responses into 3-6 conceptual categories. Respond ONLY with JSON like:
{"groups":[{"name":"Group Name","items":["item1","item2"]}]}

Responses to group:
${words}`,
          }],
        }),
      });
      const data = await res.json();
      const text = data.content?.find(c => c.type === 'text')?.text || '';
      const clean = text.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(clean);
      const updated = { ...q, groupResult: parsed.groups, aiGroupDone: false };
      updateQuestion(updated);
    } catch (e) {
      setAiError(lang === 'zh' ? 'AI 分組失敗，請確認 API 可用' : 'AI grouping failed');
    }
    setAiLoading(null);
  };

  const confirmGroup = (qId) => {
    updateAct({ questions: act.questions.map(q => q.id === qId ? { ...q, aiGroupDone: true } : q) });
    broadcast('qa_update', {});
  };

  // Export results
  const handleExport = (q) => {
    const rows = [];
    const actId = act.id;
    if (q.type === 'poll') {
      const votes = db.get(`qa_votes_${actId}_${q.id}`, {});
      // tally
      const tally = {};
      const combos = {};
      Object.values(votes).forEach(v => {
        const sel = Array.isArray(v.selections) ? v.selections : [v.selections];
        sel.forEach(s => { tally[s] = (tally[s] || 0) + 1; });
        const key = sel.sort().join('');
        combos[key] = (combos[key] || 0) + 1;
      });
      rows.push([q.title]);
      rows.push([lang === 'zh' ? '選項' : 'Option', lang === 'zh' ? '票數' : 'Count']);
      q.options.forEach((opt, i) => rows.push([opt, tally[i] || 0]));
      if (q.multiSelect) {
        rows.push([]);
        rows.push([lang === 'zh' ? '組合' : 'Combination', lang === 'zh' ? '票數' : 'Count']);
        Object.entries(combos).forEach(([k, v]) => rows.push([k, v]));
      }
    } else if (q.type === 'wordcloud') {
      const entries = db.get(`qa_wc_${actId}_${q.id}`, []);
      if (q.aiGroup && q.aiGroupDone && q.groupResult) {
        rows.push([q.title]);
        rows.push([lang === 'zh' ? '分組' : 'Group', lang === 'zh' ? '關鍵詞' : 'Keywords',
          ...(q.groupVote ? [lang === 'zh' ? '票數' : 'Votes'] : [])]);
        const groupVotes = db.get(`qa_gv_${actId}_${q.id}`, {});
        q.groupResult.forEach(g => {
          const total = Object.values(groupVotes).reduce((s, v) => s + (v[g.name] || 0), 0);
          rows.push([g.name, g.items.join(', '), ...(q.groupVote ? [total] : [])]);
        });
      } else {
        const freq = wordFrequency(entries.map(e => e.text));
        rows.push([q.title]);
        rows.push([lang === 'zh' ? '詞' : 'Word', lang === 'zh' ? '頻率' : 'Freq']);
        freq.forEach(({ word, count }) => rows.push([word, count]));
      }
    } else if (q.type === 'idea') {
      const ideas = db.get(`qa_ideas_${actId}_${q.id}`, []);
      rows.push([q.title]);
      rows.push([lang === 'zh' ? '點子' : 'Idea', lang === 'zh' ? '愛心' : 'Hearts', lang === 'zh' ? '回饋' : 'Feedback', lang === 'zh' ? '公開' : 'Public']);
      ideas.filter(i => i.public).forEach(i => rows.push([i.text, i.hearts || 0, i.feedback || '', '✓']));
    } else if (q.type === 'challenge') {
      const scores = db.get(`qa_ch_${actId}_${q.id}`, {});
      rows.push([q.title]);
      // per-question stats
      q.questions.forEach((sq, si) => {
        const qScores = Object.values(scores).map(s => s.perQ?.[si] || 0);
        if (qScores.length) {
          const avg = qScores.reduce((a, b) => a + b, 0) / qScores.length;
          const sorted = [...qScores].sort((a, b) => a - b);
          const q1 = sorted[Math.floor(sorted.length * 0.25)];
          const q3 = sorted[Math.floor(sorted.length * 0.75)];
          rows.push([`Q${si + 1}: ${sq.text}`, `Avg: ${avg.toFixed(1)}`, `Q1: ${q1}`, `Q3: ${q3}`]);
        }
      });
      const totals = Object.values(scores).map(s => s.total || 0).sort((a, b) => b - a);
      if (totals.length) {
        const avg = totals.reduce((a, b) => a + b, 0) / totals.length;
        const q1 = totals[Math.floor(totals.length * 0.75)];
        const q3 = totals[Math.floor(totals.length * 0.25)];
        rows.push(['Total', `Avg: ${avg.toFixed(1)}`, `Q1: ${q1}`, `Q3: ${q3}`]);
      }
    }

    const ts = new Date().toISOString().slice(0, 16).replace('T', '_').replace(/:/g, '');
    exportCSV(rows, `${ts}_Report`);
  };

  // QnA management
  const qnaItems = act.posts || [];
  const deleteMsg = (id) => updateAct({ posts: qnaItems.filter(q => q.id !== id && q.parentId !== id) });
  const toggleHide = (id) => updateAct({ posts: qnaItems.map(q => q.id === id ? { ...q, hidden: !q.hidden } : q) });

  const TABS = [
    { key: 'basic', label: lang === 'zh' ? '基本設定' : 'Basic' },
    { key: 'agenda', label: lang === 'zh' ? '議程' : 'Agenda' },
    { key: 'interact', label: lang === 'zh' ? '互動區' : 'Interactive' },
    { key: 'qna', label: lang === 'zh' ? '問答區' : 'Q&A' },
    { key: 'resources', label: lang === 'zh' ? '參考資料' : 'Resources' },
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

      {/* Basic settings */}
      {tab === 'basic' && (
        <Card>
          <SectionHead>{lang === 'zh' ? '活動設置' : 'Activity Settings'}</SectionHead>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 5 }}>
                {lang === 'zh' ? '活動名稱 *' : 'Activity Name *'}
              </label>
              <Inp value={act.name} onChange={v => updateAct({ name: v })} />
            </div>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 5 }}>
                {lang === 'zh' ? '描述（選填）' : 'Description (optional)'}
              </label>
              <textarea value={act.desc} onChange={e => updateAct({ desc: e.target.value })} rows={2}
                style={{ width: '100%', padding: '8px 12px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, color: 'var(--text)', resize: 'vertical' }} />
            </div>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 5 }}>
                {lang === 'zh' ? '活動結束時間（10天後自動封存）' : 'End Time (auto-archived 10 days after)'}
              </label>
              <input type="datetime-local" value={act.endTime}
                onChange={e => updateAct({ endTime: e.target.value })}
                style={{ padding: '8px 12px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, color: 'var(--text)' }} />
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

      {/* Agenda */}
      {tab === 'agenda' && (
        <Card>
          <SectionHead>{lang === 'zh' ? '議程表' : 'Agenda'}</SectionHead>
          <AgendaEditor items={act.agenda || []} onChange={v => updateAct({ agenda: v })} lang={lang} />
          <div style={{ marginTop: 20 }}>
            <Toggle
              label={lang === 'zh' ? '啟用行為守則' : 'Enable Code of Conduct'}
              checked={act.rulesEnabled} onChange={v => updateAct({ rulesEnabled: v })} />
            {act.rulesEnabled && (
              <div style={{ marginTop: 12 }}>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>
                  {lang === 'zh' ? '行為守則（支援 Markdown）' : 'Code of Conduct (Markdown supported)'}
                </label>
                <textarea
                  value={act.rules} onChange={e => updateAct({ rules: e.target.value })}
                  rows={8} placeholder="# 行為守則&#10;&#10;..."
                  style={{ width: '100%', padding: '10px 12px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, color: 'var(--text)', resize: 'vertical', fontFamily: 'monospace' }} />
                {act.rules && (
                  <div style={{ marginTop: 10, padding: 14, background: 'var(--surface-2)', borderRadius: 8, fontSize: 13, lineHeight: 1.7 }}
                    dangerouslySetInnerHTML={{ __html: mdToHtml(act.rules) }} />
                )}
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Interactive questions */}
      {tab === 'interact' && (
        <div>
          {(act.questions || []).length === 0 && (
            <Empty>{lang === 'zh' ? '尚無互動題目，最多可新增 5 個' : 'No questions yet. Add up to 5.'}</Empty>
          )}
          {(act.questions || []).map((q) => {
            const typeInfo = Q_TYPES.find(t => t.type === q.type);
            return (
              <Card key={q.id} style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: editQ === q.id ? 16 : 0 }}>
                  <span style={{ fontSize: 18 }}>{typeInfo?.icon}</span>
                  <span style={{ fontSize: 14, fontWeight: 600, flex: 1 }}>
                    {q.title || (lang === 'zh' ? `（未命名 ${typeInfo?.zh}）` : `(Untitled ${typeInfo?.en})`)}
                  </span>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <Badge color={q.open ? 'green' : 'gray'}>
                      {q.open ? (lang === 'zh' ? '開放中' : 'Open') : (lang === 'zh' ? '未開放' : 'Closed')}
                    </Badge>
                    <Btn size="sm" variant={q.open ? 'danger' : 'primary'}
                      onClick={() => { toggleOpen(q.id); broadcast('qa_update', {}); }}>
                      {q.open ? (lang === 'zh' ? '關閉' : 'Close') : (lang === 'zh' ? '開始' : 'Open')}
                    </Btn>
                    <Btn size="sm" variant="ghost" onClick={() => setEditQ(editQ === q.id ? null : q.id)}>
                      {editQ === q.id ? (lang === 'zh' ? '收起' : 'Collapse') : (lang === 'zh' ? '編輯' : 'Edit')}
                    </Btn>
                    <Btn size="sm" variant="ghost" onClick={() => handleExport(q)}>
                      {lang === 'zh' ? '匯出' : 'Export'}
                    </Btn>
                    <Btn size="sm" variant="danger" onClick={() => deleteQuestion(q.id)}>✕</Btn>
                  </div>
                </div>

                {editQ === q.id && (
                  <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14 }}>
                    <QuestionEditor q={q} onChange={updateQuestion} lang={lang} />
                  </div>
                )}

                {/* AI group controls */}
                {q.type === 'wordcloud' && q.aiGroup && editQ === q.id && (
                  <div style={{ marginTop: 12, padding: 12, background: 'var(--surface-2)', borderRadius: 8, border: '1px solid var(--border)' }}>
                    <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
                      🤖 {lang === 'zh' ? 'AI 分組' : 'AI Grouping'}
                    </p>
                    {aiError && <p style={{ color: 'var(--danger)', fontSize: 12, marginBottom: 8 }}>{aiError}</p>}
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <Btn size="sm" onClick={() => runAIGroup(q.id)} loading={aiLoading === q.id}>
                        {q.groupResult ? (lang === 'zh' ? '重新分組' : 'Regroup') : (lang === 'zh' ? '開始 AI 分組' : 'Start AI Grouping')}
                      </Btn>
                      {q.groupResult && !q.aiGroupDone && (
                        <Btn size="sm" variant="primary" onClick={() => confirmGroup(q.id)}>
                          {lang === 'zh' ? '確認分組（發布至前台）' : 'Confirm & Publish Groups'}
                        </Btn>
                      )}
                    </div>
                    {q.groupResult && (
                      <div style={{ marginTop: 10 }}>
                        {q.groupResult.map((g, gi) => (
                          <div key={gi} style={{ marginBottom: 6 }}>
                            <Badge color={['teal', 'blue', 'amber', 'green', 'purple'][gi % 5]}>{g.name}</Badge>
                            <span style={{ fontSize: 12, color: 'var(--text-2)', marginLeft: 8 }}>{g.items.join(', ')}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {q.aiGroupDone && q.groupVote && (
                      <div style={{ marginTop: 10 }}>
                        <Toggle
                          label={lang === 'zh' ? '開放前台投票' : 'Open voting on front-end'}
                          checked={q.voteOpen} onChange={v => { updateQuestion({ ...q, voteOpen: v }); broadcast('qa_update', {}); }} />
                      </div>
                    )}
                  </div>
                )}
              </Card>
            );
          })}

          {(act.questions || []).length < 5 && (
            <div>
              <p style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 10 }}>
                {lang === 'zh' ? '選擇題型新增互動題目：' : 'Select question type to add:'}
              </p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {Q_TYPES.map(qt => (
                  <Btn key={qt.type} size="sm" variant="ghost" onClick={() => addQuestion(qt.type)}>
                    {qt.icon} {lang === 'zh' ? qt.zh : qt.en}
                  </Btn>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Q&A moderation */}
      {tab === 'qna' && (
        <Card>
          <SectionHead>{lang === 'zh' ? '問答區管理' : 'Q&A Moderation'}</SectionHead>
          {qnaItems.length === 0 ? (
            <Empty>{lang === 'zh' ? '尚無留言' : 'No messages yet'}</Empty>
          ) : (
            qnaItems.sort((a, b) => (b.likes || 0) - (a.likes || 0)).map(msg => (
              <div key={msg.id} style={{
                padding: '12px 14px', marginBottom: 8, borderRadius: 8,
                background: msg.hidden ? 'var(--surface-2)' : 'var(--surface)',
                border: '1px solid var(--border)',
                opacity: msg.hidden ? 0.5 : 1,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 13, fontWeight: 600 }}>{msg.nick || 'Anonymous'}</span>
                      <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{new Date(msg.ts).toLocaleTimeString()}</span>
                      {msg.hidden && <Badge color="red">{lang === 'zh' ? '已隱藏' : 'Hidden'}</Badge>}
                    </div>
                    <p style={{ fontSize: 14, lineHeight: 1.5 }}>{msg.content}</p>
                    <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 4 }}>
                      👍 {msg.likes || 0} · 👎 {msg.dislikes || 0}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <Btn size="sm" variant="ghost" onClick={() => toggleHide(msg.id)}>
                      {msg.hidden ? '👁️' : '🙈'}
                    </Btn>
                    <Btn size="sm" variant="danger" onClick={() => deleteMsg(msg.id)}>✕</Btn>
                  </div>
                </div>
              </div>
            ))
          )}
        </Card>
      )}

      {/* Resources */}
      {tab === 'resources' && (
        <Card>
          <SectionHead>{lang === 'zh' ? '參考資料連結' : 'Reference Resources'}</SectionHead>
          <ResourceEditor items={act.resources || []} onChange={v => updateAct({ resources: v })} lang={lang} />
        </Card>
      )}
    </div>
  );
}

// ─── Root ──────────────────────────────────────────────────────────────────────
export default function QAAdmin() {
  const [authed, setAuthed] = useState(() => checkSession('qa_admin'));
  const [editId, setEditId] = useState(null);
  const { lang } = useLang();

  if (!authed) return <AdminLogin namespace="qa_admin" lang={lang} title={lang === 'zh' ? '互動問答後台' : 'Q&A Admin'} onLogin={() => setAuthed(true)} />;
  if (editId) return <ActivityEditor actId={editId} onBack={() => setEditId(null)} />;
  return (
    <ActivityList
      onEdit={setEditId}
      onLogout={() => { destroySession('qa_admin'); setAuthed(false); }}
    />
  );
}
