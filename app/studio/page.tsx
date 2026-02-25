'use client';
import { useRef, useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import html2canvas from 'html2canvas';
import Sidebar, { type Confinements } from '../components/Sidebar';
import InvitationCard from '../components/InvitationCard';
import { getSizeByKey, defaultPositions } from '@/lib/canvasSizes';
import { useAuth } from '../components/AuthProvider';
import UserMenu from '../components/UserMenu';

const DEFAULT_CONFINEMENTS: Confinements = {
  preset: 'Classic Elegant',
};

function StudioContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading, accessToken } = useAuth();

  // Auth gate
  useEffect(() => {
    if (!authLoading && !user) router.replace('/login');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, authLoading]);

  const sizeKey = searchParams.get('size') ?? 'portrait';
  const canvasSize = getSizeByKey(sizeKey);
  const defPos = defaultPositions(canvasSize.width, canvasSize.height);

  const [data, setData] = useState({ eventTitle: '', hostName: '', dateTime: '' });
  const [confinements, setConfinements] = useState<Confinements>(DEFAULT_CONFINEMENTS);
  const [bg, setBg] = useState('');
  const [overlayOpacity, setOverlayOpacity] = useState(0.3);
  const [glowIntensity, setGlowIntensity] = useState(7);
  const [vignetteIntensity, setVignetteIntensity] = useState(0);
  const [titleSize, setTitleSize] = useState(72);
  const [nameSize, setNameSize] = useState(39);
  const [dateSize, setDateSize] = useState(56);
  const [titleX, setTitleX] = useState(defPos.titleX);
  const [titleY, setTitleY] = useState(defPos.titleY);
  const [nameX, setNameX] = useState(defPos.nameX);
  const [nameY, setNameY] = useState(defPos.nameY);
  const [dateX, setDateX] = useState(defPos.dateX);
  const [dateY, setDateY] = useState(defPos.dateY);
  const [titleColor, setTitleColor] = useState('#ffffff');
  const [nameColor, setNameColor] = useState('#ffffff');
  const [dateColor, setDateColor] = useState('#ffffff');
  const [titleFont, setTitleFont] = useState('"Playfair Display", serif');
  const [nameFont, setNameFont] = useState('Inter, sans-serif');
  const [dateFont, setDateFont] = useState('Inter, sans-serif');
  const [isLoading, setIsLoading] = useState(false);
  const [imgError, setImgError] = useState('');
  const [isDownloading, setIsDownloading] = useState(false);

  // Save modal state
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);

  const cardRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      const padding = 48;
      const s = Math.min(
        (width - padding) / canvasSize.width,
        (height - padding) / canvasSize.height,
      );
      setScale(Math.max(0.05, s));
    });
    obs.observe(el);
    return () => obs.disconnect();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvasSize.width, canvasSize.height]);

  // Load saved design from localStorage when ?load=1
  useEffect(() => {
    if (searchParams.get('load') !== '1') return;
    const raw = localStorage.getItem('invitia-state');
    if (!raw) return;
    const s = JSON.parse(raw);
    if (s.data) setData(s.data);
    if (s.bg !== undefined) setBg(s.bg);
    if (s.overlayOpacity !== undefined) setOverlayOpacity(s.overlayOpacity);
    if (s.glowIntensity !== undefined) setGlowIntensity(s.glowIntensity);
    if (s.vignetteIntensity !== undefined) setVignetteIntensity(s.vignetteIntensity);
    if (s.titleSize !== undefined) setTitleSize(s.titleSize);
    if (s.nameSize !== undefined) setNameSize(s.nameSize);
    if (s.dateSize !== undefined) setDateSize(s.dateSize);
    if (s.titleX !== undefined) setTitleX(s.titleX);
    if (s.titleY !== undefined) setTitleY(s.titleY);
    if (s.nameX !== undefined) setNameX(s.nameX);
    if (s.nameY !== undefined) setNameY(s.nameY);
    if (s.dateX !== undefined) setDateX(s.dateX);
    if (s.dateY !== undefined) setDateY(s.dateY);
    if (s.titleColor) setTitleColor(s.titleColor);
    if (s.nameColor) setNameColor(s.nameColor);
    if (s.dateColor) setDateColor(s.dateColor);
    if (s.titleFont) setTitleFont(s.titleFont);
    if (s.nameFont) setNameFont(s.nameFont);
    if (s.dateFont) setDateFont(s.dateFont);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const settings = {
    bg, overlayOpacity, glowIntensity, vignetteIntensity,
    titleSize, nameSize, dateSize,
    titleX, titleY, nameX, nameY, dateX, dateY,
    titleColor, nameColor, dateColor,
    titleFont, nameFont, dateFont,
  };

  const handleGenerate = async () => {
    setIsLoading(true);
    setImgError('');
    setBg('');
    try {
      const res = await fetch('/api/generate-background', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(confinements),
      });
      const { url, error } = await res.json();
      if (error) throw new Error(error);
      setBg(url);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Generation failed';
      setImgError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!cardRef.current) return;
    setIsDownloading(true);
    try {
      const canvas = await html2canvas(cardRef.current, {
        useCORS: true,
        scale: 2,
        backgroundColor: null,
      });
      const link = document.createElement('a');
      link.download = 'invitation.png';
      link.href = canvas.toDataURL('image/png');
      link.click();
    } finally {
      setIsDownloading(false);
    }
  };

  const handleGoToExport = () => {
    localStorage.setItem('invitia-state', JSON.stringify({ data, ...settings, canvasWidth: canvasSize.width, canvasHeight: canvasSize.height }));
    router.push('/export');
  };

  const handleSave = async () => {
    if (!saveName.trim()) { setSaveError('Please enter a name.'); return; }
    setIsSaving(true);
    setSaveError('');
    try {
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
      setTimeout(() => {
        setShowSaveModal(false);
        setSaveName('');
        setSaveSuccess(false);
      }, 1500);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setIsSaving(false);
    }
  };

  if (authLoading || !user) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#09090b', fontFamily: 'var(--font-inter), system-ui, sans-serif' }}>

      {/* Header */}
      <header style={{
        flexShrink: 0, height: 56,
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        background: 'rgba(9,9,11,0.95)',
        backdropFilter: 'blur(12px)',
        display: 'flex', alignItems: 'center',
        padding: '0 20px', gap: 14, zIndex: 40,
      }}>
        <Link href="/" style={{ fontFamily: 'var(--font-playfair)', fontSize: 18, fontWeight: 700, letterSpacing: '-0.02em', color: '#fff', textDecoration: 'none' }}>
          Invitia
        </Link>
        <div style={{ width: 1, height: 18, background: 'rgba(255,255,255,0.1)' }} />
        <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Studio</span>

        <div style={{ flex: 1 }} />

        <Link href="/gallery" style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', textDecoration: 'none' }}>Gallery</Link>
        <Link href="/saved" style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', textDecoration: 'none' }}>Saved</Link>

        <div style={{ width: 1, height: 18, background: 'rgba(255,255,255,0.1)' }} />

        <button
          onClick={() => { setShowSaveModal(true); setSaveError(''); setSaveSuccess(false); }}
          disabled={isLoading}
          style={{
            padding: '6px 14px', borderRadius: 7, fontWeight: 600, fontSize: 13, cursor: 'pointer',
            background: 'transparent', color: 'rgba(255,255,255,0.65)',
            border: '1px solid rgba(255,255,255,0.15)',
            opacity: isLoading ? 0.4 : 1,
          }}
        >
          Save
        </button>

        <button
          onClick={handleGoToExport}
          disabled={isLoading}
          style={{
            padding: '6px 16px', borderRadius: 7, fontWeight: 600, fontSize: 13, cursor: 'pointer',
            background: 'linear-gradient(135deg, #a1a1aa, #e4e4e7)',
            color: '#fff', border: 'none',
            opacity: isLoading ? 0.4 : 1,
          }}
        >
          Preview & Export →
        </button>

        <div style={{ width: 1, height: 18, background: 'rgba(255,255,255,0.1)' }} />
        <UserMenu />
      </header>

      {/* Main: sidebar + canvas */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <Sidebar
          data={data}
          confinements={confinements}
          canvasWidth={canvasSize.width}
          canvasHeight={canvasSize.height}
          overlayOpacity={overlayOpacity}
          glowIntensity={glowIntensity}
          titleSize={titleSize}
          nameSize={nameSize}
          dateSize={dateSize}
          titleX={titleX}
          titleY={titleY}
          nameX={nameX}
          nameY={nameY}
          dateX={dateX}
          dateY={dateY}
          titleColor={titleColor}
          nameColor={nameColor}
          dateColor={dateColor}
          titleFont={titleFont}
          nameFont={nameFont}
          dateFont={dateFont}
          isLoading={isLoading}
          onUpdate={(f, v) => setData({ ...data, [f]: v })}
          onConfinementUpdate={(f, v) => setConfinements({ ...confinements, [f]: v })}
          onOverlayOpacityChange={setOverlayOpacity}
          onGlowIntensityChange={setGlowIntensity}
          vignetteIntensity={vignetteIntensity}
          onVignetteIntensityChange={setVignetteIntensity}
          onTitleSizeChange={setTitleSize}
          onNameSizeChange={setNameSize}
          onDateSizeChange={setDateSize}
          onTitleXChange={setTitleX}
          onTitleYChange={setTitleY}
          onNameXChange={setNameX}
          onNameYChange={setNameY}
          onDateXChange={setDateX}
          onDateYChange={setDateY}
          onTitleColorChange={setTitleColor}
          onNameColorChange={setNameColor}
          onDateColorChange={setDateColor}
          onTitleFontChange={setTitleFont}
          onNameFontChange={setNameFont}
          onDateFontChange={setDateFont}
          onGenerate={handleGenerate}
        />

        {/* Canvas */}
        <div ref={containerRef} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
          {/* Space-taking wrapper: keeps layout correct after scale */}
          <div style={{ width: canvasSize.width * scale, height: canvasSize.height * scale, position: 'relative', flexShrink: 0 }}>
            {/* Scale transform — NOT on cardRef so html2canvas captures at full res */}
            <div style={{ position: 'absolute', top: 0, left: 0, transform: `scale(${scale})`, transformOrigin: 'top left' }}>
              <div ref={cardRef} style={{ position: 'relative' }}>
                <InvitationCard
                  {...data}
                  canvasWidth={canvasSize.width}
                  canvasHeight={canvasSize.height}
                  backgroundImage={bg}
                  overlayOpacity={overlayOpacity}
                  glowIntensity={glowIntensity}
                  vignetteIntensity={vignetteIntensity}
                  titleSize={titleSize}
                  nameSize={nameSize}
                  dateSize={dateSize}
                  titleX={titleX}
                  titleY={titleY}
                  nameX={nameX}
                  nameY={nameY}
                  dateX={dateX}
                  dateY={dateY}
                  titleColor={titleColor}
                  nameColor={nameColor}
                  dateColor={dateColor}
                  titleFont={titleFont}
                  nameFont={nameFont}
                  dateFont={dateFont}
                />
                {isLoading && (
                  <div style={{
                    position: 'absolute', inset: 0, zIndex: 10, borderRadius: '16px',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    background: 'rgba(0,0,0,0.65)',
                  }}>
                    <svg style={{ width: 36, height: 36, color: '#a1a1aa' }} className="animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    <p style={{ color: 'white', marginTop: 12, fontSize: 14 }}>Generating… ~15–30s</p>
                  </div>
                )}
                {imgError && (
                  <div style={{
                    position: 'absolute', inset: 0, zIndex: 10, borderRadius: '16px',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    background: 'rgba(0,0,0,0.8)', padding: '0 24px', gap: 12,
                  }}>
                    <p style={{ color: '#f87171', textAlign: 'center', fontSize: 13, lineHeight: 1.5 }}>{imgError}</p>
                    <p style={{ color: '#9ca3af', fontSize: 12 }}>Click Generate to try again</p>
                  </div>
                )}
              </div>
            </div>
          </div>
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
              Save Design
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
                style={{
                  flex: 1, padding: '10px 0', borderRadius: 8, fontWeight: 600, fontSize: 14,
                  background: saveSuccess ? '#22c55e' : 'linear-gradient(135deg, #a1a1aa, #e4e4e7)',
                  color: '#fff', border: 'none', cursor: isSaving ? 'wait' : 'pointer',
                  opacity: isSaving ? 0.7 : 1,
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

export default function Studio() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', background: '#09090b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 14 }}>Loading…</p>
      </div>
    }>
      <StudioContent />
    </Suspense>
  );
}
