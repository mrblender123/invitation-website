'use client';

import { useRef } from 'react';
import { useRouter } from 'next/navigation';

export default function SilverCTAButton({ label = "Let's Get Started", href = '/new' }: { label?: string; href?: string }) {
  const bloomRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const triggerBloom = () => {
    const el = bloomRef.current;
    if (!el) return;
    el.classList.remove('btn-bloom');
    void el.offsetWidth;
    el.classList.add('btn-bloom');
  };

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button
        className="silver-btn"
        style={{ padding: '1.1rem 3.5rem', fontSize: '1.05rem' }}
        onMouseDown={triggerBloom}
        onClick={() => router.push(href)}
      >
        {label}
      </button>
      <div ref={bloomRef} className="bloom-circle" />
    </div>
  );
}
