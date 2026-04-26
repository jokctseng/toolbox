import React, { useState, useEffect, useRef } from 'react';
import { db, uid, onBroadcast, broadcast } from '../store.js';
import { mdToHtml, wordFrequency, clone, badgeColor } from '../utils.js';
import { Btn, Card, Badge, Tabs, Modal, Spinner } from '../components/UI.jsx';
import { useLang } from '../App.jsx';

function JoinScreen({ onJoin, lang }) {
  const [code, setCode] = useState('');
  const [nick, setNick] = useState('');
  const [err, setErr] = useState('');

  const join = () => {
    if (!code.trim()) { setErr(lang === 'zh' ? '請輸入活動代碼' : 'Enter room code'); return; }
    const acts = db.get('qa_activities', []);
    const act = acts.find(a => a.code?.toUpperCase() === code.trim().toUpperCase() && !a.archived);
    if (!act) { setErr(lang === 'zh' ? '找不到此活動或已封存' : 'Activity not found or archived'); return; }
    onJoin(act, nick.trim() || (lang === 'zh' ? '匿名' : 'Anonymous'));
  };

  return (
    <div style={{ maxWidth: 420, margin: '60px auto', padding: 24 }}>
      <Card>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>💬</div>
          <h2 style={{ fontSize: 22 }}>{lang === 'zh' ? '加入互動問答' : 'Join Interactive Q&A'}</h2>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-2)', display: 'block', marginBottom: 5 }}>
              {lang === 'zh' ? '活動代碼 *' : 'Room Code *'}
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
          </div>
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-2)', display: 'block', marginBottom: 5 }}>
              {lang === 'zh' ? '暱稱（選填）' : 'Nickname (optional)'}
            </label>
            <input value={nick} onChange={e => setNick(e.target.value)}
              placeholder={lang === 'zh' ? '留空為匿名' : 'Leave blank for anonymous'}
              style={{
                width: '100%', padding: '9px 12px', background: 'var(--surface-2)',
                border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 14,
              }} />
          </div>
          {err && <p style={{ color: 'var(--danger)', fontSize: 13 }}>{err}</p>}
          <Btn onClick={join} size="lg" style={{ width: '100%', justifyContent: 'center' }}>
            {lang === 'zh' ? '加入 →' : 'Join →'}
          </Btn>
        </div>
      </Card>
    </div>
  );
}

function useActivity(actId) {
  const [act, setAct] = useState(() => {
    const acts = db.get('qa_activities', []);
    return acts.find(a => a.id === actId) || null;
  });
  useEffect(() => {
    const unsub = onBroadcast(({ type }) => {
      if (type === 'qa_update') {
        const acts = db.get('qa_activities', []);
        setAct(acts.find(a => a.id === actId) || null);
      }
    });
    return unsub;
  }, [actId]);
  return act;
}

function saveActivity(act) {
  const acts = db.get('qa_activities', []);
  const idx = acts.findIndex(a => a.id === act.id);
  if (idx >= 0) acts[idx] = act; else acts.push(act);
  db.set('qa_activities', acts);
  broadcast('qa_update', act.id);
}

