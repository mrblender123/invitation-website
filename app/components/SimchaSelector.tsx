'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

const SIMCHAS = [
  {
    key: 'Wedding',
    label: 'Wedding',
    icon: '💍',
    description: 'Chuppah, reception & celebration',
  },
  {
    key: 'Bar Mitzvah',
    label: 'Bar Mitzvah',
    icon: '✡',
    description: 'Coming-of-age celebration',
  },
  {
    key: 'Vach Nacht',
    label: 'Vach Nacht',
    icon: '🕯',
    description: 'Traditional bris eve gathering',
  },
  {
    key: 'Vort',
    label: 'Vort',
    icon: '💫',
    description: "L'chaim & engagement party",
  },
];

function SimchaCard({ simcha, onClick }: { simcha: typeof SIMCHAS[0]; onClick: () => void }) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? 'rgba(255,255,255,0.09)' : 'rgba(255,255,255,0.04)',
        border: hovered ? '1px solid rgba(161,161,170,0.4)' : '1px solid rgba(255,255,255,0.1)',
        borderRadius: 16,
        padding: '28px 20px',
        cursor: 'pointer',
        textAlign: 'center',
        transition: 'background 0.2s, border-color 0.2s, transform 0.2s, box-shadow 0.2s',
        transform: hovered ? 'translateY(-3px)' : 'none',
        boxShadow: hovered ? '0 12px 40px rgba(0,0,0,0.5)' : 'none',
        color: '#fff',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 10,
        width: '100%',
      }}
    >
      <span style={{ fontSize: 32 }}>{simcha.icon}</span>
      <span style={{ fontFamily: 'var(--font-playfair)', fontSize: 18, fontWeight: 700, letterSpacing: '-0.01em' }}>
        {simcha.label}
      </span>
      <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', lineHeight: 1.5 }}>
        {simcha.description}
      </span>
    </button>
  );
}

export default function SimchaSelector() {
  const [open, setOpen] = useState(false);
  const [visible, setVisible] = useState(false); // controls CSS transition
  const bloomRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Two-step open: mount first, then trigger transition
  const openModal = () => {
    setOpen(true);
    requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)));
  };

  const closeModal = () => {
    setVisible(false);
    setTimeout(() => setOpen(false), 280);
  };

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeModal(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const triggerBloom = () => {
    const el = bloomRef.current;
    if (!el) return;
    el.classList.remove('btn-bloom');
    void el.offsetWidth;
    el.classList.add('btn-bloom');
  };

  return (
    <>
      {/* CTA button */}
      <div style={{ position: 'relative', display: 'inline-block' }}>
        <button
          className="silver-btn"
          style={{ padding: '1.1rem 3.5rem', fontSize: '1.05rem' }}
          onMouseDown={triggerBloom}
          onClick={openModal}
        >
          Let&apos;s Get Started
        </button>
        <div ref={bloomRef} className="bloom-circle" />
      </div>

      {/* Modal overlay */}
      {open && (
        <div
          onClick={closeModal}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
            background: visible ? 'rgba(0,0,0,0.7)' : 'rgba(0,0,0,0)',
            backdropFilter: visible ? 'blur(8px)' : 'blur(0px)',
            transition: 'background 0.28s, backdrop-filter 0.28s',
          }}
        >
          {/* Panel */}
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: 'rgba(15,15,17,0.95)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 24,
              padding: '40px 36px',
              width: '100%',
              maxWidth: 560,
              boxShadow: '0 40px 120px rgba(0,0,0,0.8)',
              opacity: visible ? 1 : 0,
              transform: visible ? 'scale(1) translateY(0)' : 'scale(0.95) translateY(16px)',
              transition: 'opacity 0.28s cubic-bezier(0.2,0,0.2,1), transform 0.28s cubic-bezier(0.2,0,0.2,1)',
            }}
          >
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
              <p style={{
                fontSize: 12, fontWeight: 600, letterSpacing: '0.12em',
                color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', margin: 0,
              }}>
                What is the Simcha?
              </p>
              <button
                onClick={closeModal}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'rgba(255,255,255,0.35)', fontSize: 20, lineHeight: 1,
                  padding: '2px 6px', borderRadius: 6,
                }}
              >
                ×
              </button>
            </div>

            {/* Cards grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
              {SIMCHAS.map(s => (
                <SimchaCard
                  key={s.key}
                  simcha={s}
                  onClick={() => router.push(`/templates?category=${encodeURIComponent(s.key)}`)}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
