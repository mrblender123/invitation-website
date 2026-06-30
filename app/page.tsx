import LandingHeader from './components/LandingHeader';
import CategoryRows from './components/CategoryRows';
import AnnouncementBanner from './components/AnnouncementBanner';
import Footer from './components/Footer';
import { slugFromCategory } from '@/app/lib/slugs';

const schemaOrg = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebSite',
      name: 'Share Your Simcha',
      url: 'https://www.shareyoursimcha.com',
      description: 'Create beautiful Jewish simcha invitations for bris, bar mitzvah, tenoyim, upsherin, sheva brachos, wedding and more. Personalize and download for $25.99.',
      potentialAction: {
        '@type': 'SearchAction',
        target: {
          '@type': 'EntryPoint',
          urlTemplate: 'https://www.shareyoursimcha.com/templates?category={search_term_string}',
        },
        'query-input': 'required name=search_term_string',
      },
    },
    {
      '@type': 'Organization',
      name: 'Share Your Simcha',
      url: 'https://www.shareyoursimcha.com',
      logo: 'https://www.shareyoursimcha.com/logo.svg',
      description: 'Jewish simcha invitation templates for every lifecycle occasion.',
      contactPoint: {
        '@type': 'ContactPoint',
        contactType: 'customer support',
        email: 'byccreativesolutions@gmail.com',
      },
    },
    {
      '@type': 'ItemList',
      name: 'Jewish Simcha Invitation Categories',
      url: 'https://www.shareyoursimcha.com/templates',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: "It's a Boy — Bris & Shulem Zucher Invitations", url: `https://www.shareyoursimcha.com/templates/${slugFromCategory("It's a Boy")}` },
        { '@type': 'ListItem', position: 2, name: "It's a Girl — Kiddush Invitations",              url: `https://www.shareyoursimcha.com/templates/${slugFromCategory("It's a Girl")}` },
        { '@type': 'ListItem', position: 3, name: 'Bar Mitzvah Invitation Templates',               url: `https://www.shareyoursimcha.com/templates/${slugFromCategory('Bar Mitzvah')}` },
        { '@type': 'ListItem', position: 4, name: 'Upsherin Invitation Templates',                  url: `https://www.shareyoursimcha.com/templates/${slugFromCategory('Upsherin')}` },
        { '@type': 'ListItem', position: 5, name: 'Tenoyim Invitation Templates',                   url: `https://www.shareyoursimcha.com/templates/${slugFromCategory('Tenoyim')}` },
        { '@type': 'ListItem', position: 6, name: 'Bavarfen Invitation Templates',                  url: `https://www.shareyoursimcha.com/templates/${slugFromCategory('Bavarfen')}` },
        { '@type': 'ListItem', position: 7, name: 'Jewish Wedding Invitation Templates',            url: `https://www.shareyoursimcha.com/templates/${slugFromCategory('Wedding')}` },
        { '@type': 'ListItem', position: 8, name: 'Sheva Brachos Invitation Templates',             url: `https://www.shareyoursimcha.com/templates/${slugFromCategory('Sheva Brachos')}` },
      ],
    },
    {
      '@type': 'Product',
      name: 'Jewish Simcha Invitation — Customize & Download',
      description: 'Professional invitation templates for every Jewish simcha. Personalize with your own details and receive a print-ready, high-resolution PNG instantly by email.',
      brand: { '@type': 'Brand', name: 'Share Your Simcha' },
      image: 'https://www.shareyoursimcha.com/og-image.png',
      offers: {
        '@type': 'Offer',
        price: '25.99',
        priceCurrency: 'USD',
        availability: 'https://schema.org/InStock',
        url: 'https://www.shareyoursimcha.com/templates',
        seller: { '@type': 'Organization', name: 'Share Your Simcha' },
      },
    },
  ],
};

export default function Home() {
  return (
    <div className="min-h-screen" style={{ background: 'var(--background)', color: 'var(--foreground)', fontFamily: 'var(--font-inter), system-ui, sans-serif', position: 'relative', overflowX: 'clip' }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaOrg) }} />

      {/* Visually hidden SEO content */}
      <div style={{ position: 'absolute', width: 1, height: 1, padding: 0, margin: -1, overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap', border: 0 }}>
        <h1>Jewish Simcha Invitation Templates</h1>
        <p>Professional Hebrew and Yiddish invitation designs for bris, bar mitzvah, tenoyim, upsherin, sheva brachos, wedding and more. Customize with your details and download instantly for $25.99.</p>
      </div>

      {/* Ambient gradient orbs */}
      <div aria-hidden="true" style={{ position: 'fixed', top: '-10%', left: '-12%', width: 700, height: 700, borderRadius: '50%', background: 'radial-gradient(circle, rgba(200,210,255,0.18) 0%, transparent 70%)', filter: 'blur(70px)', pointerEvents: 'none', zIndex: 0 }} />
      <div aria-hidden="true" style={{ position: 'fixed', top: '-8%', right: '-14%', width: 650, height: 650, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,220,180,0.18) 0%, transparent 70%)', filter: 'blur(80px)', pointerEvents: 'none', zIndex: 0 }} />
      <div aria-hidden="true" style={{ position: 'fixed', top: '40%', left: '50%', transform: 'translateX(-50%)', width: 900, height: 500, borderRadius: '50%', background: 'radial-gradient(ellipse, rgba(220,215,255,0.10) 0%, transparent 70%)', filter: 'blur(60px)', pointerEvents: 'none', zIndex: 0 }} />
      {/* Bottom corner gradients */}
      <div aria-hidden="true" style={{ position: 'fixed', bottom: '-5%', left: '-8%', width: 600, height: 500, background: 'radial-gradient(ellipse at bottom left, rgba(180,200,255,0.22) 0%, transparent 65%)', filter: 'blur(50px)', pointerEvents: 'none', zIndex: 0 }} />
      <div aria-hidden="true" style={{ position: 'fixed', bottom: '-5%', right: '-8%', width: 600, height: 500, background: 'radial-gradient(ellipse at bottom right, rgba(255,200,220,0.18) 0%, transparent 65%)', filter: 'blur(50px)', pointerEvents: 'none', zIndex: 0 }} />
      {/* Side vignettes — tweak width (how far it reaches in) and opacity (how dark) */}
      <div aria-hidden="true" style={{ position: 'fixed', top: 0, left: 0, width: 120, height: '100%', background: 'linear-gradient(to right, rgba(30, 30, 30, 0.12), transparent)', pointerEvents: 'none', zIndex: 0 }} />
      <div aria-hidden="true" style={{ position: 'fixed', top: 0, right: 0, width: 120, height: '100%', background: 'linear-gradient(to left, rgba(0,0,0,0.12), transparent)', pointerEvents: 'none', zIndex: 0 }} />
      {/* Top fade — cards lose opacity as they scroll up into the header zone */}
      <div aria-hidden="true" style={{ position: 'fixed', top: 0, left: 0, right: 0, height: 'var(--pills-bottom, 180px)', background: 'linear-gradient(to bottom, var(--background) 20%, transparent 100%)', pointerEvents: 'none', zIndex: 48 }} />

<AnnouncementBanner />
<LandingHeader />
<div style={{ position: 'relative', zIndex: 1 }}>
        <CategoryRows />
      </div>

      <Footer />

    </div>
  );
}
