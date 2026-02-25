'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import html2canvas from 'html2canvas';
import InvitationCard from '../components/InvitationCard';
import SvgCardPreview from '../components/SvgCardPreview';
import VirtualKeyboard from '../components/VirtualKeyboard';
import { useAuth } from '../components/AuthProvider';
import SimchaSelector from '../components/SimchaSelector';
import type { Template } from '@/lib/templates';

type CartItem = {
  id: string;
  templateId: string;
  templateName: string;
  category: string;
  thumbnailSrc: string;
  fieldValues: Record<string, string>;
  savedAt: number;
};

const THUMB_TARGET_H = 264;
const EDITOR_SCALE = 1.15;

function TemplateThumbnail({ template, onClick, targetW }: { template: Template; onClick: () => void; targetW?: number }) {
  const [hovered, setHovered] = useState(false);
  const { style } = template;
  const thumbScale = targetW ? targetW / style.canvasWidth : THUMB_TARGET_H / style.canvasHeight;
  const thumbW = targetW ?? Math.round(style.canvasWidth * thumbScale);
  const thumbH = Math.round(style.canvasHeight * thumbScale);
  const gradId = `pm-${template.id}`;

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'relative',
        width: thumbW,
        height: thumbH,
        borderRadius: 12,
        overflow: 'hidden',
        cursor: 'pointer',
        flexShrink: 0,
        boxShadow: hovered
          ? '0 24px 60px rgba(0,0,0,0.8), 0 0 32px rgba(255,255,255,0.08)'
          : '0 8px 32px rgba(0,0,0,0.5)',
        transition: 'box-shadow 0.8s cubic-bezier(0.2,0,0.2,1), transform 0.8s cubic-bezier(0.2,0,0.2,1)',
        transform: hovered ? 'translateY(-2px)' : 'none',
      }}
    >
      {template.textSvg ? (
        <SvgCardPreview template={template} fieldValues={{}} scale={thumbScale} />
      ) : (
        <div style={{
          width: style.canvasWidth,
          height: style.canvasHeight,
          transform: `scale(${thumbScale})`,
          transformOrigin: 'top left',
          pointerEvents: 'none',
        }}>
          <InvitationCard
            eventTitle="Event Title" hostName="Host Name" dateTime="Date & Time"
            backgroundImage={template.thumbnailSrc}
            overlayOpacity={style.overlayOpacity ?? 0} glowIntensity={style.glowIntensity ?? 0}
            vignetteIntensity={style.vignetteIntensity ?? 0}
            canvasWidth={style.canvasWidth} canvasHeight={style.canvasHeight}
            titleSize={style.titleSize ?? 40} nameSize={style.nameSize ?? 28} dateSize={style.dateSize ?? 20}
            titleX={style.titleX ?? style.canvasWidth / 2} titleY={style.titleY ?? 230}
            nameX={style.nameX ?? style.canvasWidth / 2} nameY={style.nameY ?? 310}
            dateX={style.dateX ?? style.canvasWidth / 2} dateY={style.dateY ?? 375}
            titleColor={style.titleColor ?? '#fff'} nameColor={style.nameColor ?? '#fff'} dateColor={style.dateColor ?? '#fff'}
            titleFont={style.titleFont ?? 'Inter, sans-serif'} nameFont={style.nameFont ?? 'Inter, sans-serif'} dateFont={style.dateFont ?? 'Inter, sans-serif'}
          />
        </div>
      )}

      {/* Hover name overlay */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, transparent 55%)',
        display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
        padding: 12, opacity: hovered ? 1 : 0, transition: 'opacity 0.2s', pointerEvents: 'none',
      }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: '#fff', margin: 0, fontFamily: 'var(--font-playfair)' }}>{template.name}</p>
        <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', margin: '2px 0 0' }}>{template.category}</p>
      </div>

      {/* Platinum border + inner glow */}
      <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 10 }}
        viewBox={`0 0 ${thumbW} ${thumbH}`} xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%"   stopColor="#3f3f46" />
            <stop offset="45%"  stopColor="#a1a1aa" />
            <stop offset="50%"  stopColor="#ffffff" />
            <stop offset="55%"  stopColor="#a1a1aa" />
            <stop offset="100%" stopColor="#27272a" />
          </linearGradient>
        </defs>
        <rect x="1" y="1" width={thumbW - 2} height={thumbH - 2} rx="11"
          fill="none" stroke="white" strokeWidth="8"
          style={{ opacity: hovered ? 0.35 : 0, transition: 'opacity 1.2s cubic-bezier(0.4,0,0.2,1)', filter: 'blur(6px)' }} />
        <rect x="0.5" y="0.5" width={thumbW - 1} height={thumbH - 1} rx="11.5"
          fill="none" stroke={`url(#${gradId})`} strokeWidth="1" />
      </svg>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: '#09090b',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 8,
  padding: '10px 14px',
  color: '#fff',
  fontSize: 14,
  outline: 'none',
  boxSizing: 'border-box',
  direction: 'inherit',
};

