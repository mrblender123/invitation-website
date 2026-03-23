'use client';

import { useRef, useState, useEffect, ReactNode, CSSProperties } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';

interface LiquidGlassProps {
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
  radius?: number;
  noTilt?: boolean;
  onClick?: () => void;
}

export default function LiquidGlass({
  children,
  className,
  style,
  radius = 24,
  noTilt = false,
  onClick,
}: LiquidGlassProps) {
  const ref = useRef<HTMLDivElement>(null);
  const filterId = useRef(`lg-${Math.random().toString(36).slice(2, 8)}`);
  const [seed, setSeed] = useState(1);

  const rawX = useMotionValue(0);
  const rawY = useMotionValue(0);
  const springX = useSpring(rawX, { stiffness: 140, damping: 20 });
  const springY = useSpring(rawY, { stiffness: 140, damping: 20 });

  const rotateX = useTransform(springY, [-1, 1], [4, -4]);
  const rotateY = useTransform(springX, [-1, 1], [-4, 4]);

  // Specular highlight follows cursor
  const highlightX = useTransform(springX, x => 50 + x * 35);
  const highlightY = useTransform(springY, y => 50 + y * 35);

  function onMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    rawX.set(((e.clientX - r.left) / r.width) * 2 - 1);
    rawY.set(((e.clientY - r.top) / r.height) * 2 - 1);
  }

  function onMouseLeave() {
    rawX.set(0);
    rawY.set(0);
  }

  useEffect(() => { setSeed(Math.floor(Math.random() * 999) + 1); }, []);

  const id = filterId.current;

  return (
    <>
      {/* SVG displacement filter — physically distorts the surface */}
      <svg width="0" height="0" style={{ position: 'absolute', pointerEvents: 'none' }}>
        <defs>
          <filter id={id} x="-20%" y="-20%" width="140%" height="140%" colorInterpolationFilters="sRGB">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.01"
              numOctaves="4"
              seed={seed}
              result="noise"
            />
            <feDisplacementMap
              in="SourceGraphic"
              in2="noise"
              scale="20"
              xChannelSelector="R"
              yChannelSelector="G"
              result="displaced"
            />
            <feComposite in="displaced" in2="SourceGraphic" operator="atop" />
          </filter>
        </defs>
      </svg>

      <motion.div
        ref={ref}
        className={className}
        onClick={onClick}
        onMouseMove={onMouseMove}
        onMouseLeave={onMouseLeave}
        style={{
          position: 'relative',
          borderRadius: radius,
          overflow: 'hidden',
          cursor: onClick ? 'pointer' : undefined,
          // 40px blur + 180% saturation prevents muddy grey
          backdropFilter: 'blur(40px) saturate(180%) brightness(1.05)',
          WebkitBackdropFilter: 'blur(40px) saturate(180%) brightness(1.05)',
          background: 'rgba(255,255,255,0.15)',
          // SVG displacement bends the painted surface
          filter: `url(#${id})`,
          willChange: 'transform, filter',
          rotateX: noTilt ? 0 : rotateX,
          rotateY: noTilt ? 0 : rotateY,
          transformStyle: 'preserve-3d',
          transformOrigin: 'center center',
          // Refined border: no flat stroke — inner glow on top, dark on bottom
          boxShadow: [
            'inset 0 1px 1px rgba(255,255,255,0.40)',  // top inner glow
            'inset 0 -1px 1px rgba(0,0,0,0.18)',        // bottom dark stroke
            'inset 1px 0 1px rgba(255,255,255,0.20)',   // left subtle glow
            'inset -1px 0 1px rgba(0,0,0,0.12)',        // right subtle dark
          ].join(', '),
          ...style,
        }}
        whileHover={{ scale: noTilt ? 1 : (onClick ? 1.015 : 1.008) }}
        transition={{ type: 'spring', stiffness: 260, damping: 24 }}
      >
        {/* Specular highlight — radial gradient tracking mouse */}
        <motion.div
          style={{
            position: 'absolute', inset: 0,
            borderRadius: radius,
            background: useTransform(
              [highlightX, highlightY] as never,
              ([x, y]: number[]) =>
                `radial-gradient(ellipse 60% 50% at ${x}% ${y}%, rgba(255,255,255,0.30) 0%, transparent 70%)`
            ),
            pointerEvents: 'none',
            zIndex: 1,
          }}
        />

        {/* Content */}
        <div style={{ position: 'relative', zIndex: 2 }}>
          {children}
        </div>
      </motion.div>
    </>
  );
}
