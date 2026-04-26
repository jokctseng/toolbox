import React, { useState, useRef } from 'react';
import { db, uid, broadcast, onBroadcast } from '../store.js';
import { parseNameList, clone } from '../utils.js';
import { Btn, Card, Modal, Badge, SectionHead, NumInp, Confirm, Empty } from '../components/UI.jsx';
import { useLang } from '../App.jsx';
import { useEffect } from 'react';

const DEFAULTS = { callCount: 1, waitingMax: 3 };

function loadQ() { return db.get('queue', { master: [], waiting: [], calling: [], done: [], settings: DEFAULTS }); }
function saveQ(q) { db.set('queue', q); broadcast('queue_update', q); }

function PersonCard({ person, actions, size = 'md', highlight }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: size === 'lg' ? '12px 16px' : '8px 12px',
      background: highlight ? 'var(--accent-light)' : 'var(--surface-2)',
      border: `1px solid ${highlight ? 'var(--accent)' : 'var(--border)'}`,
      borderRadius: 8, gap: 8, marginBottom: 6,
      fontSize: size === 'lg' ? 18 : 14,
    }}>
      <span style={{ fontWeight: highlight ? 700 : 500, color: highlight ? 'var(--accent)' : 'var(--text)', flex: 1 }}>
        {person.label}
      </span>
      {actions && <div style={{ display: 'flex', gap: 4 }}>{actions}</div>}
    </div>
  );
}

