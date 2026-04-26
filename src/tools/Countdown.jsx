import React, { useState, useEffect, useRef, useCallback } from 'react';
import { db, uid } from '../store.js';
import { toSeconds, fromSeconds, formatTime, playSound, clone } from '../utils.js';
import { Btn, Card, Toggle, TimeInput, Badge, SectionHead } from '../components/UI.jsx';
import { useLang } from '../App.jsx';

const DEFAULT_TIMER = {
  id: '', name: '', duration: { h: 0, m: 5, s: 0 },
  remindOffset: { h: 0, m: 1, s: 0 }, remindEnabled: true,
  remindSound: 'bell', remindFlash: true,
  state: 'idle', // idle | running | paused | reminding | finished
  remaining: 0, startedAt: null, pausedAt: null,
};

const SOUNDS = [
  { key: 'none', zh: '無聲音', en: 'No Sound' },
  { key: 'bell', zh: '鈴聲', en: 'Bell' },
  { key: 'beep', zh: '嗶嗶聲', en: 'Beep' },
  { key: 'alarm', zh: '警報聲', en: 'Alarm' },
];

function loadTimers() {
  return db.get('timers', []);
}
function saveTimers(timers) {
  db.set('timers', timers);
}

// Compute actual remaining based on wall clock
function computeRemaining(timer) {
  if (timer.state === 'idle' || timer.state === 'finished') return timer.remaining;
  if (timer.state === 'paused') return timer.remaining;
  if (timer.state === 'running' || timer.state === 'reminding') {
    const elapsed = Math.floor((Date.now() - timer.startedAt) / 1000);
    return Math.max(0, timer.remaining - elapsed);
  }
  return 0;
}

function playFinishSound(type) {
  [0, 650, 1300].forEach(delay => {
    window.setTimeout(() => playSound(type), delay);
  });
}

