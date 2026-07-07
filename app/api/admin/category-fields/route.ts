import { NextRequest, NextResponse } from 'next/server';
import { readdir, readFile } from 'fs/promises';
import path from 'path';
import { createServiceClient, createAuthenticatedClient } from '@/lib/supabase';

const TEMPLATES_DIR = path.join(process.cwd(), 'public', 'templates');
const ADMIN_EMAIL = 'bycheshin@gmail.com';

async function verifyAdmin(req: NextRequest): Promise<boolean> {
  const auth = req.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return false;
  const token = auth.slice(7);
  const { data: { user }, error } = await createAuthenticatedClient(token).auth.getUser();
  return !error && user?.email === ADMIN_EMAIL;
}

const SKIP_IDS = new Set(['static_text', 'layer_1', 'layer 1', 'background', 'layer']);

function extractFields(svg: string): Array<{ id: string; placeholder: string }> {
  const results: Array<{ id: string; placeholder: string }> = [];
  const seen = new Set<string>();
  const re = /<g\b[^>]*\bid="([^"]+)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(svg)) !== null) {
    const raw = m[1];
    const id = raw.replace(/\*/g, '').trim();
    if (!id || !/^[A-Za-z]/.test(id)) continue;
    if (SKIP_IDS.has(id.toLowerCase())) continue;
    if (/^layer/i.test(id)) continue;
    if (/^line_\d/.test(id)) continue;
    if (seen.has(id)) continue;
    seen.add(id);
    // grab the first tspan text after this group tag as placeholder
    const after = svg.slice(m.index + m[0].length);
    const tspan = after.match(/<tspan[^>]*>([^<]+)</);
    const placeholder = tspan?.[1]?.trim() ?? '';
    results.push({ id, placeholder });
  }
  return results;
}

// GET — returns union of all field IDs from SVGs in the folder, merged with Supabase config.
// Used by the admin category-fields editor.
export async function GET(req: NextRequest) {
  if (!await verifyAdmin(req)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const folder = req.nextUrl.searchParams.get('folder');
  if (!folder) return NextResponse.json({ error: 'folder required' }, { status: 400 });

  const folderAbs = path.join(TEMPLATES_DIR, folder);

  // Collect all unique named field IDs across all SVGs in the folder
  let files: string[] = [];
  try { files = await readdir(folderAbs); } catch {
    return NextResponse.json({ error: 'Folder not found' }, { status: 404 });
  }
  const svgFiles = files.filter(f => /\.svg$/i.test(f) && !/-thumb\.svg$/i.test(f));

  const allIds = new Set<string>();
  const placeholderMap: Record<string, string> = {}; // first seen placeholder per field id
  const perTemplate: Record<string, string[]> = {};
  for (const f of svgFiles) {
    try {
      const content = await readFile(path.join(folderAbs, f), 'utf-8');
      const fields = extractFields(content);
      perTemplate[f] = fields.map(fld => fld.id);
      for (const { id, placeholder } of fields) {
        allIds.add(id);
        if (!placeholderMap[id] && placeholder) placeholderMap[id] = placeholder;
      }
    } catch { /* skip unreadable files */ }
  }

  // Count how many templates have each field
  const templateCount = svgFiles.length;
  const fieldCounts: Record<string, number> = {};
  for (const ids of Object.values(perTemplate)) {
    for (const id of ids) fieldCounts[id] = (fieldCounts[id] ?? 0) + 1;
  }

  // Load saved config from Supabase
  const { data: configRows } = await createServiceClient()
    .from('category_field_config')
    .select('field_id, required, sort_order')
    .eq('folder', folder)
    .order('sort_order');

  const configMap = new Map(
    (configRows ?? []).map(r => [r.field_id, { required: r.required, sort_order: r.sort_order }])
  );

  // Merge: configured fields first (in order), then unconfigured fields at the end
  const configured = (configRows ?? []).map(r => r.field_id);
  const unconfigured = [...allIds].filter(id => !configMap.has(id));
  const orderedIds = [...configured.filter(id => allIds.has(id)), ...unconfigured];

  const fields = orderedIds.map((id, i) => ({
    id,
    label: id.replace(/[-_]/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()),
    placeholder: placeholderMap[id] ?? '',
    required: configMap.get(id)?.required ?? true,
    sort_order: configMap.get(id)?.sort_order ?? (configured.length + i),
    inTemplates: fieldCounts[id] ?? 0,
    templateCount,
  }));

  return NextResponse.json({ folder, fields });
}

// POST — save category field config to Supabase
export async function POST(req: NextRequest) {
  if (!await verifyAdmin(req)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { folder, fields } = await req.json() as {
    folder: string;
    fields: Array<{ id: string; required: boolean; order: number }>;
  };

  if (!folder || !Array.isArray(fields)) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  const db = createServiceClient();

  // Delete old config for this folder, then insert new
  await db.from('category_field_config').delete().eq('folder', folder);

  const rows = fields.map((f, i) => ({
    folder,
    field_id: f.id,
    required: f.required,
    sort_order: f.order ?? i,
  }));

  const { error } = await db.from('category_field_config').insert(rows);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
