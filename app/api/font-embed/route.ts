import { NextResponse } from 'next/server';

// Cache the result in memory for the lifetime of the server process
let cachedCss: string | null = null;

export async function GET() {
  if (cachedCss !== null) {
    return NextResponse.json({ css: cachedCss });
  }

  try {
    // Fetch the Typekit CSS (kit hat2kft)
    const kitCss = await fetch('https://use.typekit.net/hat2kft.css', {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Referer': process.env.NEXT_PUBLIC_APP_URL ?? 'https://pintle.co',
      },
    }).then(r => r.text());

    // Extract all @font-face blocks
    const faceRegex = /@font-face\s*\{[^}]+\}/g;
    const allFaces = kitCss.match(faceRegex) ?? [];

    // Keep only forma-djr-hebrew-banner faces
    const targetFaces = allFaces.filter(f =>
      f.toLowerCase().includes('forma-djr-hebrew-banner')
    );

    const embeddedFaces: string[] = [];

    for (const face of targetFaces) {
      // Find woff2 URL in this face
      const urlMatch = face.match(/url\(["']?([^"')]+\.woff2[^"')"]*)/i);
      if (!urlMatch) continue;

      try {
        const fontBuffer = await fetch(urlMatch[1], {
          headers: { 'Referer': process.env.NEXT_PUBLIC_APP_URL ?? 'https://pintle.co' },
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
