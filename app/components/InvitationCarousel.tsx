'use client';

const IMAGES = [
  '/templates/Vach Nacht/009.png',
  '/templates/Vach Nacht/01111.png',
  '/templates/Vach Nacht/099.png',
  '/templates/Vach Nacht/222.png',
  '/templates/Vach Nacht/333.png',
  '/templates/Vort/22.png',
  '/templates/wedding/001.png',
  '/templates/wedding/002.png',
  '/templates/wedding/1.png',
  '/templates/wedding/11.png',
  '/templates/wedding/6.png',
  '/templates/wedding/8.png',
];

const CARD_W = 160;
const CARD_H = 224; // 160 × 504/360
const GAP    = 16;

export default function InvitationCarousel() {
  // Duplicate once — track = 2× images, animation slides exactly -50% for seamless loop
  const track = [...IMAGES, ...IMAGES];

  return (
    <section style={{ padding: '0 0 100px', overflow: 'hidden', position: 'relative', zIndex: 1 }}>
      <p style={{
        textAlign: 'center', fontSize: 13, fontWeight: 500, letterSpacing: '0.1em',
        color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', marginBottom: 48,
      }}>
        Browse our collection
      </p>

      {/* Fade edges */}
      <div aria-hidden="true" style={{
        position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 2,
        background: 'linear-gradient(to right, #09090b 0%, transparent 8%, transparent 92%, #09090b 100%)',
      }} />

      <div
        className="marquee-track"
        style={{
          display: 'flex',
          gap: GAP,
          width: 'max-content',
        }}
      >
        {track.map((src, i) => (
          <div
            key={i}
            style={{
              width: CARD_W,
              height: CARD_H,
              flexShrink: 0,
              borderRadius: 12,
              overflow: 'hidden',
              border: '1px solid rgba(255,255,255,0.1)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt="invitation design"
              width={CARD_W}
              height={CARD_H}
              style={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover' }}
              draggable={false}
            />
          </div>
        ))}
      </div>
    </section>
  );
}
