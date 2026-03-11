'use client';

import Link from 'next/link';
import { useState } from 'react';

const CATEGORIES = [
  { key: "It's a Boy",    label: "It's a Boy",   icon: '👶🏻', description: 'Bris & baby boy celebration' },
  { key: "It's a Girl",   label: "It's a Girl",  icon: '🎀', description: 'Baby girl celebration' },
  { key: 'Upsherin',      label: 'Upsherin',     icon: '✂️', description: 'First haircut celebration' },
  { key: 'Bar Mitzvah',   label: 'Bar Mitzvah',  icon: '13', description: 'Coming-of-age celebration' },
  { key: 'Tenoyim',       label: 'Tenoyim',      icon: '📜', description: 'Engagement contract signing' },
  { key: 'Vort',          label: 'Vort',         icon: '🥂', description: 'Engagement celebration' },
  { key: 'Wedding',       label: 'Wedding',      icon: '💍', description: 'Chuppah & reception' },
  { key: 'Sheva Brachos', label: 'Sheva Brachos',icon: '🍷', description: 'Seven blessings celebration' },
];

function CategoryCard({ category }: { category: typeof CATEGORIES[0] }) {
  const [hovered, setHovered] = useState(false);

  return (
    <Link
      href={`/templates?category=${encodeURIComponent(category.key)}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        textDecoration: 'none',
        aspectRatio: '1 / 1',
        background: hovered ? 'rgba(255,255,255,0.82)' : 'rgba(255,255,255,0.62)',
        backdropFilter: 'blur(14px) saturate(1.5)',
        WebkitBackdropFilter: 'blur(14px) saturate(1.5)',
        border: hovered ? '1px solid rgba(255,255,255,0.95)' : '1px solid rgba(255,255,255,0.82)',
        borderBottom: hovered ? '1px solid rgba(0,0,0,0.09)' : '1px solid rgba(0,0,0,0.07)',
        borderRadius: 20,
        padding: 20,
        boxShadow: hovered
          ? 'inset 0 1px 0 rgba(255,255,255,0.95), 0 8px 28px rgba(0,0,0,0.10), 0 2px 6px rgba(0,0,0,0.06)'
          : 'inset 0 1px 0 rgba(255,255,255,0.92), 0 2px 12px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)',
        transition: 'all 0.2s',
        transform: hovered ? 'translateY(-4px)' : 'none',
        cursor: 'pointer',
      }}
    >
      <span style={{
        fontSize: category.icon === '13' ? 40 : 52,
        fontFamily: category.icon === '13' ? 'var(--font-playfair)' : undefined,
        fontWeight: category.icon === '13' ? 700 : undefined,
        color: category.icon === '13' ? 'var(--foreground)' : undefined,
        marginBottom: 14,
        lineHeight: 1,
        display: 'inline-block',
        transform: hovered ? 'scale(1.35) rotate(-8deg)' : 'scale(1) rotate(0deg)',
        transition: 'transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)',
      }}>
        {category.icon}
      </span>
      <span style={{ fontSize: 17, fontWeight: 600, color: 'var(--foreground)' }}>
        {category.label}
      </span>
    </Link>
  );
}

export default function CategoryGrid() {
  return (
    <section className="category-section" style={{ width: '100%', maxWidth: 1100, margin: '0 auto', padding: '0 24px 100px', position: 'relative', zIndex: 1, boxSizing: 'border-box' }}>
      <p style={{ textAlign: 'center', fontSize: 13, fontWeight: 500, letterSpacing: '0.1em', color: 'var(--muted-faint)', textTransform: 'uppercase', marginBottom: 16 }}>
        Browse by occasion
      </p>
      <h2 style={{
        fontFamily: 'var(--font-playfair)', fontSize: 'clamp(26px, 4vw, 42px)', fontWeight: 700,
        textAlign: 'center', letterSpacing: '-0.02em', marginBottom: 48, color: 'var(--foreground)',
      }}>
        What's the Simcha?
      </h2>
      <div className="category-grid" style={{ display: 'grid', gap: 16 }}>
        {CATEGORIES.map(cat => <CategoryCard key={cat.key} category={cat} />)}
      </div>
    </section>
  );
}