/* ---- Q&A Section ---- */
function QnASection({ act, userId, nick, lang }) {
  const [text, setText] = useState('');
  const [replyTo, setReplyTo] = useState(null);
  const [editId, setEditId] = useState(null);
  const [editText, setEditText] = useState('');

  const posts = (act.posts || []).filter(p => !p.hidden).sort((a, b) => {
    const scoreA = (a.likes || 0) - (a.dislikes || 0);
    const scoreB = (b.likes || 0) - (b.dislikes || 0);
    return scoreB - scoreA || a.ts - b.ts;
  });

  const post = (parentId = null) => {
    const content = parentId ? text : text;
    if (!content.trim()) return;
    const updated = clone(act);
    updated.posts = updated.posts || [];
    updated.posts.push({ id: uid(), userId, nick, content: content.trim(), ts: Date.now(), parentId, likes: 0, dislikes: 0, likedBy: [], dislikedBy: [] });
    saveActivity(updated);
    setText('');
    setReplyTo(null);
  };

  const react = (postId, type) => {
    const updated = clone(act);
    const p = updated.posts?.find(p => p.id === postId);
    if (!p) return;
    p.likedBy = p.likedBy || [];
    p.dislikedBy = p.dislikedBy || [];
    if (type === 'like') {
      if (p.likedBy.includes(userId)) { p.likedBy = p.likedBy.filter(x => x !== userId); p.likes = Math.max(0, (p.likes||0)-1); }
      else { p.likedBy.push(userId); p.likes = (p.likes||0)+1; if (p.dislikedBy.includes(userId)) { p.dislikedBy = p.dislikedBy.filter(x=>x!==userId); p.dislikes=Math.max(0,(p.dislikes||0)-1); } }
    } else {
      if (p.dislikedBy.includes(userId)) { p.dislikedBy = p.dislikedBy.filter(x => x !== userId); p.dislikes = Math.max(0,(p.dislikes||0)-1); }
      else { p.dislikedBy.push(userId); p.dislikes=(p.dislikes||0)+1; if (p.likedBy.includes(userId)) { p.likedBy=p.likedBy.filter(x=>x!==userId); p.likes=Math.max(0,(p.likes||0)-1); } }
    }
    saveActivity(updated);
  };

  const editPost = (postId) => {
    const updated = clone(act);
    const p = updated.posts?.find(p => p.id === postId);
    if (!p) return;
    p.content = editText.trim();
    p.edited = true;
    saveActivity(updated);
    setEditId(null);
  };

  const renderPost = (p, depth = 0) => {
    const replies = (act.posts || []).filter(r => r.parentId === p.id && !r.hidden)
      .sort((a, b) => a.ts - b.ts);
    const isOwn = p.userId === userId;
    return (
      <div key={p.id} style={{ marginLeft: depth * 20, marginBottom: 12 }}>
        <div style={{
          background: 'var(--surface-2)', borderRadius: 10, padding: '12px 14px',
          border: '1px solid var(--border)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent)' }}>{p.nick}</span>
                {p.isHost && <Badge color="teal">HOST</Badge>}
                {p.edited && <span style={{ fontSize: 11, color: 'var(--text-3)' }}>（edited）</span>}
              </div>
              {editId === p.id ? (
                <div style={{ display: 'flex', gap: 6 }}>
                  <input value={editText} onChange={e => setEditText(e.target.value)}
                    style={{ flex: 1, padding: '6px 10px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', fontSize: 14 }} />
                  <Btn size="sm" onClick={() => editPost(p.id)}>{lang === 'zh' ? '儲存' : 'Save'}</Btn>
                  <Btn size="sm" variant="ghost" onClick={() => setEditId(null)}>{lang === 'zh' ? '取消' : 'Cancel'}</Btn>
                </div>
              ) : (
                <p style={{ fontSize: 14, lineHeight: 1.6 }}>{p.content}</p>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10 }}>
            <button onClick={() => react(p.id, 'like')} style={{
              background: 'none', border: 'none', cursor: 'pointer', fontSize: 13,
              color: (p.likedBy||[]).includes(userId) ? 'var(--accent)' : 'var(--text-3)',
              display: 'flex', alignItems: 'center', gap: 3,
            }}>👍 {p.likes || 0}</button>
            <button onClick={() => react(p.id, 'dislike')} style={{
              background: 'none', border: 'none', cursor: 'pointer', fontSize: 13,
              color: (p.dislikedBy||[]).includes(userId) ? 'var(--danger)' : 'var(--text-3)',
              display: 'flex', alignItems: 'center', gap: 3,
            }}>👎 {p.dislikes || 0}</button>
            <button onClick={() => setReplyTo(p.id)} style={{
              background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--text-3)',
            }}>↩ {lang === 'zh' ? '回覆' : 'Reply'}</button>
            {isOwn && editId !== p.id && (
              <button onClick={() => { setEditId(p.id); setEditText(p.content); }} style={{
                background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--text-3)',
              }}>✏️</button>
            )}
          </div>
        </div>
        {replyTo === p.id && (
          <div style={{ marginLeft: 16, marginTop: 6, display: 'flex', gap: 6 }}>
            <input value={text} onChange={e => setText(e.target.value)}
              placeholder={lang === 'zh' ? '回覆…' : 'Reply…'}
              onKeyDown={e => e.key === 'Enter' && post(p.id)}
              style={{ flex: 1, padding: '7px 10px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', fontSize: 14 }} />
            <Btn size="sm" onClick={() => post(p.id)}>{lang === 'zh' ? '送出' : 'Post'}</Btn>
            <Btn size="sm" variant="ghost" onClick={() => setReplyTo(null)}>✕</Btn>
          </div>
        )}
        {replies.map(r => renderPost(r, depth + 1))}
      </div>
    );
  };

  const topLevel = posts.filter(p => !p.parentId);

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <input value={replyTo ? '' : text} onChange={e => setText(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !replyTo && post()}
          placeholder={lang === 'zh' ? '輸入您的問題或留言…' : 'Ask a question or comment…'}
          style={{ flex: 1, padding: '10px 14px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 14 }} />
        <Btn onClick={() => !replyTo && post()}>
          {lang === 'zh' ? '發問' : 'Post'}
        </Btn>
      </div>
      {topLevel.length === 0 ? (
        <p style={{ color: 'var(--text-3)', textAlign: 'center', padding: 20 }}>
          {lang === 'zh' ? '還沒有留言，搶先發問！' : 'No posts yet. Be the first to ask!'}
        </p>
      ) : topLevel.map(p => renderPost(p))}
    </div>
  );
}

/* ---- Interactive Section ---- */
function PollQuestion({ q, act, userId, lang }) {
  const [selected, setSelected] = useState(() => {
    const resp = (act.responses || []).find(r => r.qId === q.id && r.userId === userId);
    return resp?.value || [];
  });
  const [submitted, setSubmitted] = useState(() =>
    (act.responses || []).some(r => r.qId === q.id && r.userId === userId)
  );

  const toggle = (opt) => {
    if (submitted) return;
    if (q.multiSelect) {
      const max = q.maxSelect || 99;
      if (selected.includes(opt)) setSelected(s => s.filter(x => x !== opt));
      else if (selected.length < max) setSelected(s => [...s, opt]);
    } else {
      setSelected([opt]);
    }
  };

  const submit = () => {
    if (selected.length === 0) return;
    const updated = clone(act);
    updated.responses = (updated.responses || []).filter(r => !(r.qId === q.id && r.userId === userId));
    updated.responses.push({ id: uid(), qId: q.id, userId, value: selected, ts: Date.now() });
    saveActivity(updated);
    setSubmitted(true);
  };

  const responses = (act.responses || []).filter(r => r.qId === q.id);
  const counts = {};
  (q.options || []).forEach(o => { counts[o] = 0; });
  responses.forEach(r => { (r.value || []).forEach(v => { counts[v] = (counts[v] || 0) + 1; }); });
  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {(q.options || []).map(opt => {
        const count = counts[opt] || 0;
        const pct = total > 0 ? Math.round(count / total * 100) : 0;
        const isSel = selected.includes(opt);
        return (
          <div key={opt} onClick={() => toggle(opt)} style={{
            padding: '10px 14px', borderRadius: 8,
            border: `2px solid ${isSel ? 'var(--accent)' : 'var(--border)'}`,
            background: isSel ? 'var(--accent-light)' : 'var(--surface-2)',
            cursor: submitted ? 'default' : 'pointer', position: 'relative', overflow: 'hidden',
          }}>
            {submitted && q.showResult && (
              <div style={{ position: 'absolute', inset: 0, background: 'var(--accent)', opacity: .12, width: `${pct}%`, borderRadius: 8 }} />
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', position: 'relative', zIndex: 1 }}>
              <span style={{ fontWeight: isSel ? 600 : 400 }}>{opt}</span>
              {submitted && q.showResult && <span style={{ fontSize: 13, color: 'var(--text-2)' }}>{pct}% ({count})</span>}
            </div>
          </div>
        );
      })}
      {!submitted && (
        <Btn onClick={submit} disabled={selected.length === 0} style={{ marginTop: 4 }}>
          {lang === 'zh' ? '送出投票' : 'Submit Vote'}
        </Btn>
      )}
      {submitted && <p style={{ fontSize: 13, color: 'var(--success)', textAlign: 'center' }}>✓ {lang === 'zh' ? '已投票' : 'Voted'}</p>}
    </div>
  );
}

function WordCloudQuestion({ q, act, userId, lang }) {
  const [text, setText] = useState('');
  const charLimit = q.charLimit || 50;
  const canMulti = q.multiInput !== false;

  const myResponses = (act.responses || []).filter(r => r.qId === q.id && r.userId === userId);
  const allResponses = (act.responses || []).filter(r => r.qId === q.id);
  const entries = allResponses.map(r => r.value);
  const freq = wordFrequency(entries);

  const submit = () => {
    if (!text.trim()) return;
    if (!canMulti && myResponses.length > 0) return;
    const updated = clone(act);
    updated.responses = updated.responses || [];
    updated.responses.push({ id: uid(), qId: q.id, userId, value: text.trim(), ts: Date.now() });
    saveActivity(updated);
    setText('');
  };

  // If AI grouping confirmed, show groups
  const groups = q.aiGroupDone ? q.groupResult : null;

  return (
    <div>
      {/* Word cloud visualization */}
      <div style={{ background: 'var(--surface-2)', borderRadius: 12, padding: 20, marginBottom: 16, minHeight: 80 }}>
        {groups ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {groups.map((g, gi) => (
              <div key={gi}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-3)', marginBottom: 6 }}>{g.name}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {(g.items || []).map((item, ii) => {
                    const f = freq.find(f => f.word === item.toLowerCase()) || { count: 1 };
                    const size = Math.min(22, 12 + f.count * 2);
                    return (
                      <span key={ii} style={{ fontSize: size, fontWeight: f.count > 1 ? 700 : 400, color: 'var(--accent)', padding: '2px 6px', background: 'var(--accent-light)', borderRadius: 4 }}>
                        {item}
                      </span>
                    );
                  })}
                </div>
                {q.voteOpen && (
                  <GroupVoteRow group={g} act={act} userId={userId} lang={lang} qId={q.id} gi={gi} />
                )}
              </div>
            ))}
          </div>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', justifyContent: 'center' }}>
            {freq.length === 0 ? (
              <span style={{ color: 'var(--text-3)', fontSize: 14 }}>{lang === 'zh' ? '尚無回應' : 'No responses yet'}</span>
            ) : freq.map(({ word, count }) => {
              const size = Math.min(28, 12 + count * 3);
              return (
                <span key={word} style={{ fontSize: size, fontWeight: count > 2 ? 700 : 400, color: count > 2 ? 'var(--accent)' : 'var(--text-2)', lineHeight: 1.4 }}>
                  {word}
                </span>
              );
            })}
          </div>
        )}
      </div>
      {(canMulti || myResponses.length === 0) && (
        <div style={{ display: 'flex', gap: 8 }}>
          <input value={text} onChange={e => setText(e.target.value.slice(0, charLimit))}
            onKeyDown={e => e.key === 'Enter' && submit()}
            placeholder={`${lang === 'zh' ? '輸入您的想法' : 'Your response'} (max ${charLimit})`}
            style={{ flex: 1, padding: '9px 12px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 14 }} />
          <Btn size="sm" onClick={submit}>{lang === 'zh' ? '送出' : 'Submit'}</Btn>
        </div>
      )}
    </div>
  );
}

