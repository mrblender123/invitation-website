import { NextRequest, NextResponse } from 'next/server';

// Only proxy images from these known domains
const ALLOWED_HOSTS = [
  'pub-85c54822fbab4a3d8a76a9ac5c583022.r2.dev',
  'joy-send.com',
  'www.joy-send.com',
];

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url');
  if (!url) return NextResponse.json({ error: 'Missing url param' }, { status: 400 });

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return NextResponse.json({ error: 'Invalid URL' }, { status: 400 });
  }

  if (parsed.protocol !== 'https:' || !ALLOWED_HOSTS.includes(parsed.hostname)) {
    return NextResponse.json({ error: 'URL not allowed' }, { status: 403 });
  }

  try {
    const res = await fetch(url);
    if (!res.ok) return NextResponse.json({ error: 'Failed to fetch image' }, { status: 502 });

    const buffer = await res.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');
    const mimeType = res.headers.get('content-type') ?? 'image/jpeg';
    return NextResponse.json({ url: `data:${mimeType};base64,${base64}` });
  } catch {
    return NextResponse.json({ error: 'Proxy error' }, { status: 500 });
  }
}
