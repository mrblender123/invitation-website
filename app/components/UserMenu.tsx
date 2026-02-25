'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from './AuthProvider';

export default function UserMenu() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  if (!user) return null;

  const avatar = user.user_metadata?.avatar_url as string | undefined;
  const name = (user.user_metadata?.full_name ?? user.email ?? 'User') as string;
  const initials = name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase();

  const handleSignOut = async () => {
    await signOut();
    router.push('/');
  };

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          background: 'rgba(255,255,255,0.06)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 99, padding: '4px 12px 4px 4px',
          cursor: 'pointer', color: '#fff',
        }}
      >
        {avatar ? (
          <img src={avatar} alt={name} style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover' }} />
        ) : (
          <div style={{
            width: 28, height: 28, borderRadius: '50%',
            background: 'linear-gradient(135deg, #a1a1aa, #e4e4e7)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, fontWeight: 700, color: '#fff',
          }}>
            {initials}
          </div>
        )}
        <span style={{ fontSize: 13, fontWeight: 500, maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {name.split(' ')[0]}
        </span>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ opacity: 0.5 }}>
          <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div style={{ position: 'fixed', inset: 0, zIndex: 49 }} onClick={() => setOpen(false)} />
          {/* Dropdown */}
          <div style={{
            position: 'absolute', right: 0, top: 'calc(100% + 8px)', zIndex: 50,
            background: '#18181b', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 12, padding: 8, minWidth: 200,
            boxShadow: '0 16px 40px rgba(0,0,0,0.6)',
          }}>
            <div style={{ padding: '8px 12px 12px', borderBottom: '1px solid rgba(255,255,255,0.07)', marginBottom: 4 }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: '#fff', margin: 0 }}>{name}</p>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', margin: '2px 0 0', wordBreak: 'break-all' }}>{user.email}</p>
            </div>
            <button
              onClick={handleSignOut}
              style={{
                width: '100%', textAlign: 'left', padding: '9px 12px',
                background: 'none', border: 'none', borderRadius: 7,
                fontSize: 13, color: 'rgba(255,255,255,0.65)', cursor: 'pointer',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = '#fff'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'rgba(255,255,255,0.65)'; }}
            >
              Sign out
            </button>
          </div>
        </>
      )}
    </div>
  );
}
