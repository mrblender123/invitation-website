'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import html2canvas from 'html2canvas';
import InvitationCard from '../components/InvitationCard';
import SvgCardPreview from '../components/SvgCardPreview';
import { useAuth } from '../components/AuthProvider';
import VirtualKeyboard from '../components/VirtualKeyboard';
import { CATEGORY_SUBS, SUB_DISPLAY_NAMES } from '@/lib/categories';
import GlassPill from '../components/GlassPill';
import type { Template } from '@/lib/templates';

const THUMB_TARGET_H = 264;
const EDITOR_SCALE = 1.15;

/**
 * Draws SVG <text> elements directly onto a canvas using ctx.fillText().
 * This uses the browser's loaded font system (including Typekit), unlike
 * drawing SVG as <img> which is sandboxed and can't access external fonts.
 */
function renderSvgTextToCanvas(
  ctx: CanvasRenderingContext2D,
  svgEl: SVGElement,
  canvasWidth: number,
  canvasHeight: number,
) {
  const vbParts = (svgEl.getAttribute('viewBox') ?? '').trim().split(/[\s,]+/).map(Number);
  const svgW = vbParts[2] > 0 ? vbParts[2] : canvasWidth;
  const svgH = vbParts[3] > 0 ? vbParts[3] : canvasHeight;
  const kx = canvasWidth / svgW;
  const ky = canvasHeight / svgH;

  function parseTransform(t: string) {
    const txM = t.match(/translate\(\s*([\d.+-]+)(?:[,\s]+([\d.+-]+))?\s*\)/);
    const rotM = t.match(/rotate\(\s*([\d.+-]+)/);
    const scM  = t.match(/scale\(\s*([\d.+-]+)(?:[,\s]+([\d.+-]+))?\s*\)/);
    return {
      tx:  txM ? parseFloat(txM[1]) : 0,
      ty:  txM?.[2] ? parseFloat(txM[2]) : 0,
      rot: rotM ? parseFloat(rotM[1]) * Math.PI / 180 : 0,
      sx:  scM ? parseFloat(scM[1]) : 1,
      sy:  scM?.[2] ? parseFloat(scM[2]) : (scM ? parseFloat(scM[1]) : 1),
    };
  }

  // Walk up from el to stopAt to find nearest ancestor with given attribute
  function inheritAttr(el: Element, attr: string, stopAt: Element): string | null {
    let n: Element | null = el;
    while (n) {
      const v = n.getAttribute(attr);
      if (v !== null) return v;
      if (n === stopAt) break;
      n = n.parentElement;
    }
    return null;
  }

  for (const textEl of Array.from(svgEl.querySelectorAll('text'))) {
    // Accumulate opacity up through parent groups
    let opacity = 1;
    let node: Element | null = textEl;
    while (node && node !== svgEl) {
      const op = (node as SVGElement).getAttribute('opacity');
      if (op !== null) opacity *= parseFloat(op);
      node = node.parentElement;
    }
    if (opacity <= 0) continue;

    const rawFamily = (textEl.getAttribute('font-family') ?? 'sans-serif')
      .replace(/['"]/g, '').split(',')[0].trim();
    const fontWeight = textEl.getAttribute('font-weight') ?? '400';
    const anchor     = textEl.getAttribute('text-anchor') ?? 'start';
    const ls         = parseFloat(textEl.getAttribute('letter-spacing') ?? '0');

    const { tx, ty, rot, sx, sy } = parseTransform(textEl.getAttribute('transform') ?? '');

    // Only process leaf tspans so nested font-size/fill on outer tspans is inherited correctly
    const allTspans = Array.from(textEl.querySelectorAll('tspan'));
    const leafTspans = allTspans.filter(ts => ts.querySelector('tspan') === null);

    let currentY = 0;
    for (const tspan of leafTspans) {
      const text = tspan.textContent ?? '';
      if (!text.trim()) continue;

      const xAttr  = tspan.getAttribute('x');
      const yAttr  = tspan.getAttribute('y');
      const dyAttr = tspan.getAttribute('dy');
      const x = xAttr  !== null ? parseFloat(xAttr)  : 0;
      if (yAttr  !== null) currentY = parseFloat(yAttr);
      if (dyAttr !== null) currentY += parseFloat(dyAttr);

      // Inherit font-size and fill: tspan → parent tspans → text element
      const fontSize = parseFloat(inheritAttr(tspan, 'font-size', textEl) ?? '12');
      const fill     = inheritAttr(tspan, 'fill', textEl) ?? '#000';

      ctx.save();
      ctx.globalAlpha = opacity;
      ctx.scale(kx, ky);
      ctx.translate(tx, ty);
      if (rot) ctx.rotate(rot);
      ctx.scale(sx, sy);

      ctx.font         = `${fontWeight} ${fontSize}px "${rawFamily}"`;
      ctx.fillStyle    = fill;
      ctx.textAlign    = anchor === 'middle' ? 'center' : anchor === 'end' ? 'right' : 'left';
      ctx.textBaseline = 'alphabetic';
      if (!isNaN(ls) && 'letterSpacing' in ctx) {
        (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${ls}px`;
      }

      ctx.fillText(text, x, currentY);
      ctx.restore();
    }
  }
}

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
          ? '0 6px 20px rgba(0,0,0,0.10)'
          : '0 2px 8px rgba(0,0,0,0.06)',
        transition: 'box-shadow 0.2s, transform 0.2s',
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
  background: '#ffffff',
  border: '1px solid rgba(0,0,0,0.12)',
  borderRadius: 8,
  padding: '10px 14px',
  color: '#18181b',
  fontSize: 14,
  outline: 'none',
  boxSizing: 'border-box',
  direction: 'inherit',
};

const labelStyle: React.CSSProperties = {
  fontSize: 12,
  color: 'rgba(0,0,0,0.4)',
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  display: 'block',
  marginBottom: 6,
};

function TemplatesContent() {
  const router = useRouter();
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const category    = searchParams.get('category');
  const subcategory = searchParams.get('subcategory');
  const templateParam = searchParams.get('template');
  const subs        = category ? (CATEGORY_SUBS[category] ?? []) : [];

  const [templates, setTemplates] = useState<Template[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [selected, setSelected] = useState<Template | null>(null);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [isDownloading, setIsDownloading] = useState(false);
  const [activeField, setActiveField] = useState<{ id: string; rtl: boolean } | null>(null);
  const [clearedFields, setClearedFields] = useState<Set<string>>(new Set());
  const [hoveredField, setHoveredField] = useState<string | null>(null);
const [windowWidth, setWindowWidth] = useState(1200);
  const [showAllFields, setShowAllFields] = useState(false);
  const [keyboardRect, setKeyboardRect] = useState<DOMRect | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // Draft modal state
  const [showDraftModal, setShowDraftModal] = useState(false);
  const [draftEmail, setDraftEmail] = useState('');
  const [draftSending, setDraftSending] = useState(false);
  const [draftSent, setDraftSent] = useState(false);
  const [draftError, setDraftError] = useState('');

  useEffect(() => {
    const update = () => setWindowWidth(window.innerWidth);
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  // Update keyboard anchor position when active field changes
  useEffect(() => {
    if (!activeField) { setKeyboardRect(null); return; }
    const el = inputRefs.current[activeField.id];
    if (el) setKeyboardRect(el.getBoundingClientRect());
  }, [activeField]);

  // Fetch templates from the API (auto-discovered from public/templates/*/)
  useEffect(() => {
    fetch('/api/templates')
      .then(r => r.json())
      .then(({ templates: data }) => {
        setTemplates(data ?? []);
        // Auto-select template from URL param
        if (templateParam) {
          const t = (data ?? []).find((t: Template) => t.id === templateParam);
          if (t) { setSelected(t); return; }
        }
        // Check if we need to reload a saved design
        const raw = localStorage.getItem('pintle-template-load');
        if (!raw) return;
        localStorage.removeItem('pintle-template-load');
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
    if (!cardRef.current || !selected) return null;

    // SVG templates: bypass html2canvas (can't access cross-origin Typekit font).
    // Instead, composite the PNG background + SVG overlay on a native canvas.
    if (selected.textSvg) {
      // Load the PNG first so we can use its native resolution for the output canvas
      const img = await new Promise<HTMLImageElement>(resolve => {
        const i = new Image();
        i.crossOrigin = 'anonymous';
        i.onload = () => resolve(i);
        i.onerror = () => resolve(i);
        i.src = selected.backgroundSrc;
      });

      // Use the PNG's native pixel dimensions — falls back to SVG viewBox size
      const { canvasWidth, canvasHeight } = selected.style;
      const outW = img.naturalWidth  || canvasWidth;
      const outH = img.naturalHeight || canvasHeight;

      const canvas = document.createElement('canvas');
      canvas.width  = outW;
      canvas.height = outH;
      const ctx = canvas.getContext('2d')!;

      // 1. Draw PNG background at full native resolution
      ctx.drawImage(img, 0, 0, outW, outH);

      // 2. Draw text directly using canvas API — uses the browser's loaded fonts
      //    (SVG-as-img is sandboxed and can't access Typekit)
      //    renderSvgTextToCanvas scales by outW/svgViewBoxW automatically
      await document.fonts.ready;
      const overlayDiv = cardRef.current.querySelector('[data-svg-overlay="true"]');
      const svgEl = overlayDiv?.querySelector('svg');
      if (svgEl) {
        renderSvgTextToCanvas(ctx, svgEl as SVGElement, outW, outH);
      }

      return new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    }

    // Legacy (non-SVG) templates: use html2canvas
    await document.fonts.ready;
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

  const handleSaveForLater = async () => {
    if (!selected) return;

    // Logged-in: skip modal, send directly using their account email
    if (user?.email) {
      setDraftSending(true);
      setDraftError('');
      try {
        const res = await fetch('/api/drafts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ templateId: selected.id, fieldValues, email: user.email }),
        });
        if (!res.ok) {
          const d = await res.json();
          setDraftError(d.error ?? 'Something went wrong.');
          setShowDraftModal(true);
        } else {
          setDraftEmail(user.email);
          setDraftSent(true);
          setShowDraftModal(true);
        }
      } catch {
        setDraftError('Network error. Please try again.');
        setShowDraftModal(true);
      } finally {
        setDraftSending(false);
      }
      return;
    }

    // Not logged in: show email modal
    setDraftEmail('');
    setDraftSent(false);
    setDraftError('');
    setShowDraftModal(true);
  };

  const handleSendDraft = async () => {
    if (!selected || !draftEmail.trim()) return;
    setDraftSending(true);
    setDraftError('');
    try {
      const res = await fetch('/api/drafts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateId: selected.id, fieldValues, email: draftEmail.trim() }),
      });
      if (!res.ok) {
        const d = await res.json();
        setDraftError(d.error ?? 'Something went wrong. Please try again.');
      } else {
        setDraftSent(true);
      }
    } catch {
      setDraftError('Network error. Please try again.');
    } finally {
      setDraftSending(false);
    }
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
      bg: selected.backgroundSrc,
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
    localStorage.setItem('pintle-state', JSON.stringify(state));
    router.push('/studio?load=1');
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--background)', color: 'var(--foreground)', fontFamily: 'var(--font-inter), system-ui, sans-serif' }}>

      {/* Header */}
      <header>
        <div style={{
          maxWidth: 1200,
          margin: '0 auto',
          height: 56,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 24px',
        }}>
          <Link href="/" style={{ fontFamily: 'var(--font-playfair)', fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--foreground)', textDecoration: 'none' }}>
            Pintle
          </Link>
          <nav style={{ display: 'flex', alignItems: 'center', gap: 16 }} />
        </div>
      </header>

      {/* Content */}
      <div className="page-content" style={{ maxWidth: 1200, margin: '0 auto', padding: '44px 24px 80px' }}>

        {selected === null ? (
          /* ── Gallery view ── */
          <>
            <div style={{ marginBottom: 36 }}>
              <GlassPill text="← Back" onClick={() => router.back()} />
            </div>


            {/* Sub-category filter tabs */}
            {subs.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 40 }}>
                <GlassPill
                  text="All"
                  href={`/templates?category=${encodeURIComponent(category!)}`}
                  active={!subcategory}
                  replace
                />
                {subs.map(sub => (
                  <GlassPill
                    key={sub}
                    text={SUB_DISPLAY_NAMES[sub] ?? sub}
                    href={`/templates?category=${encodeURIComponent(category!)}&subcategory=${encodeURIComponent(sub)}`}
                    active={subcategory === sub}
                    replace
                  />
                ))}
              </div>
            )}

            {loadingTemplates ? (
              <div style={{ textAlign: 'center', padding: '80px 0' }}>
                <p style={{ fontSize: 14, color: 'var(--muted-faint)' }}>Loading templates…</p>
              </div>
            ) : (() => {
              const filtered = (category ? templates.filter(t => t.category === category) : templates)
                .filter(t => !subcategory || t.subcategory === subcategory);
              return filtered.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '80px 0', border: '1px dashed rgba(0,0,0,0.12)', borderRadius: 20 }}>
                  <p style={{ fontSize: 22, marginBottom: 12 }}>🎨</p>
                  <p style={{ fontSize: 16, fontWeight: 600, color: 'var(--muted)', marginBottom: 8 }}>
                    {category ? `No ${category} templates yet` : 'Templates coming soon'}
                  </p>
                  <p style={{ fontSize: 14, color: 'var(--muted-faint)', marginBottom: 28 }}>
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
                      <div key={template.id} style={{
                        display: 'flex', flexDirection: 'column', alignItems: 'center',
                        gap: 10, width: cardW,
                        background: 'rgba(255,255,255,0.62)',
                        backdropFilter: 'blur(14px) saturate(1.5)',
                        WebkitBackdropFilter: 'blur(14px) saturate(1.5)',
                        border: '1px solid rgba(255,255,255,0.82)',
                        borderBottom: '1px solid rgba(0,0,0,0.07)',
                        borderRadius: 16,
                        padding: 0,
                        paddingBottom: isMobileGallery ? 8 : 12,
                        overflow: 'hidden',
                        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.92), 0 2px 12px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.background = 'rgba(255,255,255,0.82)';
                        e.currentTarget.style.boxShadow = 'inset 0 1px 0 rgba(255,255,255,0.95), 0 8px 28px rgba(0,0,0,0.10), 0 2px 6px rgba(0,0,0,0.06)';
                        e.currentTarget.style.transform = 'translateY(-3px)';
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.background = 'rgba(255,255,255,0.62)';
                        e.currentTarget.style.boxShadow = 'inset 0 1px 0 rgba(255,255,255,0.92), 0 2px 12px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)';
                        e.currentTarget.style.transform = 'none';
                      }}
                      >
                        <TemplateThumbnail template={template} onClick={() => handleSelectTemplate(template)} targetW={mobileCardW} />
                        <div style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: `0 ${isMobileGallery ? 8 : 12}px` }}>
                          <p style={{ fontSize: isMobileGallery ? 11 : 13, fontWeight: 600, color: 'var(--foreground)', margin: 0 }}>{template.name}</p>
                          <p style={{ fontSize: isMobileGallery ? 11 : 13, fontWeight: 500, color: 'var(--muted)', margin: 0 }}>$19.99</p>
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
            <div style={{ marginBottom: 40, display: 'inline-block' }}>
              <GlassPill text="← Back" onClick={() => router.back()} />
            </div>

            {(() => {
              const isMobile = windowWidth < 900;
              const MAX_H = 720; // max display height in editor
              const scaleByH = MAX_H / selected.style.canvasHeight;
              const cardScale = isMobile
                ? Math.min(scaleByH, (windowWidth - 32) / selected.style.canvasWidth)
                : Math.min(EDITOR_SCALE, scaleByH);
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
                  activeFieldId={activeField?.id}
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
                        backgroundImage={selected.backgroundSrc}
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
                {selected.fields?.some(f => f.optional) && (
                  <div style={{ alignSelf: 'flex-start', marginBottom: 16 }}>
                    <GlassPill
                      text={showAllFields ? '− Hide extra fields' : '+ Show all fields'}
                      onClick={() => setShowAllFields(v => !v)}
                    />
                  </div>
                )}
                <div style={{
                  display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 32,
                  maxHeight: 420, overflowY: 'auto', overflowX: 'hidden',
                  paddingRight: 6,
                  scrollbarWidth: 'thin',
                  scrollbarColor: 'rgba(0,0,0,0.12) transparent',
                }}>
                  {selected.fields ? (
                    selected.fields.filter(f => !f.optional || showAllFields).map(field => {
                      const isActive = activeField?.id === field.id;
                      return (
                      <div key={field.id} style={{ position: 'relative' }}>
                        <div
                          style={{ position: 'relative' }}
                          onMouseEnter={() => setHoveredField(field.id)}
                          onMouseLeave={() => setHoveredField(null)}
                        >
                            <input
                              ref={el => { inputRefs.current[field.id] = el; }}
                              style={{
                                ...inputStyle,
                                paddingLeft: 30,
                                paddingRight: 30,
                                textAlign: 'center',
                                direction: field.rtl ? 'rtl' : 'ltr',
                                borderColor: isActive ? 'rgba(0,0,0,0.4)' : field.optional ? 'rgba(160,130,70,0.5)' : undefined,
                                background: field.optional ? 'rgba(255,245,210,0.5)' : '#ffffff',
                              }}
                              placeholder={clearedFields.has(field.id) ? '' : field.placeholder}
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
                          {/* Clear / Reload — always visible */}
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
                              color: 'var(--muted)',
                              fontSize: 14,
                              cursor: 'pointer',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              padding: 0,
                              lineHeight: 1,
                            }}
                          >
                            {clearedFields.has(field.id) ? '↺' : '×'}
                          </button>
                        </div>
                      </div>
                      );
                    })
                  ) : (
                    <>
                      <div>
                        <input
                          style={inputStyle}
                          placeholder="e.g. Sarah & David's Wedding"
                          value={fieldValues.eventTitle ?? ''}
                          onChange={e => setFieldValues(v => ({ ...v, eventTitle: e.target.value }))}
                        />
                      </div>
                      <div>
                        <input
                          style={inputStyle}
                          placeholder="e.g. The Cohen Family"
                          value={fieldValues.hostName ?? ''}
                          onChange={e => setFieldValues(v => ({ ...v, hostName: e.target.value }))}
                        />
                      </div>
                      <div>
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
                  <GlassPill
                    text={isDownloading ? 'Preparing…' : '⬇ Download PNG'}
                    onClick={handleDownload}
                    disabled={isDownloading}
                    fullWidth
                  />

                  {/* Buy + Save for Later row */}
                  <div style={{ display: 'flex', gap: 8 }}>
                    <div style={{ flex: 1 }}>
                      <GlassPill text="Buy" fullWidth />
                    </div>
                    <div style={{ flex: 1 }}>
                      <GlassPill text="Save for Later" onClick={handleSaveForLater} fullWidth />
                    </div>
                  </div>

                  {!selected.textSvg && (
                    <GlassPill
                      text={user ? 'Customize in Studio →' : 'Open in Studio →'}
                      onClick={handleOpenInStudio}
                      fullWidth
                    />
                  )}
                </div>

                <p style={{ fontSize: 12, color: 'var(--muted-faint)', marginTop: 20 }}>
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

      {/* Save for Later — email draft modal */}
      {showDraftModal && (
        <div
          onClick={e => { if (e.target === e.currentTarget) setShowDraftModal(false); }}
          style={{
            position: 'fixed', inset: 0, zIndex: 200,
            background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 24,
          }}
        >
          <div style={{
            background: '#ffffff',
            border: '1px solid rgba(0,0,0,0.08)',
            borderRadius: 16,
            padding: '36px 32px',
            width: '100%',
            maxWidth: 420,
            position: 'relative',
            boxShadow: '0 20px 60px rgba(0,0,0,0.12)',
          }}>
            {/* Close */}
            <button
              onClick={() => setShowDraftModal(false)}
              style={{
                position: 'absolute', top: 16, right: 16,
                background: 'none', border: 'none', color: 'var(--muted)',
                fontSize: 20, cursor: 'pointer', lineHeight: 1, padding: 4,
              }}
            >
              ×
            </button>

            {draftSent ? (
              /* Success state */
              <div style={{ textAlign: 'center', padding: '8px 0' }}>
                <p style={{ fontSize: 36, marginBottom: 16 }}>📬</p>
                <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--foreground)', margin: '0 0 10px' }}>Check your inbox</h2>
                <p style={{ fontSize: 14, color: 'var(--muted)', margin: '0 0 28px', lineHeight: 1.6 }}>
                  We sent a link to <strong style={{ color: 'var(--foreground)' }}>{draftEmail}</strong>.
                  Your draft will be available for 7 days.
                </p>
                <GlassPill text="Done" onClick={() => setShowDraftModal(false)} />
              </div>
            ) : (
              /* Input state */
              <>
                <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--foreground)', margin: '0 0 8px' }}>Save your draft</h2>
                <p style={{ fontSize: 14, color: 'var(--muted)', margin: '0 0 28px', lineHeight: 1.6 }}>
                  Enter your email and we&apos;ll send you a link to continue editing.
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <input
                    type="email"
                    placeholder="your@email.com"
                    value={draftEmail}
                    onChange={e => setDraftEmail(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleSendDraft(); }}
                    autoFocus
                    style={{
                      ...inputStyle,
                      fontSize: 15,
                      padding: '12px 16px',
                    }}
                  />

                  {draftError && (
                    <p style={{ fontSize: 13, color: '#f87171', margin: 0 }}>{draftError}</p>
                  )}

                  <GlassPill
                    text={draftSending ? 'Sending…' : 'Send me the link'}
                    onClick={handleSendDraft}
                    disabled={draftSending || !draftEmail.trim()}
                    fullWidth
                  />
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Virtual keyboard portal — fixed below the active input, not clipped by any overflow container */}
      {activeField && keyboardRect && windowWidth >= 768 && createPortal(
        <div style={{ position: 'fixed', top: keyboardRect.bottom + 8, left: keyboardRect.left, width: keyboardRect.width, zIndex: 1000 }}>
          <VirtualKeyboard
            lang={activeField.rtl ? 'he' : 'en'}
            onKey={char => setFieldValues(v => ({ ...v, [activeField.id]: (v[activeField.id] ?? '') + char }))}
            onBackspace={() => setFieldValues(v => {
              const cur = v[activeField.id] ?? '';
              return { ...v, [activeField.id]: Array.from(cur).slice(0, -1).join('') };
            })}
            onDone={() => setActiveField(null)}
          />
        </div>,
        document.body
      )}
    </div>
  );
}

export default function TemplatesPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', background: 'var(--background)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: 'var(--muted-faint)', fontSize: 14 }}>Loading…</p>
      </div>
    }>
      <TemplatesContent />
    </Suspense>
  );
}
