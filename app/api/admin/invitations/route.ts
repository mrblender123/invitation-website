import { NextRequest, NextResponse } from 'next/server';
import { createAuthenticatedClient, createServiceClient } from '@/lib/supabase';

const ADMIN_EMAIL = 'bycheshin@gmail.com';

async function verifyAdmin(req: NextRequest): Promise<boolean> {
  const auth = req.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return false;
  const token = auth.slice(7);
  const { data: { user }, error } = await createAuthenticatedClient(token).auth.getUser();
  return !error && user?.email === ADMIN_EMAIL;
}

export async function GET(req: NextRequest) {
  if (!(await verifyAdmin(req))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const admin = createServiceClient();

  const { data: invitations, error } = await admin
    .from('invitations')
    .select('id, name, event_title, host_name, date_time, created_at, user_id')
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: usersData } = await admin.auth.admin.listUsers();
  const emailById: Record<string, string> = {};
  for (const u of usersData?.users ?? []) {
    emailById[u.id] = u.email ?? '—';
  }

  const enriched = (invitations ?? []).map(inv => ({
    ...inv,
    user_email: emailById[inv.user_id] ?? '—',
  }));

  return NextResponse.json({ invitations: enriched });
}

export async function DELETE(req: NextRequest) {
  if (!(await verifyAdmin(req))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const admin = createServiceClient();
  const { error } = await admin.from('invitations').delete().eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
