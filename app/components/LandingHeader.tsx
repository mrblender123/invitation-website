'use client';

import { useState, useEffect, useRef } from 'react';
import GlassPill from './GlassPill';

const HEADER = {
  height:    52,
  topOffset: 12,
  fontSize:  20,
};

const CATEGORIES = [
  { key: "It's a Boy",    emoji: '👶🏻', subcategories: ['Bris', 'Pidyon Haben', "Shlishi L'milah", 'Shulem Zucher', 'Vachnacht', 'Vachnacht-Bris'] },
  { key: "It's a Girl",   emoji: '🎀' },
  { key: 'Upsherin',      emoji: '✂️' },
  { key: 'Bar Mitzvah',   emoji: '⓭' },
  { key: 'Tenoyim',       emoji: '📜' },
  { key: 'Vort',          emoji: '🥂' },
  { key: 'Wedding',       emoji: '💍' },
  { key: 'Sheva Brachos', emoji: '🍷' },
];

function GlassPillLayers({ mousePos, isHovered, isPressed }: { mousePos: { x: number; y: number }; isHovered: boolean; isPressed: boolean }) {
  return (
    <>
      {/* 0. Lens distortion */}
      <div style={{ position: 'absolute', inset: -3, borderRadius: 40, pointerEvents: 'none', zIndex: -1, backdropFilter: 'blur(10px) saturate(1.8)', WebkitBackdropFilter: 'blur(10px) saturate(1.8)', maskImage: 'radial-gradient(circle at center, black 60%, transparent 100%)', WebkitMaskImage: 'radial-gradient(circle at center, black 60%, transparent 100%)' }} />
      {/* 1. Chromatic aberration */}
      <div style={{ position: 'absolute', inset: 0, borderRadius: 9999, pointerEvents: 'none', overflow: 'hidden', filter: 'blur(8px)', opacity: isHovered ? 0.50 : 0.20, transition: 'opacity 700ms' }}>
        <div style={{ position: 'absolute', inset: '0 auto 0 -8px', width: 40, background: 'rgba(148,163,184,0.25)' }} />
        <div style={{ position: 'absolute', inset: '0 -8px 0 auto', width: 40, background: 'rgba(203,213,225,0.25)' }} />
      </div>
      {/* 2. Base glass body */}
      <div style={{ position: 'absolute', inset: 0, borderRadius: 9999, background: 'rgba(255,255,255,0.50)', backdropFilter: 'blur(60px)', WebkitBackdropFilter: 'blur(60px)', border: isPressed ? '1.5px solid rgba(148,163,184,0.50)' : '1.5px solid rgba(255,255,255,0.90)', boxShadow: isPressed ? 'inset 0 8px 20px rgba(148,163,184,0.20), inset 0 -2px 10px rgba(255,255,255,0.9)' : 'inset 0 12px 24px rgba(255,255,255,1), inset 0 -10px 20px rgba(0,0,0,0.05), 0 10px 30px -10px rgba(0,0,0,0.10)', transition: 'box-shadow 300ms, border 300ms' }} />
      {/* 3. Click bubble */}
      <div style={{ position: 'absolute', inset: 0, borderRadius: 9999, background: 'rgba(148,163,184,0.20)', filter: 'blur(16px)', opacity: isPressed ? 1 : 0, transition: 'opacity 300ms', pointerEvents: 'none' }} />
      {/* 4. Fresnel top rim */}
      <div style={{ position: 'absolute', inset: 0.5, borderRadius: 9999, borderTop: '1.5px solid white', pointerEvents: 'none', zIndex: 20 }} />
      {/* 5. Surface glare */}
      <div style={{ position: 'absolute', top: 1.2, left: '8%', width: '84%', height: '40%', borderRadius: '100% 100% 0 0', background: 'linear-gradient(to bottom, rgba(255,255,255,0.95), transparent)', pointerEvents: 'none', zIndex: 20, opacity: isPressed ? 0.40 : 1, transform: isPressed ? 'translateY(4px) scale(0.95)' : 'none', transition: 'opacity 300ms, transform 300ms' }} />
      {/* 6. Subsurface scatter */}
      <div style={{ position: 'absolute', inset: 0, borderRadius: 9999, pointerEvents: 'none', overflow: 'hidden', mixBlendMode: 'overlay' }}>
        <div style={{ position: 'absolute', width: 160, height: 160, borderRadius: '50%', background: 'radial-gradient(circle, rgba(148,163,184,0.4) 0%, transparent 70%)', left: mousePos.x - 80, top: mousePos.y - 80, filter: 'blur(36px)', opacity: isHovered && !isPressed ? 0.8 : 0, transition: 'opacity 500ms' }} />
      </div>
      {/* 8. Outer rim */}
      <div style={{ position: 'absolute', inset: -0.8, borderRadius: 9999, border: '1px solid rgba(203,213,225,0.20)', pointerEvents: 'none' }} />
    </>
  );
}

