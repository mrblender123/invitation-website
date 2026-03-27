'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';

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
}

export default function GlassPill({
  text, emoji, href, onClick, velocity = 0, subcategories, fullWidth,
  isOpen: controlledOpen, onToggle, disabled, active, replace,
}: GlassPillProps) {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);
  const [isPressed, setIsPressed] = useState(false);
  const [internalOpen, setInternalOpen] = useState(false);
  const [scrollOpacity, setScrollOpacity] = useState(1);
  const [scrollOffset, setScrollOffset] = useState(0);
  const pillRef = useRef<HTMLDivElement>(null);

  const hasDropdown = subcategories && subcategories.length > 0;
  const isControlled = onToggle !== undefined;
  const dropOpen = isControlled ? (controlledOpen ?? false) : internalOpen;

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

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!pillRef.current) return;
    const rect = pillRef.current.getBoundingClientRect();
    setMousePosition({ x: e.clientX - rect.left, y: e.clientY - rect.top });
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
  const interactionScale = isPressed ? 0.92 : isHovered ? 1.06 : 1.0;
  const isNumeric = emoji === '⓭';

  const pillEl = (
    <div
      ref={pillRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => { setIsHovered(false); setIsPressed(false); }}
      onMouseDown={() => setIsPressed(true)}
      onMouseUp={() => setIsPressed(false)}
      style={{
        position: 'relative',
        width: fullWidth ? '100%' : undefined,
        minHeight: fullWidth ? 44 : undefined,
        padding: fullWidth ? '10px 16px' : '9px 16px',
        borderRadius: 9999,
        cursor: disabled ? 'not-allowed' : 'pointer',
        userSelect: 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: fullWidth ? 'center' : undefined,
        overflow: 'visible',
        zIndex: 50,
        opacity: disabled ? 0.5 : scrollOpacity,
        pointerEvents: scrollOpacity < 0.1 ? 'none' : 'auto',
        transform: `scale(${interactionScale + cappedVelocity * 0.08}) translateY(${scrollOffset}px)`,
        transition: isPressed
          ? 'transform 0.1s ease-out, opacity 0.1s ease-out'
          : 'transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.2s ease-out',
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
        position: 'absolute', inset: 0, borderRadius: 9999,
        pointerEvents: 'none', overflow: 'hidden',
        filter: 'blur(8px)',
        opacity: isHovered ? 0.50 : 0.20,
        transition: 'opacity 700ms',
      }}>
        <div style={{ position: 'absolute', inset: '0 auto 0 -8px', width: 40, background: 'rgba(59,130,246,0.20)' }} />
        <div style={{ position: 'absolute', inset: '0 -8px 0 auto', width: 40, background: 'rgba(236,72,153,0.20)' }} />
      </div>
      {/* 2. Base glass body */}
      <div style={{
        position: 'absolute', inset: 0, borderRadius: 9999,
        background: active ? 'rgba(59,130,246,0.10)' : 'rgba(255,255,255,0.50)',
        backdropFilter: 'blur(60px)',
        WebkitBackdropFilter: 'blur(60px)',
        border: isPressed ? '1.5px solid rgba(59,130,246,0.30)' : active ? '1.5px solid rgba(59,130,246,0.40)' : '1.5px solid rgba(255,255,255,0.90)',
        boxShadow: isPressed
          ? 'inset 0 8px 20px rgba(59,130,246,0.15), inset 0 -2px 10px rgba(255,255,255,0.9)'
          : active
          ? 'inset 0 8px 20px rgba(59,130,246,0.10), inset 0 -4px 12px rgba(255,255,255,0.9)'
          : 'inset 0 12px 24px rgba(255,255,255,1), inset 0 -10px 20px rgba(0,0,0,0.05), 0 10px 30px -10px rgba(0,0,0,0.10)',
        transition: 'box-shadow 300ms, border 300ms',
      }} />
      {/* 3. Click bubble */}
      <div style={{
        position: 'absolute', inset: 0, borderRadius: 9999,
        background: 'rgba(59,130,246,0.10)',
        filter: 'blur(16px)',
        opacity: isPressed ? 1 : 0,
        transition: 'opacity 300ms',
        pointerEvents: 'none',
      }} />
      {/* 4. Fresnel top rim */}
      <div style={{
        position: 'absolute', inset: 0.5, borderRadius: 9999,
        borderTop: '1.5px solid white', pointerEvents: 'none', zIndex: 20,
      }} />
      {/* 5. Surface glare */}
      <div style={{
        position: 'absolute', top: 1.2, left: '8%', width: '84%', height: '40%',
        borderRadius: '100% 100% 0 0',
        background: 'linear-gradient(to bottom, rgba(255,255,255,0.95), transparent)',
        pointerEvents: 'none', zIndex: 20,
        opacity: isPressed ? 0.40 : 1,
        transform: isPressed ? 'translateY(4px) scale(0.95)' : 'none',
        transition: 'opacity 300ms, transform 300ms',
      }} />
      {/* 6. Subsurface scatter */}
      <div style={{
        position: 'absolute', inset: 0, borderRadius: 9999,
        pointerEvents: 'none', overflow: 'hidden', mixBlendMode: 'overlay',
      }}>
        <div style={{
          position: 'absolute', width: 160, height: 160, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(59,130,246,0.4) 0%, transparent 70%)',
          left: mousePosition.x - 80, top: mousePosition.y - 80,
          filter: 'blur(36px)',
          opacity: isHovered && !isPressed ? 0.8 : 0,
          transition: 'opacity 500ms',
        }} />
      </div>
      {/* 7. Content */}
      <div style={{
        position: 'relative', zIndex: 30,
        display: 'flex', alignItems: 'center',
        gap: 6,
        transform: isPressed ? 'scale(0.90)' : 'scale(1)',
        opacity: isPressed ? 0.70 : 1,
        transition: 'transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.5s',
      }}>
        {emoji && (
          <span style={{
            fontSize: isNumeric ? '1rem' : '1.1rem',
            fontFamily: isNumeric ? 'var(--font-playfair)' : undefined,
            fontWeight: isNumeric ? 700 : undefined,
            lineHeight: 1,
            filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.15))',
          }}>{emoji}</span>
        )}
        <span style={{
          fontSize: fullWidth ? '0.94rem' : '0.88rem',
          fontWeight: 700,
          fontStyle: 'italic',
          letterSpacing: '-0.01em',
          color: active ? 'rgb(59,130,246)' : '#0f172a',
          lineHeight: 1,
          whiteSpace: 'nowrap',
        }}>
          {text}
        </span>
        {hasDropdown && (
          <svg
            width="14" height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke={dropOpen ? 'rgba(59,130,246,0.8)' : 'rgba(100,116,139,0.7)'}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              transform: dropOpen ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 300ms, stroke 300ms',
              flexShrink: 0,
            }}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        )}
      </div>
      {/* 8. Outer rim */}
      <div style={{
        position: 'absolute', inset: -0.8, borderRadius: 9999,
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
              padding: '10px 20px', borderRadius: 9999,
              fontSize: 13, fontWeight: 700, fontStyle: 'italic',
              color: '#334155', textDecoration: 'none', whiteSpace: 'nowrap', display: 'flex', justifyContent: 'center',
              transition: 'background 0.15s, color 0.15s, transform 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.80)'; e.currentTarget.style.color = 'rgb(59,130,246)'; e.currentTarget.style.transform = 'scale(1.05)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#334155'; e.currentTarget.style.transform = 'scale(1)'; }}
          >
            All {text}
          </Link>
          {subcategories!.map((sub, idx) => (
            <Link
              key={sub}
              href={`${href}&subcategory=${encodeURIComponent(sub)}`}
              style={{
                padding: '10px 20px', borderRadius: 9999,
                fontSize: 13, fontWeight: 700, fontStyle: 'italic',
                color: '#334155', textDecoration: 'none', whiteSpace: 'nowrap', display: 'flex', justifyContent: 'center',
                transition: `background 0.15s ${idx * 30}ms, color 0.15s, transform 0.15s`,
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.80)'; e.currentTarget.style.color = 'rgb(59,130,246)'; e.currentTarget.style.transform = 'scale(1.05)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#334155'; e.currentTarget.style.transform = 'scale(1)'; }}
            >
              {sub}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
