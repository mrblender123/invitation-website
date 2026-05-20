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
        <a href="/" style={{ ...textStyle, pointerEvents: 'auto', fontFamily: 'var(--font-playfair)', fontSize: HEADER.fontSize, paddingLeft: 20 }}>
          Joy Send
        </a>

        {/* Right — About + WhatsApp */}
        <div style={{ pointerEvents: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          <a href="/about" style={{ background: 'none', border: '1px solid rgba(0,0,0,0.18)', borderRadius: 9999, fontSize: '0.9rem', fontWeight: 500, color: '#555', padding: '6px 16px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>
            About
          </a>
          <a
            href="https://wa.me/YOURNUMBERHERE"
            target="_blank" rel="noopener noreferrer"
            title="Chat on WhatsApp"
            style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 34, height: 34, borderRadius: 9999, border: '1px solid rgba(0,0,0,0.18)' }}
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
