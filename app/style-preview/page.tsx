'use client';

const options = [
  {
    label: 'A — White pill with shadow',
    style: {
      background: 'white',
      border: '1px solid rgba(0,0,0,0.08)',
      boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
    },
  },
  {
    label: 'B — Frosted glass (simplified)',
    style: {
      background: 'rgba(255,255,255,0.75)',
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      border: '1px solid rgba(255,255,255,0.9)',
    },
  },
  {
    label: 'C — Outline only',
    style: {
      background: 'transparent',
      border: '1px solid rgba(0,0,0,0.18)',
    },
  },
  {
    label: 'D — Solid muted',
    style: {
      background: 'rgba(0,0,0,0.06)',
    },
  },
];

const pillStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  height: 52,
  borderRadius: 9999,
  padding: '0 20px',
  fontSize: '0.88rem',
  fontWeight: 700,
  fontStyle: 'italic',
  color: '#0f172a',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
};

const backgrounds = [
  { label: 'Light background', bg: '#f8f8f6' },
  { label: 'Gradient background', bg: 'linear-gradient(135deg, #e8f4f8 0%, #f5e8f8 100%)' },
  { label: 'Dark background', bg: '#1a1a2e' },
];

export default function StylePreviewPage() {
  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', padding: 40, minHeight: '100vh' }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>Header Button Style Preview</h1>
      <p style={{ color: '#666', marginBottom: 40 }}>Each option shown on 3 different backgrounds. Tell me which one you like.</p>

      {backgrounds.map(bg => (
        <div key={bg.label} style={{ marginBottom: 48 }}>
          <p style={{ fontWeight: 600, marginBottom: 16, color: '#333' }}>{bg.label}</p>
          <div style={{
            background: bg.bg,
            borderRadius: 20,
            padding: '32px 40px',
            display: 'flex',
            flexWrap: 'wrap',
            gap: 24,
            alignItems: 'center',
          }}>
            {options.map(opt => (
              <div key={opt.label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                <div style={{ ...pillStyle, ...opt.style }}>
                  Share Your Simcha
                </div>
                <div style={{ ...pillStyle, ...opt.style, fontStyle: 'normal', fontSize: '0.82rem', gap: 12, paddingLeft: 12 }}>
                  About
                  <span style={{ width: 1, height: 16, background: 'rgba(0,0,0,0.12)', display: 'inline-block' }} />
                  <span>💬</span>
                </div>
                <span style={{ fontSize: 11, color: bg.label === 'Dark background' ? '#aaa' : '#888', textAlign: 'center', maxWidth: 120 }}>{opt.label}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
