'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import InvitationCard from '../components/InvitationCard';
import { useAuth } from '../components/AuthProvider';

type InvitiaState = {
  data: { eventTitle: string; hostName: string; dateTime: string };
  bg: string;
  overlayOpacity: number;
  glowIntensity: number;
  vignetteIntensity?: number;
  canvasWidth?: number;
  canvasHeight?: number;
  titleSize: number; nameSize: number; dateSize: number;
  titleX: number; titleY: number;
  nameX: number; nameY: number;
  dateX: number; dateY: number;
  titleColor: string; nameColor: string; dateColor: string;
  titleFont: string; nameFont: string; dateFont: string;
};

export default function ExportPage() {
  const router = useRouter();
  const { accessToken } = useAuth();
  const cardRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<InvitiaState | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloaded, setDownloaded] = useState(false);

  // Save to DB modal
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    const raw = localStorage.getItem('invitia-state');
    if (!raw) { router.replace('/studio'); return; }
    const parsed = JSON.parse(raw);
    setState(parsed);
    // Pre-fill save name from event title
    if (parsed.data?.eventTitle) setSaveName(parsed.data.eventTitle);
  }, [router]);

  const handleDownload = async () => {
    if (!state) return;
    setIsDownloading(true);
    try {
      const scale = 3;
      const W = canvasWidth * scale;
      const H = canvasHeight * scale;

      const canvas = document.createElement('canvas');
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext('2d')!;

      // Rounded clip (matches the 16px card border-radius)
      const r = 16 * scale;
      ctx.beginPath();
      ctx.moveTo(r, 0);
      ctx.lineTo(W - r, 0);
      ctx.quadraticCurveTo(W, 0, W, r);
      ctx.lineTo(W, H - r);
      ctx.quadraticCurveTo(W, H, W - r, H);
      ctx.lineTo(r, H);
      ctx.quadraticCurveTo(0, H, 0, H - r);
      ctx.lineTo(0, r);
      ctx.quadraticCurveTo(0, 0, r, 0);
      ctx.closePath();
      ctx.clip();

      // 1. Background image with cover cropping
      if (bg) {
        // If bg is a remote URL (not base64), proxy it server-side to avoid canvas taint
        let imgSrc = bg;
        if (!bg.startsWith('data:')) {
          const proxyRes = await fetch(`/api/proxy-image?url=${encodeURIComponent(bg)}`);
          const proxyJson = await proxyRes.json();
          imgSrc = proxyJson.url ?? bg;
        }
        const img = new Image();
        await new Promise<void>((res) => { img.onload = () => res(); img.onerror = () => res(); img.src = imgSrc; });
        const imgScale = Math.max(W / img.naturalWidth, H / img.naturalHeight);
        const iw = img.naturalWidth * imgScale;
        const ih = img.naturalHeight * imgScale;
        ctx.drawImage(img, (W - iw) / 2, (H - ih) / 2, iw, ih);
      } else {
        ctx.fillStyle = '#bf4f9d';
        ctx.fillRect(0, 0, W, H);
      }

      // 2. Darkness overlay
      ctx.fillStyle = `rgba(0,0,0,${overlayOpacity})`;
      ctx.fillRect(0, 0, W, H);

      // 3. Vignette
      if (vignetteIntensity > 0) {
        const grad = ctx.createRadialGradient(W / 2, H / 2, H * 0.15, W / 2, H / 2, Math.max(W, H) / 2);
        grad.addColorStop(0, 'rgba(0,0,0,0)');
        grad.addColorStop(1, `rgba(0,0,0,${vignetteIntensity})`);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, W, H);
      }

      // 4. Text with glow (mirrors SVG layer)
      const drawText = (
        text: string, x: number, y: number,
        size: number, font: string, color: string, bold: boolean,
      ) => {
        ctx.save();
        ctx.font = `${bold ? 'bold ' : ''}${size * scale}px ${font}`;
        ctx.textAlign = 'center';
        ctx.fillStyle = color;
        // Two glow passes
        ctx.shadowColor = color;
        ctx.shadowBlur = glowIntensity * scale * 2;
        ctx.fillText(text || '', x * scale, y * scale);
        ctx.shadowBlur = glowIntensity * scale;
        ctx.fillText(text || '', x * scale, y * scale);
        ctx.shadowBlur = 0;
        ctx.fillText(text || '', x * scale, y * scale);
        ctx.restore();
      };

      drawText(data.eventTitle || 'Event Title', titleX, titleY, titleSize, titleFont, titleColor, true);
      drawText(data.hostName  || 'Host Name',   nameX,  nameY,  nameSize,  nameFont,  nameColor,  false);
      drawText(data.dateTime  || 'Date & Time', dateX,  dateY,  dateSize,  dateFont,  dateColor,  false);

      const link = document.createElement('a');
      link.download = 'invitation.png';
      link.href = canvas.toDataURL('image/png');
      link.click();
      setDownloaded(true);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleSave = async () => {
    if (!state || !saveName.trim()) { setSaveError('Please enter a name.'); return; }
    setIsSaving(true);
    setSaveError('');
    try {
      const { data, ...settings } = state;
      const res = await fetch('/api/invitations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({
          name: saveName.trim(),
          event_title: data.eventTitle,
          host_name: data.hostName,
          date_time: data.dateTime,
          settings,
        }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setSaveSuccess(true);
      setTimeout(() => { setShowSaveModal(false); setSaveSuccess(false); }, 1500);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setIsSaving(false);
    }
  };

  if (!state) return null;

  const { data, bg, overlayOpacity, glowIntensity, vignetteIntensity = 0,
    canvasWidth = 450, canvasHeight = 800,
    titleSize, nameSize, dateSize,
    titleX, titleY, nameX, nameY, dateX, dateY,
    titleColor, nameColor, dateColor,
    titleFont, nameFont, dateFont } = state;

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
            <Link href="/saved" style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', textDecoration: 'none' }}>Saved Designs</Link>
            <Link href="/studio" style={{ fontSize: 14, color: 'rgba(255,255,255,0.55)', textDecoration: 'none' }}>← Back to Studio</Link>
          </div>
        </div>
      </header>

      {/* Main */}
      <div style={{ maxWidth: 1000, margin: '0 auto', padding: '64px 24px 80px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 48 }}>

        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: 12, fontWeight: 500, letterSpacing: '0.12em', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', marginBottom: 12 }}>
            Export
          </p>
          <h1 style={{ fontFamily: 'var(--font-playfair)', fontSize: 'clamp(28px, 4vw, 42px)', fontWeight: 700, letterSpacing: '-0.02em', margin: 0 }}>
            Your invitation is ready
          </h1>
          <p style={{ marginTop: 12, fontSize: 15, color: 'rgba(255,255,255,0.45)' }}>
            Review your design, save it to your library, or download a high-resolution PNG.
          </p>
        </div>

        {/* Card preview */}
        <div style={{
          padding: 40, borderRadius: 28,
          background: 'radial-gradient(ellipse at 50% 0%, rgba(161,161,170,0.12) 0%, rgba(9,9,11,0) 70%)',
          border: '1px solid rgba(255,255,255,0.07)',
          display: 'flex', justifyContent: 'center',
        }}>
          <div ref={cardRef} style={{ boxShadow: '0 40px 80px rgba(0,0,0,0.7)', borderRadius: 16 }}>
            <InvitationCard
              {...data}
              backgroundImage={bg}
              overlayOpacity={overlayOpacity}
              glowIntensity={glowIntensity}
              vignetteIntensity={vignetteIntensity}
              canvasWidth={canvasWidth}
              canvasHeight={canvasHeight}
              titleSize={titleSize} nameSize={nameSize} dateSize={dateSize}
              titleX={titleX} titleY={titleY}
              nameX={nameX} nameY={nameY}
              dateX={dateX} dateY={dateY}
              titleColor={titleColor} nameColor={nameColor} dateColor={dateColor}
              titleFont={titleFont} nameFont={nameFont} dateFont={dateFont}
            />
          </div>
        </div>

        {/* Details row */}
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', justifyContent: 'center' }}>
          {[
            { label: 'Dimensions', value: `${canvasWidth} × ${canvasHeight} px` },
            { label: 'Export scale', value: `3× (${canvasWidth * 3} × ${canvasHeight * 3} px)` },
            { label: 'Format', value: 'PNG (transparent bg)' },
          ].map(({ label, value }) => (
            <div key={label} style={{
              padding: '12px 20px', borderRadius: 10,
              border: '1px solid rgba(255,255,255,0.07)',
              background: 'rgba(255,255,255,0.03)',
              textAlign: 'center', minWidth: 160,
            }}>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>{label}</div>
              <div style={{ fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,0.8)' }}>{value}</div>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
          <button
            onClick={handleDownload}
            disabled={isDownloading}
            className="silver-btn"
            style={{ padding: '14px 40px', fontSize: 15 }}
          >
            {isDownloading ? (
              <>
                <svg className="animate-spin" style={{ width: 16, height: 16 }} viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Exporting…
              </>
            ) : downloaded ? '✓ Downloaded' : '⬇ Download PNG'}
          </button>

          <button
            onClick={() => { setShowSaveModal(true); setSaveError(''); setSaveSuccess(false); }}
            className="silver-btn"
            style={{ padding: '14px 28px', fontSize: 15 }}
          >
            Save to Library
          </button>

          <Link href="/studio" className="silver-btn" style={{ padding: '14px 28px', fontSize: 15 }}>
            Edit again
          </Link>
        </div>

      </div>

      {/* Save Modal */}
      {showSaveModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 100,
          background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }} onClick={() => setShowSaveModal(false)}>
          <div style={{
            background: '#18181b', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 16, padding: 32, width: 380, maxWidth: '90vw',
          }} onClick={e => e.stopPropagation()}>
            <h2 style={{ fontFamily: 'var(--font-playfair)', fontSize: 22, fontWeight: 700, marginBottom: 6, color: '#fff' }}>
              Save to Library
            </h2>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', marginBottom: 24 }}>
              Give this invitation a name so you can find it later.
            </p>
            <input
              autoFocus
              placeholder="e.g. Sarah's Wedding, Summer Gala…"
              value={saveName}
              onChange={e => setSaveName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSave()}
              style={{
                width: '100%', background: '#09090b', border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: 8, padding: '10px 14px', color: '#fff', fontSize: 14,
                outline: 'none', boxSizing: 'border-box', marginBottom: 8,
              }}
            />
            {saveError && <p style={{ fontSize: 12, color: '#f87171', marginBottom: 8 }}>{saveError}</p>}
            <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
              <button
                onClick={handleSave}
                disabled={isSaving || saveSuccess}
                className="silver-btn"
                style={{
                  flex: 1, padding: '10px 0', fontSize: 14,
                  background: saveSuccess ? '#22c55e' : undefined,
                  color: saveSuccess ? '#fff' : undefined,
                }}
              >
                {saveSuccess ? '✓ Saved!' : isSaving ? 'Saving…' : 'Save'}
              </button>
              <button
                onClick={() => setShowSaveModal(false)}
                style={{
                  padding: '10px 20px', borderRadius: 8, fontWeight: 600, fontSize: 14,
                  background: 'transparent', color: 'rgba(255,255,255,0.5)',
                  border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer',
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
