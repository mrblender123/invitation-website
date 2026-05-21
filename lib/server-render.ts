import { readdir, readFile } from 'fs/promises';
import path from 'path';
import sharp from 'sharp';
import { PDFDocument } from 'pdf-lib';

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function injectFieldValues(svgContent: string, fieldValues: Record<string, string>): string {
  let result = svgContent;
  for (const [rawId, value] of Object.entries(fieldValues)) {
    if (!value) continue;
    for (const id of [rawId, `${rawId}*`]) {
      const esc = escapeRegExp(id);
      result = result.replace(
        new RegExp(`(<g[^>]+id=["']${esc}["'][^>]*>[\\s\\S]*?<tspan[^>]*>)[^<]*(</tspan>)`, 'g'),
        `$1${escapeXml(value)}$2`,
      );
    }
  }
  return result;
}

interface TemplatePaths {
  svgPath: string;
  backgroundUrl: string;
}

async function resolveTemplate(templateId: string): Promise<TemplatePaths | null> {
  const R2 = process.env.R2_PUBLIC_URL?.replace(/\/$/, '') ?? '';
  const encode = (s: string) => s.split('/').map(encodeURIComponent).join('/');
  const templatesDir = path.join(process.cwd(), 'public', 'templates');

  const folders = await readdir(templatesDir, { withFileTypes: true });
  for (const folder of folders.filter(f => f.isDirectory())) {
    const folderPath = path.join(templatesDir, folder.name);
    const files = await readdir(folderPath, { withFileTypes: true });
    const subDirs = files.filter(f => f.isDirectory());

    if (subDirs.length > 0) {
      for (const subDir of subDirs) {
        const subPath = path.join(folderPath, subDir.name);
        const subFiles = await readdir(subPath);
        for (const f of subFiles.filter(f => /\.svg$/i.test(f))) {
          const stem = f.replace(/\.svg$/i, '');
          if (`${folder.name}-${subDir.name}-${stem}` === templateId) {
            return {
              svgPath: path.join(subPath, f),
              backgroundUrl: `${R2}/templates/${encode(folder.name)}/${encode(subDir.name)}/${encode(stem)}.webp`,
            };
          }
        }
      }
    } else {
      for (const f of files.filter(f => f.isFile() && /\.svg$/i.test(f.name))) {
        const stem = f.name.replace(/\.svg$/i, '');
        if (`${folder.name}-${stem}` === templateId) {
          return {
            svgPath: path.join(folderPath, f.name),
            backgroundUrl: `${R2}/templates/${encode(folder.name)}/${encode(stem)}.webp`,
          };
        }
      }
    }
  }
  return null;
}

async function buildFontFaceStyle(): Promise<string> {
  const fontsDir = path.join(process.cwd(), 'public', 'fonts');
  const rules: string[] = [];
  try {
    const files = await readdir(fontsDir);
    for (const file of files.filter(f => /\.ttf$/i.test(f))) {
      const buf = await readFile(path.join(fontsDir, file));
      const b64 = buf.toString('base64');
      // Derive family name from filename (e.g. "Heebo[wght].ttf" → "Heebo", "SecularOne-Regular.ttf" → "Secular One")
      const family = file
        .replace(/\.ttf$/i, '')
        .replace(/\[.*?\]/g, '')      // strip variable font axis e.g. [wght]
        .replace(/-Regular$/i, '')
        .replace(/([a-z])([A-Z])/g, '$1 $2') // CamelCase → "Camel Case"
        .trim();
      rules.push(
        `@font-face { font-family: '${family}'; src: url('data:font/truetype;base64,${b64}') format('truetype'); font-weight: 100 900; }`,
      );
    }
  } catch { /* fonts dir missing — render with system fonts */ }
  return rules.join('\n');
}

export async function renderTemplateToPng(
  templateId: string,
  fieldValues: Record<string, string>,
): Promise<Buffer | null> {
  const resolved = await resolveTemplate(templateId);
  if (!resolved) {
    console.error('[render] template not found:', templateId);
    return null;
  }

  const svgContent = await readFile(resolved.svgPath, 'utf-8');
  const injected = injectFieldValues(svgContent, fieldValues);

  // Parse viewBox
  const vbMatch = injected.match(/viewBox=["']([^"']+)["']/);
  const vbParts = vbMatch?.[1].trim().split(/[\s,]+/) ?? [];
  const svgW = vbParts.length >= 4 ? Math.round(parseFloat(vbParts[2])) : 444;
  const svgH = vbParts.length >= 4 ? Math.round(parseFloat(vbParts[3])) : 630;

  // Extract inner content: strip <svg> wrapper and any <image> tags
  const innerContent = injected
    .replace(/^[\s\S]*?<svg[^>]*>/, '')
    .replace(/<\/svg>[\s\S]*$/, '')
    .replace(/<image[^/]*(\/?>|>[\s\S]*?<\/image>)/gi, '');

  // Embed fonts
  const fontStyle = await buildFontFaceStyle();

  // Fetch background from R2 and convert to PNG for embedding
  let bgDataUri = '';
  try {
    const bgRes = await fetch(resolved.backgroundUrl);
    if (bgRes.ok) {
      const bgBuf = Buffer.from(await bgRes.arrayBuffer());
      const bgPng = await sharp(bgBuf).resize(svgW * 2, svgH * 2).png().toBuffer();
      bgDataUri = `data:image/png;base64,${bgPng.toString('base64')}`;
    }
  } catch (e) {
    console.error('[render] background fetch error:', e);
  }

  // Build a self-contained SVG: fonts + background image + text layer
  const combinedSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"
     viewBox="0 0 ${svgW} ${svgH}" width="${svgW * 2}" height="${svgH * 2}">
  <defs>
    <style>${fontStyle}</style>
  </defs>
  ${bgDataUri ? `<image href="${bgDataUri}" x="0" y="0" width="${svgW}" height="${svgH}" preserveAspectRatio="xMidYMid slice"/>` : ''}
  ${innerContent}
</svg>`;

  // Render with sharp (uses librsvg internally)
  return await sharp(Buffer.from(combinedSvg)).png().toBuffer();
}

export async function pngToPdf(pngBuffer: Buffer): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  const img = await pdf.embedPng(pngBuffer);
  const page = pdf.addPage([img.width, img.height]);
  page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
  return Buffer.from(await pdf.save());
}
