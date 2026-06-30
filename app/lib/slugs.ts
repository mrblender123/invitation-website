export function slugify(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

const CATEGORY_SLUGS: Record<string, string> = {
  "It's a Boy":    'its-a-boy',
  "It's a Girl":   'its-a-girl',
  'Bar Mitzvah':   'bar-mitzvah',
  'Upsherin':      'upsherin',
  'Tenoyim':       'tenoyim',
  'Bavarfen':      'bavarfen',
  'Wedding':       'wedding',
  'Sheva Brachos': 'sheva-brachos',
};

const SLUG_TO_CATEGORY: Record<string, string> = Object.fromEntries(
  Object.entries(CATEGORY_SLUGS).map(([k, v]) => [v, k])
);

export function slugFromCategory(cat: string): string {
  return CATEGORY_SLUGS[cat] ?? slugify(cat);
}

export function categoryFromSlug(slug: string): string | null {
  return SLUG_TO_CATEGORY[slug] ?? null;
}

export function categoryPath(cat: string, sub?: string): string {
  const base = `/templates/${slugFromCategory(cat)}`;
  return sub ? `${base}/${slugify(sub)}` : base;
}