const labelStyle: React.CSSProperties = {
  fontSize: 12,
  color: 'rgba(255,255,255,0.4)',
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  display: 'block',
  marginBottom: 6,
};

function TemplatesContent() {
  const router = useRouter();
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const category = searchParams.get('category');

  const [templates, setTemplates] = useState<Template[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [selected, setSelected] = useState<Template | null>(null);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [isDownloading, setIsDownloading] = useState(false);
  const [activeField, setActiveField] = useState<{ id: string; rtl: boolean } | null>(null);
  const [clearedFields, setClearedFields] = useState<Set<string>>(new Set());
  const [hoveredField, setHoveredField] = useState<string | null>(null);
  const [cartCount, setCartCount] = useState(0);
  const [savedToCart, setSavedToCart] = useState(false);
  const [windowWidth, setWindowWidth] = useState(1200);
  const [simchaOpen, setSimchaOpen] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const update = () => setWindowWidth(window.innerWidth);
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  // Read initial cart count from localStorage
  useEffect(() => {
    const raw = localStorage.getItem('invitia-cart');
    if (raw) {
      try { setCartCount(JSON.parse(raw).length); } catch {}
    }
  }, []);

  // Fetch templates from the API (auto-discovered from public/templates/*/)
  useEffect(() => {
    fetch('/api/templates')
      .then(r => r.json())
      .then(({ templates: data }) => {
        setTemplates(data ?? []);
        // Check if we need to reload a saved design
        const raw = localStorage.getItem('invitia-template-load');
        if (!raw) return;
        localStorage.removeItem('invitia-template-load');
        try {
          const { templateId, fieldValues: saved } = JSON.parse(raw);
          const template = (data ?? []).find((t: Template) => t.id === templateId);
          if (template) {
            setSelected(template);
            setFieldValues(saved ?? {});
          }
        } catch {}
      })
      .finally(() => setLoadingTemplates(false));
  }, []);

  const handleSelectTemplate = (template: Template) => {
    setSelected(template);
    setClearedFields(new Set());
    if (template.fields) {
      const initial: Record<string, string> = {};
      for (const f of template.fields) initial[f.id] = f.placeholder;
      setFieldValues(initial);
    } else {
      setFieldValues({ eventTitle: '', hostName: '', dateTime: '' });
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const generateBlob = async (): Promise<Blob | null> => {
    if (!cardRef.current) return null;
    const canvas = await html2canvas(cardRef.current, { useCORS: true, scale: 2 });
    return new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
  };

  const handleDownload = async () => {
    if (!cardRef.current) return;
    setIsDownloading(true);
    try {
      const blob = await generateBlob();
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = `${selected?.id ?? 'invitation'}.png`;
      link.href = url;
      link.click();
      URL.revokeObjectURL(url);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleSaveForLater = () => {
    if (!selected) return;
    const cartRaw = localStorage.getItem('invitia-cart');
    let cart: CartItem[] = [];
    try { cart = cartRaw ? JSON.parse(cartRaw) : []; } catch { cart = []; }
    const item: CartItem = {
      id: `${selected.id}-${Date.now()}`,
      templateId: selected.id,
      templateName: selected.name,
      category: selected.category,
      thumbnailSrc: selected.thumbnailSrc,
      fieldValues,
      savedAt: Date.now(),
    };
    cart.push(item);
    localStorage.setItem('invitia-cart', JSON.stringify(cart));
    setCartCount(cart.length);
    setSavedToCart(true);
    setTimeout(() => setSavedToCart(false), 2000);
  };

  const handleOpenInStudio = () => {
    if (!selected) return;
    const { style } = selected;
    const state = {
      data: {
        eventTitle: fieldValues.eventTitle ?? fieldValues[selected.fields?.[0]?.id ?? ''] ?? '',
        hostName: fieldValues.hostName ?? fieldValues[selected.fields?.[1]?.id ?? ''] ?? '',
        dateTime: fieldValues.dateTime ?? fieldValues[selected.fields?.[2]?.id ?? ''] ?? '',
      },
      bg: selected.thumbnailSrc,
      overlayOpacity: style.overlayOpacity ?? 0,
      glowIntensity: style.glowIntensity ?? 0,
      vignetteIntensity: style.vignetteIntensity ?? 0,
      titleSize: style.titleSize ?? 40,
      nameSize: style.nameSize ?? 28,
      dateSize: style.dateSize ?? 20,
      titleX: style.titleX, titleY: style.titleY,
      nameX: style.nameX,   nameY: style.nameY,
      dateX: style.dateX,   dateY: style.dateY,
      titleColor: style.titleColor,
      nameColor: style.nameColor,
      dateColor: style.dateColor,
      titleFont: style.titleFont,
      nameFont: style.nameFont,
      dateFont: style.dateFont,
      canvasWidth: style.canvasWidth,
      canvasHeight: style.canvasHeight,
    };
    localStorage.setItem('invitia-state', JSON.stringify(state));
    router.push('/studio?load=1');
  };

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
          <nav style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            {cartCount > 0 && (
              <Link
                href="/cart"
                style={{
                  position: 'relative',
                  display: 'flex', alignItems: 'center', gap: 6,
                  color: 'rgba(255,255,255,0.65)', fontSize: 22,
                  textDecoration: 'none',
                }}
              >
                🛒
                <span style={{
                  position: 'absolute', top: -6, right: -8,
                  background: '#f0d060', color: '#1a1200',
                  fontSize: 10, fontWeight: 700,
                  width: 16, height: 16, borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {cartCount}
                </span>
              </Link>
            )}
          </nav>
        </div>
      </header>

      {/* Content */}
      <div className="page-content" style={{ maxWidth: 1200, margin: '0 auto', padding: '56px 24px 80px' }}>

        {selected === null ? (
          /* ── Gallery view ── */
          <>
            <button
              onClick={() => setSimchaOpen(true)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                background: 'transparent', border: 'none', cursor: 'pointer',
                color: 'rgba(255,255,255,0.4)', fontSize: 14, padding: '0 0 36px',
              }}
            >
              ← Change Simcha
            </button>
            <SimchaSelector forceOpen={simchaOpen} onClose={() => setSimchaOpen(false)} hideButton />

            <div style={{ marginBottom: 48 }}>
              <p style={{ fontSize: 12, fontWeight: 500, letterSpacing: '0.12em', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', marginBottom: 12 }}>
                {category ?? 'Templates'}
              </p>
              <h1 style={{ fontFamily: 'var(--font-playfair)', fontSize: 'clamp(28px, 4vw, 42px)', fontWeight: 700, letterSpacing: '-0.02em', margin: '0 0 10px' }}>
                {category ? `${category} Invitations` : 'Ready-Made Invitations'}
              </h1>
              <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.4)', margin: 0 }}>
                Pick a design, fill in your details, and download — no account needed.
              </p>
            </div>

            {loadingTemplates ? (
              <div style={{ textAlign: 'center', padding: '80px 0' }}>
                <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.3)' }}>Loading templates…</p>
              </div>
            ) : (() => {
              const filtered = category ? templates.filter(t => t.category === category) : templates;
              return filtered.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '80px 0', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: 20 }}>
                  <p style={{ fontSize: 22, marginBottom: 12 }}>🎨</p>
                  <p style={{ fontSize: 16, fontWeight: 600, color: 'rgba(255,255,255,0.6)', marginBottom: 8 }}>
                    {category ? `No ${category} templates yet` : 'Templates coming soon'}
                  </p>
                  <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.3)', marginBottom: 28 }}>
                    Check back shortly — we&apos;re adding designs now.
                  </p>
                </div>
              ) : (() => {
                const isMobileGallery = windowWidth < 640;
                // 32px total horizontal padding on mobile (16px each side via .page-content), 12px gap between 2 cols
                const mobileCardW = isMobileGallery ? Math.floor((windowWidth - 32 - 12) / 2) : undefined;
                return (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: isMobileGallery ? 'repeat(2, 1fr)' : `repeat(auto-fill, minmax(185px, 1fr))`,
                  gap: isMobileGallery ? 12 : 28,
                  justifyItems: 'center',
                }}>
                  {filtered.map(template => {
                    const ts = mobileCardW ? mobileCardW / template.style.canvasWidth : THUMB_TARGET_H / template.style.canvasHeight;
                    const cardW = mobileCardW ?? Math.round(template.style.canvasWidth * ts);
                    return (
                      <div key={template.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, width: cardW }}>
                        <TemplateThumbnail template={template} onClick={() => handleSelectTemplate(template)} targetW={mobileCardW} />
                        <div style={{ width: '100%', textAlign: 'center' }}>
                          <p style={{ fontSize: isMobileGallery ? 11 : 13, fontWeight: 600, color: 'rgba(255,255,255,0.8)', margin: '0 0 2px' }}>{template.name}</p>
                          <p style={{ fontSize: isMobileGallery ? 10 : 11, color: 'rgba(255,255,255,0.35)', margin: 0 }}>{template.category}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
                );
              })();
            })()}
          </>
        ) : (
          /* ── Editor view ── */
          <>
            {/* Back button */}
            <button
              onClick={() => setSelected(null)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                background: 'transparent', border: 'none', cursor: 'pointer',
                color: 'rgba(255,255,255,0.45)', fontSize: 14, padding: '0 0 40px',
              }}
            >
              ← Back to Templates
            </button>

            {(() => {
              const isMobile = windowWidth < 900;
              const cardScale = isMobile
                ? Math.min(EDITOR_SCALE, (windowWidth - 32) / selected.style.canvasWidth)
                : EDITOR_SCALE;
              return (
            <div style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr' : 'auto 1fr',
              gap: isMobile ? 24 : 48,
              alignItems: 'start',
            }}>

              {/* Live preview — flex wrapper centers card on mobile without affecting desktop */}
              <div style={{ display: 'flex', justifyContent: 'center' }}>
              {selected.textSvg ? (
                <SvgCardPreview
                  ref={cardRef}
                  template={selected}
                  fieldValues={fieldValues}
                  scale={cardScale}
                />
              ) : (
                <div style={{
                  position: 'relative',
                  width: selected.style.canvasWidth * cardScale,
                  height: selected.style.canvasHeight * cardScale,
                  flexShrink: 0,
                }}>
                  <div style={{
                    position: 'absolute', top: 0, left: 0,
                    transform: `scale(${cardScale})`,
                    transformOrigin: 'top left',
                  }}>
                    <div ref={cardRef}>
                      <InvitationCard
                        eventTitle={fieldValues.eventTitle ?? ''}
                        hostName={fieldValues.hostName ?? ''}
                        dateTime={fieldValues.dateTime ?? ''}
                        backgroundImage={selected.thumbnailSrc}
                        overlayOpacity={selected.style.overlayOpacity ?? 0}
                        glowIntensity={selected.style.glowIntensity ?? 0}
                        vignetteIntensity={selected.style.vignetteIntensity ?? 0}
                        canvasWidth={selected.style.canvasWidth}
                        canvasHeight={selected.style.canvasHeight}
                        titleSize={selected.style.titleSize ?? 40}
                        nameSize={selected.style.nameSize ?? 28}
                        dateSize={selected.style.dateSize ?? 20}
                        titleX={selected.style.titleX ?? selected.style.canvasWidth / 2}
                        titleY={selected.style.titleY ?? 230}
                        nameX={selected.style.nameX ?? selected.style.canvasWidth / 2}
                        nameY={selected.style.nameY ?? 310}
                        dateX={selected.style.dateX ?? selected.style.canvasWidth / 2}
                        dateY={selected.style.dateY ?? 375}
                        titleColor={selected.style.titleColor ?? '#fff'}
                        nameColor={selected.style.nameColor ?? '#fff'}
                        dateColor={selected.style.dateColor ?? '#fff'}
                        titleFont={selected.style.titleFont ?? 'Inter, sans-serif'}
                        nameFont={selected.style.nameFont ?? 'Inter, sans-serif'}
                        dateFont={selected.style.dateFont ?? 'Inter, sans-serif'}
                      />
                    </div>
                  </div>
                </div>
              )}
              </div>{/* /preview flex wrapper */}

              {/* Edit panel */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                {/* Text inputs — dynamic for SVG templates, legacy for InvitationCard */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20, marginBottom: 32 }}>
                  {selected.fields ? (
                    selected.fields.map(field => {
                      const isActive = activeField?.id === field.id;
                      return (
                      <div key={field.id} style={{ position: 'relative' }}>
                        <label style={labelStyle}>{field.label}</label>
                        <div
                          style={{ position: 'relative' }}
                          onMouseEnter={() => setHoveredField(field.id)}
                          onMouseLeave={() => setHoveredField(null)}
                        >
                          <input
                            style={{
                              ...inputStyle,
                              paddingLeft: 30,
                              paddingRight: 30,
                              textAlign: 'center',
                              direction: field.rtl ? 'rtl' : 'ltr',
                              borderColor: isActive ? 'rgba(255,255,255,0.45)' : undefined,
                            }}
                            placeholder={field.placeholder}
                            value={fieldValues[field.id] ?? ''}
                            onFocus={() => setActiveField({ id: field.id, rtl: field.rtl ?? false })}
                            onBlur={() => setActiveField(null)}
                            onChange={e => {
                              setFieldValues(v => ({ ...v, [field.id]: e.target.value }));
                              if (clearedFields.has(field.id) && e.target.value !== '') {
                                setClearedFields(s => { const n = new Set(s); n.delete(field.id); return n; });
                              }
                            }}
                          />
                          {/* Clear / Reload — visible only when active or hovered */}
                          {(isActive || hoveredField === field.id) && (
                            <button
                              onMouseDown={e => {
                                e.preventDefault();
                                if (clearedFields.has(field.id)) {
                                  setFieldValues(v => ({ ...v, [field.id]: field.placeholder }));
                                  setClearedFields(s => { const n = new Set(s); n.delete(field.id); return n; });
                                } else {
                                  setFieldValues(v => ({ ...v, [field.id]: '' }));
                                  setClearedFields(s => new Set(s).add(field.id));
                                }
                              }}
                              title={clearedFields.has(field.id) ? 'Restore default' : 'Clear field'}
                              style={{
                                position: 'absolute',
                                left: 8,
                                top: '50%',
                                transform: 'translateY(-50%)',
                                width: 16, height: 16,
                                borderRadius: '50%',
                                border: 'none',
                                background: 'none',
                                color: clearedFields.has(field.id) ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.25)',
                                fontSize: 14,
                                cursor: 'pointer',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                padding: 0,
                                lineHeight: 1,
                              }}
                            >
                              {clearedFields.has(field.id) ? '↺' : '×'}
                            </button>
                          )}
                        </div>
                        {isActive && (
                          <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50 }}>
                            <VirtualKeyboard
                              lang={field.rtl ? 'he' : 'en'}
                              onKey={char => setFieldValues(v => ({ ...v, [field.id]: (v[field.id] ?? '') + char }))}
                              onBackspace={() => setFieldValues(v => {
                                const cur = v[field.id] ?? '';
                                return { ...v, [field.id]: Array.from(cur).slice(0, -1).join('') };
                              })}
                              onDone={() => setActiveField(null)}
                            />
                          </div>
                        )}
                      </div>
                      );
                    })
                  ) : (
                    <>
                      <div>
                        <label style={labelStyle}>Event Title</label>
                        <input
                          style={inputStyle}
                          placeholder="e.g. Sarah & David's Wedding"
                          value={fieldValues.eventTitle ?? ''}
                          onChange={e => setFieldValues(v => ({ ...v, eventTitle: e.target.value }))}
                        />
                      </div>
                      <div>
                        <label style={labelStyle}>Host Name</label>
                        <input
                          style={inputStyle}
                          placeholder="e.g. The Cohen Family"
                          value={fieldValues.hostName ?? ''}
                          onChange={e => setFieldValues(v => ({ ...v, hostName: e.target.value }))}
                        />
                      </div>
                      <div>
                        <label style={labelStyle}>Date & Time</label>
                        <input
                          style={inputStyle}
                          placeholder="e.g. Sunday, June 15 · 6:00 PM"
                          value={fieldValues.dateTime ?? ''}
                          onChange={e => setFieldValues(v => ({ ...v, dateTime: e.target.value }))}
                        />
                      </div>
                    </>
                  )}
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <button
                    onClick={handleDownload}
                    disabled={isDownloading}
                    className="silver-btn"
                    style={{
                      padding: '12px 0', fontSize: 15, fontWeight: 600,
                      opacity: isDownloading ? 0.6 : 1,
                      cursor: isDownloading ? 'wait' : 'pointer',
                      width: '100%',
                    }}
                  >
                    {isDownloading ? 'Preparing…' : '⬇ Download PNG'}
                  </button>

                  {/* Buy + Save for Later row */}
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      style={{
                        flex: 1, padding: '11px 0', borderRadius: 8,
                        fontWeight: 700, fontSize: 14,
                        background: 'linear-gradient(135deg, #b8973a 0%, #f0d060 50%, #b8973a 100%)',
                        color: '#1a1200',
                        border: 'none',
                        cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                        letterSpacing: '0.02em',
                      }}
                    >
                      Buy
                    </button>
                    <button
                      onClick={handleSaveForLater}
                      style={{
                        flex: 1, padding: '11px 0', borderRadius: 8,
                        fontWeight: 600, fontSize: 14,
                        background: savedToCart ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.05)',
                        color: savedToCart ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.65)',
                        border: `1px solid ${savedToCart ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.15)'}`,
                        cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                        transition: 'all 0.2s',
                      }}
                    >
                      {savedToCart ? '✓ Saved' : '🛒 Save for Later'}
                    </button>
                  </div>

                  {!selected.textSvg && (
                    <button
                      onClick={handleOpenInStudio}
                      style={{
                        padding: '11px 0', borderRadius: 8, fontWeight: 600, fontSize: 14,
                        background: 'transparent', color: 'rgba(255,255,255,0.55)',
                        border: '1px solid rgba(255,255,255,0.15)', cursor: 'pointer',
                        width: '100%',
                      }}
                    >
                      {user ? 'Customize further in Studio →' : 'Open in Studio (sign in required) →'}
                    </button>
                  )}
                </div>

                <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.2)', marginTop: 20 }}>
                  {selected.textSvg
                    ? 'Tap a field above to edit it.'
                    : 'Want fonts, colors, and positioning control? Use the full studio.'}
                </p>
              </div>
            </div>
            );})()}
          </>
        )}
      </div>

    </div>
  );
}

export default function TemplatesPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', background: '#09090b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 14 }}>Loading…</p>
      </div>
    }>
      <TemplatesContent />
    </Suspense>
  );
}
