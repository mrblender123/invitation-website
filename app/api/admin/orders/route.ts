import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServiceClient } from '@/lib/supabase';

const ADMIN_EMAIL = 'bycheshin@gmail.com';

async function getEmail(req: NextRequest): Promise<string | null> {
  const token = req.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return null;
  const { data } = await createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  ).auth.getUser(token);
  return data.user?.email ?? null;
}

export async function GET(req: NextRequest) {
  const email = await getEmail(req);
  if (email !== ADMIN_EMAIL) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

  const db = createServiceClient();
  const { data, error } = await db
    .from('orders')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}
