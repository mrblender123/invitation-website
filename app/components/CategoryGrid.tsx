'use client';

import Link from 'next/link';
import { useState } from 'react';

const CATEGORIES = [
  { key: "It's a Boy",    label: "It's a Boy",   icon: '💙', description: 'Bris & baby boy celebration' },
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
        background: hovered ? 'rgba(255,255,255,0.09)' : 'rgba(255,255,255,0.04)',
        border: hovered ? '1px solid rgba(161,161,170,0.4)' : '1px solid rgba(255,255,255,0.08)',
        borderRadius: 20,
        padding: 20,
        transition: 'background 0.2s, border-color 0.2s, transform 0.2s',
        transform: hovered ? 'translateY(-4px)' : 'none',
        cursor: 'pointer',
      }}
    >
      <span style={{
        fontSize: category.icon === '13' ? 28 : 36,
        fontFamily: category.icon === '13' ? 'var(--font-playfair)' : undefined,
        fontWeight: category.icon === '13' ? 700 : undefined,
        color: category.icon === '13' ? '#fff' : undefined,
        marginBottom: 14,
        lineHeight: 1,
      }}>
        {category.icon}
      </span>
      <span style={{ fontSize: 15, fontWeight: 600, color: '#fff', marginBottom: 6 }}>
        {category.label}
      </span>
      <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', lineHeight: 1.5 }}>
        {category.description}
      </span>
    </Link>
  );
}

export default function CategoryGrid() {
  return (
    <section className="category-section" style={{ width: '100%', maxWidth: 1100, margin: '0 auto', padding: '0 24px 100px', position: 'relative', zIndex: 1, boxSizing: 'border-box' }}>
      <p style={{ textAlign: 'center', fontSize: 13, fontWeight: 500, letterSpacing: '0.1em', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', marginBottom: 16 }}>
        Browse by occasion
      </p>
      <h2 style={{
        fontFamily: 'var(--font-playfair)', fontSize: 'clamp(26px, 4vw, 42px)', fontWeight: 700,
        textAlign: 'center', letterSpacing: '-0.02em', marginBottom: 48, color: '#fff',
      }}>
        What's the Simcha?
      </h2>
      <div className="category-grid" style={{ display: 'grid', gap: 16 }}>
        {CATEGORIES.map(cat => <CategoryCard key={cat.key} category={cat} />)}
      </div>
    </section>
  );
}
