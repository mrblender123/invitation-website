'use client';

import { useState, useEffect } from 'react';

type BannerConfig = {
  enabled:     boolean;
  text:        string;
  link:        string;
  linkLabel:   string;
  size:        'small' | 'large';
  bgColor:     string;
  bgOpacity:   number;
  textColor:   string;
  textOpacity: number;
  accentColor: string;
  blur:        boolean;
};

function hexToRgba(hex: string, opacity: number) {
  try {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${opacity})`;
  } catch {
    return hex;
  }
}

export default function AnnouncementBanner() {
  const [cfg, setCfg] = useState<BannerConfig | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    fetch('/api/admin/banner')
      .then(r => r.json())
      .then(setCfg)
      .catch(() => {});
  }, []);

  if (!cfg || !cfg.enabled || !cfg.text || dismissed) return null;

  const isLarge = cfg.size === 'large';
  const bg = hexToRgba(cfg.bgColor ?? '#0f172a', cfg.bgOpacity ?? 1);
  const tc = hexToRgba(cfg.textColor ?? '#ffffff', cfg.textOpacity ?? 1);

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 200,
      background: bg,
      backdropFilter: cfg.blur ? 'blur(12px)' : undefined,
      WebkitBackdropFilter: cfg.blur ? 'blur(12px)' : undefined,
      color: tc,
      padding: isLarge ? '18px 56px' : '10px 48px',
      textAlign: 'center', fontSize: isLarge ? 15 : 13, fontWeight: 500, lineHeight: 1.4,
    }}>
      {cfg.text}
      {cfg.link && (
        <a href={cfg.link} style={{ color: cfg.accentColor ?? '#fbbf24', marginLeft: 10, textDecoration: 'underline', fontWeight: 600 }}>
          {cfg.linkLabel || 'Learn more →'}
        </a>
      )}
      <button onClick={() => setDismissed(true)} aria-label="Dismiss"
        style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: tc, opacity: 0.5, fontSize: 20, lineHeight: 1, padding: 4 }}>
        ×
      </button>
    </div>
  );
}