export default function LandingHeader() {
  const [scrollVelocity, setScrollVelocity] = useState(0);
  const [activeCategory, setActiveCategory] = useState<number | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const [windowWidth, setWindowWidth] = useState(1200);

  const [logoHovered, setLogoHovered] = useState(false);
  const [logoPressed, setLogoPressed] = useState(false);
  const [logoMouse, setLogoMouse] = useState({ x: 0, y: 0 });
  const logoRef = useRef<HTMLDivElement>(null);

  const [rightHovered, setRightHovered] = useState(false);
  const [rightPressed, setRightPressed] = useState(false);
  const [rightMouse, setRightMouse] = useState({ x: 0, y: 0 });
  const rightRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const update = () => setWindowWidth(window.innerWidth);
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  useEffect(() => {
    let lastScrollY = window.scrollY;
    let frameId: ReturnType<typeof requestAnimationFrame>;

    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      const diff = currentScrollY - lastScrollY;
      setScrollVelocity(Math.min(Math.abs(diff) * 0.05, 1));
      setScrolled(currentScrollY > 20);
      lastScrollY = currentScrollY;

      if (Math.abs(diff) > 25) setActiveCategory(null);

      cancelAnimationFrame(frameId);
      const decay = () => {
        setScrollVelocity(prev => {
          if (prev < 0.01) return 0;
          frameId = requestAnimationFrame(decay);
          return prev * 0.9;
        });
      };
      frameId = requestAnimationFrame(decay);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      cancelAnimationFrame(frameId);
    };
  }, []);

  const hideTransform = `translateY(calc(-100% - ${HEADER.topOffset}px))`;

  const textStyle: React.CSSProperties = {
    position: 'relative', zIndex: 30,
    fontSize: '0.88rem', fontWeight: 700, fontStyle: 'italic',
    letterSpacing: '-0.01em', color: '#0f172a', whiteSpace: 'nowrap',
    textDecoration: 'none',
  };

  return (
    <>
      {/* Fixed header row */}
      <div style={{
        position: 'fixed', top: HEADER.topOffset, left: '50%',
        transform: scrolled
          ? `translateX(-50%) ${hideTransform}`
          : 'translateX(-50%) translateY(0)',
        width: 'calc(100% - 48px)',
        maxWidth: 1100,
        height: HEADER.height,
        zIndex: 100,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        pointerEvents: 'none',
        transition: 'transform 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
      }}>
        {/* Logo pill — left */}
        <div
          ref={logoRef}
          onMouseMove={e => { const r = logoRef.current!.getBoundingClientRect(); setLogoMouse({ x: e.clientX - r.left, y: e.clientY - r.top }); }}
          onMouseEnter={() => setLogoHovered(true)}
          onMouseLeave={() => { setLogoHovered(false); setLogoPressed(false); }}
          onMouseDown={() => setLogoPressed(true)}
          onMouseUp={() => setLogoPressed(false)}
          style={{
            position: 'relative', pointerEvents: 'auto',
            display: 'flex', alignItems: 'center',
            height: HEADER.height, borderRadius: 9999,
            padding: '0 20px', overflow: 'visible',
            transform: logoPressed ? 'scale(0.92)' : logoHovered ? 'scale(1.06)' : 'scale(1)',
            transition: logoPressed ? 'transform 0.1s ease-out' : 'transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)',
            cursor: 'pointer',
          }}
        >
          <GlassPillLayers mousePos={logoMouse} isHovered={logoHovered} isPressed={logoPressed} />
          <a href="/" style={{ ...textStyle, fontFamily: 'var(--font-playfair)', fontSize: HEADER.fontSize }}>
            Pintle
          </a>
        </div>

        {/* Right pill — About + WhatsApp */}
        <div
          ref={rightRef}
          onMouseMove={e => { const r = rightRef.current!.getBoundingClientRect(); setRightMouse({ x: e.clientX - r.left, y: e.clientY - r.top }); }}
          onMouseEnter={() => setRightHovered(true)}
          onMouseLeave={() => { setRightHovered(false); setRightPressed(false); }}
          onMouseDown={() => setRightPressed(true)}
          onMouseUp={() => setRightPressed(false)}
          style={{
            position: 'relative', pointerEvents: 'auto',
            display: 'flex', alignItems: 'center', gap: 2,
            height: HEADER.height, borderRadius: 9999,
            padding: '0 6px', overflow: 'visible',
            transform: rightPressed ? 'scale(0.92)' : rightHovered ? 'scale(1.06)' : 'scale(1)',
            transition: rightPressed ? 'transform 0.1s ease-out' : 'transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)',
            cursor: 'pointer',
          }}
        >
          <GlassPillLayers mousePos={rightMouse} isHovered={rightHovered} isPressed={rightPressed} />
          <a href="/about" style={{ ...textStyle, fontFamily: 'var(--font-inter), system-ui, sans-serif', padding: '0 12px', height: '100%', display: 'inline-flex', alignItems: 'center' }}>
            About
          </a>
          <div style={{ position: 'relative', zIndex: 30, width: 1, height: 16, background: 'rgba(0,0,0,0.12)', flexShrink: 0 }} />
          <a
            href="https://wa.me/YOURNUMBERHERE"
            target="_blank" rel="noopener noreferrer"
            title="Chat on WhatsApp"
            style={{ position: 'relative', zIndex: 30, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 36, height: '100%', flexShrink: 0 }}
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" fill="#25D366"/>
            </svg>
          </a>
        </div>
      </div>

      {/* Spacer for fixed header */}
      <div style={{ height: 76 }} />

      {/* Sticky category pills */}
      <div style={{
        position: 'sticky',
        top: scrolled ? 0 : 64,
        transition: 'top 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
        zIndex: 50,
        overflow: 'visible',
        padding: '12px 24px 16px',
        pointerEvents: 'none',
      }}>
        <div style={{
          maxWidth: 1100,
          margin: '0 auto',
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'center',
          gap: 8,
          overflow: 'visible',
          pointerEvents: 'auto',
        }}>
          {CATEGORIES.map((cat, i) => (
            <div key={cat.key} style={{ flex: windowWidth < 640 ? '0 0 calc(50% - 4px)' : '0 0 auto', overflow: 'visible' }}>
              <GlassPill
                text={cat.key}
                emoji={cat.emoji}
                href={`/templates?category=${encodeURIComponent(cat.key)}`}
                velocity={scrollVelocity}
                subcategories={cat.subcategories}
                fullWidth={windowWidth < 640}
                isOpen={activeCategory === i}
                onToggle={() => setActiveCategory(activeCategory === i ? null : i)}
              />
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
