'use client';

const IMAGES = [
  "/templates/It's a boy/Vachnacht/01111.png",
  '/templates/Vort/22.png',
  '/templates/wedding/001.png',
  '/templates/wedding/002.png',
  '/templates/wedding/1.png',
  '/templates/wedding/11.png',
  '/templates/wedding/6.png',
  '/templates/wedding/8.png',
];

const CARD_W = 160;
const CARD_H = 224;
const GAP    = 16;

export default function InvitationCarousel() {
  const track = [...IMAGES, ...IMAGES];

  return (
    <section style={{ padding: '0 0 100px', overflow: 'hidden', position: 'relative', zIndex: 1 }}>
      <p style={{
        textAlign: 'center', fontSize: 13, fontWeight: 500, letterSpacing: '0.1em',
        color: 'var(--muted-faint)', textTransform: 'uppercase', marginBottom: 48,
      }}>
        Browse our collection
      </p>

      {/* Fade edges */}
      <div aria-hidden="true" style={{
        position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 2,
        background: 'linear-gradient(to right, #f8f7f4 0%, transparent 12%, transparent 88%, #f8f7f4 100%)',
      }} />

      <div
        className="marquee-track"
        style={{ display: 'flex', gap: GAP, width: 'max-content' }}
      >
        {track.map((src, i) => (
          <div
            key={i}
            style={{
              position: 'relative',
              width: CARD_W,
              height: CARD_H,
              flexShrink: 0,
              borderRadius: 18,
              overflow: 'hidden',
              /* liquid glass border */
              border: '1px solid rgba(255,255,255,0.22)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.18)',
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

            {/* glass sheen overlay */}
            <div aria-hidden="true" style={{
              position: 'absolute',
              inset: 0,
              borderRadius: 18,
              background: 'linear-gradient(135deg, rgba(255,255,255,0.13) 0%, rgba(255,255,255,0.03) 40%, transparent 60%)',
              pointerEvents: 'none',
            }} />

            {/* specular highlight strip at top */}
            <div aria-hidden="true" style={{
              position: 'absolute',
              top: 0, left: '10%',
              width: '80%', height: 1,
              background: 'rgba(255,255,255,0.35)',
              pointerEvents: 'none',
            }} />
          </div>
        ))}
      </div>
    </section>
  );
}
