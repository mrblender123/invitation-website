import { MetadataRoute } from 'next';

const BASE = 'https://www.joy-note.com';

const CATEGORIES = [
  "It's a Boy",
  "It's a Girl",
  'Upsherin',
  'Bar Mitzvah',
  'Tenoyim',
  'Bavarfen',
  'Wedding',
  'Sheva Brachos',
];

export default function sitemap(): MetadataRoute.Sitemap {
  const categoryUrls = CATEGORIES.map(cat => ({
    url: `${BASE}/templates?category=${encodeURIComponent(cat)}`,
    lastModified: new Date(),
    changeFrequency: 'weekly' as const,
    priority: 0.8,
  }));

  return [
    {
      url: BASE,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: `${BASE}/templates`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: `${BASE}/about`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    {
      url: `${BASE}/contact`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    ...categoryUrls,
  ];
}