function GroupVoteRow({ group, act, userId, lang, qId, gi }) {
  const votesPerPerson = act.questions?.find(q=>q.id===qId)?.groupVoteMax || 1;
  const myVotes = (act.groupVotes || []).filter(v => v.qId === qId && v.userId === userId);
  const myVotesForGroup = myVotes.filter(v => v.gi === gi).length;
  const totalForGroup = (act.groupVotes || []).filter(v => v.qId === qId && v.gi === gi).length;

  const addVote = () => {
    if (myVotes.length >= votesPerPerson) return;
    const updated = clone(act);
    updated.groupVotes = updated.groupVotes || [];
    updated.groupVotes.push({ id: uid(), qId, userId, gi, ts: Date.now() });
    saveActivity(updated);
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6 }}>
      <button onClick={addVote} disabled={myVotes.length >= votesPerPerson} style={{
        padding: '4px 12px', borderRadius: 100, border: '1px solid var(--border)',
        background: myVotesForGroup > 0 ? 'var(--accent-light)' : 'var(--surface-2)',
        color: myVotesForGroup > 0 ? 'var(--accent)' : 'var(--text-2)',
        cursor: myVotes.length >= votesPerPerson ? 'not-allowed' : 'pointer',
        fontSize: 13, fontFamily: 'var(--font-body)',
      }}>
        ▲ {totalForGroup} {myVotesForGroup > 0 && `(+${myVotesForGroup})`}
      </button>
      <span style={{ fontSize: 12, color: 'var(--text-3)' }}>
        {lang === 'zh' ? `已用 ${myVotes.length}/${votesPerPerson} 票` : `${myVotes.length}/${votesPerPerson} votes used`}
      </span>
    </div>
  );
}

