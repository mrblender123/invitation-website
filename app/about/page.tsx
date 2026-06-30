import LandingHeader from '../components/LandingHeader';
import FaqAccordion from '../components/FaqAccordion';
import GlassPill from '../components/GlassPill';
import Footer from '../components/Footer';

export const metadata = {
  title: 'About Share Your Simcha | Jewish Simcha Invitations Made Easy',
  description: 'Share Your Simcha makes it easy to create beautiful Jewish simcha invitations. Browse templates, personalize your details, and download instantly — no design skills needed.',
};

const faqSchema = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    { '@type': 'Question', name: 'How much does it cost?', acceptedAnswer: { '@type': 'Answer', text: 'Browsing and customizing is completely free. When you\'re happy with your design, you pay $25.99 to download — your finished invitation arrives as a high-quality PNG straight to your email.' } },
    { '@type': 'Question', name: 'Do I need to create an account?', acceptedAnswer: { '@type': 'Answer', text: 'No account needed. Browse, customize, pay, and receive your invitation — all without signing up.' } },
    { '@type': 'Question', name: 'Can I make changes after I download?', acceptedAnswer: { '@type': 'Answer', text: 'Yes. Every purchase includes up to 3 edits within 7 days. A link in your confirmation email lets you reopen your invitation, make changes, and re-download.' } },
    { '@type': 'Question', name: "I paid but didn't receive my invitation email — what should I do?", acceptedAnswer: { '@type': 'Answer', text: "Check your Promotions tab (in Gmail) or your Spam folder — the email sometimes lands there. If you still can't find it, contact us and we'll resend it." } },
    { '@type': 'Question', name: 'What simchas are supported?', acceptedAnswer: { '@type': 'Answer', text: "We cover the full lifecycle of Jewish celebrations: Bris, Vachnacht, Pidyon Haben, It's a Girl, Upsherin, Bar Mitzvah, Tenoyim, Bavarfen, Wedding, and Sheva Brachos — with more added regularly." } },
    { '@type': 'Question', name: 'Can I share the invitation digitally?', acceptedAnswer: { '@type': 'Answer', text: "Absolutely. Share the PNG directly on WhatsApp, email, or any messaging app. It's the perfect size for digital sharing." } },
    { '@type': 'Question', name: 'Can I print the invitation?', acceptedAnswer: { '@type': 'Answer', text: 'Yes. The downloaded image is high resolution and suitable for home printing or a professional print shop.' } },
    { '@type': 'Question', name: 'Can I edit Hebrew text on the templates?', acceptedAnswer: { '@type': 'Answer', text: 'Yes. Templates that include Hebrew fields are fully editable. Just click the field and type your text.' } },
  ],
};

const STEPS = [
  {
    number: '01',
    title: 'Browse',
    body: "Choose from a curated collection of beautiful designs for every simcha — Bris, Bar Mitzvah, Wedding, Sheva Brachos, and more. No design skills needed.",
  },
  {
    number: '02',
    title: 'Customize',
    body: 'Click any text field to make it yours. Your changes appear instantly on the invitation — names, dates, times, locations. What you see is what you get.',
  },
  {
    number: '03',
    title: 'Download',
    body: 'Pay once ($25.99) and receive your finished invitation as a high-quality PNG straight to your email. Share it on WhatsApp, print it, or post it — ready in minutes.',
  },
];

export default function AboutPage() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--background)', color: 'var(--foreground)', fontFamily: 'var(--font-inter), system-ui, sans-serif', position: 'relative', overflowX: 'clip' }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />

      <LandingHeader />

      {/* Hero */}
      <section style={{ maxWidth: 720, margin: '0 auto', padding: '100px 24px 80px', textAlign: 'center', position: 'relative', zIndex: 1 }}>
        <p style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.14em', color: 'var(--muted-faint)', textTransform: 'uppercase', marginBottom: 20 }}>
          About Share Your Simcha
        </p>
        <h1 style={{ fontFamily: 'var(--font-playfair)', fontSize: 'clamp(36px, 6vw, 64px)', fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1.1, margin: '0 0 28px' }}>
          Browse.{' '}
          <span style={{ color: 'var(--muted-faint)' }}>Customize.</span>{' '}
          Download.
        </h1>
        <p style={{ fontSize: 18, lineHeight: 1.75, color: 'var(--muted)', maxWidth: 500, margin: '0 auto' }}>
          Beautiful invitations for every simcha — ready in minutes, no designer needed.
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


      <Footer />

    </div>
  );
}
