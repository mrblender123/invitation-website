import { NextRequest, NextResponse } from 'next/server';
import { writeFile } from 'fs/promises';
import path from 'path';
import { createAuthenticatedClient } from '@/lib/supabase';

const ADMIN_EMAIL = 'bycheshin@gmail.com';

async function verifyAdmin(req: NextRequest): Promise<boolean> {
  const auth = req.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return false;
  const token = auth.slice(7);
  const { data: { user }, error } = await createAuthenticatedClient(token).auth.getUser();
  return !error && user?.email === ADMIN_EMAIL;
}

export async function POST(req: NextRequest) {
  if (!await verifyAdmin(req)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { svgPublicPath, svgContent } = await req.json();

  if (
    typeof svgPublicPath !== 'string' ||
    !svgPublicPath.startsWith('/templates/') ||
    !svgPublicPath.toLowerCase().endsWith('.svg') ||
    svgPublicPath.includes('..')
  ) {
    return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
  }

  const filePath = path.join(process.cwd(), 'public', svgPublicPath);
  await writeFile(filePath, svgContent, 'utf-8');

  return NextResponse.json({ ok: true });
}
