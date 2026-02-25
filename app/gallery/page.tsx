'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { Invitation } from '@/lib/supabase';
import InvitationCard from '../components/InvitationCard';
import { useAuth } from '../components/AuthProvider';
import UserMenu from '../components/UserMenu';

const CARD_W = 450;
const CARD_H = 800;
const SCALE = 0.48;
const THUMB_W = CARD_W * SCALE;
const THUMB_H = CARD_H * SCALE;

function CardThumbnail({ inv, onEdit, onExport }: { inv: Invitation; onEdit: () => void; onExport: () => void }) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'relative',
        width: THUMB_W,
        height: THUMB_H,
        borderRadius: 12,
        overflow: 'hidden',
        cursor: 'pointer',
        flexShrink: 0,
        boxShadow: hovered
          ? '0 24px 60px rgba(0,0,0,0.7), 0 0 0 1px rgba(161,161,170,0.4)'
          : '0 8px 32px rgba(0,0,0,0.5)',
        transition: 'box-shadow 0.25s, transform 0.25s',
        transform: hovered ? 'translateY(-4px)' : 'none',
      }}
    >
      {/* Scaled card */}
      <div style={{
        width: CARD_W,
        height: CARD_H,
        transform: `scale(${SCALE})`,
        transformOrigin: 'top left',
        pointerEvents: 'none',
      }}>
        <InvitationCard
          eventTitle={inv.event_title}
          hostName={inv.host_name}
          dateTime={inv.date_time}
          backgroundImage={inv.settings.bg}
          overlayOpacity={inv.settings.overlayOpacity}
          glowIntensity={inv.settings.glowIntensity}
          titleSize={inv.settings.titleSize}
          nameSize={inv.settings.nameSize}
          dateSize={inv.settings.dateSize}
          titleX={inv.settings.titleX}
          titleY={inv.settings.titleY}
          nameX={inv.settings.nameX}
          nameY={inv.settings.nameY}
          dateX={inv.settings.dateX}
          dateY={inv.settings.dateY}
          titleColor={inv.settings.titleColor}
          nameColor={inv.settings.nameColor}
          dateColor={inv.settings.dateColor}
          titleFont={inv.settings.titleFont}
          nameFont={inv.settings.nameFont}
          dateFont={inv.settings.dateFont}
        />
      </div>

      {/* Hover overlay */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(to top, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.3) 50%, transparent 100%)',
        display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
        padding: 16, gap: 6,
        opacity: hovered ? 1 : 0,
        transition: 'opacity 0.2s',
      }}>
        <p style={{ fontSize: 14, fontWeight: 700, color: '#fff', margin: 0, lineHeight: 1.2,
          fontFamily: 'var(--font-playfair)' }}>
          {inv.name}
        </p>
        {inv.event_title && (
          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', margin: 0 }}>{inv.event_title}</p>
        )}
        {inv.date_time && (
          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', margin: 0 }}>{inv.date_time}</p>
        )}
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <button onClick={onEdit} className="silver-btn" style={{ flex: 1, padding: '7px 0', fontSize: 12 }}>
            Edit
          </button>
          <button onClick={onExport} className="silver-btn" style={{ flex: 1, padding: '7px 0', fontSize: 12 }}>
            Export
          </button>
        </div>
      </div>
    </div>
  );
}

export default function GalleryPage() {
  const router = useRouter();
  const { user, loading: authLoading, accessToken } = useAuth();
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);

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

  const loadIntoStudio = (inv: Invitation, dest: '/studio' | '/export') => {
    localStorage.setItem('invitia-state', JSON.stringify({
      data: { eventTitle: inv.event_title, hostName: inv.host_name, dateTime: inv.date_time },
      ...inv.settings,
    }));
    router.push(dest === '/studio' ? '/studio?load=1' : '/export');
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
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px', height: 60, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Link href="/" style={{ fontFamily: 'var(--font-playfair)', fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em', color: '#fff', textDecoration: 'none' }}>
            Invitia
          </Link>
          <nav style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
            <Link href="/saved" style={{ fontSize: 14, color: 'rgba(255,255,255,0.45)', textDecoration: 'none' }}>
              List View
            </Link>
            <Link href="/new" className="silver-btn" style={{ padding: '8px 18px', fontSize: 14 }}>
              + New Design
            </Link>
            <UserMenu />
          </nav>
        </div>
      </header>

      {/* Content */}
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '56px 24px 80px' }}>

        {/* Page heading */}
        <div style={{ marginBottom: 48 }}>
          <p style={{ fontSize: 12, fontWeight: 500, letterSpacing: '0.12em', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', marginBottom: 12 }}>
            Gallery
          </p>
          <h1 style={{ fontFamily: 'var(--font-playfair)', fontSize: 'clamp(28px, 4vw, 42px)', fontWeight: 700, letterSpacing: '-0.02em', margin: '0 0 8px' }}>
            Your Invitation Designs
          </h1>
          <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.4)', margin: 0 }}>
            Hover over a card to edit or export it.
          </p>
        </div>

        {/* Loading */}
        {loading && (
          <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 80 }}>
            <svg style={{ width: 32, height: 32, color: '#a1a1aa' }} className="animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
          </div>
        )}

        {/* Empty */}
        {!loading && invitations.length === 0 && (
          <div style={{
            textAlign: 'center', padding: '80px 0',
            border: '1px dashed rgba(255,255,255,0.1)', borderRadius: 20,
          }}>
            <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.35)', marginBottom: 20 }}>
              No saved designs yet — create one in the studio.
            </p>
            <Link href="/studio" className="silver-btn" style={{ padding: '12px 28px', fontSize: 14 }}>
              Open Studio
            </Link>
          </div>
        )}

        {/* Gallery grid */}
        {!loading && invitations.length > 0 && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: `repeat(auto-fill, minmax(${THUMB_W}px, 1fr))`,
            gap: 28,
            justifyItems: 'center',
          }}>
            {invitations.map(inv => (
              <div key={inv.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, width: THUMB_W }}>
                <CardThumbnail
                  inv={inv}
                  onEdit={() => loadIntoStudio(inv, '/studio')}
                  onExport={() => loadIntoStudio(inv, '/export')}
                />
                <div style={{ width: '100%', textAlign: 'center' }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.8)', margin: '0 0 2px' }}>{inv.name}</p>
                  <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', margin: 0 }}>
                    {new Date(inv.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
