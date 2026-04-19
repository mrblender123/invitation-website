'use client';

import { useState, useEffect } from 'react';
import GlassPill from './GlassPill';

// ── Header style controls ─────────────────────────────────────────────────────
const HEADER = {
  // Size & position
  height:    52,       // height in px
  maxWidth:  1200,     // max width in px
  topOffset: 12,       // gap from top of screen in px
  sideMargin: 48,      // total left+right margin (e.g. 48 = 24px each side)
  padding:   '0 32px', // inner padding

  // Background
  background: 'rgba(180,180,185,0.35)',  // main fill color + opacity

  // Blur / frosted glass
  blur:      16,   // backdrop blur in px
  saturate:  1.2,  // backdrop saturate multiplier

  // Border
  border: '1px solid rgba(200,200,205,0.50)',

  // Shadow (inner glow + drop shadow)
  boxShadow: '0 2px 12px rgba(0,0,0,0.08)',

  // Text
  fontSize:   20,
  fontColor:  '#0f172a',

  // Decorative layers — set opacity to 0 to hide
  chromaticOpacity: 0,     // left/right edge color fringe
  glareOpacity:     0,     // top white shine
  fresnelRim:       false, // top inner white line
  outerRim:         false, // faint outer border ring
};
// ─────────────────────────────────────────────────────────────────────────────

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

export default function LandingHeader() {
  const [scrollVelocity, setScrollVelocity] = useState(0);
  const [activeCategory, setActiveCategory] = useState<number | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const [windowWidth, setWindowWidth] = useState(1200);

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

  return (
    <>
      {/* Fixed thin top bar — just Pintle + About */}
      <header style={{
        position: 'fixed',
        top: HEADER.topOffset, left: '50%',
        transform: scrolled ? `translateX(-50%) translateY(calc(-100% - ${HEADER.topOffset}px))` : 'translateX(-50%) translateY(0)',
        width: `calc(100% - ${HEADER.sideMargin}px)`,
        maxWidth: HEADER.maxWidth,
        height: HEADER.height,
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: HEADER.padding,
        pointerEvents: 'none',
        background: HEADER.background,
        backdropFilter: `blur(${HEADER.blur}px) saturate(${HEADER.saturate})`,
        WebkitBackdropFilter: `blur(${HEADER.blur}px) saturate(${HEADER.saturate})`,
        borderRadius: 9999,
        border: HEADER.border,
        boxShadow: HEADER.boxShadow,
        transition: 'transform 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
        overflow: 'hidden',
      }}>
        {/* Chromatic aberration */}
        <div style={{ position: 'absolute', inset: 0, borderRadius: 9999, pointerEvents: 'none', filter: 'blur(8px)', opacity: HEADER.chromaticOpacity }}>
          <div style={{ position: 'absolute', inset: '0 auto 0 -8px', width: 40, background: 'rgba(148,163,184,0.25)' }} />
          <div style={{ position: 'absolute', inset: '0 -8px 0 auto', width: 40, background: 'rgba(203,213,225,0.25)' }} />
        </div>
        {/* Fresnel top rim */}
        {HEADER.fresnelRim && <div style={{ position: 'absolute', inset: 0.5, borderRadius: 9999, borderTop: '1.5px solid white', pointerEvents: 'none' }} />}
        {/* Surface glare */}
        <div style={{ position: 'absolute', top: 1.2, left: '8%', width: '84%', height: '40%', borderRadius: '100% 100% 0 0', background: `linear-gradient(to bottom, rgba(255,255,255,${HEADER.glareOpacity}), transparent)`, pointerEvents: 'none' }} />
        {/* Outer rim */}
        {HEADER.outerRim && <div style={{ position: 'absolute', inset: -0.8, borderRadius: 9999, border: '1px solid rgba(203,213,225,0.20)', pointerEvents: 'none' }} />}

        <a href="/" style={{
          position: 'relative', zIndex: 10,
          pointerEvents: 'auto',
          fontFamily: 'var(--font-playfair)',
          fontSize: HEADER.fontSize,
          fontWeight: 700,
          fontStyle: 'italic',
          color: HEADER.fontColor,
          textDecoration: 'none',
          letterSpacing: '-0.01em',
          transition: 'color 0.2s',
        }}
          onMouseOver={e => (e.currentTarget.style.color = 'rgba(15,23,42,1)')}
          onMouseOut={e => (e.currentTarget.style.color = HEADER.fontColor)}
        >
          Pintle
        </a>
        <a href="/about" style={{
          position: 'relative', zIndex: 10,
          pointerEvents: 'auto',
          fontFamily: 'var(--font-playfair)',
          fontSize: HEADER.fontSize,
          fontWeight: 700,
          fontStyle: 'italic',
          color: HEADER.fontColor,
          textDecoration: 'none',
          letterSpacing: '-0.01em',
          transition: 'color 0.2s',
        }}
          onMouseOver={e => (e.currentTarget.style.color = 'rgba(15,23,42,1)')}
          onMouseOut={e => (e.currentTarget.style.color = HEADER.fontColor)}
        >
          About
        </a>
      </header>

      {/* Spacer for fixed header */}
      <div style={{ height: 76 }} />

      {/* Sticky category pills — in page flow, sticks below the fixed header */}
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