function TimerCard({ timer, onUpdate, onDelete, onFullscreen, lang }) {
  const t = k => ({ zh: { start:'開始', pause:'暫停', resume:'繼續', reset:'重設', running:'運行中',
    paused:'已暫停', reminding:'提醒中', finished:'時間到！', idle:'待機',
    remind:'提前提醒', sound:'鈴聲提醒', flash:'變色閃爍', name:'計時器名稱',
    duration:'計時時長', remindOffset:'提前提醒時間',
    sounds: { none:'無聲音', bell:'鈴聲', beep:'嗶嗶聲', alarm:'警報聲' },
  }, en: { start:'Start', pause:'Pause', resume:'Resume', reset:'Reset', running:'Running',
    paused:'Paused', reminding:'Reminding', finished:"Time's Up!", idle:'Idle',
    remind:'Early Reminder', sound:'Sound Alert', flash:'Color Flash',
    name:'Timer Name', duration:'Duration', remindOffset:'Remind Before',
    sounds: { none:'No Sound', bell:'Bell', beep:'Beep', alarm:'Alarm' },
  }}[lang]?.[k] ?? k);

  const [editing, setEditing] = useState(timer.state === 'idle' && timer.remaining === 0);
  const [draft, setDraft] = useState(clone(timer));
  const flashRef = useRef(false);
  const soundedRemind = useRef(false);
  const soundedFinish = useRef(false);

  const remaining = computeRemaining(timer);
  const totalSecs = toSeconds(timer.duration.h, timer.duration.m, timer.duration.s);
  const remindSecs = toSeconds(timer.remindOffset.h, timer.remindOffset.m, timer.remindOffset.s);
  const progress = totalSecs > 0 ? 1 - (remaining / totalSecs) : 0;

  // Sound / notification triggers
  useEffect(() => {
    if (timer.state === 'reminding' && !soundedRemind.current) {
      soundedRemind.current = true;
      if (timer.remindSound !== 'none') playSound(timer.remindSound);
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        if (Notification.permission === 'granted') {
          navigator.serviceWorker.controller.postMessage({
            type: 'TIMER_ALERT', title: timer.name || 'KC 計時器',
            body: `${t('reminding')} — ${formatTime(remaining)}`, id: timer.id,
          });
        }
      }
    }
    if (timer.state === 'finished' && !soundedFinish.current) {
      soundedFinish.current = true;
      if (timer.remindSound !== 'none') playFinishSound(timer.remindSound);
    }
    if (timer.state === 'idle') {
      soundedRemind.current = false;
      soundedFinish.current = false;
    }
  }, [timer.state]);

  const stateColors = {
    idle: 'var(--text-3)', running: 'var(--accent)', paused: 'var(--warm)',
    reminding: 'var(--warm)', finished: 'var(--danger)',
  };

  const cardStyle = {
    position: 'relative', overflow: 'hidden',
    animation: timer.state === 'finished' && timer.remindFlash ? 'flash 0.6s ease infinite' : undefined,
  };

  const handleStart = () => {
    const secs = toSeconds(timer.duration.h, timer.duration.m, timer.duration.s);
    if (secs <= 0) return;
    onUpdate({ ...timer, state: 'running', remaining: secs, startedAt: Date.now(), pausedAt: null });
  };
  const handlePause = () => {
    onUpdate({ ...timer, state: 'paused', remaining: computeRemaining(timer), startedAt: null });
  };
  const handleResume = () => {
    onUpdate({ ...timer, state: 'running', startedAt: Date.now() - 0 });
  };
  const handleReset = () => {
    const secs = toSeconds(timer.duration.h, timer.duration.m, timer.duration.s);
    onUpdate({ ...timer, state: 'idle', remaining: secs, startedAt: null, pausedAt: null });
  };
  const saveEdit = () => {
    const secs = toSeconds(draft.duration.h, draft.duration.m, draft.duration.s);
    onUpdate({ ...draft, state: 'idle', remaining: secs, startedAt: null });
    setEditing(false);
  };

  // Progress ring
  const R = 52, C = 2 * Math.PI * R;
  const strokeDash = C * (1 - progress);

  const stateLabel = { idle: t('idle'), running: t('running'), paused: t('paused'), reminding: t('reminding'), finished: t('finished') };

  return (
    <Card style={cardStyle}>
      {/* Progress bar top */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'var(--surface-2)' }}>
        <div style={{ height: '100%', background: stateColors[timer.state] || 'var(--accent)',
          width: `${progress*100}%`, transition: 'width 1s linear', borderRadius: 2 }} />
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        {/* Clock display */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <svg width={120} height={120} style={{ flexShrink: 0 }}>
            <circle cx={60} cy={60} r={R} fill="none" stroke="var(--surface-2)" strokeWidth={6} />
            <circle cx={60} cy={60} r={R} fill="none" stroke={stateColors[timer.state]}
              strokeWidth={6} strokeDasharray={C} strokeDashoffset={strokeDash}
              strokeLinecap="round" transform="rotate(-90 60 60)"
              style={{ transition: 'stroke-dashoffset 1s linear, stroke .3s' }} />
            <text x={60} y={56} textAnchor="middle" fontSize={timer.state === 'finished' ? 13 : 18}
              fontWeight={700} fontFamily="var(--font-display)" fill={stateColors[timer.state]}>
              {timer.state === 'finished' ? t('finished') : formatTime(remaining)}
            </text>
            <text x={60} y={72} textAnchor="middle" fontSize={11} fill="var(--text-3)" fontFamily="var(--font-body)">
              {stateLabel[timer.state] || ''}
            </text>
          </svg>
          <div>
            <h3 style={{ fontSize: 16, marginBottom: 4 }}>{timer.name || (lang === 'zh' ? '計時器' : 'Timer')}</h3>
            <p style={{ fontSize: 12, color: 'var(--text-3)' }}>
              {lang === 'zh' ? '總時長' : 'Total'}: {formatTime(totalSecs)}
            </p>
            {timer.remindEnabled && remindSecs > 0 && (
              <p style={{ fontSize: 12, color: 'var(--warm)', marginTop: 2 }}>
                ⏰ {lang === 'zh' ? '提前' : 'Alert'} {formatTime(remindSecs)}
              </p>
            )}
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {(timer.state === 'idle' || timer.state === 'finished') && (
            <Btn onClick={handleStart} size="sm">▶ {t('start')}</Btn>
          )}
          {timer.state === 'running' && (
            <Btn onClick={handlePause} size="sm" variant="secondary">⏸ {t('pause')}</Btn>
          )}
          {timer.state === 'reminding' && (
            <Btn onClick={handlePause} size="sm" variant="warm">⏸ {t('pause')}</Btn>
          )}
          {timer.state === 'paused' && (
            <Btn onClick={handleResume} size="sm">▶ {t('resume')}</Btn>
          )}
          {timer.state !== 'idle' && (
            <Btn onClick={handleReset} size="sm" variant="ghost">↺ {t('reset')}</Btn>
          )}
          {(timer.state === 'running' || timer.state === 'reminding' || timer.state === 'paused') && (
            <Btn onClick={() => onFullscreen(timer.id)} size="sm" variant="ghost">
              ⛶
            </Btn>
          )}
          {(timer.state === 'idle' || timer.state === 'finished') && (
            <Btn onClick={() => { setDraft(clone(timer)); setEditing(true); }} size="sm" variant="ghost">✏️</Btn>
          )}
          <Btn onClick={onDelete} size="sm" variant="ghost" style={{ color: 'var(--danger)' }}>🗑</Btn>
        </div>
      </div>

      {editing && (
        <div style={{
          marginTop: 18, paddingTop: 18, borderTop: '1px solid var(--border)',
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
          gap: 18, alignItems: 'start',
        }}>
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-2)', display: 'block', marginBottom: 6 }}>
              {t('name')}
            </label>
            <input value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })}
              placeholder={lang === 'zh' ? '計時器名稱' : 'Timer name'}
              style={{ width: '100%', padding: '9px 12px', background: 'var(--surface-2)',
                border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', fontSize: 14 }} />
          </div>
          <TimeInput label={t('duration')} value={draft.duration}
            onChange={v => setDraft({ ...draft, duration: v })} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Toggle checked={draft.remindEnabled}
              onChange={v => setDraft({ ...draft, remindEnabled: v })}
              label={t('remind')} />
            {draft.remindEnabled && (
              <Toggle checked={draft.remindFlash}
                onChange={v => setDraft({ ...draft, remindFlash: v })}
                label={t('flash')} />
            )}
          </div>
          {draft.remindEnabled && (
            <>
              <TimeInput label={t('remindOffset')} value={draft.remindOffset}
                onChange={v => setDraft({ ...draft, remindOffset: v })} />
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-2)', display: 'block', marginBottom: 8 }}>
                  {t('sound')}
                </label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {SOUNDS.map(s => (
                    <button key={s.key} onClick={() => setDraft({ ...draft, remindSound: s.key })}
                      style={{
                        padding: '7px 12px', borderRadius: 6, border: '2px solid',
                        borderColor: draft.remindSound === s.key ? 'var(--accent)' : 'var(--border)',
                        background: draft.remindSound === s.key ? 'var(--accent-light)' : 'var(--surface-2)',
                        color: draft.remindSound === s.key ? 'var(--accent)' : 'var(--text-2)',
                        cursor: 'pointer', fontSize: 13, fontFamily: 'var(--font-body)',
                      }}>{s[lang] || s.en}</button>
                  ))}
                </div>
              </div>
            </>
          )}
          <div style={{ display: 'flex', gap: 8, alignSelf: 'end', justifyContent: 'flex-end', gridColumn: '1 / -1' }}>
            <Btn onClick={() => setEditing(false)} variant="ghost">{lang === 'zh' ? '取消' : 'Cancel'}</Btn>
            <Btn onClick={saveEdit}>{lang === 'zh' ? '儲存設定' : 'Save Settings'}</Btn>
          </div>
        </div>
      )}
    </Card>
  );
}

