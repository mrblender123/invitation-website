import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';

const ADMIN_EMAIL = 'bycheshin@gmail.com';

export const DEFAULT_BANNER = {
  enabled: false,
  text: '',
  link: '',
  linkLabel: 'Learn more →',
  size: 'small' as 'small' | 'large',
  style: 'dark' as 'dark' | 'light' | 'accent',
};

// Public GET — called by AnnouncementBanner on every page load
export async function GET() {
  try {
    const db = createServiceClient();
    const { data } = await db
      .from('site_settings')
      .select('value')
      .eq('key', 'banner')
      .single();

    return NextResponse.json(data?.value ?? DEFAULT_BANNER, {
      headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' },
    });
  } catch {
    return NextResponse.json(DEFAULT_BANNER);
  }
}

// Protected POST — admin only
export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization') ?? '';
  const token = auth.replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Verify token against Supabase
  const db = createServiceClient();
  const { data: { user }, error } = await db.auth.getUser(token);
  if (error || user?.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json();
  await db.from('site_settings').upsert({ key: 'banner', value: body, updated_at: new Date().toISOString() });

  return NextResponse.json({ ok: true });
}
