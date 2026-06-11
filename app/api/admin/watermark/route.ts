// POST /api/admin/watermark — save or delete a watermark config for a template (admin only)
// DELETE /api/admin/watermark — remove a watermark config

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const ADMIN_EMAIL = 'bycheshin@gmail.com';

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

async function getEmail(req: NextRequest): Promise<string | null> {
  const token = req.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return null;
  const { data } = await createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  ).auth.getUser(token);
  return data.user?.email ?? null;
}

export async function POST(req: NextRequest) {
  const email = await getEmail(req);
  if (email !== ADMIN_EMAIL) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

  const { templateId, x, y, w, color, opacity } = await req.json();
  if (!templateId) return NextResponse.json({ error: 'Missing templateId' }, { status: 400 });

  const db = adminClient();
  const { error } = await db
    .from('template_watermarks')
    .upsert({ template_id: templateId, x, y, w, color, opacity }, { onConflict: 'template_id' });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const email = await getEmail(req);
  if (email !== ADMIN_EMAIL) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

  const { templateId } = await req.json();
  if (!templateId) return NextResponse.json({ error: 'Missing templateId' }, { status: 400 });

  const db = adminClient();
  const { error } = await db.from('template_watermarks').delete().eq('template_id', templateId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
