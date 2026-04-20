import { NextResponse } from 'next/server';

// Cache the result in memory for the lifetime of the server process
let cachedCss: string | null = null;

export async function GET() {
  if (cachedCss !== null) {
    return NextResponse.json({ css: cachedCss });
  }

  const apiKey = process.env.ADOBE_FONTS_API_KEY;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://pintle.co';

  try {
    // Fetch the Typekit CSS (kit clg1fwd — contains forma-djr-hebrew-banner + schablona)
    const kitCss = await fetch('https://use.typekit.net/fjv7kfq.css', {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Referer': appUrl,
        ...(apiKey ? { 'X-Typekit-Token': apiKey } : {}),
      },
    }).then(r => r.text());

    // Extract all @font-face blocks
    const faceRegex = /@font-face\s*\{[^}]+\}/g;
    const allFaces = kitCss.match(faceRegex) ?? [];

    // Keep forma-djr-hebrew-banner and schablona faces
    const targetFaces = allFaces.filter(f => {
      const lower = f.toLowerCase();
      return lower.includes('forma-djr-hebrew-banner') || lower.includes('schablona');
    });

    const embeddedFaces: string[] = [];

    for (const face of targetFaces) {
      // Find woff2 URL in this face
      const urlMatch = face.match(/url\(["']?([^"')]+\.woff2[^"')"]*)/i);
      if (!urlMatch) continue;

      try {
        const fontBuffer = await fetch(urlMatch[1], {
          headers: {
            'Referer': appUrl,
            ...(apiKey ? { 'X-Typekit-Token': apiKey } : {}),
          },
        }).then(r => r.arrayBuffer());

        const base64 = Buffer.from(fontBuffer).toString('base64');
        // Replace the src line with embedded data URI
        const embedded = face.replace(
          /src\s*:[\s\S]+?;/,
          `src: url('data:font/woff2;base64,${base64}') format('woff2');`
        );
        embeddedFaces.push(embedded);
      } catch {
        // Font file couldn't be fetched — skip
      }
    }

    cachedCss = embeddedFaces.join('\n');
    return NextResponse.json({ css: cachedCss });
  } catch (err) {
    console.error('[font-embed]', err);
    return NextResponse.json({ css: '' });
  }
}