function IdeaQuestion({ q, act, userId, lang }) {
  const [text, setText] = useState('');
  const [isPublic, setIsPublic] = useState(true);

  const submit = () => {
    if (!text.trim()) return;
    const updated = clone(act);
    updated.responses = updated.responses || [];
    updated.responses.push({ id: uid(), qId: q.id, userId, value: text.trim(), public: isPublic, hearts: 0, heartedBy: [], ts: Date.now() });
    saveActivity(updated);
    setText('');
  };

  const heart = (respId) => {
    const updated = clone(act);
    const r = updated.responses?.find(r => r.id === respId);
    if (!r) return;
    r.heartedBy = r.heartedBy || [];
    if (r.heartedBy.includes(userId)) { r.heartedBy = r.heartedBy.filter(x=>x!==userId); r.hearts=Math.max(0,(r.hearts||0)-1); }
    else { r.heartedBy.push(userId); r.hearts=(r.hearts||0)+1; }
    saveActivity(updated);
  };

  const publicIdeas = (act.responses || [])
    .filter(r => r.qId === q.id && r.public)
    .sort((a, b) => (b.hearts||0) - (a.hearts||0));
  const myPrivate = (act.responses || [])
    .filter(r => r.qId === q.id && !r.public && r.userId === userId);

  return (
    <div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
        <textarea value={text} onChange={e => setText(e.target.value)}
          placeholder={lang === 'zh' ? '分享您的點子（不限字數）' : 'Share your idea…'}
          rows={3} style={{ width: '100%', padding: '10px 12px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 14, resize: 'vertical', fontFamily: 'var(--font-body)' }} />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
            <input type="checkbox" checked={isPublic} onChange={e => setIsPublic(e.target.checked)} />
            {lang === 'zh' ? '公開分享' : 'Share publicly'}
          </label>
          <Btn size="sm" onClick={submit}>{lang === 'zh' ? '送出點子' : 'Submit Idea'}</Btn>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {publicIdeas.map(idea => (
          <div key={idea.id} style={{ padding: '12px 14px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 10 }}>
            <p style={{ fontSize: 14, lineHeight: 1.6, marginBottom: 8 }}>{idea.value}</p>
            {idea.feedback && (
              <div style={{ background: 'var(--warm-light)', borderRadius: 6, padding: '8px 12px', marginBottom: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--warm)' }}>HOST: </span>
                <span style={{ fontSize: 13 }}>{idea.feedback}</span>
              </div>
            )}
            <button onClick={() => heart(idea.id)} style={{
              background: 'none', border: 'none', cursor: 'pointer', fontSize: 14,
              color: (idea.heartedBy||[]).includes(userId) ? 'var(--danger)' : 'var(--text-3)',
            }}>❤️ {idea.hearts || 0}</button>
          </div>
        ))}
        {myPrivate.map(idea => (
          <div key={idea.id} style={{ padding: '12px 14px', background: 'var(--surface-3)', border: '1px dashed var(--border)', borderRadius: 10 }}>
            <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 4 }}>🔒 {lang === 'zh' ? '僅您可見' : 'Private'}</div>
            <p style={{ fontSize: 14 }}>{idea.value}</p>
            {idea.feedback && (
              <div style={{ background: 'var(--warm-light)', borderRadius: 6, padding: '8px 12px', marginTop: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--warm)' }}>HOST: </span>
                <span style={{ fontSize: 13 }}>{idea.feedback}</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function ChallengeQuestion({ q, act, userId, lang }) {
  const [answers, setAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState(null);
  const [mapping, setMapping] = useState(null);

  const submit = () => {
    let total = 0;
    const qs = q.questions || [];
    qs.forEach((cq, i) => {
      const ans = answers[i];
      if (ans === undefined) return;
      if (q.hasAnswer) {
        if (Number(ans) === Number(cq.answer)) total += cq.score || 1;
      } else {
        const opt = (cq.options || [])[Number(ans)];
        total += opt?.score || 0;
      }
    });
    const updated = clone(act);
    updated.responses = updated.responses || [];
    updated.responses.push({ id: uid(), qId: q.id, userId, value: answers, score: total, ts: Date.now() });
    saveActivity(updated);
    setScore(total);
    setSubmitted(true);
    // Find score mapping
    if (q.scoreMap) {
      const m = q.scoreMap.find(sm => total >= sm.min && total <= sm.max);
      setMapping(m);
    }
  };

  if (submitted) {
    return (
      <div style={{ textAlign: 'center', padding: 24 }}>
        <div style={{ fontSize: 48, marginBottom: 8 }}>🏆</div>
        <div style={{ fontSize: 32, fontWeight: 800, color: 'var(--accent)' }}>{score} {lang === 'zh' ? '分' : 'pts'}</div>
        {mapping && (
          <div style={{ marginTop: 16, padding: 16, background: 'var(--accent-light)', borderRadius: 12 }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--accent)' }}>{mapping.label}</div>
            <p style={{ fontSize: 14, marginTop: 6, color: 'var(--text-2)' }}>{mapping.desc}</p>
          </div>
        )}
        {q.showRanking && (
          <RankingDisplay q={q} act={act} userId={userId} lang={lang} />
        )}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {(q.questions || []).map((cq, i) => (
        <div key={i} style={{ padding: 16, background: 'var(--surface-2)', borderRadius: 10, border: '1px solid var(--border)' }}>
          <p style={{ fontWeight: 600, marginBottom: 12 }}>{i+1}. {cq.text}</p>
          {cq.desc && <p style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 10 }}>{cq.desc}</p>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {(cq.options || []).map(opt => {
              const label = typeof opt === 'string' ? opt : opt.text;
              return (
                <button key={`${label}-${i}`} onClick={() => setAnswers(a => ({ ...a, [i]: cq.options.indexOf(opt) }))} style={{
                  padding: '9px 14px', borderRadius: 8, textAlign: 'left', cursor: 'pointer',
                  border: `2px solid ${answers[i] === cq.options.indexOf(opt) ? 'var(--accent)' : 'var(--border)'}`,
                  background: answers[i] === cq.options.indexOf(opt) ? 'var(--accent-light)' : 'var(--surface)',
                  color: 'var(--text)', fontFamily: 'var(--font-body)', fontSize: 14,
                  fontWeight: answers[i] === cq.options.indexOf(opt) ? 600 : 400,
                }}>{label}</button>
              );
            })}
          </div>
        </div>
      ))}
      <Btn onClick={submit} disabled={Object.keys(answers).length < (q.questions||[]).length} style={{ alignSelf: 'flex-end' }}>
        {lang === 'zh' ? '送出答案' : 'Submit Answers'}
      </Btn>
    </div>
  );
}

function RankingDisplay({ q, act, userId, lang }) {
  const responses = (act.responses || []).filter(r => r.qId === q.id && r.score !== undefined);
  const sorted = [...responses].sort((a, b) => b.score - a.score);
  const myRank = sorted.findIndex(r => r.userId === userId) + 1;
  return (
    <div style={{ marginTop: 20 }}>
      <h4 style={{ fontSize: 14, marginBottom: 10 }}>{lang === 'zh' ? '排行榜' : 'Ranking'}</h4>
      {sorted.slice(0, 10).map((r, i) => (
        <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border)', background: r.userId === userId ? 'var(--accent-light)' : 'none' }}>
          <span style={{ fontWeight: r.userId === userId ? 700 : 400 }}>#{i+1} {r.userId === userId ? (lang === 'zh' ? '（您）' : '(You)') : '***'}</span>
          <span>{r.score} pts</span>
        </div>
      ))}
    </div>
  );
}

function InteractSection({ act, userId, lang }) {
  const questions = (act.questions || []).filter(q => q.open);
  if (questions.length === 0) return (
    <p style={{ color: 'var(--text-3)', textAlign: 'center', padding: 24 }}>
      {lang === 'zh' ? '尚無開放互動題目' : 'No active questions yet'}
    </p>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {questions.map(q => (
        <Card key={q.id}>
          <h4 style={{ fontSize: 16, marginBottom: 4 }}>{q.title}</h4>
          {q.desc && <p style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 16 }}>{q.desc}</p>}
          {q.type === 'poll' && <PollQuestion q={q} act={act} userId={userId} lang={lang} />}
          {q.type === 'wordcloud' && <WordCloudQuestion q={q} act={act} userId={userId} lang={lang} />}
          {q.type === 'idea' && <IdeaQuestion q={q} act={act} userId={userId} lang={lang} />}
          {q.type === 'challenge' && <ChallengeQuestion q={q} act={act} userId={userId} lang={lang} />}
        </Card>
      ))}
    </div>
  );
}

export default function QAFront() {
  const { lang } = useLang();
  const [joined, setJoined] = useState(null); // { act, userId, nick }
  const [tab, setTab] = useState('qna');
  const [liveAct, setLiveAct] = useState(null);

  useEffect(() => {
    if (!joined) return;
    setLiveAct(joined.act);
    const unsub = onBroadcast(({ type }) => {
      if (type === 'qa_update') {
        const acts = db.get('qa_activities', []);
        const updated = acts.find(a => a.id === joined.act.id);
        if (updated) setLiveAct(updated);
      }
    });
    return unsub;
  }, [joined]);

  if (!joined) {
    return <JoinScreen lang={lang} onJoin={(act, nick) => {
      const userId = db.get('user_id') || uid();
      db.set('user_id', userId);
      setJoined({ act, userId, nick });
      setLiveAct(act);
    }} />;
  }

  const act = liveAct || joined.act;
  const tabs = [
    { key: 'agenda', label: lang === 'zh' ? '議程' : 'Agenda' },
    { key: 'qna', label: lang === 'zh' ? '問答區' : 'Q&A' },
    { key: 'interact', label: lang === 'zh' ? '互動區' : 'Interactive' },
    { key: 'resources', label: lang === 'zh' ? '參考資料' : 'Resources' },
  ];

  return (
    <div style={{ maxWidth: 700, margin: '0 auto', padding: '24px 16px' }}>
      {/* Activity header */}
      <Card style={{ marginBottom: 20, background: 'linear-gradient(135deg, var(--accent-light), var(--surface))' }}>
        <h2 style={{ fontSize: 20, marginBottom: 4 }}>{act.name}</h2>
        {act.desc && <p style={{ fontSize: 14, color: 'var(--text-2)' }}>{act.desc}</p>}
        <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 12 }}>
          <Badge color="teal">💬 {joined.nick}</Badge>
          {act.endTime && <span style={{ fontSize: 12, color: 'var(--text-3)' }}>
            {lang === 'zh' ? '結束' : 'End'}: {new Date(act.endTime).toLocaleDateString()}
          </span>}
        </div>
      </Card>

      <Tabs tabs={tabs} active={tab} onChange={setTab} style={{ marginBottom: 20 }} />

      {tab === 'agenda' && (
        <Card>
          {act.rulesEnabled && act.rules && (
            <div style={{ marginBottom: 20, padding: 16, background: 'var(--warm-light)', borderRadius: 10, border: '1px solid var(--warm)' }}>
              <h4 style={{ fontSize: 14, color: 'var(--warm)', marginBottom: 8 }}>
                {lang === 'zh' ? '行為守則' : 'Code of Conduct'}
              </h4>
              <div style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.7 }}
                dangerouslySetInnerHTML={{ __html: mdToHtml(act.rules) }} />
            </div>
          )}
          {(act.agenda || []).length === 0 ? (
            <p style={{ color: 'var(--text-3)' }}>{lang === 'zh' ? '尚無議程' : 'No agenda yet'}</p>
          ) : (act.agenda || []).map((item, i) => (
            <div key={i} style={{ display: 'flex', gap: 16, padding: '10px 0', borderBottom: i < act.agenda.length-1 ? '1px solid var(--border)' : 'none' }}>
              {(item.time || item.duration) && (
                <div style={{ minWidth: 70, fontSize: 13, color: 'var(--text-3)', flexShrink: 0 }}>
                  {item.time}{item.duration ? ` (${item.duration}m)` : ''}
                </div>
              )}
              <div style={{ fontSize: 14 }}>{item.item}</div>
            </div>
          ))}
        </Card>
      )}

      {tab === 'qna' && (
        <QnASection act={act} userId={joined.userId} nick={joined.nick} lang={lang} />
      )}

      {tab === 'interact' && (
        <InteractSection act={act} userId={joined.userId} lang={lang} />
      )}

      {tab === 'resources' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {(act.resources || []).length === 0 ? (
            <p style={{ color: 'var(--text-3)' }}>{lang === 'zh' ? '尚無參考資料' : 'No resources yet'}</p>
          ) : (act.resources || []).map((r, i) => (
            <Card key={i} style={{ padding: '14px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  {r.type && <Badge color={badgeColor(r.type)} style={{ marginBottom: 6 }}>{r.type}</Badge>}
                  <h4 style={{ fontSize: 15 }}>{r.name}</h4>
                  {r.desc && <p style={{ fontSize: 13, color: 'var(--text-2)', marginTop: 4 }}>{r.desc}</p>}
                </div>
                {r.url && (
                  <a href={r.url} target="_blank" rel="noopener noreferrer">
                    <Btn size="sm" variant="ghost">↗ {lang === 'zh' ? '開啟' : 'Open'}</Btn>
                  </a>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
