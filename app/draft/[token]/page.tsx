'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';

export default function DraftPage() {
  const router = useRouter();
  const { token } = useParams<{ token: string }>();
  const [status, setStatus] = useState<'loading' | 'error' | 'expired'>('loading');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!token) return;
    fetch(`/api/drafts/${token}`)
      .then(async res => {
        if (res.status === 410) { setStatus('expired'); return; }
        if (!res.ok) { const d = await res.json(); setErrorMsg(d.error ?? 'Unknown error'); setStatus('error'); return; }
        const { templateId, fieldValues } = await res.json();
        localStorage.setItem('invitia-template-load', JSON.stringify({ templateId, fieldValues }));
        router.replace('/templates');
      })
      .catch(err => { setErrorMsg(String(err)); setStatus('error'); });
  }, [token, router]);

  if (status === 'loading') {
    return (
      <div style={{ minHeight: '100vh', background: '#09090b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 15 }}>Loading your draft…</p>
      </div>
    );
  }

  if (status === 'expired') {
    return (
      <div style={{ minHeight: '100vh', background: '#09090b', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 }}>
        <p style={{ fontSize: 32 }}>⏳</p>
        <h1 style={{ color: '#fff', fontSize: 22, fontWeight: 700, margin: 0 }}>Draft expired</h1>
        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 15, margin: 0, textAlign: 'center' }}>
          This link is more than 7 days old. Please create a new draft.
        </p>
        <button
          onClick={() => router.push('/templates')}
          style={{
            marginTop: 8, padding: '12px 28px', borderRadius: 8,
            background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)',
            color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer',
          }}
        >
          Browse Templates
        </button>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#09090b', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 }}>
      <p style={{ fontSize: 32 }}>⚠️</p>
      <h1 style={{ color: '#fff', fontSize: 22, fontWeight: 700, margin: 0 }}>Could not load draft</h1>
      <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14, margin: 0 }}>{errorMsg}</p>
      <button
        onClick={() => router.push('/templates')}
        style={{
          marginTop: 8, padding: '12px 28px', borderRadius: 8,
          background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)',
          color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer',
        }}
      >
        Browse Templates
      </button>
    </div>
  );
}
