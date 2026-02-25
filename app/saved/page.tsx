'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { Invitation } from '@/lib/supabase';
import { useAuth } from '../components/AuthProvider';
import UserMenu from '../components/UserMenu';

export default function SavedPage() {
  const router = useRouter();
  const { user, loading: authLoading, accessToken } = useAuth();
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Auth gate
  useEffect(() => {
    if (!authLoading && !user) router.replace('/login');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, authLoading]);

  useEffect(() => {
    if (!accessToken) return;
    fetch('/api/invitations', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then(r => r.json())
      .then(({ invitations }) => setInvitations(invitations ?? []))
      .finally(() => setLoading(false));
  }, [accessToken]);

  const handleLoad = (inv: Invitation) => {
    if (inv.settings.isTemplate && inv.settings.templateId) {
      // Template-based design: reopen in the template editor
      localStorage.setItem('invitia-template-load', JSON.stringify({
        templateId: inv.settings.templateId,
        fieldValues: inv.settings.fieldValues ?? {},
      }));
      router.push('/templates');
    } else {
      // Studio-based design: reopen in the AI studio
      localStorage.setItem('invitia-state', JSON.stringify({
        data: {
          eventTitle: inv.event_title,
          hostName: inv.host_name,
          dateTime: inv.date_time,
        },
        ...inv.settings,
      }));
      router.push('/studio?load=1');
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    await fetch(`/api/invitations/${id}`, {
      method: 'DELETE',
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
    });
    setInvitations(prev => prev.filter(i => i.id !== id));
    setDeletingId(null);
  };

  if (authLoading || !user) return null;

  return (
    <div style={{ minHeight: '100vh', background: '#09090b', color: '#fff', fontFamily: 'var(--font-inter), system-ui, sans-serif' }}>

      {/* Header */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 50,
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        background: 'rgba(9,9,11,0.85)',
        backdropFilter: 'blur(12px)',
      }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 24px', height: 60, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Link href="/" style={{ fontFamily: 'var(--font-playfair)', fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em', color: '#fff', textDecoration: 'none' }}>
            Invitia
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <Link href="/gallery" style={{ fontSize: 14, color: 'rgba(255,255,255,0.45)', textDecoration: 'none' }}>
              Gallery View
            </Link>
            <Link href="/new" className="silver-btn" style={{ padding: '8px 18px', fontSize: 14 }}>
              + New Design
            </Link>
            <UserMenu />
          </div>
        </div>
      </header>

      {/* Content */}
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '56px 24px 80px' }}>
        <div style={{ marginBottom: 48 }}>
          <p style={{ fontSize: 12, fontWeight: 500, letterSpacing: '0.12em', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', marginBottom: 12 }}>
            Library
          </p>
          <h1 style={{ fontFamily: 'var(--font-playfair)', fontSize: 'clamp(28px, 4vw, 42px)', fontWeight: 700, letterSpacing: '-0.02em', margin: 0 }}>
            Saved Designs
          </h1>
        </div>

        {loading && (
          <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 80 }}>
            <svg style={{ width: 32, height: 32, color: '#a1a1aa' }} className="animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
          </div>
        )}

        {!loading && invitations.length === 0 && (
          <div style={{
            textAlign: 'center', padding: '80px 0',
            border: '1px dashed rgba(255,255,255,0.1)', borderRadius: 20,
          }}>
            <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.35)', marginBottom: 20 }}>No saved designs yet.</p>
            <Link href="/studio" className="silver-btn" style={{ padding: '12px 28px', fontSize: 14 }}>
              Create your first invitation
            </Link>
          </div>
        )}

        {!loading && invitations.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 20 }}>
            {invitations.map(inv => (
              <div key={inv.id} style={{
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 16,
                background: 'rgba(255,255,255,0.03)',
                overflow: 'hidden',
                display: 'flex', flexDirection: 'column',
              }}>
                {/* Mini card preview */}
                {inv.settings.isTemplate ? (
                  /* Template design — show the background image thumbnail */
                  <div style={{
                    height: 160, position: 'relative', overflow: 'hidden',
                    background: '#1a1a1f',
                  }}>
                    <img
                      src={inv.settings.bg}
                      alt={inv.name}
                      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                    />
                    <div style={{
                      position: 'absolute', inset: 0,
                      background: 'linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 60%)',
                      display: 'flex', alignItems: 'flex-end', padding: '10px 12px',
                    }}>
                      <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                        Template
                      </span>
                    </div>
                  </div>
                ) : (
                  /* Studio design — show styled text preview */
                  <div style={{
                    height: 160, background: inv.settings.bg
                      ? `url(${inv.settings.bg}) center/cover`
                      : 'linear-gradient(135deg, #1e1035, #0d0d0d)',
                    position: 'relative',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    gap: 4,
                  }}>
                    <div style={{ position: 'absolute', inset: 0, background: `rgba(0,0,0,${inv.settings.overlayOpacity ?? 0.3})` }} />
                    <span style={{ position: 'relative', fontFamily: inv.settings.titleFont ?? 'serif', fontSize: 18, fontWeight: 700, color: inv.settings.titleColor ?? '#fff', textAlign: 'center', padding: '0 16px' }}>
                      {inv.event_title || 'Untitled Event'}
                    </span>
                    <span style={{ position: 'relative', fontSize: 11, color: inv.settings.nameColor ?? 'rgba(255,255,255,0.6)', fontFamily: inv.settings.nameFont ?? 'sans-serif' }}>
                      {inv.host_name || ''}
                    </span>
                  </div>
                )}

                {/* Info */}
                <div style={{ padding: '16px 18px', flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <p style={{ fontSize: 15, fontWeight: 600, color: '#fff', margin: 0 }}>{inv.name}</p>
                  {inv.date_time && <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', margin: 0 }}>{inv.date_time}</p>}
                  <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', margin: '4px 0 0' }}>
                    {new Date(inv.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </p>
                </div>

                {/* Actions */}
                <div style={{ padding: '0 18px 18px', display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => handleLoad(inv)}
                    className="silver-btn"
                    style={{ flex: 1, padding: '8px 0', fontSize: 13 }}
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(inv.id)}
                    disabled={deletingId === inv.id}
                    style={{
                      padding: '8px 14px', borderRadius: 8, fontWeight: 600, fontSize: 13,
                      background: 'transparent', color: 'rgba(255,255,255,0.4)',
                      border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer',
                      opacity: deletingId === inv.id ? 0.5 : 1,
                    }}
                  >
                    {deletingId === inv.id ? '…' : 'Delete'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
