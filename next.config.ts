import type { NextConfig } from "next";

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

const nextConfig: NextConfig = {
  async redirects() {
    return Object.entries(CATEGORY_SLUGS).map(([cat, slug]) => ({
      source: '/templates',
      has: [{ type: 'query', key: 'category', value: cat }],
      destination: `/templates/${slug}`,
      permanent: true,
    }));
  },

  async headers() {
    const rules = [];

    // In development, prevent the browser from caching SVG template files so
    // admin-editor saves appear immediately without a hard refresh.
    if (process.env.NODE_ENV === 'development') {
      rules.push({
        source: '/templates/:path*.svg',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Pragma', value: 'no-cache' },
        ],
      });
    }

    return rules;
  },
};

export default nextConfig;
