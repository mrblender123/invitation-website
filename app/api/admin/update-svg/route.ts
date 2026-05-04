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

  if (typeof svgPublicPath !== 'string' || !svgPublicPath.toLowerCase().endsWith('.svg')) {
    return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
  }

  // Accept both "/templates/..." local paths and full R2 URLs
  let relativePath: string; // e.g. "/templates/It's a boy/PH-01.svg"
  const r2PublicUrl = process.env.R2_PUBLIC_URL?.replace(/\/$/, '') ?? '';
  if (r2PublicUrl && svgPublicPath.startsWith(r2PublicUrl)) {
    // Strip R2 base URL and decode percent-encoding
    relativePath = decodeURIComponent(svgPublicPath.slice(r2PublicUrl.length));
  } else if (svgPublicPath.startsWith('/templates/')) {
    relativePath = svgPublicPath;
  } else {
    return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
  }

  if (relativePath.includes('..')) {
    return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
  }

  // In development: write directly to local filesystem (fast, immediate)
  if (process.env.NODE_ENV === 'development') {
    const localPath = path.join(process.cwd(), 'public', relativePath);
    await writeFile(localPath, svgContent, 'utf-8');
    return NextResponse.json({ ok: true });
  }

  const githubToken = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPO;
  const branch = process.env.GITHUB_BRANCH ?? 'main';

  if (!githubToken || !repo) {
    return NextResponse.json({ error: 'GitHub not configured' }, { status: 500 });
  }

  // File path in the repo (public/templates/...)
  const filePath = `public${relativePath}`;
  const apiUrl = `https://api.github.com/repos/${repo}/contents/${filePath}`;
  const headers = {
    Authorization: `Bearer ${githubToken}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'Content-Type': 'application/json',
  };

  // Get current file SHA (required for updates)
  const getRes = await fetch(`${apiUrl}?ref=${branch}`, { headers });
  if (!getRes.ok) {
    return NextResponse.json({ error: `GitHub GET failed: ${getRes.status}` }, { status: 500 });
  }
  const getJson = await getRes.json();
  const sha: string = getJson.sha;

  // Commit updated content
  const content = Buffer.from(svgContent, 'utf-8').toString('base64');
  const putRes = await fetch(apiUrl, {
    method: 'PUT',
    headers,
    body: JSON.stringify({
      message: `Update ${svgPublicPath} via template editor`,
      content,
      sha,
      branch,
    }),
  });

  if (!putRes.ok) {
    const err = await putRes.text();
    return NextResponse.json({ error: `GitHub PUT failed: ${err}` }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
