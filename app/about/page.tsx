import Link from 'next/link';
import LandingHeader from '../components/LandingHeader';
import FaqAccordion from '../components/FaqAccordion';

export const metadata = {
  title: 'About — Pintle',
  description: 'Simple. Easy. Done. Create beautiful Jewish celebration invitations in minutes.',
};

const STEPS = [
  {
    number: '01',
    title: 'Simple',
    body: 'Browse a curated collection of beautiful designs for every simcha — from a Bris to a Wedding. No design skills needed. Just pick what you love.',
  },
  {
    number: '02',
    title: 'Easy',
    body: 'Tap any field to update the text. Your changes appear instantly on the invitation. No learning curve, no tutorials.',
  },
  {
    number: '03',
    title: 'Done',
    body: 'Download your finished invitation as a high-quality image and share it on WhatsApp, email, or print it. Ready in minutes.',
  },
];

export default function AboutPage() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--background)', color: 'var(--foreground)', fontFamily: 'var(--font-inter), system-ui, sans-serif', position: 'relative', overflow: 'hidden' }}>

      <LandingHeader />

      {/* Hero */}
      <section style={{ maxWidth: 720, margin: '0 auto', padding: '100px 24px 80px', textAlign: 'center', position: 'relative', zIndex: 1 }}>
        <p style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.14em', color: 'var(--muted-faint)', textTransform: 'uppercase', marginBottom: 20 }}>
          About Pintle
        </p>
        <h1 style={{ fontFamily: 'var(--font-playfair)', fontSize: 'clamp(36px, 6vw, 64px)', fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1.1, margin: '0 0 28px' }}>
          Simple.{' '}
          <span style={{ color: 'var(--muted-faint)' }}>Easy.</span>{' '}
          Done.
        </h1>
        <p style={{ fontSize: 18, lineHeight: 1.75, color: 'var(--muted)', maxWidth: 500, margin: '0 auto' }}>
          Pintle was built for the Jewish community — so anyone can create a beautiful, meaningful invitation for their simcha without any design experience.
        </p>
      </section>

      {/* Steps */}
      <section style={{ maxWidth: 900, margin: '0 auto', padding: '0 24px 100px', position: 'relative', zIndex: 1 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {STEPS.map((step, i) => (
            <div
              key={step.number}
              style={{
                display: 'grid',
                gridTemplateColumns: '80px 1fr',
                gap: '0 40px',
                alignItems: 'start',
                padding: '40px 40px',
                borderRadius: 20,
                border: '1px solid var(--border)',
                background: i === 1 ? 'rgba(0,0,0,0.03)' : 'transparent',
              }}
            >
              <div style={{ fontFamily: 'var(--font-playfair)', fontSize: 48, fontWeight: 700, color: 'var(--muted-faint)', lineHeight: 1, paddingTop: 4 }}>
                {step.number}
              </div>
              <div>
                <h2 style={{ fontFamily: 'var(--font-playfair)', fontSize: 28, fontWeight: 700, letterSpacing: '-0.02em', margin: '0 0 12px', color: 'var(--foreground)' }}>
                  {step.title}
                </h2>
                <p style={{ fontSize: 16, lineHeight: 1.75, color: 'var(--muted)', margin: 0 }}>
                  {step.body}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Mission */}
      <section style={{ maxWidth: 640, margin: '0 auto', padding: '0 24px 120px', textAlign: 'center', position: 'relative', zIndex: 1 }}>
        <div style={{ width: 1, height: 60, background: 'linear-gradient(to bottom, transparent, var(--border), transparent)', margin: '0 auto 60px' }} />
        <p style={{ fontSize: 20, lineHeight: 1.8, color: 'var(--muted)', fontStyle: 'italic' }}>
          "Every simcha deserves a beautiful invitation. We made that possible for everyone."
        </p>
      </section>

      {/* FAQ */}
      <section style={{ maxWidth: 760, margin: '0 auto', padding: '0 24px 100px', position: 'relative', zIndex: 1 }}>
        <p style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.14em', color: 'var(--muted-faint)', textTransform: 'uppercase', marginBottom: 16, textAlign: 'center' }}>
          FAQ
        </p>
        <h2 style={{ fontFamily: 'var(--font-playfair)', fontSize: 'clamp(24px, 3.5vw, 36px)', fontWeight: 700, letterSpacing: '-0.02em', textAlign: 'center', marginBottom: 40, color: 'var(--foreground)' }}>
          Common questions
        </h2>
        <FaqAccordion />
      </section>

      {/* CTA */}
      <section style={{ padding: '0 24px 120px', position: 'relative', zIndex: 1 }}>
        <div style={{
          maxWidth: 600,
          margin: '0 auto',
          textAlign: 'center',
          borderRadius: 24,
          border: '1px solid var(--border)',
          background: 'rgba(255,255,255,0.6)',
          padding: '56px 40px',
        }}>
          <h2 style={{ fontFamily: 'var(--font-playfair)', fontSize: 'clamp(24px, 3.5vw, 36px)', fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 16, color: 'var(--foreground)' }}>
            Ready to create yours?
          </h2>
          <p style={{ fontSize: 15, color: 'var(--muted)', marginBottom: 32 }}>
            Browse templates for every simcha and have your invitation ready in minutes.
          </p>
          <Link
            href="/templates"
            className="silver-btn"
            style={{ padding: '0.95rem 3rem', fontSize: '1rem', textDecoration: 'none', display: 'inline-block' }}
          >
            Browse Templates
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ borderTop: '1px solid var(--border)', padding: '32px 24px', textAlign: 'center' }}>
        <p style={{ fontSize: 12, color: 'var(--muted-faint)', margin: 0 }}>
          © {new Date().getFullYear()} Pintle. All rights reserved.
        </p>
      </footer>

    </div>
  );
}
