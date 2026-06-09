'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../components/AuthProvider';

const ADMIN_EMAIL = 'bycheshin@gmail.com';

type BannerSize = 'small' | 'large';

type BannerConfig = {
  enabled:     boolean;
  text:        string;
  link:        string;
  linkLabel:   string;
  size:        BannerSize;
  bgColor:     string;
  bgOpacity:   number;
  textColor:   string;
  textOpacity: number;
  accentColor: string;
  blur:        boolean;
};

const DEFAULT: BannerConfig = {
  enabled: false, text: '', link: '', linkLabel: 'Learn more →', size: 'small',
  bgColor: '#0f172a', bgOpacity: 1, textColor: '#ffffff', textOpacity: 1,
  accentColor: '#fbbf24', blur: false,
};

const PRESETS = [
  { label: 'Dark',   bgColor: '#0f172a', bgOpacity: 1,    textColor: '#ffffff', textOpacity: 1, accentColor: '#fbbf24', blur: false },
  { label: 'Light',  bgColor: '#f1f5f9', bgOpacity: 1,    textColor: '#0f172a', textOpacity: 1, accentColor: '#6366f1', blur: false },
  { label: 'Purple', bgColor: '#7c3aed', bgOpacity: 1,    textColor: '#ffffff', textOpacity: 1, accentColor: '#fde68a', blur: false },
  { label: 'Glass',  bgColor: '#ffffff', bgOpacity: 0.12, textColor: '#ffffff', textOpacity: 1, accentColor: '#fbbf24', blur: true  },
];

