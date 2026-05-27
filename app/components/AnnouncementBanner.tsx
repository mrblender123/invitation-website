'use client';

import { useState } from 'react';

// ─── Edit here to control the banner ────────────────────────────────────────
const BANNER = {
  enabled: false,
  text: 'New templates just added for Sheva Brachos and Wedding! 🎉',
  link: '',        // optional URL — leave empty for no link
  linkLabel: 'Browse now →',
};
// ────────────────────────────────────────────────────────────────────────────

export default function AnnouncementBanner() {
  const [dismissed, setDismissed] = useState(false);

  if (!BANNER.enabled || dismissed) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0,
      zIndex: 200,
      background: '#0f172a',
      color: '#fff',
      padding: '10px 48px 10px 16px',
      textAlign: 'center',
      fontSize: 13,
      fontWeight: 500,
      lineHeight: 1.4,
    }}>
      {BANNER.text}
      {BANNER.link && (
        <a
          href={BANNER.link}
          style={{ color: '#fbbf24', marginLeft: 10, textDecoration: 'underline', fontWeight: 600 }}
        >
          {BANNER.linkLabel}
        </a>
      )}
      <button
        onClick={() => setDismissed(true)}
        aria-label="Dismiss"
        style={{
          position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'rgba(255,255,255,0.5)', fontSize: 18, lineHeight: 1, padding: 4,
        }}
      >
        ×
      </button>
    </div>
  );
}
