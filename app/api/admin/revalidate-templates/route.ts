import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { createAuthenticatedClient } from '@/lib/supabase';

const ADMIN_EMAIL = 'bycheshin@gmail.com';

export async function POST(req: NextRequest) {
  const auth = req.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const token = auth.slice(7);
  const { data: { user }, error } = await createAuthenticatedClient(token).auth.getUser();
  if (error || user?.email !== ADMIN_EMAIL) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  revalidatePath('/api/templates');
  return NextResponse.json({ ok: true });
}
