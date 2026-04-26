import React, { createContext, useContext, useState, useEffect } from 'react';
import { db } from './store.js';
import T from './i18n.js';
import Countdown from './tools/Countdown.jsx';
import Queue from './tools/Queue.jsx';
import QAFront from './tools/QAFront.jsx';
import QAAdmin from './tools/QAAdmin.jsx';
import CoFront from './tools/CoFront.jsx';
import CoAdmin from './tools/CoAdmin.jsx';

export const LangCtx = createContext({ lang: 'zh', t: k => k, setLang: () => {} });
export const ThemeCtx = createContext({ theme: 'light', toggle: () => {} });
export const useLang = () => useContext(LangCtx);
export const useTheme = () => useContext(ThemeCtx);

export function useHash() {
  const [hash, setHash] = useState(() => window.location.hash.slice(1) || '/');
  useEffect(() => {
    const h = () => setHash(window.location.hash.slice(1) || '/');
    window.addEventListener('hashchange', h);
    return () => window.removeEventListener('hashchange', h);
  }, []);
  return hash;
}

export function nav(path) { window.location.hash = path; }

function Header() {
  const { lang, setLang, t } = useLang();
  const { theme, toggle } = useTheme();
  const hash = useHash();
  const isHome = hash === '/' || hash === '';

  return (
    <header style={{
      background: 'var(--surface)', borderBottom: '1px solid var(--border)',
      padding: '0 20px', display: 'flex', alignItems: 'center',
      height: 56, gap: 12, position: 'sticky', top: 0, zIndex: 100,
      boxShadow: 'var(--shadow-sm)',
    }}>
      <button onClick={() => nav('/')} style={{
        display: 'flex', alignItems: 'center', gap: 8, background: 'none',
        border: 'none', cursor: 'pointer', fontFamily: 'var(--font-display)',
        fontWeight: 700, fontSize: 17, color: 'var(--text)', padding: 0,
      }}>
        <span>🛠️</span>
        <span style={{ color: 'var(--accent)' }}>KC</span>
        <span style={{ color: 'var(--text-2)', fontWeight: 600, fontSize: 14 }}>
          {lang === 'zh' ? '工具箱' : 'Toolbox'}
        </span>
      </button>

      {!isHome && (
        <button onClick={() => nav('/')} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--text-3)', fontSize: 13, display: 'flex', alignItems: 'center', gap: 3,
        }}>← {t('home')}</button>
      )}

      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
        <button onClick={toggle} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18 }}>
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>
        <button onClick={() => setLang(lang === 'zh' ? 'en' : 'zh')} style={{
          background: 'var(--surface-2)', border: '1px solid var(--border)',
          borderRadius: 6, padding: '4px 10px', cursor: 'pointer',
          fontSize: 13, fontWeight: 600, color: 'var(--text-2)',
        }}>{t('lang')}</button>
      </div>
    </header>
  );
}

const TOOLS = [
  { key: 'countdown', icon: '⏱️', color: '#0d9488', path: '/countdown' },
  { key: 'queue', icon: '📋', color: '#d97706', path: '/queue' },
  { key: 'qa', icon: '💬', color: '#2563eb', path: '/qa', admin: '/qa-admin' },
  { key: 'cocreate', icon: '🌐', color: '#16a34a', path: '/cocreate', admin: '/cocreate-admin' },
];

function Home() {
  const { t } = useLang();
  const names = {
    countdown: [t('toolCountdown'), t('toolCountdownDesc')],
    queue: [t('toolQueue'), t('toolQueueDesc')],
    qa: [t('toolQA'), t('toolQADesc')],
    cocreate: [t('toolCoCreate'), t('toolCoCreateDesc')],
  };

  return (
    <div style={{ maxWidth: 860, margin: '0 auto', padding: '40px 20px' }}>
      <div style={{ textAlign: 'center', marginBottom: 48 }} className="fade-in">
        <div style={{ fontSize: 52, marginBottom: 12 }}>🛠️</div>
        <h1 style={{ fontSize: 'clamp(26px,5vw,40px)', marginBottom: 10 }}>{t('homeTitle')}</h1>
        <p style={{ fontSize: 15, color: 'var(--text-2)', maxWidth: 460, margin: '0 auto' }}>{t('homeSubtitle')}</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px,1fr))', gap: 16 }}>
        {TOOLS.map((tool, i) => {
          const [name, desc] = names[tool.key];
          return (
            <div key={tool.key} className="fade-in" style={{ animationDelay: `${i*0.08}s` }}>
              <div style={{
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius-xl)', padding: '24px 20px',
                height: '100%', display: 'flex', flexDirection: 'column', gap: 10,
                boxShadow: 'var(--shadow-sm)',
              }}>
                <div style={{ fontSize: 36 }}>{tool.icon}</div>
                <h3 style={{ fontSize: 16 }}>{name}</h3>
                <p style={{ fontSize: 13, color: 'var(--text-2)', flex: 1, lineHeight: 1.6 }}>{desc}</p>
                <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                  <button onClick={() => nav(tool.path)} style={{
                    flex: 1, padding: '8px 0', background: tool.color,
                    color: '#fff', border: 'none', borderRadius: 8,
                    cursor: 'pointer', fontWeight: 600, fontSize: 13, fontFamily: 'var(--font-body)',
                  }}>{t('enterTool')}</button>
                  {tool.admin && (
                    <button onClick={() => nav(tool.admin)} style={{
                      padding: '8px 10px', background: 'var(--surface-2)',
                      border: '1px solid var(--border)', borderRadius: 8,
                      cursor: 'pointer', fontSize: 14,
                    }}>⚙️</button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-3)', marginTop: 48 }}>
        KC Workshop Toolbox · React + Vite · GitHub Pages
      </p>
    </div>
  );
}

function Router({ hash }) {
  const path = hash.split('?')[0];
  if (path === '/' || path === '') return <Home />;
  if (path === '/countdown') return <Countdown />;
  if (path === '/queue') return <Queue />;
  if (path.startsWith('/qa-admin')) return <QAAdmin />;
  if (path.startsWith('/qa')) return <QAFront />;
  if (path.startsWith('/cocreate-admin')) return <CoAdmin />;
  if (path.startsWith('/cocreate')) return <CoFront />;
  return <div style={{ textAlign: 'center', padding: 80, color: 'var(--text-3)' }}>
    <div style={{ fontSize: 48 }}>404</div>
    <button onClick={() => nav('/')} style={{ marginTop: 16, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer' }}>← Home</button>
  </div>;
}

export default function App() {
  const [lang, setLang] = useState(() => db.get('lang', 'zh'));
  const [theme, setTheme] = useState(() => db.get('theme', 'light'));
  const hash = useHash();

  useEffect(() => { document.documentElement.setAttribute('data-theme', theme); db.set('theme', theme); }, [theme]);
  useEffect(() => { db.set('lang', lang); }, [lang]);

  const t = k => (T[lang]?.[k] ?? T.zh?.[k] ?? k);

  return (
    <ThemeCtx.Provider value={{ theme, toggle: () => setTheme(t => t === 'dark' ? 'light' : 'dark') }}>
      <LangCtx.Provider value={{ lang, t, setLang }}>
        <Header />
        <main><Router hash={hash} /></main>
      </LangCtx.Provider>
    </ThemeCtx.Provider>
  );
}
