import { MetadataRoute } from 'next';
import { slugFromCategory } from '@/app/lib/slugs';
import { CATEGORY_SUBS, SUB_DISPLAY_NAMES } from '@/lib/categories';

const BASE = 'https://www.shareyoursimcha.com';

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
    url: `${BASE}/templates/${slugFromCategory(cat)}`,
    lastModified: new Date(),
    changeFrequency: 'weekly' as const,
    priority: 0.8,
  }));

  const subcategoryUrls = CATEGORIES.flatMap(cat =>
    (CATEGORY_SUBS[cat] ?? []).map(sub => ({
      url: `${BASE}/templates/${slugFromCategory(cat)}/${slugFromCategory(sub)}`,
      lastModified: new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    }))
  );

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
    ...subcategoryUrls,
  ];
}
