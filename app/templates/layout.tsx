import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Jewish Simcha Invitation Templates | Share Your Simcha',
  description: 'Browse Jewish simcha invitation templates. Choose your design, fill in your details, and download a print-ready PNG & PDF in minutes — bris, bar mitzvah, tenoyim, upsherin, sheva brachos & more.',
};

const schema = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://www.shareyoursimcha.com' },
        { '@type': 'ListItem', position: 2, name: 'Templates', item: 'https://www.shareyoursimcha.com/templates' },
      ],
    },
    {
      '@type': 'Service',
      name: 'Jewish Simcha Invitation Templates',
      provider: { '@type': 'Organization', name: 'Share Your Simcha', url: 'https://www.shareyoursimcha.com' },
      description: 'Customizable invitation templates for every Jewish lifecycle event — bris, bar mitzvah, tenoyim, upsherin, sheva brachos, wedding and more.',
      offers: {
        '@type': 'Offer',
        price: '8.99',
        priceCurrency: 'USD',
        availability: 'https://schema.org/InStock',
        url: 'https://www.shareyoursimcha.com/templates',
      },
      areaServed: 'Worldwide',
      serviceType: 'Digital Invitation Design',
    },
  ],
};

export default function TemplatesLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
      {children}
    </>
  );
}
