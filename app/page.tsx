import Image from 'next/image';
import LandingHeader from './components/LandingHeader';
import SimchaSelector from './components/SimchaSelector';
import CTAButton from './components/CTAButton';
import CategoryGrid from './components/CategoryGrid';
import InvitationCarousel from './components/InvitationCarousel';

export default function Home() {
  return (
    <div className="min-h-screen" style={{ background: 'var(--background)', color: 'var(--foreground)', fontFamily: 'var(--font-inter), system-ui, sans-serif', position: 'relative', overflowX: 'hidden' }}>

      {/* ── Ambient gradient orbs ── */}
      {/* Top-left warm orb */}
      <div aria-hidden="true" style={{
        position: 'absolute', top: '-10%', left: '-12%',
        width: 700, height: 700, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(200,210,255,0.18) 0%, transparent 70%)',
        filter: 'blur(70px)', pointerEvents: 'none', zIndex: 0,
      }} />
      {/* Top-right warm orb */}
      <div aria-hidden="true" style={{
        position: 'absolute', top: '-8%', right: '-14%',
        width: 650, height: 650, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(255,220,180,0.18) 0%, transparent 70%)',
        filter: 'blur(80px)', pointerEvents: 'none', zIndex: 0,
      }} />
      {/* Center soft bloom */}
      <div aria-hidden="true" style={{
        position: 'absolute', top: '5%', left: '50%', transform: 'translateX(-50%)',
        width: 800, height: 400, borderRadius: '50%',
        background: 'radial-gradient(ellipse, rgba(220,215,255,0.12) 0%, transparent 70%)',
        filter: 'blur(50px)', pointerEvents: 'none', zIndex: 0,
      }} />

      <LandingHeader liquid />

      {/* Hero */}
      <section style={{ maxWidth: 1100, margin: '0 auto', padding: '120px 24px 60px', textAlign: 'center', position: 'relative', zIndex: 1 }}>

        {/* Banner */}
        <div style={{ width: '100%', borderRadius: 20, overflow: 'hidden', margin: '0 0 40px' }}>
          <Image
            src="/banner.png"
            alt="Pintle banner"
            width={1400}
            height={500}
            style={{ width: '100%', height: 'auto', display: 'block' }}
            priority
            unoptimized
          />
        </div>

        <p style={{ fontSize: 18, lineHeight: 1.7, color: 'var(--muted)', maxWidth: 520, margin: '0 auto 40px' }}>
          Celebrate Your Simcha<br />Create and send invitations with ease.
        </p>

        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <SimchaSelector scrollTo="categories" />
        </div>
      </section>


      <div id="categories">
        <CategoryGrid />
      </div>

      {/* Features */}
      <section id="features" style={{ maxWidth: 1100, margin: '0 auto', padding: '0 24px 120px', position: 'relative', zIndex: 1 }}>
        <p style={{ textAlign: 'center', fontSize: 13, fontWeight: 500, letterSpacing: '0.1em', color: 'var(--muted-faint)', textTransform: 'uppercase', marginBottom: 16 }}>
          Everything you need
        </p>
        <h2 style={{
          fontFamily: 'var(--font-playfair)', fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 700,
          textAlign: 'center', letterSpacing: '-0.02em', marginBottom: 60,
          color: 'var(--foreground)',
        }}>
          Designed for creators
        </h2>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
          {[
            {
              icon: '✦',
              title: 'Simple',
              description: 'Pick a design you love.',
            },
            {
              icon: '◈',
              title: 'Easy',
              description: 'Customize it quickly.',
            },
            {
              icon: '⬇',
              title: 'Done',
              description: 'Send and celebrate.',
            },
          ].map(({ icon, title, description }) => (
            <div key={title} style={{
              padding: '32px 28px',
              borderRadius: 16,
              background: 'rgba(255,255,255,0.62)',
              backdropFilter: 'blur(14px) saturate(1.5)',
              WebkitBackdropFilter: 'blur(14px) saturate(1.5)',
              border: '1px solid rgba(255,255,255,0.82)',
              borderBottom: '1px solid rgba(0,0,0,0.07)',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.92), 0 2px 12px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)',
            }}>
              <div style={{ fontSize: 26, marginBottom: 14, textAlign: 'center' }}>{icon}</div>
              <h3 style={{ fontFamily: 'var(--font-playfair)', fontSize: 22, fontWeight: 700, marginBottom: 8, color: 'var(--foreground)', textAlign: 'center', letterSpacing: '-0.01em' }}>{title}</h3>
              <p style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--muted)', textAlign: 'center', margin: 0 }}>{description}</p>
            </div>
          ))}
        </div>
      </section>

      <InvitationCarousel />

      {/* CTA banner */}
      <section style={{ padding: '0 24px 120px' }}>
        <div className="cta-banner" style={{
          maxWidth: 680, margin: '0 auto', textAlign: 'center',
          borderRadius: 24,
          border: '1px solid var(--border)',
          background: 'linear-gradient(135deg, rgba(200,210,255,0.12) 0%, rgba(255,220,180,0.1) 100%)',
        }}>
          <h2 style={{ fontFamily: 'var(--font-playfair)', fontSize: 'clamp(24px, 3.5vw, 38px)', fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 16, color: 'var(--foreground)' }}>
            Ready to design?
          </h2>
          <p style={{ fontSize: 15, color: 'var(--muted)', marginBottom: 32 }}>
            Open the studio and create your first invitation in minutes.
          </p>
          <CTAButton />
        </div>
      </section>

      {/* Footer */}
      <footer style={{
        borderTop: '1px solid var(--border)',
        padding: '48px 24px 32px',
        fontFamily: 'var(--font-inter), system-ui, sans-serif',
      }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 40, marginBottom: 40 }}>

            {/* Brand */}
            <div style={{ maxWidth: 260 }}>
              <p style={{ fontFamily: 'var(--font-playfair)', fontSize: 22, fontWeight: 700, color: 'var(--foreground)', margin: '0 0 10px' }}>
                Pintle
              </p>
              <p style={{ fontSize: 13, lineHeight: 1.7, color: 'var(--muted-faint)', margin: 0 }}>
                Beautiful invitation designs for every simcha. Customize, download, and share in minutes.
              </p>
            </div>

            {/* Links */}
            <div style={{ display: 'flex', gap: 56, flexWrap: 'wrap' }}>
              <div>
                <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted-faint)', margin: '0 0 14px' }}>
                  Browse
                </p>
                {["It's a Boy", "It's a Girl", 'Bar Mitzvah', 'Wedding', 'Vort'].map(cat => (
                  <a key={cat} href={`/templates?category=${encodeURIComponent(cat)}`} className="footer-link">
                    {cat}
                  </a>
                ))}
              </div>
              <div>
                <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted-faint)', margin: '0 0 14px' }}>
                  More
                </p>
                {[
                  { label: 'Templates', href: '/templates' },
                ].map(({ label, href }) => (
                  <a key={label} href={href} className="footer-link">
                    {label}
                  </a>
                ))}
              </div>
            </div>
          </div>

          {/* Bottom bar */}
          <div style={{
            borderTop: '1px solid var(--border)',
            paddingTop: 20,
            display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 8,
          }}>
            <p style={{ fontSize: 12, color: 'var(--muted-faint)', margin: 0 }}>
              © {new Date().getFullYear()} Pintle. All rights reserved.
            </p>
            <p style={{ fontSize: 12, color: 'var(--muted-faint)', margin: 0 }}>
              Built with Next.js
            </p>
          </div>
        </div>
      </footer>

    </div>
  );
}
