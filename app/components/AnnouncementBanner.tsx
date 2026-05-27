'use client';

import { useState, useEffect } from 'react';

type BannerConfig = {
  enabled: boolean;
  text: string;
  link: string;
  linkLabel: string;
  size: 'small' | 'large';
  style: 'dark' | 'light' | 'accent' | 'glass';
};

const STYLE_PRESETS = {
  dark:   { bg: '#0f172a',                color: '#fff',    accent: '#fbbf24', blur: false },
  light:  { bg: '#f1f5f9',                color: '#0f172a', accent: '#6366f1', blur: false },
  accent: { bg: '#7c3aed',                color: '#fff',    accent: '#fde68a', blur: false },
  glass:  { bg: 'rgba(255,255,255,0.12)', color: '#fff',    accent: '#fbbf24', blur: true  },
};

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

  const preset = STYLE_PRESETS[cfg.style] ?? STYLE_PRESETS.dark;
  const isLarge = cfg.size === 'large';

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0,
      zIndex: 200,
      background: preset.bg,
      backdropFilter: preset.blur ? 'blur(12px)' : undefined,
      WebkitBackdropFilter: preset.blur ? 'blur(12px)' : undefined,
      color: preset.color,
      padding: isLarge ? '18px 56px' : '10px 48px',
      textAlign: 'center',
      fontSize: isLarge ? 15 : 13,
      fontWeight: 500,
      lineHeight: 1.4,
    }}>
      {cfg.text}
      {cfg.link && (
        <a
          href={cfg.link}
          style={{ color: preset.accent, marginLeft: 10, textDecoration: 'underline', fontWeight: 600 }}
        >
          {cfg.linkLabel || 'Learn more →'}
        </a>
      )}
      <button
        onClick={() => setDismissed(true)}
        aria-label="Dismiss"
        style={{
          position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
          background: 'none', border: 'none', cursor: 'pointer',
          color: preset.color, opacity: 0.5, fontSize: 20, lineHeight: 1, padding: 4,
        }}
      >
        ×
      </button>
    </div>
  );
}
