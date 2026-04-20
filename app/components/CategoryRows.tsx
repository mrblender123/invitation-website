'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import GlassPill from './GlassPill';

interface Template {
  id: string;
  name: string;
  category: string;
  subcategory?: string;
  thumbnailSrc: string;
  style: { canvasWidth: number; canvasHeight: number };
}

const THUMB_H = 260;
const CATEGORY_META: { key: string; icon: string }[] = [
  { key: "It's a Boy",    icon: '👶🏻' },
  { key: "It's a Girl",   icon: '🎀' },
  { key: 'Upsherin',      icon: '✂️' },
  { key: 'Bar Mitzvah',   icon: '⓭' },
  { key: 'Tenoyim',       icon: '📜' },
  { key: 'Vort',          icon: '🥂' },
  { key: 'Wedding',       icon: '💍' },
  { key: 'Sheva Brachos', icon: '🍷' },
];
const CATEGORY_ORDER = CATEGORY_META.map(c => c.key);
const CATEGORY_ICON: Record<string, string> = Object.fromEntries(CATEGORY_META.map(c => [c.key, c.icon]));


function TemplateThumb({ template }: { template: Template }) {
  const [hovered, setHovered] = useState(false);
  const ratio = template.style.canvasWidth / template.style.canvasHeight;
  const w = Math.round(THUMB_H * ratio);

  return (
    <Link
      href={`/templates?template=${encodeURIComponent(template.id)}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        width: w,
        borderRadius: 16,
        overflow: 'hidden',
        border: hovered ? '2px solid rgba(180,180,195,0.85)' : '2px solid transparent',
        boxShadow: hovered ? '0 0 0 1px rgba(255,255,255,0.6), inset 0 0 0 1px rgba(255,255,255,0.4)' : 'none',
        transition: 'border 0.18s, box-shadow 0.18s',
        textDecoration: 'none',
      }}
    >
      <div style={{ width: '100%', height: THUMB_H, flexShrink: 0 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={template.thumbnailSrc}
          alt={template.name}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          draggable={false}
        />
      </div>
    </Link>
  );
}

function CategoryRow({ category, templates }: { category: string; templates: Template[] }) {
  return (
    <section style={{ marginBottom: 48 }}>
      {/* Row header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 24px', marginBottom: 12,
      }}>
        <h2 style={{
          fontSize: 16, fontWeight: 700,
          color: 'var(--foreground)', margin: 0,
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <span style={{
            fontSize: CATEGORY_ICON[category] === '⓭' ? 24 : 20,
            fontFamily: CATEGORY_ICON[category] === '⓭' ? 'var(--font-playfair)' : undefined,
            fontWeight: CATEGORY_ICON[category] === '⓭' ? 700 : undefined,
            lineHeight: 1,
            verticalAlign: 'middle',
            position: 'relative',
            top: CATEGORY_ICON[category] === '⓭' ? '-1px' : undefined,
          }}>
            {CATEGORY_ICON[category] ?? ''}
          </span>
          {category}
        </h2>
        <GlassPill
          text="View all →"
          href={`/templates?category=${encodeURIComponent(category)}`}
        />
      </div>

      {/* Horizontal scroll */}
      <div style={{
        overflowX: 'auto',
        scrollbarWidth: 'none',
        paddingLeft: 24,
        paddingRight: 24,
      }}>
        <div style={{ display: 'flex', gap: 12, width: 'max-content', paddingBottom: 4 }}>
          {templates.map(t => (
            <TemplateThumb key={t.id} template={t} />
          ))}
        </div>
      </div>
    </section>
  );
}

export default function CategoryRows() {
  const [byCategory, setByCategory] = useState<Record<string, Template[]>>({});

  useEffect(() => {
    fetch('/api/templates', { cache: 'no-store' })
      .then(r => r.json())
      .then(({ templates }: { templates: Template[] }) => {
        const grouped: Record<string, Template[]> = {};
        for (const t of templates) {
          if (!grouped[t.category]) grouped[t.category] = [];
          grouped[t.category].push(t);
        }
        setByCategory(grouped);
      });
  }, []);

  const categories = CATEGORY_ORDER.filter(c => (byCategory[c]?.length ?? 0) > 0);
  // Also include any categories from the API not in CATEGORY_ORDER
  for (const c of Object.keys(byCategory)) {
    if (!categories.includes(c)) categories.push(c);
  }

  if (categories.length === 0) {
    return <div style={{ padding: '60px 24px', textAlign: 'center', color: 'var(--muted)' }}>Loading...</div>;
  }

  return (
    <div style={{ paddingTop: 40, paddingBottom: 80, maxWidth: 1100, margin: '0 auto' }}>
      {categories.map(cat => (
        <CategoryRow key={cat} category={cat} templates={byCategory[cat]} />
      ))}
    </div>
  );
}