export default function Queue() {
  const { t, lang } = useLang();
  const [q, setQ] = useState(loadQ);
  const [mode, setMode] = useState('admin'); // admin | display
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState('');
  const [newName, setNewName] = useState('');
  const [confirmReset, setConfirmReset] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => {
    const unsub = onBroadcast(({ type, payload }) => {
      if (type === 'queue_update') setQ(payload);
    });
    return unsub;
  }, []);

  const update = (next) => { setQ(next); saveQ(next); };

  const addPerson = (label) => {
    if (!label.trim()) return;
    const p = { id: uid(), label: label.trim() };
    const next = clone(q);
    next.master.push(p);
    // Auto-fill waiting if space
    fillWaiting(next);
    update(next);
  };

  const fillWaiting = (next) => {
    const max = next.settings?.waitingMax ?? DEFAULTS.waitingMax;
    while (next.waiting.length < max && next.master.length > 0) {
      next.waiting.push(next.master.shift());
    }
  };

  const callNext = () => {
    const next = clone(q);
    const count = next.settings?.callCount ?? DEFAULTS.callCount;
    // Move calling → done
    next.done = [...next.calling, ...next.done];
    next.calling = [];
    // Move from waiting → calling
    const toCall = next.waiting.splice(0, count);
    next.calling = toCall;
    fillWaiting(next);
    update(next);
  };

  const markDone = (id) => {
    const next = clone(q);
    const idx = next.calling.findIndex(p => p.id === id);
    if (idx === -1) return;
    const [p] = next.calling.splice(idx, 1);
    next.done.unshift(p);
    fillWaiting(next);
    update(next);
  };

  const skip = (id) => {
    const next = clone(q);
    const idx = next.calling.findIndex(p => p.id === id);
    if (idx === -1) return;
    const [p] = next.calling.splice(idx, 1);
    next.master.push(p);
    fillWaiting(next);
    update(next);
  };

  const removeFromMaster = (id) => {
    const next = clone(q);
    next.master = next.master.filter(p => p.id !== id);
    update(next);
  };

  const doImport = () => {
    const names = parseNameList(importText);
    if (!names.length) return;
    const next = clone(q);
    names.forEach(label => next.master.push({ id: uid(), label }));
    fillWaiting(next);
    update(next);
    setImportText('');
    setShowImport(false);
  };

  const doReset = () => {
    const fresh = { master: [], waiting: [], calling: [], done: [], settings: q.settings || DEFAULTS };
    update(fresh);
  };

  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => { setImportText(ev.target.result); };
    reader.readAsText(file);
    e.target.value = '';
  };

  const settings = q.settings || DEFAULTS;

  const updateSettings = (key, val) => {
    const next = clone(q);
    next.settings = { ...settings, [key]: val };
    update(next);
  };

  // Display mode: just show calling and waiting, no controls
  if (mode === 'display') {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg)', padding: 24 }}>
        <div style={{ position: 'fixed', top: 68, right: 16, zIndex: 10 }}>
          <Btn size="sm" variant="ghost" onClick={() => setMode('admin')}>⚙️ {lang === 'zh' ? '管理' : 'Admin'}</Btn>
        </div>
        {/* Calling zone — prominent */}
        <div style={{ maxWidth: 700, margin: '0 auto' }}>
          <div style={{
            background: 'var(--accent)', borderRadius: 'var(--radius-xl)',
            padding: 32, textAlign: 'center', marginBottom: 24, boxShadow: 'var(--shadow-lg)',
          }}>
            <div style={{ color: 'rgba(255,255,255,.7)', fontSize: 14, marginBottom: 8 }}>
              {lang === 'zh' ? '▶ 叫號中' : '▶ Now Calling'}
            </div>
            {q.calling.length === 0 ? (
              <div style={{ fontSize: 28, color: 'rgba(255,255,255,.5)' }}>—</div>
            ) : (
              q.calling.map(p => (
                <div key={p.id} style={{ fontSize: 'clamp(28px,6vw,56px)', fontWeight: 800,
                  color: '#fff', fontFamily: 'var(--font-display)', lineHeight: 1.2, marginBottom: 4 }}>
                  {p.label}
                </div>
              ))
            )}
          </div>

          {/* Waiting zone */}
          <div style={{
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-xl)', padding: 24,
          }}>
            <h3 style={{ marginBottom: 16, color: 'var(--text-2)', fontSize: 15 }}>
              {lang === 'zh' ? '⏳ 候叫區' : '⏳ Waiting'}
            </h3>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              {q.waiting.length === 0 ? (
                <p style={{ color: 'var(--text-3)' }}>—</p>
              ) : q.waiting.map(p => (
                <div key={p.id} style={{
                  padding: '8px 20px', background: 'var(--warm-light)',
                  border: '1px solid var(--warm)', borderRadius: 100,
                  fontWeight: 600, color: 'var(--warm)', fontSize: 18,
                }}>{p.label}</div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Admin mode
  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '28px 20px' }}>
      <SectionHead
        title={`📋 ${t('qTitle')}`}
        actions={<>
          <Btn size="sm" variant="ghost" onClick={() => setMode('display')}>📺 {t('qDisplayMode')}</Btn>
          <Btn size="sm" variant="ghost" onClick={() => setConfirmReset(true)} style={{ color: 'var(--danger)' }}>
            ↺ {t('qReset')}
          </Btn>
        </>}
      />

      {/* Settings row */}
      <Card style={{ marginBottom: 20, padding: '16px 20px' }}>
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <NumInp label={t('qCallCount')} value={settings.callCount} min={1} max={10}
            onChange={v => updateSettings('callCount', v)} />
          <NumInp label={t('qReadyCount')} value={settings.waitingMax} min={1} max={20}
            onChange={v => updateSettings('waitingMax', v)} />
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Btn onClick={() => setShowImport(true)} variant="secondary" size="sm">
              📂 {t('qImport')}
            </Btn>
          </div>
        </div>
      </Card>

      {/* Add manual */}
      <Card style={{ marginBottom: 20, padding: '14px 16px' }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <input value={newName} onChange={e => setNewName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { addPerson(newName); setNewName(''); } }}
            placeholder={t('qNumberInput')}
            style={{
              flex: 1, padding: '9px 12px', background: 'var(--surface-2)',
              border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', fontSize: 14,
            }} />
          <Btn onClick={() => { addPerson(newName); setNewName(''); }}>+ {t('qManualAdd')}</Btn>
        </div>
      </Card>

      <div className="queue-main-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(260px, .8fr) minmax(360px, 1.35fr)', gap: 16, alignItems: 'stretch' }}>
        {/* Waiting */}
        <Card style={{ maxHeight: 560, overflow: 'auto', background: 'var(--warm-light)' }}>
          <h4 style={{ fontSize: 16, color: 'var(--warm)', marginBottom: 12, fontWeight: 800 }}>
            ⏳ {t('qWaiting')} <span style={{ fontFamily: 'var(--font-body)', fontWeight: 600 }}>({q.waiting.length}/{settings.waitingMax})</span>
          </h4>
          {q.waiting.length === 0 ? <p style={{ fontSize: 13, color: 'var(--text-3)' }}>{t('qEmpty')}</p> :
            q.waiting.map(p => (
              <PersonCard key={p.id} person={p} size="lg" />
            ))
          }
        </Card>

        {/* Calling zone — most prominent */}
        <Card style={{ background: 'linear-gradient(135deg, var(--accent-light), var(--surface))', minHeight: 360 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, gap: 12, flexWrap: 'wrap' }}>
            <h4 style={{ fontSize: 20, color: 'var(--accent)', fontWeight: 800 }}>
              📣 {t('qCalling')} <span style={{ fontFamily: 'var(--font-body)', fontWeight: 600 }}>({q.calling.length}/{settings.callCount})</span>
            </h4>
            <Btn onClick={callNext} size="lg">
              {lang === 'zh' ? '叫下一位 ▶' : 'Call Next ▶'}
            </Btn>
          </div>

          {q.calling.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '64px 0', color: 'var(--text-3)' }}>
              <p style={{ fontSize: 44 }}>—</p>
            </div>
          ) : q.calling.map(p => (
            <div key={p.id} style={{
              padding: '18px 20px', background: 'var(--accent)', borderRadius: 14,
              marginBottom: 12, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', alignItems: 'center', gap: 14,
              boxShadow: 'var(--shadow)',
            }}>
              <span style={{ fontSize: 'clamp(24px, 4vw, 42px)', fontWeight: 800, color: '#fff', fontFamily: 'var(--font-display)', lineHeight: 1.1, wordBreak: 'break-word' }}>
                {p.label}
              </span>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                <button onClick={() => markDone(p.id)} style={{
                  padding: '9px 15px', background: '#fff', border: 'none',
                  borderRadius: 8, cursor: 'pointer', fontWeight: 800, fontSize: 14, color: 'var(--accent)',
                }}>✓ {lang === 'zh' ? '完成' : 'Done'}</button>
                <button onClick={() => skip(p.id)} style={{
                  padding: '9px 11px', background: 'rgba(255,255,255,.2)', border: 'none',
                  borderRadius: 8, cursor: 'pointer', fontSize: 13, color: '#fff',
                }}>↩</button>
              </div>
            </div>
          ))}

          <div style={{ borderTop: '1px solid var(--border)', marginTop: 16, paddingTop: 12 }}>
            <h5 style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 8 }}>
              ✅ {t('qDone')} ({q.done.length})
            </h5>
            <div style={{ maxHeight: 120, overflowY: 'auto' }}>
              {q.done.slice(0, 10).map(p => (
                <span key={p.id} style={{
                  display: 'inline-block', padding: '2px 8px', margin: '2px',
                  background: 'var(--success-light)', color: 'var(--success)',
                  borderRadius: 100, fontSize: 12,
                }}>{p.label}</span>
              ))}
              {q.done.length > 10 && <span style={{ fontSize: 12, color: 'var(--text-3)' }}>
                +{q.done.length - 10}
              </span>}
            </div>
          </div>
        </Card>
      </div>

      {/* Master list */}
      <details style={{ marginTop: 16 }}>
        <summary style={{
          padding: '12px 16px', background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius)', cursor: 'pointer', fontWeight: 700, color: 'var(--text-2)',
          boxShadow: 'var(--shadow-sm)',
        }}>
          📄 {t('qTotalList')} ({q.master.length})
        </summary>
        <Card style={{ maxHeight: 280, overflow: 'auto', marginTop: 8 }}>
          {q.master.length === 0 ? <p style={{ fontSize: 13, color: 'var(--text-3)' }}>{t('qEmpty')}</p> :
            q.master.map(p => (
              <PersonCard key={p.id} person={p} actions={[
                <button key="del" onClick={() => removeFromMaster(p.id)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', fontSize: 14 }}>✕</button>
              ]} />
            ))
          }
        </Card>
      </details>

      {/* Import Modal */}
      <Modal open={showImport} onClose={() => setShowImport(false)}
        title={t('qImport')}
        footer={<div style={{ display: 'flex', gap: 8 }}>
          <Btn variant="ghost" onClick={() => setShowImport(false)}>
            {lang === 'zh' ? '取消' : 'Cancel'}
          </Btn>
          <Btn onClick={doImport}>{lang === 'zh' ? '匯入' : 'Import'}</Btn>
        </div>}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <p style={{ fontSize: 13, color: 'var(--text-2)' }}>{t('qImportHint')}</p>
          <input type="file" accept=".txt,.csv" ref={fileRef} onChange={handleFile}
            style={{ display: 'none' }} />
          <Btn variant="ghost" size="sm" onClick={() => fileRef.current?.click()}>
            📂 {lang === 'zh' ? '選擇檔案' : 'Choose File'}
          </Btn>
          <textarea value={importText} onChange={e => setImportText(e.target.value)}
            rows={8} placeholder={lang === 'zh' ? '每行一個名字或編號…' : 'One name/number per line…'}
            style={{
              width: '100%', padding: '10px 12px', background: 'var(--surface-2)',
              border: '1px solid var(--border)', borderRadius: 6,
              color: 'var(--text)', fontSize: 13, resize: 'vertical',
            }} />
          <p style={{ fontSize: 12, color: 'var(--text-3)' }}>
            {lang === 'zh' ? `已輸入 ${parseNameList(importText).length} 人` : `${parseNameList(importText).length} entries detected`}
          </p>
        </div>
      </Modal>

      <Confirm open={confirmReset} onClose={() => setConfirmReset(false)} onConfirm={doReset}
        message={t('qConfirmReset')} />
    </div>
  );
}
