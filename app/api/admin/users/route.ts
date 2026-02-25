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

  const { data: usersData, error: usersError } = await admin.auth.admin.listUsers();
  if (usersError) return NextResponse.json({ error: usersError.message }, { status: 500 });

  const { data: invitations } = await admin
    .from('invitations')
    .select('user_id');

  const countByUser: Record<string, number> = {};
  for (const inv of invitations ?? []) {
    countByUser[inv.user_id] = (countByUser[inv.user_id] ?? 0) + 1;
  }

  const users = usersData.users.map(u => ({
    id: u.id,
    email: u.email ?? '—',
    created_at: u.created_at,
    invitationCount: countByUser[u.id] ?? 0,
  }));

  users.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return NextResponse.json({ users });
}
