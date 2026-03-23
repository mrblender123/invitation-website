import LandingHeader from './components/LandingHeader';
import CategoryRows from './components/CategoryRows';

export default function Home() {
  return (
    <div className="min-h-screen" style={{ background: 'var(--background)', color: 'var(--foreground)', fontFamily: 'var(--font-inter), system-ui, sans-serif', position: 'relative', overflowX: 'hidden' }}>

      {/* Ambient gradient orbs */}
      <div aria-hidden="true" style={{ position: 'fixed', top: '-10%', left: '-12%', width: 700, height: 700, borderRadius: '50%', background: 'radial-gradient(circle, rgba(200,210,255,0.18) 0%, transparent 70%)', filter: 'blur(70px)', pointerEvents: 'none', zIndex: 0 }} />
      <div aria-hidden="true" style={{ position: 'fixed', top: '-8%', right: '-14%', width: 650, height: 650, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,220,180,0.18) 0%, transparent 70%)', filter: 'blur(80px)', pointerEvents: 'none', zIndex: 0 }} />
      <div aria-hidden="true" style={{ position: 'fixed', top: '40%', left: '50%', transform: 'translateX(-50%)', width: 900, height: 500, borderRadius: '50%', background: 'radial-gradient(ellipse, rgba(220,215,255,0.10) 0%, transparent 70%)', filter: 'blur(60px)', pointerEvents: 'none', zIndex: 0 }} />

<LandingHeader />
<div style={{ position: 'relative', zIndex: 1 }}>
        <CategoryRows />

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

    </div>
  );
}
