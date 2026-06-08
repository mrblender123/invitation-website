'use client';

import { useState, useEffect, useRef } from 'react';
import GlassPill from './GlassPill';

const HEADER = {
  height:    52,
  topOffset: 12,
  fontSize:  20,
};

const CATEGORIES = [
  { key: "It's a Boy",    emoji: '👶🏻', subcategories: ['Bris', 'Pidyon Haben', "Shlishi L'milah", 'Shulem Zucher', 'Vachnacht-Bris'] },
  { key: "It's a Girl",   emoji: '🎀' },
  { key: 'Upsherin',      emoji: '✂️' },
  { key: 'Bar Mitzvah',   emoji: '⓭' },
  { key: 'Tenoyim',       emoji: '📜' },
  { key: 'Bavarfen',      emoji: '🥂' },
  { key: 'Wedding',       emoji: '💍' },
  { key: 'Sheva Brachos', emoji: '🍷' },
];



export default function LandingHeader() {
  const [scrollVelocity, setScrollVelocity] = useState(0);
  const [activeCategory, setActiveCategory] = useState<number | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const [windowWidth, setWindowWidth] = useState(1200);

  const pillsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = pillsRef.current;
    if (!el) return;
    const update = () => {
      const h = 64 + el.offsetHeight + 12;
      document.documentElement.style.setProperty('--pills-bottom', `${h}px`);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

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
      {/* Full-width frosted backdrop — covers header + category pills seamlessly */}
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0,
        height: 'var(--pills-bottom, 160px)',
        zIndex: 49,
        pointerEvents: 'none',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        maskImage: 'linear-gradient(to bottom, black 75%, transparent 100%)',
        WebkitMaskImage: 'linear-gradient(to bottom, black 75%, transparent 100%)',
      }} />

      {/* Fixed header row */}
      <div style={{
        position: 'fixed', top: HEADER.topOffset, left: '50%',
        transform: 'translateX(-50%) translateY(0)',
        width: 'calc(100% - 48px)',
        maxWidth: 1100,
        height: HEADER.height,
        zIndex: 100,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        pointerEvents: 'none',
        transition: 'transform 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
      }}>
        {/* Logo — left */}
        <a href="/" style={{ pointerEvents: 'auto', paddingLeft: 20, display: 'flex', alignItems: 'center' }}>
          <img src="/logo.svg" alt="Joy Note" style={{ height: 40, width: 'auto' }} />
        </a>

        {/* Right — About + WhatsApp */}
        <div style={{ pointerEvents: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          <a href="/about" style={{ background: 'none', border: '1px solid rgba(0,0,0,0.18)', borderRadius: 9999, fontSize: '0.9rem', fontWeight: 500, color: '#555', padding: '6px 16px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>
            About
          </a>
          <a
            href="mailto:info@joy-note.com"
            title="Email us"
            style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 34, height: 34, borderRadius: 9999, border: '1px solid rgba(0,0,0,0.18)' }}
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="4" width="20" height="16" rx="2"/>
              <path d="M2 7l10 7 10-7"/>
            </svg>
          </a>
        </div>
      </div>

      {/* Spacer for fixed header */}
      <div style={{ height: 76 }} />

      {/* Sticky category pills */}
      <div ref={pillsRef} style={{
        position: 'sticky',
        top: 64,
        zIndex: 50,
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
