import { NextResponse } from 'next/server';
import { readdir, readFile } from 'fs/promises';
import path from 'path';
import type { Template, SvgField } from '@/lib/templates';

/** "bar-mitzvah" → "Bar Mitzvah" */
function folderToCategory(folder: string): string {
  return folder.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

/** "classic-cream" → "Classic Cream" */
function stemToName(stem: string): string {
  return stem.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

/** "name_signature" → "Name Signature" */
function idToLabel(id: string): string {
  return id.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

const SKIP_IDS = new Set(['static_text', 'layer_1', 'layer 1', 'background']);

function parseSvg(content: string, publicUrl: string): Pick<Template, 'textSvg' | 'fields' | 'style'> {
  // Extract viewBox → canvas size
  let canvasWidth = 444, canvasHeight = 630;
  const vbMatch = content.match(/viewBox=["']([^"']+)["']/);
  if (vbMatch) {
    const parts = vbMatch[1].trim().split(/[\s,]+/);
    if (parts.length >= 4) {
      canvasWidth  = Math.round(parseFloat(parts[2]));
      canvasHeight = Math.round(parseFloat(parts[3]));
    }
  }

  // Collect all <g id="..."> in document order
  const fields: SvgField[] = [];
  const seenIds = new Set<string>();
  const gTagRegex = /<g\b([^>]*)>/g;
  let m: RegExpExecArray | null;

  while ((m = gTagRegex.exec(content)) !== null) {
    const attrs = m[1];
    const idMatch = attrs.match(/\bid="([^"]+)"/);
    if (!idMatch) continue;
    const gId = idMatch[1];

    // Skip system / static groups
    if (seenIds.has(gId)) continue;
    if (SKIP_IDS.has(gId.toLowerCase())) continue;
    if (/^layer/i.test(gId)) continue;
    seenIds.add(gId);

    // Find first <tspan> after this group's opening tag to use as placeholder
    const afterTag = content.slice(m.index + m[0].length);
    const tspanMatch = afterTag.match(/<tspan[^>]*>([^<]*)</);
    const placeholder = tspanMatch?.[1]?.trim() ?? '';

    fields.push({ id: gId, label: idToLabel(gId), placeholder, rtl: true });
  }

  return {
    textSvg: publicUrl,
    fields: fields.length > 0 ? fields : undefined,
    style: { canvasWidth, canvasHeight },
  };
}

export async function GET() {
  try {
    const templatesDir = path.join(process.cwd(), 'public', 'templates');
    const entries = await readdir(templatesDir, { withFileTypes: true });

    const templates: Template[] = [];

    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      if (!entry.isDirectory()) continue;

      const folder     = entry.name;
      const category   = folderToCategory(folder);
      const folderPath = path.join(templatesDir, folder);
      const files      = await readdir(folderPath);

      // Pair each image with its SVG (same stem)
      const imageFiles = files
        .filter(f => /\.(png|jpg|jpeg)$/i.test(f))
        .sort();

      for (const imgFile of imageFiles) {
        const stem    = imgFile.replace(/\.(png|jpg|jpeg)$/i, '');
        const svgFile = files.find(f => f.toLowerCase() === `${stem.toLowerCase()}.svg`);

        const id           = `${folder}-${stem}`;
        const thumbnailSrc = `/templates/${folder}/${imgFile}`;

        let svgData: Partial<Template> = { style: { canvasWidth: 444, canvasHeight: 630 } };

        if (svgFile) {
          const svgPath   = path.join(folderPath, svgFile);
          const svgPublic = `/templates/${folder}/${svgFile}`;
          const content   = await readFile(svgPath, 'utf-8');
          svgData = parseSvg(content, svgPublic);
        }

        templates.push({
          id,
          name: stemToName(stem),
          category,
          thumbnailSrc,
          ...svgData,
        } as Template);
      }
    }

    return NextResponse.json({ templates });
  } catch (err) {
    console.error('[/api/templates]', err);
    return NextResponse.json({ templates: [], error: String(err) }, { status: 500 });
  }
}
