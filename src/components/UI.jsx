import React, { useState, useRef, useEffect } from 'react';

// --- Btn ---
export function Btn({ children, onClick, variant = 'primary', size = 'md', disabled, className = '', style, type = 'button', ...rest }) {
  const base = {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    border: 'none', borderRadius: 'var(--radius-sm)', cursor: disabled ? 'not-allowed' : 'pointer',
    fontFamily: 'var(--font-body)', fontWeight: 600, transition: 'var(--trans)',
    whiteSpace: 'nowrap', userSelect: 'none',
    opacity: disabled ? 0.55 : 1,
    fontSize: size === 'sm' ? 13 : size === 'lg' ? 16 : 14,
    padding: size === 'sm' ? '5px 12px' : size === 'lg' ? '11px 22px' : '8px 16px',
  };
  const variants = {
    primary: { background: 'var(--accent)', color: '#fff' },
    secondary: { background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border)' },
    danger: { background: 'var(--danger)', color: '#fff' },
    ghost: { background: 'transparent', color: 'var(--text-2)', border: '1px solid var(--border)' },
    warm: { background: 'var(--warm)', color: '#fff' },
    success: { background: 'var(--success)', color: '#fff' },
    link: { background: 'transparent', color: 'var(--accent)', padding: 0, fontWeight: 500 },
  };
  return (
    <button type={type} onClick={disabled ? undefined : onClick}
      style={{ ...base, ...variants[variant], ...style }} className={className} {...rest}>
      {children}
    </button>
  );
}

// --- Card ---
export function Card({ children, style, className = '', onClick, padding = 20 }) {
  return (
    <div onClick={onClick}
      style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-sm)',
        padding, cursor: onClick ? 'pointer' : undefined,
        transition: 'var(--trans)',
        ...style
      }}
      className={`fade-in ${className}`}>
      {children}
    </div>
  );
}

// --- Modal ---
export function Modal({ open, onClose, title, children, width = 540, footer }) {
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);
  if (!open) return null;
  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000, padding: 16, backdropFilter: 'blur(4px)',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'var(--surface)', borderRadius: 'var(--radius-xl)',
        boxShadow: 'var(--shadow-lg)', width: '100%', maxWidth: width,
        maxHeight: '92vh', display: 'flex', flexDirection: 'column',
        animation: 'scaleIn .2s ease',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '18px 24px 0', flexShrink: 0 }}>
          {title && <h3 style={{ fontSize: 18, fontFamily: 'var(--font-display)' }}>{title}</h3>}
          <button onClick={onClose} style={{
            background: 'none', border: 'none', cursor: 'pointer', fontSize: 20,
            color: 'var(--text-3)', marginLeft: 'auto', lineHeight: 1, padding: 4,
          }}>✕</button>
        </div>
        <div style={{ padding: '16px 24px', overflowY: 'auto', flex: 1 }}>{children}</div>
        {footer && <div style={{ padding: '0 24px 18px', flexShrink: 0 }}>{footer}</div>}
      </div>
    </div>
  );
}

// --- Input ---
export function Inp({ label, value, onChange, placeholder, type = 'text', required, multiline, rows = 3, style, hint, ...rest }) {
  const inputStyle = {
    width: '100%', padding: '9px 12px',
    background: 'var(--surface-2)', border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)', color: 'var(--text)',
    fontSize: 14, fontFamily: 'var(--font-body)',
    transition: 'border-color .2s', outline: 'none',
    resize: multiline ? 'vertical' : undefined,
    ...style
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      {label && <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-2)' }}>
        {label}{required && <span style={{ color: 'var(--danger)', marginLeft: 2 }}>*</span>}
      </label>}
      {multiline
        ? <textarea value={value} onChange={e => onChange(e.target.value)}
            placeholder={placeholder} rows={rows} style={inputStyle} {...rest} />
        : <input type={type} value={value} onChange={e => onChange(e.target.value)}
            placeholder={placeholder} style={inputStyle} {...rest} />
      }
      {hint && <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{hint}</span>}
    </div>
  );
}

// --- NumericInput ---
export function NumInp({ label, value, onChange, min = 0, max = 99, style }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      {label && <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-2)' }}>{label}</label>}
      <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <button onClick={() => onChange(Math.max(min, (value||0) - 1))} style={{
          width: 30, height: 34, background: 'var(--surface-2)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-sm) 0 0 var(--radius-sm)', cursor: 'pointer', fontSize: 16, color: 'var(--text-2)',
        }}>−</button>
        <input type="number" value={value} min={min} max={max}
          onChange={e => onChange(Math.min(max, Math.max(min, parseInt(e.target.value)||0)))}
          style={{
            width: 56, textAlign: 'center', padding: '7px 4px',
            background: 'var(--surface-2)', border: '1px solid var(--border)',
            borderLeft: 'none', borderRight: 'none', color: 'var(--text)', fontSize: 14,
            ...style
          }} />
        <button onClick={() => onChange(Math.min(max, (value||0) + 1))} style={{
          width: 30, height: 34, background: 'var(--surface-2)', border: '1px solid var(--border)',
          borderRadius: '0 var(--radius-sm) var(--radius-sm) 0', cursor: 'pointer', fontSize: 16, color: 'var(--text-2)',
        }}>+</button>
      </div>
    </div>
  );
}

