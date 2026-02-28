'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

interface SimchaSelectorProps {
  forceOpen?: boolean;
  onClose?: () => void;
  hideButton?: boolean;
}

const SIMCHAS = [
  { key: "It's a Boy",    label: "It's a Boy",   icon: '💙', description: 'Bris & baby boy celebration' },
  { key: "It's a Girl",   label: "It's a Girl",  icon: '🎀', description: 'Baby girl celebration' },
  { key: 'Upsherin',      label: 'Upsherin',     icon: '✂️', description: 'First haircut celebration' },
  { key: 'Bar Mitzvah',   label: 'Bar Mitzvah',  icon: '13', description: 'Coming-of-age celebration' },
  { key: 'Tenoyim',       label: 'Tenoyim',      icon: '📜', description: 'Engagement contract signing' },
  { key: 'Vort',          label: 'Vort',         icon: '🥂', description: 'Engagement celebration' },
  { key: 'Wedding',       label: 'Wedding',      icon: '💍', description: 'Chuppah & reception' },
  { key: 'Sheva Brachos', label: 'Sheva Brachos',icon: '🍷', description: 'Seven blessings celebration' },
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
        borderRadius: 14,
        padding: '14px 8px',
        cursor: 'pointer',
        textAlign: 'center',
        transition: 'background 0.2s, border-color 0.2s, transform 0.2s, box-shadow 0.2s',
        transform: hovered ? 'translateY(-3px)' : 'none',
        boxShadow: hovered ? '0 12px 40px rgba(0,0,0,0.5)' : 'none',
        color: '#fff',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        width: '100%',
        aspectRatio: '1 / 1',
      }}
    >
      <span style={{ fontSize: simcha.icon === '13' ? 22 : 26, fontFamily: simcha.icon === '13' ? 'var(--font-playfair)' : undefined, fontWeight: simcha.icon === '13' ? 700 : undefined, lineHeight: 1 }}>{simcha.icon}</span>
      <span style={{ fontFamily: 'var(--font-playfair)', fontSize: 13, fontWeight: 700, letterSpacing: '-0.01em', lineHeight: 1.3 }}>
        {simcha.label}
      </span>
    </button>
  );
}

export default function SimchaSelector({ forceOpen, onClose, hideButton }: SimchaSelectorProps = {}) {
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
    setTimeout(() => { setOpen(false); onClose?.(); }, 280);
  };

  // Open when forceOpen prop becomes true
  useEffect(() => {
    if (forceOpen) openModal();
  }, [forceOpen]);

  // Lock background scroll while modal is open
  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

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
      <div style={{ position: 'relative', display: hideButton ? 'none' : 'inline-block' }}>
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
            className="simcha-panel"
            style={{
              background: 'rgba(15,15,17,0.95)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 24,
              padding: '32px 28px',
              width: '100%',
              maxWidth: 580,
              boxShadow: '0 40px 120px rgba(0,0,0,0.8)',
              opacity: visible ? 1 : 0,
              transform: visible ? 'scale(1) translateY(0)' : 'scale(0.95) translateY(16px)',
              transition: 'opacity 0.28s cubic-bezier(0.2,0,0.2,1), transform 0.28s cubic-bezier(0.2,0,0.2,1)',
            }}
          >
            {/* Header */}
            <div style={{ position: 'relative', textAlign: 'center', marginBottom: 28 }}>
              <p style={{
                fontSize: 12, fontWeight: 600, letterSpacing: '0.12em',
                color: '#fff', textTransform: 'uppercase', margin: 0,
              }}>
                What is the Simcha?
              </p>
              <button
                onClick={closeModal}
                style={{
                  position: 'absolute', top: '50%', right: 0, transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'rgba(255,255,255,0.35)', fontSize: 20, lineHeight: 1,
                  padding: '2px 6px', borderRadius: 6,
                }}
              >
                ×
              </button>
            </div>

            {/* Cards grid */}
            <div className="simcha-grid" style={{ display: 'grid', gap: 10 }}>
              {SIMCHAS.map(s => (
                <SimchaCard
                  key={s.key}
                  simcha={s}
                  onClick={() => {
                    const href = `/templates?category=${encodeURIComponent(s.key)}`;
                    setVisible(false);
                    setTimeout(() => { setOpen(false); onClose?.(); router.push(href); }, 280);
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
