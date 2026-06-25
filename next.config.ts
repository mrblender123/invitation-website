import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingExcludes: {
    '*': ['./public/templates/**'],
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