function FullscreenTimer({ timer, onClose, onPause, onResume, onReset, lang }) {
  if (!timer) return null;
  const remaining = computeRemaining(timer);
  const totalSecs = toSeconds(timer.duration.h, timer.duration.m, timer.duration.s);
  const progress = totalSecs > 0 ? Math.max(0, Math.min(1, remaining / totalSecs)) : 0;
  const stateText = {
    running: lang === 'zh' ? '運行中' : 'Running',
    reminding: lang === 'zh' ? '提醒中' : 'Reminder',
    paused: lang === 'zh' ? '已暫停' : 'Paused',
    finished: lang === 'zh' ? '時間到' : "Time's Up",
  }[timer.state] || '';

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 2000,
      background: timer.state === 'finished' ? 'var(--danger-light)' : 'var(--bg)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: 24,
      animation: timer.state === 'finished' && timer.remindFlash ? 'flash 0.6s ease infinite' : undefined,
    }}>
      <button onClick={onClose} style={{
        position: 'absolute', top: 18, right: 18, border: '1px solid var(--border)',
        background: 'var(--surface)', color: 'var(--text)', borderRadius: 10,
        padding: '8px 12px', fontSize: 18,
      }}>✕</button>
      <p style={{ fontSize: 'clamp(18px, 3vw, 32px)', color: 'var(--text-2)', marginBottom: 8 }}>{timer.name}</p>
      <div style={{
        fontFamily: 'var(--font-body)',
        fontSize: 'clamp(76px, 19vw, 240px)',
        fontWeight: 900,
        lineHeight: 1,
        color: timer.state === 'finished' ? 'var(--danger)' : 'var(--accent)',
        fontVariantNumeric: 'tabular-nums',
        letterSpacing: 0,
      }}>
        {timer.state === 'finished' ? stateText : formatTime(remaining)}
      </div>
      <p style={{ fontSize: 'clamp(16px, 2.5vw, 28px)', color: 'var(--text-2)', marginTop: 16 }}>{stateText}</p>
      <div style={{ width: 'min(760px, 86vw)', height: 14, background: 'var(--surface-2)', borderRadius: 99, overflow: 'hidden', marginTop: 28 }}>
        <div style={{ width: `${progress * 100}%`, height: '100%', background: 'var(--accent)', transition: 'width 1s linear' }} />
      </div>
      <div style={{ display: 'flex', gap: 10, marginTop: 28, flexWrap: 'wrap', justifyContent: 'center' }}>
        {(timer.state === 'running' || timer.state === 'reminding') && <Btn onClick={onPause} size="lg" variant="secondary">{lang === 'zh' ? '暫停' : 'Pause'}</Btn>}
        {timer.state === 'paused' && <Btn onClick={onResume} size="lg">{lang === 'zh' ? '繼續' : 'Resume'}</Btn>}
        <Btn onClick={onReset} size="lg" variant="ghost">{lang === 'zh' ? '重設' : 'Reset'}</Btn>
      </div>
    </div>
  );
}

