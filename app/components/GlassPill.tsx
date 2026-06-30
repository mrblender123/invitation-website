'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import Emoji from './Emoji';

interface GlassPillProps {
  text: string;
  emoji?: string;
  href?: string;
  onClick?: () => void;
  velocity?: number;
  subcategories?: string[];
  fullWidth?: boolean;
  isOpen?: boolean;
  onToggle?: () => void;
  disabled?: boolean;
  active?: boolean;
  replace?: boolean;
  hoverColor?: string;
  variant?: 'glass' | 'flat';
  /** Adds a white tint to the flat variant's background so it stays visible over dark images. */
  tinted?: boolean;
}

export default function GlassPill({
  text, emoji, href, onClick, velocity = 0, subcategories, fullWidth,
  isOpen: controlledOpen, onToggle, disabled, active, replace, hoverColor,
  variant = 'glass', tinted,
}: GlassPillProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [internalOpen, setInternalOpen] = useState(false);
  const [scrollOpacity, setScrollOpacity] = useState(1);
  const [scrollOffset, setScrollOffset] = useState(0);
  const [ripples, setRipples] = useState<{ id: number; x: number; y: number; size: number }[]>([]);
  const pillRef = useRef<HTMLDivElement>(null);
  const rippleId = useRef(0);

  const hasDropdown = subcategories && subcategories.length > 0;
  const isControlled = onToggle !== undefined;
  const dropOpen = isControlled ? (controlledOpen ?? false) : internalOpen;
  const isFlat = variant === 'flat';

  useEffect(() => {
    const handleFade = () => {
      if (!pillRef.current) return;
      const rect = pillRef.current.getBoundingClientRect();
      const startFade = 60;
      const endFade = -10;
      if (rect.top < startFade) {
        const progress = Math.max(0, (rect.top - endFade) / (startFade - endFade));
        setScrollOpacity(Math.pow(progress, 0.8));
        setScrollOffset((1 - progress) * -8);
      } else {
        setScrollOpacity(1);
        setScrollOffset(0);
      }
    };
    window.addEventListener('scroll', handleFade, { passive: true });
    handleFade();
    return () => window.removeEventListener('scroll', handleFade);
  }, []);

  const addRipple = (e: React.MouseEvent) => {
    if (!pillRef.current) return;
    const rect = pillRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const size = Math.max(rect.width, rect.height) * 2.2;
    const id = rippleId.current++;
    setRipples(r => [...r, { id, x, y, size }]);
    setTimeout(() => setRipples(r => r.filter(rp => rp.id !== id)), 550);
  };

  const handleClick = () => {
    if (disabled) return;
    if (isControlled && onToggle) {
      onToggle();
    } else if (hasDropdown) {
      setInternalOpen(o => !o);
    } else if (onClick) {
      onClick();
    }
  };

  const absVelocity = Math.abs(velocity);
  const cappedVelocity = Math.min(absVelocity, 0.1);
  const isNumeric = emoji === '⓭';

  const contentEl = (
    <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', gap: 6 }}>
      {emoji && (
        isNumeric ? (
          <span style={{ fontSize: '1rem', fontFamily: 'var(--font-playfair)', fontWeight: 675, lineHeight: 1 }}>{emoji}</span>
        ) : (
          <span style={{ lineHeight: 1 }}>
            <Emoji char={emoji} size="1.1rem" />
          </span>
        )
      )}
      <span style={{
        fontSize: fullWidth ? '0.84rem' : '0.78rem',
        fontFamily: 'var(--font-montserrat)',
        fontWeight: 625,
        fontStyle: 'normal',
        letterSpacing: '0.03em',
        color: '#0f172a',
        lineHeight: 1,
        whiteSpace: 'nowrap',
      }}>
        {text}
      </span>
      {hasDropdown && (
        <svg
          width="14" height="14" viewBox="0 0 24 24" fill="none"
          stroke={dropOpen ? 'rgba(100,116,139,0.9)' : 'rgba(100,116,139,0.7)'}
          strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
          style={{ transform: dropOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 300ms', flexShrink: 0 }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      )}
    </div>
  );

  const sharedPointerProps = {
    ref: pillRef,
    onMouseEnter: () => setIsHovered(true),
    onMouseLeave: () => setIsHovered(false),
    onMouseDown: addRipple,
  };

  const pillEl = isFlat ? (
    <div
      {...sharedPointerProps}
      style={{
        position: 'relative',
        width: fullWidth ? '100%' : undefined,
        minHeight: fullWidth ? 44 : undefined,
        padding: fullWidth ? '10px 16px' : '9px 16px',
        borderRadius: 'var(--pill-radius)',
        border: active ? '1.5px solid rgba(0,0,0,0.22)' : '1.5px solid rgba(0,0,0,0.18)',
        background: tinted
          ? (active ? 'rgba(255,255,255,0.35)' : isHovered ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.20)')
          : (active ? 'rgba(0,0,0,0.07)' : isHovered ? 'rgba(0,0,0,0.04)' : 'transparent'),
        cursor: disabled ? 'not-allowed' : 'pointer',
        userSelect: 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: fullWidth ? 'center' : undefined,
        overflow: 'hidden',
        opacity: disabled ? 0.5 : scrollOpacity,
        pointerEvents: scrollOpacity < 0.1 ? 'none' : 'auto',
        transform: `translateY(${scrollOffset}px)`,
        transition: 'background 180ms, opacity 0.2s ease-out',
      }}
    >
      {ripples.map(r => (
        <span
          key={r.id}
          className="pill-ripple"
          style={{
            left: r.x - r.size / 2, top: r.y - r.size / 2,
            width: r.size, height: r.size,
            background: hoverColor ?? 'var(--pill-ripple-color)',
          }}
        />
      ))}
      {contentEl}
    </div>
  ) : (
    <div
      {...sharedPointerProps}
      style={{
        position: 'relative',
        width: fullWidth ? '100%' : undefined,
        minHeight: fullWidth ? 44 : undefined,
        padding: fullWidth ? '10px 16px' : '9px 16px',
        borderRadius: 'var(--pill-radius)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        userSelect: 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: fullWidth ? 'center' : undefined,
        overflow: 'visible',
        zIndex: 50,
        opacity: disabled ? 0.5 : scrollOpacity,
        pointerEvents: scrollOpacity < 0.1 ? 'none' : 'auto',
        transform: `scale(${1 + cappedVelocity * 0.08}) translateY(${scrollOffset}px)`,
        transition: 'transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.2s ease-out',
      }}
    >
      {/* 0. Lens distortion */}
      <div style={{
        position: 'absolute', inset: -3, borderRadius: 40,
        pointerEvents: 'none', zIndex: -1,
        backdropFilter: `blur(${10 + absVelocity * 12}px) saturate(1.8)`,
        WebkitBackdropFilter: `blur(${10 + absVelocity * 12}px) saturate(1.8)`,
        maskImage: 'radial-gradient(circle at center, black 60%, transparent 100%)',
        WebkitMaskImage: 'radial-gradient(circle at center, black 60%, transparent 100%)',
      }} />
      {/* 1. Chromatic aberration */}
      <div style={{
        position: 'absolute', inset: 0, borderRadius: 'var(--pill-radius)',
        pointerEvents: 'none', overflow: 'hidden',
        filter: 'blur(8px)',
        opacity: isHovered ? 0.50 : 0.20,
        transition: 'opacity 700ms',
      }}>
        <div style={{ position: 'absolute', inset: '0 auto 0 -8px', width: 40, background: 'rgba(148,163,184,0.25)' }} />
        <div style={{ position: 'absolute', inset: '0 -8px 0 auto', width: 40, background: 'rgba(203,213,225,0.25)' }} />
      </div>
      {/* 2. Base glass body */}
      <div style={{
        position: 'absolute', inset: 0, borderRadius: 'var(--pill-radius)',
        background: active
          ? 'rgba(148,163,184,0.18)'
          : isHovered ? (hoverColor ?? 'rgba(0,0,0,0.10)') : 'rgba(255,255,255,0.50)',
        backdropFilter: 'blur(60px)',
        WebkitBackdropFilter: 'blur(60px)',
        border: active ? '1.5px solid rgba(148,163,184,0.60)' : '1.5px solid rgba(255,255,255,0.90)',
        boxShadow: active
          ? 'inset 0 8px 20px rgba(148,163,184,0.15), inset 0 -4px 12px rgba(255,255,255,0.9)'
          : 'inset 0 12px 24px rgba(255,255,255,1), inset 0 -10px 20px rgba(0,0,0,0.05), 0 10px 30px -10px rgba(0,0,0,0.10)',
        transition: 'box-shadow 300ms, border 300ms, background 250ms',
      }} />
      {/* 3. Ripple click effect */}
      <div style={{
        position: 'absolute', inset: 0, borderRadius: 'var(--pill-radius)',
        overflow: 'hidden', pointerEvents: 'none',
      }}>
        {ripples.map(r => (
          <span
            key={r.id}
            className="pill-ripple"
            style={{ left: r.x - r.size / 2, top: r.y - r.size / 2, width: r.size, height: r.size }}
          />
        ))}
      </div>
      {/* 4. Fresnel top rim */}
      <div style={{
        position: 'absolute', inset: 0.5, borderRadius: 'var(--pill-radius)',
        borderTop: '1.5px solid white', pointerEvents: 'none', zIndex: 20,
      }} />
      {/* 5. Surface glare */}
      <div style={{
        position: 'absolute', top: 1.2, left: '8%', width: '84%', height: '40%',
        borderRadius: '100% 100% 0 0',
        background: 'linear-gradient(to bottom, rgba(255,255,255,0.95), transparent)',
        pointerEvents: 'none', zIndex: 20,
      }} />
      {/* Content */}
      <div style={{ position: 'relative', zIndex: 30, display: 'flex', alignItems: 'center', gap: 6 }}>
        {emoji && (
          isNumeric ? (
            <span style={{ fontSize: '1rem', fontFamily: 'var(--font-playfair)', fontWeight: 675, lineHeight: 1, filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.15))' }}>{emoji}</span>
          ) : (
            <span style={{ lineHeight: 1, filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.15))' }}>
              <Emoji char={emoji} size="1.1rem" />
            </span>
          )
        )}
        <span style={{
          fontSize: fullWidth ? '0.84rem' : '0.78rem',
          fontFamily: 'var(--font-montserrat)',
          fontWeight: 625,
          fontStyle: 'normal',
          letterSpacing: '0.03em',
          color: active ? 'rgb(71,85,105)' : '#0f172a',
          lineHeight: 1,
          whiteSpace: 'nowrap',
        }}>
          {text}
        </span>
        {hasDropdown && (
          <svg
            width="14" height="14" viewBox="0 0 24 24" fill="none"
            stroke={dropOpen ? 'rgba(100,116,139,0.9)' : 'rgba(100,116,139,0.7)'}
            strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
            style={{ transform: dropOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 300ms, stroke 300ms', flexShrink: 0 }}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        )}
      </div>
      {/* 8. Outer rim */}
      <div style={{
        position: 'absolute', inset: -0.8, borderRadius: 'var(--pill-radius)',
        border: '1px solid rgba(203,213,225,0.20)', pointerEvents: 'none',
      }} />
    </div>
  );

  return (
    <div style={{ position: 'relative', width: fullWidth ? '100%' : 'fit-content', overflow: 'visible' }}>
      {hasDropdown || onClick ? (
        <div onClick={handleClick} style={{ cursor: disabled ? 'not-allowed' : 'pointer', width: fullWidth ? '100%' : 'fit-content' }}>
          {pillEl}
        </div>
      ) : (
        <Link href={href ?? '/'} replace={replace} style={{ textDecoration: 'none' }}>
          {pillEl}
        </Link>
      )}

      {/* Dropdown */}
      {hasDropdown && dropOpen && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 8px)',
          left: 0,
          right: 0,
          zIndex: 200,
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
          padding: 8,
          borderRadius: 28,
          background: 'rgba(255,255,255,0.60)',
          backdropFilter: 'blur(30px) saturate(180%)',
          WebkitBackdropFilter: 'blur(30px) saturate(180%)',
          border: '1px solid rgba(255,255,255,0.80)',
          boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
        }}>
          <Link
            href={href ?? '/'}
            style={{
              padding: '10px 20px', borderRadius: 'var(--pill-radius)',
              fontSize: 13, fontFamily: 'var(--font-montserrat)', fontWeight: 600, fontStyle: 'normal', letterSpacing: '0.04em',
              color: '#334155', textDecoration: 'none', whiteSpace: 'nowrap', display: 'flex', justifyContent: 'center',
              transition: 'background 0.15s, color 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.80)'; e.currentTarget.style.color = 'rgb(71,85,105)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#334155'; }}
          >
            All {text}
          </Link>
          {subcategories!.map((sub, idx) => (
            <Link
              key={sub}
              href={`${href}&subcategory=${encodeURIComponent(sub)}`}
              style={{
                padding: '10px 20px', borderRadius: 'var(--pill-radius)',
                fontSize: 13, fontFamily: 'var(--font-montserrat)', fontWeight: 600, fontStyle: 'normal', letterSpacing: '0.04em',
                color: '#334155', textDecoration: 'none', whiteSpace: 'nowrap', display: 'flex', justifyContent: 'center',
                transition: `background 0.15s ${idx * 30}ms, color 0.15s`,
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.80)'; e.currentTarget.style.color = 'rgb(71,85,105)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#334155'; }}
            >
              {sub}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