// --- Toggle ---
export function Toggle({ checked, onChange, label }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', userSelect: 'none' }}>
      <div onClick={() => onChange(!checked)} style={{
        width: 40, height: 22, borderRadius: 11,
        background: checked ? 'var(--accent)' : 'var(--surface-3)',
        position: 'relative', transition: 'background .2s', flexShrink: 0,
      }}>
        <div style={{
          width: 18, height: 18, borderRadius: '50%', background: '#fff',
          position: 'absolute', top: 2, left: checked ? 20 : 2,
          transition: 'left .2s', boxShadow: '0 1px 3px rgba(0,0,0,.2)',
        }} />
      </div>
      {label && <span style={{ fontSize: 14, color: 'var(--text)' }}>{label}</span>}
    </label>
  );
}

// --- Badge ---
export function Badge({ children, color = 'teal', style }) {
  return (
    <span className={`badge-${color}`} style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '2px 8px', borderRadius: 100, fontSize: 12, fontWeight: 600,
      ...style
    }}>{children}</span>
  );
}

// --- Tabs ---
export function Tabs({ tabs, active, onChange, style }) {
  return (
    <div style={{
      display: 'flex', gap: 2, background: 'var(--surface-2)',
      borderRadius: 'var(--radius)', padding: 3, flexWrap: 'wrap',
      ...style
    }}>
      {tabs.map(t => (
        <button key={t.key} onClick={() => onChange(t.key)} style={{
          padding: '6px 14px', borderRadius: 7, border: 'none', cursor: 'pointer',
          background: active === t.key ? 'var(--surface)' : 'transparent',
          color: active === t.key ? 'var(--accent)' : 'var(--text-2)',
          fontWeight: active === t.key ? 600 : 400,
          fontFamily: 'var(--font-body)', fontSize: 14,
          boxShadow: active === t.key ? 'var(--shadow-sm)' : 'none',
          transition: 'var(--trans)',
        }}>{t.label}</button>
      ))}
    </div>
  );
}

// --- TimeInput (h/m/s) ---
export function TimeInput({ value, onChange, label }) {
  const { h, m, s } = value;
  const field = (lbl, val, key, max) => (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
      <input type="number" value={val} min={0} max={max}
        onChange={e => onChange({ ...value, [key]: Math.min(max, Math.max(0, parseInt(e.target.value)||0)) })}
        style={{
          width: 60, textAlign: 'center', padding: '8px 4px',
          background: 'var(--surface-2)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-sm)', color: 'var(--text)', fontSize: 20, fontWeight: 700,
        }} />
      <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{lbl}</span>
    </div>
  );
  return (
    <div>
      {label && <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-2)', marginBottom: 6 }}>{label}</div>}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {field('時 h', h, 'h', 23)}
        <span style={{ color: 'var(--text-3)', fontSize: 20, paddingBottom: 18 }}>:</span>
        {field('分 m', m, 'm', 59)}
        <span style={{ color: 'var(--text-3)', fontSize: 20, paddingBottom: 18 }}>:</span>
        {field('秒 s', s, 's', 59)}
      </div>
    </div>
  );
}

// --- Confirm Dialog ---
export function Confirm({ open, onClose, onConfirm, message, title = '確認' }) {
  return (
    <Modal open={open} onClose={onClose} title={title} width={380}
      footer={
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <Btn variant="ghost" onClick={onClose}>取消 Cancel</Btn>
          <Btn variant="danger" onClick={() => { onConfirm(); onClose(); }}>確認 Confirm</Btn>
        </div>
      }>
      <p style={{ color: 'var(--text-2)' }}>{message || '確定要執行此操作嗎？'}</p>
    </Modal>
  );
}

// --- DragList (simple drag-to-reorder) ---
export function DragList({ items, renderItem, onReorder, keyProp = 'id' }) {
  const [drag, setDrag] = useState(null);
  const [over, setOver] = useState(null);

  const handleDrop = () => {
    if (drag === null || over === null || drag === over) return;
    const next = [...items];
    const [item] = next.splice(drag, 1);
    next.splice(over, 0, item);
    onReorder(next);
    setDrag(null); setOver(null);
  };

  return (
    <div>
      {items.map((item, i) => (
        <div key={item[keyProp] || i}
          draggable
          onDragStart={() => setDrag(i)}
          onDragOver={e => { e.preventDefault(); setOver(i); }}
          onDragEnd={() => { setDrag(null); setOver(null); }}
          onDrop={handleDrop}
          style={{
            opacity: drag === i ? 0.4 : 1,
            outline: over === i && drag !== i ? '2px dashed var(--accent)' : 'none',
            outlineOffset: 2, borderRadius: 'var(--radius-sm)',
          }}>
          {renderItem(item, i)}
        </div>
      ))}
    </div>
  );
}

// --- Empty state ---
export function Empty({ icon = '📭', message = '尚無資料', action }) {
  return (
    <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-3)' }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>{icon}</div>
      <p style={{ fontSize: 15 }}>{message}</p>
      {action && <div style={{ marginTop: 16 }}>{action}</div>}
    </div>
  );
}

// --- Spinner ---
export function Spinner({ size = 24 }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      border: `3px solid var(--border)`,
      borderTopColor: 'var(--accent)',
      animation: 'spin .7s linear infinite',
    }} />
  );
}

// --- ProgressBar ---
export function Progress({ value, max, color = 'var(--accent)', height = 6 }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div style={{ background: 'var(--surface-2)', borderRadius: 100, height, overflow: 'hidden' }}>
      <div style={{
        height: '100%', width: `${pct}%`,
        background: color, borderRadius: 100,
        transition: 'width .4s ease',
      }} />
    </div>
  );
}

// --- Section heading ---
export function SectionHead({ title, actions, desc }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <h2 style={{ fontSize: 20 }}>{title}</h2>
        {actions && <div style={{ display: 'flex', gap: 8 }}>{actions}</div>}
      </div>
      {desc && <p style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 4 }}>{desc}</p>}
    </div>
  );
}
