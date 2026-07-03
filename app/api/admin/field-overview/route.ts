import { NextRequest, NextResponse } from 'next/server';
import { readdir, readFile, stat } from 'fs/promises';
import path from 'path';
import { createAuthenticatedClient } from '@/lib/supabase';

const TEMPLATES_DIR = path.join(process.cwd(), 'public', 'templates');
const ADMIN_EMAIL = 'bycheshin@gmail.com';

async function verifyAdmin(req: NextRequest): Promise<boolean> {
  const auth = req.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return false;
  const token = auth.slice(7);
  const { data: { user }, error } = await createAuthenticatedClient(token).auth.getUser();
  return !error && user?.email === ADMIN_EMAIL;
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

function extractFields(svg: string) {
  const fields: { id: string; required: boolean; placeholder: string }[] = [];
  const re = /<g\b[^>]*\bid="([A-Za-z][^"]*)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(svg)) !== null) {
    const fullId = m[1];
    const start  = m.index;
    const end    = findMatchingClose(svg, start);
    if (end === -1) continue;
    const content = svg.slice(start, end);
    const tspan   = content.match(/<tspan[^>]*>([^<]+)</);
    fields.push({
      id:          fullId.replace(/\*$/, ''),
      required:    fullId.endsWith('*'),
      placeholder: tspan ? tspan[1].trim() : '',
    });
  }
  return fields;
}

async function getSvgFolders(): Promise<string[]> {
  const folders: string[] = [];
  async function scan(dir: string, depth = 0) {
    if (depth > 2) return;
    let entries: string[];
    try { entries = await readdir(dir); } catch { return; }
    const hasSvg = entries.some(f => f.toLowerCase().endsWith('.svg') && !f.startsWith('_'));
    if (hasSvg) { folders.push(dir); return; }
    for (const e of entries) {
      const full = path.join(dir, e);
      try {
        const s = await stat(full);
        if (s.isDirectory()) await scan(full, depth + 1);
      } catch {}
    }
  }
  await scan(TEMPLATES_DIR);
  return folders.sort();
}

export async function GET(req: NextRequest) {
  if (!await verifyAdmin(req)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  try {
    const folders = await getSvgFolders();
    const result = [];
    for (const folder of folders) {
      const entries = await readdir(folder);
      const svgFile = entries.find(f => f.toLowerCase().endsWith('.svg') && !f.startsWith('_'));
      if (!svgFile) continue;
      const svg = await readFile(path.join(folder, svgFile), 'utf-8');
      const fields = extractFields(svg);
      const rel   = path.relative(TEMPLATES_DIR, folder);
      const parts = rel.split(path.sep);
      result.push({
        folder:   path.relative(process.cwd(), folder).replace(/\\/g, '/'),
        category: parts[0],
        name:     parts[parts.length - 1],
        fields,
      });
    }
    return NextResponse.json(result);
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
