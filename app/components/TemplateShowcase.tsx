'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import SvgCardPreview from './SvgCardPreview';
import InvitationCard from './InvitationCard';
import type { Template } from '@/lib/templates';

const THUMB_H = 220;

function TemplateCard({ template }: { template: Template }) {
  const router = useRouter();
  const [hovered, setHovered] = useState(false);
  const { style } = template;
  const scale = THUMB_H / style.canvasHeight;
  const thumbW = Math.round(style.canvasWidth * scale);
  const gradId = `ts-${template.id}`;

  return (
    <div
      onClick={() => router.push(`/templates?category=${encodeURIComponent(template.category)}`)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'relative',
        width: thumbW,
        height: THUMB_H,
        borderRadius: 12,
        overflow: 'hidden',
        cursor: 'pointer',
        flexShrink: 0,
        boxShadow: hovered
          ? '0 24px 60px rgba(0,0,0,0.8), 0 0 32px rgba(255,255,255,0.08)'
          : '0 8px 32px rgba(0,0,0,0.5)',
        transition: 'box-shadow 0.4s ease, transform 0.4s ease',
        transform: hovered ? 'translateY(-4px)' : 'none',
      }}
    >
      {template.textSvg ? (
        <SvgCardPreview template={template} fieldValues={{}} scale={scale} />
      ) : (
        <div style={{
          width: style.canvasWidth,
          height: style.canvasHeight,
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
          pointerEvents: 'none',
        }}>
          <InvitationCard
            eventTitle="" hostName="" dateTime=""
            backgroundImage={template.thumbnailSrc}
            overlayOpacity={style.overlayOpacity ?? 0}
            glowIntensity={style.glowIntensity ?? 0}
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

      {/* Hover overlay */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, transparent 55%)',
        display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
        padding: 12, opacity: hovered ? 1 : 0, transition: 'opacity 0.2s', pointerEvents: 'none',
      }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: '#fff', margin: 0, fontFamily: 'var(--font-playfair)' }}>{template.name}</p>
        <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', margin: '2px 0 0' }}>{template.category}</p>
      </div>

      {/* Border */}
      <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 10 }}
        viewBox={`0 0 ${thumbW} ${THUMB_H}`} xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%"   stopColor="#3f3f46" />
            <stop offset="45%"  stopColor="#a1a1aa" />
            <stop offset="50%"  stopColor="#ffffff" />
            <stop offset="55%"  stopColor="#a1a1aa" />
            <stop offset="100%" stopColor="#27272a" />
          </linearGradient>
        </defs>
        <rect x="1" y="1" width={thumbW - 2} height={THUMB_H - 2} rx="11"
          fill="none" stroke="white" strokeWidth="8"
          style={{ opacity: hovered ? 0.35 : 0, transition: 'opacity 0.6s ease', filter: 'blur(6px)' }} />
        <rect x="0.5" y="0.5" width={thumbW - 1} height={THUMB_H - 1} rx="11.5"
          fill="none" stroke={`url(#${gradId})`} strokeWidth="1" />
      </svg>
    </div>
  );
}

export default function TemplateShowcase() {
  const router = useRouter();
  const [templates, setTemplates] = useState<Template[]>([]);

  useEffect(() => {
    fetch('/api/templates')
      .then(r => r.json())
      .then(({ templates: data }) => setTemplates(data ?? []));
  }, []);

  if (templates.length === 0) return null;

  return (
    <section style={{ padding: '0 0 120px' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 24px' }}>
        <p style={{ textAlign: 'center', fontSize: 13, fontWeight: 500, letterSpacing: '0.1em', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', marginBottom: 16 }}>
          Our designs
        </p>
        <h2 style={{
          fontFamily: 'var(--font-playfair)', fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 700,
          textAlign: 'center', letterSpacing: '-0.02em', marginBottom: 16, color: '#fff',
        }}>
          Browse Templates
        </h2>
        <p style={{ textAlign: 'center', fontSize: 15, color: 'rgba(255,255,255,0.4)', marginBottom: 48 }}>
          Click any design to customize it for your simcha.
        </p>
      </div>

      {/* Scrollable row */}
      <div style={{
        overflowX: 'auto',
        paddingBottom: 16,
        scrollbarWidth: 'none',
        msOverflowStyle: 'none',
      }}>
        <div style={{
          display: 'flex',
          gap: 20,
          padding: '8px 48px',
          width: 'max-content',
        }}>
          {templates.map(template => (
            <div key={template.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
              <TemplateCard template={template} />
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', margin: 0 }}>{template.category}</p>
            </div>
          ))}
        </div>
      </div>

      {/* View all button */}
      <div style={{ textAlign: 'center', marginTop: 40 }}>
        <button
          onClick={() => router.push('/templates')}
          className="silver-btn"
          style={{ padding: '12px 32px', fontSize: 15 }}
        >
          View All Templates →
        </button>
      </div>
    </section>
  );
}
