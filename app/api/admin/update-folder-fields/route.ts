import { NextRequest, NextResponse } from 'next/server';
import { readdir, readFile, writeFile } from 'fs/promises';
import path from 'path';
import { revalidatePath } from 'next/cache';
import { createAuthenticatedClient } from '@/lib/supabase';

const ADMIN_EMAIL = 'bycheshin@gmail.com';

async function verifyAdmin(req: NextRequest): Promise<boolean> {
  const auth = req.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return false;
  const token = auth.slice(7);
  const { data: { user }, error } = await createAuthenticatedClient(token).auth.getUser();
  return !error && user?.email === ADMIN_EMAIL;
}

// ── SVG manipulation ──────────────────────────────────────────────────────────

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function findMatchingClose(svg: string, start: number): number {
  let depth = 0, i = start;
  while (i < svg.length) {
    const open  = svg.indexOf('<g', i);
    const close = svg.indexOf('</g>', i);
    if (close === -1) return -1;
    if (open !== -1 && open < close) {
      const c = svg[open + 2];
      if (c === ' ' || c === '\t' || c === '\n' || c === '\r' || c === '>') depth++;
      i = open + 2;
    } else {
      if (--depth === 0) return close + 4;
      i = close + 4;
    }
  }
  return -1;
}

function extractFieldBlocks(svg: string) {
  const blocks: { fullId: string; id: string; required: boolean; start: number; end: number; content: string }[] = [];
  const re = /<g\b[^>]*\bid="([A-Za-z][^"]*)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(svg)) !== null) {
    const fullId = m[1];
    const start  = m.index;
    const end    = findMatchingClose(svg, start);
    if (end === -1) continue;
    blocks.push({ fullId, id: fullId.replace(/\*$/, ''), required: fullId.endsWith('*'), start, end, content: svg.slice(start, end) });
  }
  return blocks;
}

function applyFieldChanges(svg: string, fields: { id: string; required: boolean }[]): string {
  let result = svg;

  // Step 1: apply required changes
  for (const { id, required } of fields) {
    const e = escapeRegex(id);
    if (required) {
      result = result.replace(new RegExp(`\\bid="${e}"`, 'g'), `id="${id}*"`);
    } else {
      result = result.replace(new RegExp(`\\bid="${e}\\*"`, 'g'), `id="${id}"`);
    }
  }

  // Step 2: reorder using updated fullIds
  const desiredFullIds = fields.map(f => f.required ? `${f.id}*` : f.id);
  const blocks = extractFieldBlocks(result);
  if (!blocks.length) return result;

  const contentMap: Record<string, string> = Object.fromEntries(blocks.map(b => [b.fullId, b.content]));
  const inOrder      = new Set(desiredFullIds.filter(id => id in contentMap));
  const orderedBlocks = blocks.filter(b => inOrder.has(b.fullId));
  const filteredOrder = desiredFullIds.filter(id => id in contentMap);
  if (orderedBlocks.length !== filteredOrder.length) return result;

  const replacements = orderedBlocks
    .map((b, i) => ({ start: b.start, end: b.end, newContent: contentMap[filteredOrder[i]] }))
    .sort((a, b) => b.start - a.start);

  for (const { start, end, newContent } of replacements) {
    result = result.slice(0, start) + newContent + result.slice(end);
  }
  return result;
}

// ── GitHub helper (same pattern as update-svg) ────────────────────────────────

async function writeFileToGitHub(relativePath: string, content: string): Promise<void> {
  const githubToken = process.env.GITHUB_TOKEN!;
  const repo        = process.env.GITHUB_REPO!;
  const branch      = process.env.GITHUB_BRANCH ?? 'main';
  const filePath    = `public/${relativePath}`;
  const apiUrl      = `https://api.github.com/repos/${repo}/contents/${encodeURIComponent(filePath).replace(/%2F/g, '/')}`;
  const headers = {
    Authorization: `Bearer ${githubToken}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'Content-Type': 'application/json',
  };
  const getRes  = await fetch(`${apiUrl}?ref=${branch}`, { headers });
  const getJson = await getRes.json();
  await fetch(apiUrl, {
    method: 'PUT', headers,
    body: JSON.stringify({
      message: `Update ${filePath} via field manager`,
      content: Buffer.from(content, 'utf-8').toString('base64'),
      sha: getJson.sha,
      branch,
    }),
  });
}

// ── Route ─────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  if (!await verifyAdmin(req)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { folderPath, fields } = await req.json() as {
    folderPath: string;
    fields: { id: string; required: boolean }[];
  };

  if (!folderPath || !Array.isArray(fields)) {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  const absFolder = path.join(process.cwd(), folderPath);
  const entries   = await readdir(absFolder);
  const svgFiles  = entries.filter(f => f.toLowerCase().endsWith('.svg') && !f.startsWith('_'));

  let count = 0;
  for (const file of svgFiles) {
    const absPath = path.join(absFolder, file);
    const orig    = await readFile(absPath, 'utf-8');
    const updated = applyFieldChanges(orig, fields);
    if (updated === orig) continue;

    if (process.env.NODE_ENV === 'development') {
      await writeFile(absPath, updated, 'utf-8');
    } else {
      const relPath = path.relative(path.join(process.cwd(), 'public'), absPath).replace(/\\/g, '/');
      await writeFileToGitHub(relPath, updated);
    }
    count++;
  }

  revalidatePath('/api/templates');
  return NextResponse.json({ ok: true, count });
}
