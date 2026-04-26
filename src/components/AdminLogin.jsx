import React, { useState } from 'react';
import { supabase, hasSupabaseConfig } from '../supabaseClient.js';
import { createSession } from '../store.js';
import { Btn, Card, Inp } from './UI.jsx';

const adminEmails = (import.meta.env.VITE_ADMIN_EMAILS || '')
  .split(',')
  .map(email => email.trim().toLowerCase())
  .filter(Boolean);

export default function AdminLogin({ namespace, title, lang = 'zh', onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const login = async () => {
    setError('');
    const normalized = email.trim().toLowerCase();
    if (!hasSupabaseConfig) {
      setError(lang === 'zh'
        ? '請先設定 Supabase 環境變數，後台不再提供公開產生 OTP。'
        : 'Supabase environment variables are required for admin login.');
      return;
    }
    if (adminEmails.length > 0 && !adminEmails.includes(normalized)) {
      setError(lang === 'zh' ? '此 Email 不在管理員名單內' : 'This email is not in the admin allowlist.');
      return;
    }

    setLoading(true);
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: normalized,
      password,
    });
    setLoading(false);

    if (signInError) {
      setError(signInError.message);
      return;
    }

    createSession(namespace);
    onLogin?.();
  };

  return (
    <div style={{ maxWidth: 420, margin: '72px auto', padding: 20 }}>
      <Card>
        <div style={{ textAlign: 'center', marginBottom: 22 }}>
          <div style={{ fontSize: 34, marginBottom: 8 }}>🔐</div>
          <h2 style={{ fontSize: 21 }}>{title || (lang === 'zh' ? '管理員登入' : 'Admin Login')}</h2>
          <p style={{ fontSize: 13, color: 'var(--text-2)', marginTop: 8, lineHeight: 1.6 }}>
            {lang === 'zh'
              ? '請使用 Supabase Auth 中已建立的管理員帳號登入。'
              : 'Sign in with an admin account created in Supabase Auth.'}
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Inp
            label="Email"
            value={email}
            onChange={setEmail}
            type="email"
            placeholder="admin@example.com"
            autoComplete="username"
          />
          <Inp
            label={lang === 'zh' ? '密碼' : 'Password'}
            value={password}
            onChange={setPassword}
            type="password"
            autoComplete="current-password"
            onKeyDown={e => e.key === 'Enter' && login()}
          />
          {adminEmails.length > 0 && (
            <p style={{ fontSize: 12, color: 'var(--text-3)' }}>
              {lang === 'zh' ? '允許管理員：' : 'Allowed admins: '}{adminEmails.join(', ')}
            </p>
          )}
          {error && <p style={{ fontSize: 13, color: 'var(--danger)' }}>{error}</p>}
          <Btn onClick={login} loading={loading} disabled={!email.trim() || !password} size="lg" style={{ width: '100%', justifyContent: 'center' }}>
            {lang === 'zh' ? '登入後台' : 'Sign In'}
          </Btn>
        </div>
      </Card>
    </div>
  );
}
