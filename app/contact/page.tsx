import LandingHeader from '../components/LandingHeader';

export const metadata = {
  title: 'Contact — Joy Note',
  description: 'Get in touch with Joy Note. We\'d love to hear from you.',
};

export default function ContactPage() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--background)', color: 'var(--foreground)', fontFamily: 'var(--font-inter), system-ui, sans-serif', position: 'relative', overflowX: 'clip' }}>

      <LandingHeader />

      <section style={{ maxWidth: 600, margin: '0 auto', padding: '100px 24px 120px', textAlign: 'center', position: 'relative', zIndex: 1 }}>
        <p style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.14em', color: 'var(--muted-faint)', textTransform: 'uppercase', marginBottom: 20 }}>
          Get in touch
        </p>
        <h1 style={{ fontFamily: 'var(--font-playfair)', fontSize: 'clamp(32px, 5vw, 56px)', fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1.1, margin: '0 0 24px' }}>
          Contact Us
        </h1>
        <p style={{ fontSize: 17, lineHeight: 1.75, color: 'var(--muted)', margin: '0 0 48px' }}>
          Have a question, a custom request, or just want to say hello? We&apos;re here to help.
        </p>

        <a
          href="mailto:info@shareyoursimcha.com"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 10,
            background: '#0f172a',
            color: '#fff',
            textDecoration: 'none',
            padding: '14px 32px',
            borderRadius: 9999,
            fontSize: 15,
            fontWeight: 600,
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="4" width="20" height="16" rx="2"/>
            <path d="M2 7l10 7 10-7"/>
          </svg>
          info@shareyoursimcha.com
        </a>

        <p style={{ fontSize: 13, color: 'var(--muted-faint)', marginTop: 24 }}>
          We typically respond within one business day.
        </p>
      </section>

      <footer style={{ borderTop: '1px solid var(--border)', padding: '32px 24px', textAlign: 'center' }}>
        <p style={{ fontSize: 12, color: 'var(--muted-faint)', margin: 0 }}>
          © {new Date().getFullYear()} Joy Note. All rights reserved.
        </p>
      </footer>

    </div>
  );
}
