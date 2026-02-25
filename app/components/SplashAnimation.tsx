'use client';

import { useEffect, useRef, useState } from 'react';

const ICONS = [
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2C9.5 2 7 4 7 8c0 3.5 3 6.5 4 8v5l-1 1h4l-1-1v-5c1-1.5 4-4.5 4-8 0-4-2.5-6-5-6z"/><path d="M11 16h2"/></svg>`,
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M10 2v5.5l-2.5 3V20a2 2 0 0 0 2 2h5a2 2 0 0 0 2-2v-9.5l-2.5-3V2z"/><path d="M10 7.5h4"/></svg>`,
];

export default function SplashAnimation() {
  const [gone, setGone] = useState(false);
  const [fading, setFading] = useState(false);
  const emitterRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const emitter = emitterRef.current;
    if (!emitter) return;

    const spawnIcon = () => {
      const el = document.createElement('div');
      const size = 20 + Math.random() * 20;
      const drift = (Math.random() - 0.5) * 200;
      const rotation = (Math.random() - 0.5) * 45;
      const rotationEnd = rotation + (Math.random() - 0.5) * 180;
      const animDuration = 5 + Math.random() * 4;

      Object.assign(el.style, {
        position: 'absolute',
        pointerEvents: 'none',
        color: '#a8a5a3',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        left: `${Math.random() * 100}vw`,
        width: `${size}px`,
        height: `${size}px`,
        animationName: 'splashFloat',
        animationDuration: `${animDuration}s`,
        animationTimingFunction: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
        animationFillMode: 'forwards',
        willChange: 'transform, opacity',
      });
      el.style.setProperty('--drift', `${drift}px`);
      el.style.setProperty('--rot', `${rotation}deg`);
      el.style.setProperty('--rot-end', `${rotationEnd}deg`);
      el.innerHTML = ICONS[Math.floor(Math.random() * ICONS.length)];
      const svg = el.querySelector('svg');
      if (svg) {
        svg.style.width = '100%';
        svg.style.height = '100%';
        svg.setAttribute('stroke-width', '1.25');
      }

      emitter.appendChild(el);
      setTimeout(() => { if (emitter.contains(el)) el.remove(); }, animDuration * 1000);
    };

    for (let i = 0; i < 8; i++) spawnIcon();
    const interval = setInterval(spawnIcon, 300);

    const t1 = setTimeout(() => setFading(true), 2500);
    const t2 = setTimeout(() => { clearInterval(interval); setGone(true); }, 3000);

    return () => { clearInterval(interval); clearTimeout(t1); clearTimeout(t2); };
  }, []);

  if (gone) return null;

  return (
    <>
      <style>{`
        @keyframes splashFloat {
          0%   { opacity: 0; transform: translateY(30px) scale(0.4) rotate(0deg); }
          15%  { opacity: 0.8; transform: translateY(-5vh) scale(1.1) rotate(var(--rot)); }
          100% { opacity: 0; transform: translateY(-115vh) translateX(var(--drift)) scale(0.7) rotate(var(--rot-end)); }
        }
      `}</style>
      <div style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        pointerEvents: 'none',
        background: '#09090b',
        opacity: fading ? 0 : 1,
        transition: 'opacity 0.5s ease',
      }}>
        <div
          ref={emitterRef}
          style={{
            position: 'fixed',
            bottom: -30,
            left: 0,
            width: '100%',
            height: 1,
            pointerEvents: 'none',
          }}
        />
      </div>
    </>
  );
}
