'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { categoryPath, slugFromCategory } from '@/app/lib/slugs';


interface Template {
  id: string;
  name: string;
  category: string;
  subcategory?: string;
  thumbnailSrc: string;
  backgroundSrc: string;
  style: { canvasWidth: number; canvasHeight: number };
}

const THUMB_H = 260;
const CATEGORY_META: { key: string; icon: string }[] = [
  { key: "It's a Boy",    icon: '👶🏻' },
  { key: "It's a Girl",   icon: '🎀' },
  { key: 'Upsherin',      icon: '✂️' },
  { key: 'Bar Mitzvah',   icon: '⓭' },
  { key: 'Tenoyim',       icon: '📜' },
  { key: 'Bavarfen',      icon: '🥂' },
  { key: 'Wedding',       icon: '💍' },
  { key: 'Sheva Brachos', icon: '🍷' },
];
const CATEGORY_ORDER = CATEGORY_META.map(c => c.key);


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
          onError={(e) => {
            const img = e.target as HTMLImageElement;
            const thumbPng = template.thumbnailSrc.replace('.webp', '.png');
            if (img.src !== thumbPng && thumbPng.endsWith('.png')) {
              img.src = thumbPng;
            } else {
              img.src = template.backgroundSrc;
            }
          }}
        />
      </div>
    </Link>
  );
}

function CategoryRow({ category, templates }: { category: string; templates: Template[] }) {
  const [viewAllRipples, setViewAllRipples] = useState<{ id: number; x: number; y: number; size: number }[]>([]);
  const viewAllRippleId = useRef(0);
  const addViewAllRipple = (e: React.MouseEvent<HTMLAnchorElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const size = Math.max(rect.width, rect.height) * 2.2;
    const id = viewAllRippleId.current++;
    setViewAllRipples(r => [...r, { id, x, y, size }]);
    setTimeout(() => setViewAllRipples(r => r.filter(rp => rp.id !== id)), 550);
  };
  const scrollRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const hasDragged = useRef(false);
  const startX = useRef(0);
  const startScrollLeft = useRef(0);
  const pendingDx = useRef<number | null>(null);
  const rafId = useRef<number | null>(null);
  const momentumId = useRef<number | null>(null);
  const lastMoveX = useRef(0);
  const lastMoveT = useRef(0);
  const velocity = useRef(0);
  const [grabbing, setGrabbing] = useState(false);

  const stopMomentum = () => {
    if (momentumId.current !== null) {
      cancelAnimationFrame(momentumId.current);
      momentumId.current = null;
    }
  };

  const onMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    e.preventDefault(); // prevent browser native drag-and-drop hijack; click still fires
    stopMomentum();
    dragging.current = true;
    hasDragged.current = false;
    startX.current = e.clientX;
    startScrollLeft.current = scrollRef.current?.scrollLeft ?? 0;
    lastMoveX.current = e.clientX;
    lastMoveT.current = performance.now();
    velocity.current = 0;
    setGrabbing(true);

    const flush = () => {
      rafId.current = null;
      if (pendingDx.current === null || !scrollRef.current) return;
      scrollRef.current.scrollLeft = startScrollLeft.current - pendingDx.current;
      pendingDx.current = null;
    };

    const onMove = (ev: MouseEvent) => {
      if (!dragging.current) return;
      const dx = ev.clientX - startX.current;
      if (Math.abs(dx) > 4) hasDragged.current = true;

      const now = performance.now();
      const dt = now - lastMoveT.current;
      if (dt > 0) velocity.current = (ev.clientX - lastMoveX.current) / dt; // px/ms
      lastMoveX.current = ev.clientX;
      lastMoveT.current = now;

      pendingDx.current = dx;
      if (rafId.current === null) rafId.current = requestAnimationFrame(flush);
    };
    const onUp = () => {
      dragging.current = false;
      setGrabbing(false);
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      if (rafId.current !== null) {
        cancelAnimationFrame(rafId.current);
        rafId.current = null;
        flush(); // apply any pending position before momentum takes over
      }

      // Inertia: ease out from release velocity (px/ms -> px/frame at ~60fps)
      let v = velocity.current * 16;
      const friction = 0.94;
      const step = () => {
        if (!scrollRef.current || Math.abs(v) < 0.5) {
          momentumId.current = null;
          return;
        }
        scrollRef.current.scrollLeft -= v;
        v *= friction;
        momentumId.current = requestAnimationFrame(step);
      };
      if (Math.abs(v) > 0.5) momentumId.current = requestAnimationFrame(step);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  const onClickCapture = (e: React.MouseEvent) => {
    // Capture phase fires before the Link child — cancel navigation if user dragged
    if (hasDragged.current) {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  const onContextMenu = (e: React.MouseEvent) => {
    if (dragging.current) e.preventDefault();
  };

  useEffect(() => {
    return () => {
      if (rafId.current !== null) cancelAnimationFrame(rafId.current);
      stopMomentum();
    };
  }, []);


  return (
    <section style={{ marginBottom: 48 }}>
      {/* Row header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 24px', marginBottom: 12,
      }}>
        <h2 style={{
          fontSize: 16, fontWeight: 700,
          color: 'var(--row-heading-color)', opacity: 'var(--row-heading-opacity)' as never, margin: 0,
        }}>
          {category}
        </h2>
        <a
          href={`/templates/${slugFromCategory(category)}`}
          onMouseDown={addViewAllRipple}
          style={{ position: 'relative', overflow: 'hidden', background: 'none', border: 'none', borderRadius: 9999, cursor: 'pointer', fontSize: '0.9rem', fontWeight: 500, color: '#555', padding: '4px 6px', display: 'inline-flex', alignItems: 'center', gap: 6, textDecoration: 'none' }}
        >
          {viewAllRipples.map(r => (
            <span key={r.id} className="pill-ripple" style={{ left: r.x - r.size / 2, top: r.y - r.size / 2, width: r.size, height: r.size }} />
          ))}
          View all →
        </a>
      </div>

      {/* Horizontal scroll */}
      <div
        ref={scrollRef}
        onMouseDown={onMouseDown}
        onClickCapture={onClickCapture}
        onContextMenu={onContextMenu}
        style={{
          overflowX: 'auto',
          scrollbarWidth: 'none',
          paddingLeft: 24,
          paddingRight: 24,
          cursor: grabbing ? 'grabbing' : 'grab',
          userSelect: 'none',
          willChange: 'scroll-position',
        }}
      >
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
