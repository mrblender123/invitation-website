'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../components/AuthProvider';

const ADMIN_EMAIL = 'bycheshin@gmail.com';

type BannerStyle = 'dark' | 'light' | 'accent' | 'glass';
type BannerSize  = 'small' | 'large';

type BannerConfig = {
  enabled:   boolean;
  text:      string;
  link:      string;
  linkLabel: string;
  size:      BannerSize;
  style:     BannerStyle;
};

const DEFAULT: BannerConfig = {
  enabled: false, text: '', link: '', linkLabel: 'Learn more →', size: 'small', style: 'dark',
};

const STYLE_PRESETS: Record<BannerStyle, { bg: string; color: string; accent: string; label: string; blur?: boolean }> = {
  dark:   { bg: '#0f172a',               color: '#fff',    accent: '#fbbf24', label: 'Dark'        },
  light:  { bg: '#f1f5f9',               color: '#0f172a', accent: '#6366f1', label: 'Light'       },
  accent: { bg: '#7c3aed',               color: '#fff',    accent: '#fde68a', label: 'Purple'      },
  glass:  { bg: 'rgba(255,255,255,0.12)', color: '#fff',   accent: '#fbbf24', label: 'Glass', blur: true },
};

function BannerPreview({ cfg }: { cfg: BannerConfig }) {
  const preset = STYLE_PRESETS[cfg.style];
  const isLarge = cfg.size === 'large';
  return (
    <div style={{ borderRadius: 10, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)' }}>
      <div style={{
        background: preset.bg, color: preset.color,
        backdropFilter: preset.blur ? 'blur(12px)' : undefined,
        WebkitBackdropFilter: preset.blur ? 'blur(12px)' : undefined,
        padding: isLarge ? '18px 56px' : '10px 48px',
        textAlign: 'center', fontSize: isLarge ? 15 : 13, fontWeight: 500, position: 'relative',
      }}>
        {cfg.text || <span style={{ opacity: 0.4 }}>Your message will appear here…</span>}
        {cfg.link && cfg.text && (
          <span style={{ color: preset.accent, marginLeft: 10, fontWeight: 600 }}>
            {cfg.linkLabel || 'Learn more →'}
          </span>
        )}
        <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', opacity: 0.4, fontSize: 18 }}>×</span>
      </div>
    </div>
  );
}

export default function AdminToolsPage() {
  const { user, loading, accessToken } = useAuth();
  const router = useRouter();

  const [cfg, setCfg]           = useState<BannerConfig>(DEFAULT);
  const [fetched, setFetched]   = useState(false);
  const [saving, setSaving]     = useState(false);
  const [saved, setSaved]       = useState(false);
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    if (loading) return;
    if (!user) { router.replace('/login'); return; }
    if (user.email !== ADMIN_EMAIL) router.replace('/');
  }, [user, loading, router]);

  useEffect(() => {
    fetch('/api/admin/banner')
      .then(r => r.json())
      .then(data => { setCfg({ ...DEFAULT, ...data }); setFetched(true); })
      .catch(() => setFetched(true));
  }, []);

  const set = <K extends keyof BannerConfig>(key: K, val: BannerConfig[K]) =>
    setCfg(prev => ({ ...prev, [key]: val }));

  const save = async () => {
    if (!accessToken) return;
    setSaving(true); setSaved(false); setSaveError('');
    try {
      const res = await fetch('/api/admin/banner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify(cfg),
      });
      if (!res.ok) {
        const d = await res.json();
        setSaveError(d.error ?? 'Save failed');
      } else {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    } catch (e) {
      setSaveError(String(e));
    } finally {
      setSaving(false);
    }
  };

  if (loading || !user || user.email !== ADMIN_EMAIL) return null;

  const card: React.CSSProperties = {
    background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 16, padding: '28px 32px', marginBottom: 20,
  };
  const sectionLabel: React.CSSProperties = {
    fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.35)', display: 'block', marginBottom: 10,
  };
  const inputStyle: React.CSSProperties = {
    width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 8, color: '#fff', fontSize: 14, padding: '10px 14px', outline: 'none',
    boxSizing: 'border-box', fontFamily: 'inherit',
  };
  const chip = (active: boolean): React.CSSProperties => ({
    padding: '8px 18px', borderRadius: 8, fontSize: 13, fontWeight: 500,
    cursor: 'pointer', border: '1px solid',
    background: active ? 'rgba(255,255,255,0.12)' : 'transparent',
    borderColor: active ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.08)',
    color: active ? '#fff' : 'rgba(255,255,255,0.4)', transition: 'all 0.15s',
  });

  return (
    <div style={{ minHeight: '100vh', background: '#09090b', color: '#fff', fontFamily: 'var(--font-inter), system-ui, sans-serif' }}>

      <header style={{ position: 'sticky', top: 0, zIndex: 50, background: 'rgba(9,9,11,0.85)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ maxWidth: 860, margin: '0 auto', padding: '0 24px', height: 60, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <a href="/admin" style={{ color: 'rgba(255,255,255,0.4)', textDecoration: 'none', fontSize: 14 }}>Admin</a>
            <span style={{ color: 'rgba(255,255,255,0.2)' }}>/</span>
            <span style={{ fontSize: 14, fontWeight: 600 }}>Tools</span>
          </div>
          <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>{user.email}</span>
        </div>
      </header>

      <main style={{ maxWidth: 860, margin: '0 auto', padding: '48px 24px 80px' }}>
        <h1 style={{ fontFamily: 'var(--font-playfair)', fontSize: 28, fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 4 }}>
          Site Tools
        </h1>
        <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.35)', marginBottom: 40 }}>
          Control live site features without touching code.
        </p>

        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 20, color: 'rgba(255,255,255,0.7)' }}>
          Announcement Banner
        </h2>

        {/* Toggle */}
        <div style={{ ...card, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <p style={{ margin: 0, fontWeight: 600, fontSize: 15 }}>Show banner</p>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>
              {cfg.enabled ? 'Banner is live on the site' : 'Banner is hidden'}
            </p>
          </div>
          <button
            onClick={() => set('enabled', !cfg.enabled)}
            style={{ width: 52, height: 28, borderRadius: 14, border: 'none', cursor: 'pointer', background: cfg.enabled ? '#22c55e' : 'rgba(255,255,255,0.1)', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}
          >
            <span style={{ position: 'absolute', top: 3, left: cfg.enabled ? 27 : 3, width: 22, height: 22, borderRadius: '50%', background: '#fff', transition: 'left 0.2s', display: 'block' }} />
          </button>
        </div>

        {/* Message */}
        <div style={card}>
          <span style={sectionLabel}>Message text</span>
          <textarea
            rows={2}
            placeholder="e.g. New Wedding templates just added! 🎉"
            value={cfg.text}
            onChange={e => set('text', e.target.value)}
            style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }}
          />
        </div>

        {/* Style */}
        <div style={card}>
          <span style={sectionLabel}>Style</span>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {(Object.keys(STYLE_PRESETS) as BannerStyle[]).map(s => (
              <button key={s} style={chip(cfg.style === s)} onClick={() => set('style', s)}>
                <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: STYLE_PRESETS[s].bg, border: '1px solid rgba(255,255,255,0.2)', marginRight: 6, verticalAlign: 'middle' }} />
                {STYLE_PRESETS[s].label}
              </button>
            ))}
          </div>
        </div>

        {/* Size */}
        <div style={card}>
          <span style={sectionLabel}>Size</span>
          <div style={{ display: 'flex', gap: 8 }}>
            {(['small', 'large'] as BannerSize[]).map(s => (
              <button key={s} style={chip(cfg.size === s)} onClick={() => set('size', s)}>
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Link */}
        <div style={card}>
          <span style={sectionLabel}>Link (optional)</span>
          <input
            style={{ ...inputStyle, marginBottom: 12 }}
            placeholder="https://joy-send.com/templates"
            value={cfg.link}
            onChange={e => set('link', e.target.value)}
          />
          <span style={{ ...sectionLabel, marginTop: 4 }}>Link label</span>
          <input
            style={inputStyle}
            placeholder="Browse now →"
            value={cfg.linkLabel}
            onChange={e => set('linkLabel', e.target.value)}
          />
        </div>

        {/* Live preview */}
        <div style={{ marginBottom: 24 }}>
          <span style={sectionLabel}>Preview</span>
          <BannerPreview cfg={cfg} />
          {!cfg.enabled && (
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.25)', marginTop: 8, textAlign: 'center' }}>
              Toggle &ldquo;Show banner&rdquo; on to make this visible to visitors
            </p>
          )}
        </div>

        {/* Save */}
        <button
          onClick={save}
          disabled={saving || !fetched}
          style={{
            width: '100%', padding: '14px', borderRadius: 10, fontSize: 15, fontWeight: 600,
            background: saved ? '#22c55e' : '#fff', color: saved ? '#fff' : '#0f172a',
            border: 'none', cursor: saving ? 'not-allowed' : 'pointer',
            opacity: saving ? 0.7 : 1, transition: 'all 0.2s',
          }}
        >
          {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save & Publish'}
        </button>
        {saveError && (
          <p style={{ marginTop: 12, fontSize: 13, color: '#f87171', textAlign: 'center' }}>
            Error: {saveError}
          </p>
        )}
      </main>
    </div>
  );
}
