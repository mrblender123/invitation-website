import { NextResponse } from 'next/server';
import { readdir, readFile } from 'fs/promises';
import path from 'path';
import type { Template, SvgField } from '@/lib/templates';
import { FOLDER_TO_CATEGORY } from '@/lib/categories';

export const revalidate = 3600; // cache for 1 hour

const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL?.replace(/\/$/, '') ?? '';

/** Build a valid URL from an R2 base + path segments, encoding each segment */
function r2Url(base: string, ...segments: string[]): string {
  return base + '/' + segments.map(s => s.split('/').map(encodeURIComponent).join('/')).join('/');
}

/** "bar-mitzvah" → "Bar Mitzvah", with override map for special chars */
function folderToCategory(folder: string): string {
  if (FOLDER_TO_CATEGORY[folder]) return FOLDER_TO_CATEGORY[folder];
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
  const seenIds = new Set<string>();
  const gTagRegex = /<g\b([^>]*)>/g;
  let m: RegExpExecArray | null;

  const entries: Array<{ id: string; label: string; placeholder: string; hasStar: boolean }> = [];

  while ((m = gTagRegex.exec(content)) !== null) {
    const attrs = m[1];
    const idMatch = attrs.match(/\bid="([^"]+)"/);
    if (!idMatch) continue;
    const rawId = idMatch[1];
    const hasStar = rawId.includes('*');
    const gId = rawId.replace(/\*/g, '').trim(); // strip asterisks and whitespace

    // Skip system / static groups
    if (!gId) continue;
    if (seenIds.has(gId)) continue;
    if (SKIP_IDS.has(gId.toLowerCase())) continue;
    if (/^layer/i.test(gId)) continue;
    seenIds.add(gId);

    // Find first <tspan> after this group's opening tag to use as placeholder
    const afterTag = content.slice(m.index + m[0].length);
    const tspanMatch = afterTag.match(/<tspan[^>]*>([^<]*)</);
    const placeholder = tspanMatch?.[1]?.trim() ?? '';

    entries.push({ id: gId, label: idToLabel(gId), placeholder, hasStar });
  }

  // Star convention: * = required/always-shown. No star = optional (hidden until user expands).
  // Exception: if NO fields have *, treat all as required (legacy templates with no stars).
  const anyHasStar = entries.some(e => e.hasStar);
  const fields: SvgField[] = entries.map(e => ({
    id: e.id, label: e.label, placeholder: e.placeholder, rtl: true,
    ...(anyHasStar && !e.hasStar && { optional: true }),
  }));

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
      const files      = await readdir(folderPath, { withFileTypes: true });

      // Check if this folder contains sub-folders (sub-categories)
      const subDirs = files.filter(f => f.isDirectory());

      if (subDirs.length > 0) {
        // 2-level structure: category/subcategory/images
        for (const subDir of subDirs.sort((a, b) => a.name.localeCompare(b.name))) {
          const subcategory   = subDir.name.trim();
          const subFolderPath = path.join(folderPath, subDir.name);
          const subFiles      = await readdir(subFolderPath);

          // Discover templates from SVG files (PNGs live on R2, not local)
          const svgFiles = subFiles.filter(f => /\.svg$/i.test(f)).sort();

          for (const svgFile of svgFiles) {
            const stem          = svgFile.replace(/\.svg$/i, '');
            const imgFile       = `${stem}.png`;
            const thumbFileName = `${stem}-thumb.png`;

            const id            = `${folder}-${subDir.name}-${stem}`;
            const localBase     = `/templates/${folder}/${subDir.name}`;
            const backgroundSrc = R2_PUBLIC_URL
              ? r2Url(R2_PUBLIC_URL, 'templates', folder, subDir.name, imgFile)
              : `${localBase}/${imgFile}`;
            const thumbnailSrc  = R2_PUBLIC_URL
              ? r2Url(R2_PUBLIC_URL, 'templates', folder, subDir.name, thumbFileName)
              : backgroundSrc;

            const svgPath   = path.join(subFolderPath, svgFile);
            const svgPublic = R2_PUBLIC_URL
              ? r2Url(R2_PUBLIC_URL, 'templates', folder, subDir.name, svgFile)
              : `${localBase}/${svgFile}`;
            const content   = await readFile(svgPath, 'utf-8');
            const svgData   = parseSvg(content, svgPublic);

            templates.push({
              id,
              name: stemToName(stem),
              category,
              subcategory,
              thumbnailSrc,
              backgroundSrc,
              ...svgData,
            } as Template);
          }
        }
      } else {
        // Flat structure: category/images (legacy / no sub-categories)
        const flatFileNames = files.map(f => f.name);
        const svgFiles      = flatFileNames.filter(f => /\.svg$/i.test(f)).sort();

        for (const svgFile of svgFiles) {
          const stem          = svgFile.replace(/\.svg$/i, '');
          const imgFile       = `${stem}.png`;
          const thumbFileName = `${stem}-thumb.png`;

          const id            = `${folder}-${stem}`;
          const localBase     = `/templates/${folder}`;
          const backgroundSrc = R2_PUBLIC_URL
            ? r2Url(R2_PUBLIC_URL, 'templates', folder, imgFile)
            : `${localBase}/${imgFile}`;
          const thumbnailSrc  = R2_PUBLIC_URL
            ? r2Url(R2_PUBLIC_URL, 'templates', folder, thumbFileName)
            : backgroundSrc;

          const svgPath   = path.join(folderPath, svgFile);
          const svgPublic = R2_PUBLIC_URL
            ? r2Url(R2_PUBLIC_URL, 'templates', folder, svgFile)
            : `${localBase}/${svgFile}`;
          const content   = await readFile(svgPath, 'utf-8');
          const svgData   = parseSvg(content, svgPublic);

          templates.push({
            id,
            name: stemToName(stem),
            category,
            thumbnailSrc,
            backgroundSrc,
            ...svgData,
          } as Template);
        }
      }
    }

    return NextResponse.json({ templates });
  } catch (err) {
    console.error('[/api/templates]', err);
    return NextResponse.json({ templates: [], error: String(err) }, { status: 500 });
  }
}
