'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../components/AuthProvider';

const ADMIN_EMAIL = 'bycheshin@gmail.com';

export default function AdminPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) { router.replace('/login'); return; }
    if (user.email !== ADMIN_EMAIL) router.replace('/');
  }, [user, loading, router]);

  if (loading || !user || user.email !== ADMIN_EMAIL) return null;

  const links = [
    { href: '/admin/template-editor', label: 'Template Editor', color: 'rgba(255,255,255,0.06)', border: 'rgba(255,255,255,0.12)', text: '#fff' },
    { href: '/admin/tools',           label: 'Site Tools',       color: 'rgba(255,255,255,0.06)', border: 'rgba(255,255,255,0.12)', text: '#fff' },
    { href: '/admin/orders',          label: 'Orders & Drafts',  color: 'rgba(74,222,128,0.1)',   border: 'rgba(74,222,128,0.2)',   text: '#4ade80' },
  ];

  return (
    <div style={{ minHeight: '100vh', background: '#09090b', color: '#fff', fontFamily: 'var(--font-inter), system-ui, sans-serif' }}>
      <header style={{ position: 'sticky', top: 0, zIndex: 50, background: 'rgba(9,9,11,0.85)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px', height: 60, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontFamily: 'var(--font-playfair)', fontSize: 18, fontWeight: 700 }}>
            Share Your Simcha <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13, fontWeight: 400, fontFamily: 'var(--font-inter)' }}>/ Admin</span>
          </span>
          <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>{user.email}</span>
        </div>
      </header>

      <main style={{ maxWidth: 600, margin: '0 auto', padding: '64px 24px' }}>
        <h1 style={{ fontFamily: 'var(--font-playfair)', fontSize: 32, fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 32 }}>
          Admin Panel
        </h1>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {links.map(({ href, label, color, border, text }) => (
            <a key={href} href={href} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', borderRadius: 12, fontSize: 15, fontWeight: 600, background: color, border: `1px solid ${border}`, color: text, textDecoration: 'none' }}>
              {label}
              <span style={{ opacity: 0.6 }}>→</span>
            </a>
          ))}
        </div>
      </main>
    </div>
  );
}
