import { NextRequest, NextResponse } from 'next/server';
import { createAuthenticatedClient, createServiceClient } from '@/lib/supabase';

const ADMIN_EMAIL = 'bycheshin@gmail.com';

async function verifyAdmin(req: NextRequest): Promise<string | null> {
  const auth = req.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  const token = auth.slice(7);
  const { data: { user }, error } = await createAuthenticatedClient(token).auth.getUser();
  if (error || !user || user.email !== ADMIN_EMAIL) return null;
  return user.id;
}

export async function GET(req: NextRequest) {
  const adminId = await verifyAdmin(req);
  if (!adminId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const admin = createServiceClient();

  const { count: totalInvitations } = await admin
    .from('invitations')
    .select('*', { count: 'exact', head: true });

  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const { count: invitationsThisWeek } = await admin
    .from('invitations')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', weekAgo.toISOString());

  const { data: usersData } = await admin.auth.admin.listUsers();
  const totalSignedUpUsers = usersData?.users?.length ?? 0;

  return NextResponse.json({
    totalUsers: totalSignedUpUsers,
    totalInvitations: totalInvitations ?? 0,
    invitationsThisWeek: invitationsThisWeek ?? 0,
  });
}
