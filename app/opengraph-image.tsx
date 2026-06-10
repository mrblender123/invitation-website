import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'Share Your Simcha — Jewish Simcha Invitations';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
          fontFamily: 'serif',
        }}
      >
        {/* Decorative circles */}
        <div style={{ position: 'absolute', top: -80, right: -80, width: 400, height: 400, borderRadius: '50%', background: 'rgba(251,191,36,0.08)', display: 'flex' }} />
        <div style={{ position: 'absolute', bottom: -60, left: -60, width: 320, height: 320, borderRadius: '50%', background: 'rgba(99,102,241,0.08)', display: 'flex' }} />

        {/* Logo text */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 28 }}>
          <div style={{ fontSize: 72, fontWeight: 800, color: '#fff', letterSpacing: '-2px', display: 'flex' }}>
            Share Your
          </div>
          <div style={{ fontSize: 72, fontWeight: 800, color: '#fbbf24', letterSpacing: '-2px', display: 'flex' }}>
            Simcha
          </div>
        </div>

        {/* Tagline */}
        <div style={{ fontSize: 28, color: 'rgba(255,255,255,0.65)', letterSpacing: '0.02em', display: 'flex' }}>
          Beautiful invitations for every simcha
        </div>

        {/* Categories row */}
        <div style={{ display: 'flex', gap: 12, marginTop: 48 }}>
          {["Bris", "Bar Mitzvah", "Wedding", "Sheva Brachos", "Bavarfen"].map(cat => (
            <div key={cat} style={{
              display: 'flex',
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: 9999,
              padding: '8px 20px',
              fontSize: 18,
              color: 'rgba(255,255,255,0.7)',
            }}>
              {cat}
            </div>
          ))}
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