export default function Countdown() {
  const { t, lang } = useLang();
  const [timers, setTimers] = useState(loadTimers);
  const [, setNow] = useState(Date.now());
  const [fullscreenId, setFullscreenId] = useState(null);
  const intervalRef = useRef(null);

  // Tick every second to re-render & check states
  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setNow(Date.now());
      setTimers(prev => {
        let changed = false;
        const next = prev.map(timer => {
          if (timer.state !== 'running' && timer.state !== 'reminding') return timer;
          const rem = computeRemaining(timer);
          const total = toSeconds(timer.duration.h, timer.duration.m, timer.duration.s);
          const remindSecs = toSeconds(timer.remindOffset.h, timer.remindOffset.m, timer.remindOffset.s);

          if (rem <= 0 && timer.state !== 'finished') {
            changed = true;
            return { ...timer, state: 'finished', remaining: 0, startedAt: null };
          }
          if (rem <= remindSecs && timer.remindEnabled && timer.state === 'running') {
            changed = true;
            return { ...timer, state: 'reminding' };
          }
          return timer;
        });
        if (changed) saveTimers(next);
        return changed ? next : prev;
      });
    }, 1000);
    return () => clearInterval(intervalRef.current);
  }, []);

  const updateTimer = (updated) => {
    setTimers(prev => {
      const next = prev.map(t => t.id === updated.id ? updated : t);
      saveTimers(next);
      return next;
    });
  };

  const deleteTimer = (id) => {
    setTimers(prev => { const next = prev.filter(t => t.id !== id); saveTimers(next); return next; });
  };

  const fullscreenTimer = timers.find(t => t.id === fullscreenId);
  const updateFullscreen = (patch) => {
    if (!fullscreenTimer) return;
    updateTimer({ ...fullscreenTimer, ...patch });
  };

  const addTimer = () => {
    if (timers.length >= 3) return;
    const newTimer = { ...DEFAULT_TIMER, id: uid(), name: `${lang === 'zh' ? '計時器' : 'Timer'} ${timers.length + 1}` };
    const secs = toSeconds(newTimer.duration.h, newTimer.duration.m, newTimer.duration.s);
    newTimer.remaining = secs;
    const next = [...timers, newTimer];
    setTimers(next);
    saveTimers(next);
  };

  const requestNotif = async () => {
    if (!('Notification' in window)) return;
    const permission = await Notification.requestPermission();
    if (permission === 'granted' && 'serviceWorker' in navigator) {
      await navigator.serviceWorker.ready.catch(() => null);
    }
  };

  return (
    <div style={{ maxWidth: 820, margin: '0 auto', padding: '28px 20px' }}>
      <SectionHead
        title={`⏱️ ${t('cdTitle')}`}
        desc={t('cdBgNote')}
        actions={<>
          {'Notification' in window && Notification.permission !== 'granted' && (
            <Btn variant="ghost" size="sm" onClick={requestNotif}>🔔 {t('cdNotiBtn')}</Btn>
          )}
          <Btn onClick={addTimer} disabled={timers.length >= 3}>
            + {t('cdAdd')}
          </Btn>
        </>}
      />

      {timers.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-3)' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>⏱️</div>
          <p>{t('cdAddFirst')}</p>
          <p style={{ fontSize: 13, marginTop: 8 }}>{t('cdMaxTimers')}</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px,1fr))', gap: 16 }}>
          {timers.map(timer => (
              <TimerCard key={timer.id} timer={timer} onUpdate={updateTimer}
              onDelete={() => deleteTimer(timer.id)} onFullscreen={setFullscreenId} lang={lang} />
          ))}
        </div>
      )}

      {timers.length > 0 && timers.length < 3 && (
        <div style={{ textAlign: 'center', marginTop: 24 }}>
          <Btn variant="ghost" onClick={addTimer}>+ {t('cdAdd')} ({timers.length}/3)</Btn>
        </div>
      )}

      <FullscreenTimer
        timer={fullscreenTimer}
        lang={lang}
        onClose={() => setFullscreenId(null)}
        onPause={() => updateFullscreen({ state: 'paused', remaining: computeRemaining(fullscreenTimer), startedAt: null })}
        onResume={() => updateFullscreen({ state: 'running', startedAt: Date.now() })}
        onReset={() => {
          const secs = toSeconds(fullscreenTimer.duration.h, fullscreenTimer.duration.m, fullscreenTimer.duration.s);
          updateFullscreen({ state: 'idle', remaining: secs, startedAt: null, pausedAt: null });
          setFullscreenId(null);
        }}
      />
    </div>
  );
}
