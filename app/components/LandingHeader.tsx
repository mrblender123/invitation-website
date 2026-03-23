'use client';

import { useState, useEffect } from 'react';
import GlassPill from './GlassPill';

const CATEGORIES = [
  { key: "It's a Boy",    emoji: '👶🏻', subcategories: ['Bris', 'Pidyon Haben', "Shlishi L'milah", 'Shulem Zucher', 'Vachnacht', 'Vachnacht-Bris'] },
  { key: "It's a Girl",   emoji: '🎀' },
  { key: 'Upsherin',      emoji: '✂️' },
  { key: 'Bar Mitzvah',   emoji: '13' },
  { key: 'Tenoyim',       emoji: '📜' },
  { key: 'Vort',          emoji: '🥂' },
  { key: 'Wedding',       emoji: '💍' },
  { key: 'Sheva Brachos', emoji: '🍷' },
];

export default function LandingHeader() {
  const [scrollVelocity, setScrollVelocity] = useState(0);
  const [activeCategory, setActiveCategory] = useState<number | null>(null);

  useEffect(() => {
    let lastScrollY = window.scrollY;
    let frameId: ReturnType<typeof requestAnimationFrame>;

    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      const diff = currentScrollY - lastScrollY;
      setScrollVelocity(Math.min(Math.abs(diff) * 0.05, 1));
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
        top: 0, left: 0, right: 0,
        height: 64,
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 48px',
        pointerEvents: 'none',
      }}>
        <a href="/" style={{
          pointerEvents: 'auto',
          fontFamily: 'var(--font-playfair)',
          fontSize: 20,
          fontWeight: 700,
          fontStyle: 'italic',
          color: 'rgba(15,23,42,0.80)',
          textDecoration: 'none',
          letterSpacing: '-0.01em',
          transition: 'color 0.2s',
        }}
          onMouseOver={e => (e.currentTarget.style.color = 'rgba(15,23,42,1)')}
          onMouseOut={e => (e.currentTarget.style.color = 'rgba(15,23,42,0.80)')}
        >
          Pintle
        </a>
        <a href="/about" style={{
          pointerEvents: 'auto',
          fontFamily: 'var(--font-playfair)',
          fontSize: 20,
          fontWeight: 700,
          fontStyle: 'italic',
          color: 'rgba(15,23,42,0.80)',
          textDecoration: 'none',
          letterSpacing: '-0.01em',
          transition: 'color 0.2s',
        }}
          onMouseOver={e => (e.currentTarget.style.color = 'rgba(15,23,42,1)')}
          onMouseOut={e => (e.currentTarget.style.color = 'rgba(15,23,42,0.80)')}
        >
          About
        </a>
      </header>

      {/* Spacer for fixed header */}
      <div style={{ height: 64 }} />

      {/* Sticky category pills — in page flow, sticks below the fixed header */}
      <div style={{
        position: 'sticky',
        top: 64,
        zIndex: 50,
        overflow: 'visible',
        padding: '12px 16px 16px',
        pointerEvents: 'none',
      }}>
        <div style={{
          maxWidth: 1600,
          margin: '0 auto',
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'center',
          gap: 12,
          overflow: 'visible',
          pointerEvents: 'auto',
        }}>
          {CATEGORIES.map((cat, i) => (
            <div key={cat.key} style={{ flex: '1 1 130px', maxWidth: 190, minWidth: 120, overflow: 'visible' }}>
              <GlassPill
                text={cat.key}
                emoji={cat.emoji}
                href={`/templates?category=${encodeURIComponent(cat.key)}`}
                velocity={scrollVelocity}
                subcategories={cat.subcategories}
                fullWidth
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
