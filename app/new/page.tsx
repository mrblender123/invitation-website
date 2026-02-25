import type { Metadata } from 'next';
import Link from 'next/link';
import { CANVAS_SIZES } from '@/lib/canvasSizes';

export const metadata: Metadata = {
  title: 'New Design — Invitia',
  description: 'Choose a canvas size and start designing your invitation.',
};

const MAX_PREVIEW_H = 140;
const MAX_PREVIEW_W = 140;

function AspectPreview({ width, height }: { width: number; height: number }) {
  const aspect = width / height;
  let pw: number, ph: number;
  if (aspect >= 1) {
    pw = MAX_PREVIEW_W;
    ph = Math.round(MAX_PREVIEW_W / aspect);
  } else {
    ph = MAX_PREVIEW_H;
    pw = Math.round(MAX_PREVIEW_H * aspect);
  }
  return (
    <div style={{
      width: MAX_PREVIEW_W,
      height: MAX_PREVIEW_H,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <div style={{
        width: pw,
        height: ph,
        borderRadius: 6,
        border: '2px solid rgba(161,161,170,0.5)',
        background: 'linear-gradient(135deg, rgba(161,161,170,0.15) 0%, rgba(228,228,231,0.1) 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.04em' }}>
          {width}×{height}
        </span>
      </div>
    </div>
  );
}

export default function NewPage() {
  return (
    <div style={{ minHeight: '100vh', background: '#09090b', color: '#fff', fontFamily: 'var(--font-inter), system-ui, sans-serif' }}>

      {/* Header */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 50,
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        background: 'rgba(9,9,11,0.9)',
        backdropFilter: 'blur(12px)',
      }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 24px', height: 60, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Link href="/" style={{ fontFamily: 'var(--font-playfair)', fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em', color: '#fff', textDecoration: 'none' }}>
            Invitia
          </Link>
          <Link href="/gallery" style={{ fontSize: 14, color: 'rgba(255,255,255,0.45)', textDecoration: 'none' }}>
            Gallery
          </Link>
        </div>
      </header>

      {/* Content */}
      <div style={{ maxWidth: 860, margin: '0 auto', padding: '80px 24px 100px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>

        <p style={{ fontSize: 12, fontWeight: 500, letterSpacing: '0.12em', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', marginBottom: 16 }}>
          New Design
        </p>
        <h1 style={{
          fontFamily: 'var(--font-playfair)',
          fontSize: 'clamp(28px, 4vw, 48px)',
          fontWeight: 700, letterSpacing: '-0.02em',
          marginBottom: 12, textAlign: 'center',
        }}>
          Choose your canvas size
        </h1>
        <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.4)', marginBottom: 60, textAlign: 'center' }}>
          Pick a format and we'll set up the editor for you.
        </p>

        {/* Size grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 16,
          width: '100%',
        }}>
          {CANVAS_SIZES.map((size, i) => (
            <Link
              key={size.key}
              href={`/studio?size=${size.key}`}
              style={{ textDecoration: 'none' }}
            >
              <div style={{
                padding: '28px 20px 24px',
                borderRadius: 16,
                border: i === 0
                  ? '1px solid rgba(161,161,170,0.5)'
                  : '1px solid rgba(255,255,255,0.08)',
                background: i === 0
                  ? 'linear-gradient(135deg, rgba(161,161,170,0.1) 0%, rgba(228,228,231,0.06) 100%)'
                  : 'rgba(255,255,255,0.03)',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16,
                cursor: 'pointer',
                transition: 'border-color 0.15s, background 0.15s, transform 0.15s',
              }}
                className="hover:border-zinc-400/60 hover:bg-zinc-900/20 hover:-translate-y-0.5 transition-all"
              >
                <AspectPreview width={size.width} height={size.height} />

                <div style={{ textAlign: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 4 }}>
                    <span style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>{size.label}</span>
                    {i === 0 && (
                      <span style={{
                        fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 99,
                        background: 'rgba(161,161,170,0.25)', color: '#c084fc',
                        letterSpacing: '0.05em',
                      }}>
                        DEFAULT
                      </span>
                    )}
                  </div>
                  <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', margin: 0 }}>{size.description}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>

        <p style={{ marginTop: 40, fontSize: 13, color: 'rgba(255,255,255,0.2)' }}>
          You can adjust everything in the editor.
        </p>
      </div>
    </div>
  );
}
