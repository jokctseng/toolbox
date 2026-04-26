import React, { useState } from 'react';
import { generateOTP, verifyOTP, createSession } from '../store.js';
import { Btn, Inp, Card } from './UI.jsx';

export default function OTPLogin({ namespace = 'default', onLogin, title, lang = 'zh' }) {
  const [step, setStep] = useState('generate'); // generate | verify
  const [otp, setOtp] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleGenerate = async () => {
    setLoading(true);
    const newCode = await generateOTP(namespace);
    setOtp(newCode);
    setStep('verify');
    setLoading(false);
  };

  const handleVerify = async () => {
    setError('');
    setLoading(true);
    const ok = await verifyOTP(code.trim(), namespace);
    setLoading(false);
    if (ok) {
      createSession(namespace);
      onLogin?.();
    } else {
      setError(lang === 'zh' ? 'OTP 錯誤或已過期，請重新生成' : 'Invalid or expired OTP');
    }
  };

  const copyOTP = () => {
    navigator.clipboard.writeText(otp).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{ maxWidth: 420, margin: '60px auto', padding: 24 }}>
      <Card>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>🔐</div>
          <h2 style={{ fontSize: 22 }}>{title || (lang === 'zh' ? '管理員登入' : 'Admin Login')}</h2>
        </div>

        {step === 'generate' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <p style={{ fontSize: 14, color: 'var(--text-2)', textAlign: 'center' }}>
              {lang === 'zh'
                ? '點擊下方按鈕生成一次性密碼（OTP），密碼有效期 24 小時'
                : 'Click below to generate a one-time password (OTP). Valid for 24 hours.'}
            </p>
            <Btn onClick={handleGenerate} disabled={loading} size="lg" style={{ width: '100%', justifyContent: 'center' }}>
              {loading ? '⏳' : '🔑'} {lang === 'zh' ? '生成管理員 OTP' : 'Generate Admin OTP'}
            </Btn>
            <div style={{ textAlign: 'center' }}>
              <button onClick={() => setStep('verify')} style={{
                background: 'none', border: 'none', color: 'var(--accent)',
                cursor: 'pointer', fontSize: 13, textDecoration: 'underline',
              }}>
                {lang === 'zh' ? '我已有 OTP，直接登入' : 'I already have an OTP'}
              </button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {otp && (
              <div style={{
                background: 'var(--surface-2)', borderRadius: 'var(--radius)',
                padding: 16, textAlign: 'center', border: '1px solid var(--border)',
              }}>
                <p style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 8 }}>
                  {lang === 'zh' ? '您的 OTP（請記下此碼）：' : 'Your OTP (please note):'}
                </p>
                <div style={{ fontSize: 36, fontWeight: 800, letterSpacing: 8, color: 'var(--accent)', fontFamily: 'var(--font-display)' }}>
                  {otp}
                </div>
                <Btn variant="ghost" size="sm" onClick={copyOTP} style={{ marginTop: 8 }}>
                  {copied ? '✓ ' + (lang === 'zh' ? '已複製' : 'Copied') : '📋 ' + (lang === 'zh' ? '複製' : 'Copy')}
                </Btn>
              </div>
            )}
            <Inp
              label={lang === 'zh' ? '輸入 OTP 驗證碼' : 'Enter OTP'}
              value={code}
              onChange={setCode}
              placeholder={lang === 'zh' ? '6 位數驗證碼' : '6-digit code'}
              type="text"
              maxLength={6}
              onKeyDown={e => e.key === 'Enter' && handleVerify()}
            />
            {error && <p style={{ color: 'var(--danger)', fontSize: 13 }}>{error}</p>}
            <Btn onClick={handleVerify} disabled={loading || code.length < 4} size="lg" style={{ width: '100%', justifyContent: 'center' }}>
              {loading ? '⏳' : '🔓'} {lang === 'zh' ? '登入' : 'Login'}
            </Btn>
            <div style={{ textAlign: 'center' }}>
              <button onClick={handleGenerate} style={{
                background: 'none', border: 'none', color: 'var(--text-3)',
                cursor: 'pointer', fontSize: 13, textDecoration: 'underline',
              }}>
                {lang === 'zh' ? '重新生成 OTP' : 'Generate new OTP'}
              </button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
