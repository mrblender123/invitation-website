import LandingHeader from './components/LandingHeader';
import HeroHeading from './components/HeroHeading';
import SimchaSelector from './components/SimchaSelector';
import CTAButton from './components/CTAButton';
import TemplateShowcase from './components/TemplateShowcase';

export default function Home() {
  return (
    <div className="min-h-screen bg-[#09090b] text-white" style={{ fontFamily: 'var(--font-inter), system-ui, sans-serif', position: 'relative', overflow: 'hidden' }}>

      {/* ── Ambient gradient orbs ── */}
      {/* Top-left white orb */}
      <div aria-hidden="true" style={{
        position: 'absolute', top: 0, left: '-12%',
        width: 700, height: 700, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%)',
        filter: 'blur(60px)', pointerEvents: 'none', zIndex: 0,
      }} />
      {/* Top-right white orb */}
      <div aria-hidden="true" style={{
        position: 'absolute', top: 0, right: '-14%',
        width: 650, height: 650, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(255,255,255,0.08) 0%, transparent 70%)',
        filter: 'blur(70px)', pointerEvents: 'none', zIndex: 0,
      }} />
      {/* Center white bloom */}
      <div aria-hidden="true" style={{
        position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
        width: 800, height: 400, borderRadius: '50%',
        background: 'radial-gradient(ellipse, rgba(255,255,255,0.06) 0%, transparent 70%)',
        filter: 'blur(40px)', pointerEvents: 'none', zIndex: 0,
      }} />

      <LandingHeader />

      {/* Hero */}
      <section style={{ maxWidth: 1100, margin: '0 auto', padding: '120px 24px 100px', textAlign: 'center', position: 'relative', zIndex: 1 }}>
        <HeroHeading />

        <p style={{ fontSize: 18, lineHeight: 1.7, color: 'rgba(255,255,255,0.5)', maxWidth: 520, margin: '0 auto 40px' }}>
          Celebrate Your Simcha<br />Create and send invitations with ease.
        </p>

        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <SimchaSelector />
        </div>
      </section>


      {/* Features */}
      <section id="features" style={{ maxWidth: 1100, margin: '0 auto', padding: '0 24px 120px', position: 'relative', zIndex: 1 }}>
        <p style={{ textAlign: 'center', fontSize: 13, fontWeight: 500, letterSpacing: '0.1em', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', marginBottom: 16 }}>
          Everything you need
        </p>
        <h2 style={{
          fontFamily: 'var(--font-playfair)', fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 700,
          textAlign: 'center', letterSpacing: '-0.02em', marginBottom: 60,
          color: '#fff',
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
              border: '1px solid rgba(255,255,255,0.07)',
              background: 'rgba(255,255,255,0.03)',
            }}>
              <div style={{ fontSize: 22, marginBottom: 16, color: '#a1a1aa' }}>{icon}</div>
              <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 10, color: '#fff' }}>{title}</h3>
              <p style={{ fontSize: 14, lineHeight: 1.7, color: 'rgba(255,255,255,0.45)' }}>{description}</p>
            </div>
          ))}
        </div>
      </section>

      <TemplateShowcase />

      {/* CTA banner */}
      <section style={{ padding: '0 24px 120px' }}>
        <div className="cta-banner" style={{
          maxWidth: 680, margin: '0 auto', textAlign: 'center',
          borderRadius: 24,
          border: '1px solid rgba(161,161,170,0.2)',
          background: 'linear-gradient(135deg, rgba(161,161,170,0.08) 0%, rgba(228,228,231,0.06) 100%)',
        }}>
          <h2 style={{ fontFamily: 'var(--font-playfair)', fontSize: 'clamp(24px, 3.5vw, 38px)', fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 16, color: '#fff' }}>
            Ready to design?
          </h2>
          <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.45)', marginBottom: 32 }}>
            Open the studio and create your first invitation in minutes.
          </p>
          <CTAButton />
        </div>
      </section>

      {/* Footer */}
      <footer style={{
        borderTop: '1px solid rgba(255,255,255,0.06)',
        padding: '28px 24px',
        textAlign: 'center',
        fontSize: 13,
        color: 'rgba(255,255,255,0.2)',
      }}>
        © {new Date().getFullYear()} Invitia · Built with Next.js & Stable Diffusion
      </footer>

    </div>
  );
}