function hexToRgba(hex: string, opacity: number) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${opacity})`;
}

function BannerPreview({ cfg }: { cfg: BannerConfig }) {
  const isLarge = cfg.size === 'large';
  const bg = hexToRgba(cfg.bgColor, cfg.bgOpacity);
  const tc = hexToRgba(cfg.textColor, cfg.textOpacity);
  return (
    <div style={{ borderRadius: 10, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)', background: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'16\' height=\'16\'%3E%3Crect width=\'8\' height=\'8\' fill=\'%23ccc\'/%3E%3Crect x=\'8\' y=\'8\' width=\'8\' height=\'8\' fill=\'%23ccc\'/%3E%3Crect x=\'8\' y=\'0\' width=\'8\' height=\'8\' fill=\'%23fff\'/%3E%3Crect x=\'0\' y=\'8\' width=\'8\' height=\'8\' fill=\'%23fff\'/%3E%3C/svg%3E")' }}>
      <div style={{
        background: bg,
        backdropFilter: cfg.blur ? 'blur(12px)' : undefined,
        WebkitBackdropFilter: cfg.blur ? 'blur(12px)' : undefined,
        color: tc,
        padding: isLarge ? '18px 56px' : '10px 48px',
        textAlign: 'center', fontSize: isLarge ? 15 : 13, fontWeight: 500, position: 'relative',
      }}>
        {cfg.text || <span style={{ opacity: 0.5 }}>Your message will appear here…</span>}
        {cfg.link && cfg.text && (
          <span style={{ color: cfg.accentColor, marginLeft: 10, fontWeight: 600 }}>
            {cfg.linkLabel || 'Learn more →'}
          </span>
        )}
        <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', opacity: 0.5, fontSize: 18 }}>×</span>
      </div>
    </div>
  );
}

function ColorRow({ label, color, opacity, onColor, onOpacity }: {
  label: string; color: string; opacity: number;
  onColor: (v: string) => void; onOpacity: (v: number) => void;
}) {
  return (
    <div style={{ marginBottom: 20 }}>
      <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: 'rgba(255,255,255,0.35)', display: 'block', marginBottom: 10 }}>
        {label}
      </span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        {/* Color swatch + picker */}
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <div style={{ width: 44, height: 44, borderRadius: 10, background: hexToRgba(color, opacity), border: '2px solid rgba(255,255,255,0.15)', cursor: 'pointer', overflow: 'hidden' }}>
            <input
              type="color"
              value={color}
              onChange={e => onColor(e.target.value)}
              style={{ opacity: 0, position: 'absolute', inset: 0, width: '100%', height: '100%', cursor: 'pointer', border: 'none', padding: 0 }}
            />
          </div>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>Opacity</span>
            <span style={{ fontSize: 12, color: '#fff', fontWeight: 600 }}>{Math.round(opacity * 100)}%</span>
          </div>
          <div style={{ position: 'relative', height: 6, borderRadius: 3, background: `linear-gradient(to right, transparent, ${color})` }}>
            <input
              type="range" min={0} max={100} value={Math.round(opacity * 100)}
              onChange={e => onOpacity(Number(e.target.value) / 100)}
              style={{ position: 'absolute', inset: 0, width: '100%', opacity: 0, cursor: 'pointer', height: '100%', margin: 0 }}
            />
            <div style={{ position: 'absolute', top: '50%', transform: 'translate(-50%, -50%)', left: `${Math.round(opacity * 100)}%`, width: 14, height: 14, borderRadius: '50%', background: '#fff', boxShadow: '0 0 0 2px rgba(0,0,0,0.3)', pointerEvents: 'none' }} />
          </div>
        </div>
        <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', fontFamily: 'monospace', flexShrink: 0 }}>{color}</span>
      </div>
    </div>
  );
}

export default function AdminToolsPage() {
  const { user, loading, accessToken } = useAuth();
  const router = useRouter();

  const [cfg, setCfg]             = useState<BannerConfig>(DEFAULT);
  const [fetched, setFetched]     = useState(false);
  const [saving, setSaving]       = useState(false);
  const [saved, setSaved]         = useState(false);
  const [saveError, setSaveError] = useState('');
  const [syncing, setSyncing]     = useState(false);
  const [syncMsg, setSyncMsg]     = useState('');

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

  const applyPreset = (p: typeof PRESETS[0]) =>
    setCfg(prev => ({ ...prev, bgColor: p.bgColor, bgOpacity: p.bgOpacity, textColor: p.textColor, textOpacity: p.textOpacity, accentColor: p.accentColor, blur: p.blur }));

  const save = async () => {
    if (!accessToken) return;
    setSaving(true); setSaved(false); setSaveError('');
    try {
      const res = await fetch('/api/admin/banner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify(cfg),
      });
      if (!res.ok) { const d = await res.json(); setSaveError(d.error ?? 'Save failed'); }
      else { setSaved(true); setTimeout(() => setSaved(false), 3000); }
    } catch (e) { setSaveError(String(e)); }
    finally { setSaving(false); }
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
    padding: '7px 16px', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer',
    border: '1px solid', background: active ? 'rgba(255,255,255,0.12)' : 'transparent',
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
        <h1 style={{ fontFamily: 'var(--font-playfair)', fontSize: 28, fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 4 }}>Site Tools</h1>
        <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.35)', marginBottom: 40 }}>Control live site features without touching code.</p>

        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 20, color: 'rgba(255,255,255,0.7)' }}>Announcement Banner</h2>

        {/* Toggle */}
        <div style={{ ...card, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <p style={{ margin: 0, fontWeight: 600, fontSize: 15 }}>Show banner</p>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>{cfg.enabled ? 'Banner is live on the site' : 'Banner is hidden'}</p>
          </div>
          <button onClick={() => set('enabled', !cfg.enabled)}
            style={{ width: 52, height: 28, borderRadius: 14, border: 'none', cursor: 'pointer', background: cfg.enabled ? '#22c55e' : 'rgba(255,255,255,0.1)', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
            <span style={{ position: 'absolute', top: 3, left: cfg.enabled ? 27 : 3, width: 22, height: 22, borderRadius: '50%', background: '#fff', transition: 'left 0.2s', display: 'block' }} />
          </button>
        </div>

        {/* Message */}
        <div style={card}>
          <span style={sectionLabel}>Message text</span>
          <textarea rows={2} placeholder="e.g. New Wedding templates just added! 🎉" value={cfg.text}
            onChange={e => set('text', e.target.value)}
            style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }} />
        </div>

        {/* Colors */}
        <div style={card}>
          <span style={sectionLabel}>Colors</span>

          {/* Quick presets */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 24 }}>
            {PRESETS.map(p => (
              <button key={p.label} onClick={() => applyPreset(p)}
                style={{ ...chip(false), display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ display: 'inline-block', width: 12, height: 12, borderRadius: 3, background: hexToRgba(p.bgColor, p.bgOpacity), border: '1px solid rgba(255,255,255,0.2)', flexShrink: 0 }} />
                {p.label}
              </button>
            ))}
          </div>

          <ColorRow label="Background" color={cfg.bgColor} opacity={cfg.bgOpacity}
            onColor={v => set('bgColor', v)} onOpacity={v => set('bgOpacity', v)} />
          <ColorRow label="Text" color={cfg.textColor} opacity={cfg.textOpacity}
            onColor={v => set('textColor', v)} onOpacity={v => set('textOpacity', v)} />
          <ColorRow label="Link / Accent" color={cfg.accentColor} opacity={1}
            onColor={v => set('accentColor', v)} onOpacity={() => {}} />

          {/* Blur toggle */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
            <div>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 500 }}>Blur background</p>
              <p style={{ margin: '2px 0 0', fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>Frosted glass effect — works best with low opacity</p>
            </div>
            <button onClick={() => set('blur', !cfg.blur)}
              style={{ width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer', background: cfg.blur ? '#22c55e' : 'rgba(255,255,255,0.1)', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
              <span style={{ position: 'absolute', top: 2, left: cfg.blur ? 22 : 2, width: 20, height: 20, borderRadius: '50%', background: '#fff', transition: 'left 0.2s', display: 'block' }} />
            </button>
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
          <input style={{ ...inputStyle, marginBottom: 12 }} placeholder="https://shareyoursimcha.com/templates"
            value={cfg.link} onChange={e => set('link', e.target.value)} />
          <span style={{ ...sectionLabel, marginTop: 4 }}>Link label</span>
          <input style={inputStyle} placeholder="Browse now →"
            value={cfg.linkLabel} onChange={e => set('linkLabel', e.target.value)} />
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
        <button onClick={save} disabled={saving || !fetched}
          style={{ width: '100%', padding: '14px', borderRadius: 10, fontSize: 15, fontWeight: 600, background: saved ? '#22c55e' : '#fff', color: saved ? '#fff' : '#0f172a', border: 'none', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1, transition: 'all 0.2s' }}>
          {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save & Publish'}
        </button>
        {saveError && <p style={{ marginTop: 12, fontSize: 13, color: '#f87171', textAlign: 'center' }}>Error: {saveError}</p>}

        {/* Sync to R2 */}
        <div style={{ marginTop: 32, paddingTop: 24, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginBottom: 12 }}>
            Upload all template SVGs &amp; PNGs from this deployment to R2. Use when new templates show a 404 on the live site.
          </p>
          <button
            onClick={async () => {
              setSyncing(true); setSyncMsg('');
              try {
                const res  = await fetch('/api/admin/sync-r2', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` }, body: JSON.stringify({}) });
                const data = await res.json();
                setSyncMsg(data.ok ? `✓ Synced ${data.count} files` : `✗ ${data.error}`);
              } catch (e) { setSyncMsg(`✗ ${e}`); }
              setSyncing(false);
            }}
            disabled={syncing}
            style={{ width: '100%', padding: '14px', borderRadius: 10, fontSize: 15, fontWeight: 600, background: 'rgba(99,200,255,0.15)', color: '#63c8ff', border: '1px solid rgba(99,200,255,0.3)', cursor: syncing ? 'not-allowed' : 'pointer', opacity: syncing ? 0.7 : 1 }}>
            {syncing ? 'Syncing…' : '↑ Sync all templates to R2'}
          </button>
          {syncMsg && <p style={{ marginTop: 10, fontSize: 13, color: syncMsg.startsWith('✓') ? '#4ade80' : '#f87171', textAlign: 'center' }}>{syncMsg}</p>}
        </div>
      </main>
    </div>
  );
}
