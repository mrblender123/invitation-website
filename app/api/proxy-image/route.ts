import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url');
  if (!url) return NextResponse.json({ error: 'Missing url param' }, { status: 400 });

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
