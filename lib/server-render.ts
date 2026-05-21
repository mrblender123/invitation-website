import { readdir, readFile } from 'fs/promises';
import path from 'path';
import { Resvg } from '@resvg/resvg-js';
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

async function loadFontFiles(): Promise<string[]> {
  const fontsDir = path.join(process.cwd(), 'public', 'fonts');
  try {
    const names = await readdir(fontsDir);
    return names
      .filter(n => /\.(ttf|otf)$/i.test(n))
      .map(n => path.join(fontsDir, n));
  } catch {
    return [];
  }
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

  const vbMatch = injected.match(/viewBox=["']([^"']+)["']/);
  const vbParts = vbMatch?.[1].trim().split(/[\s,]+/) ?? [];
  const svgW = vbParts.length >= 4 ? Math.round(parseFloat(vbParts[2])) : 444;
  const svgH = vbParts.length >= 4 ? Math.round(parseFloat(vbParts[3])) : 630;

  const fontFiles = await loadFontFiles();

  // Render the SVG text layer at 2× for crisp output
  const resvg = new Resvg(injected, {
    font: { fontFiles, loadSystemFonts: false, defaultFontFamily: 'Heebo' },
    fitTo: { mode: 'width', value: svgW * 2 },
  });
  const textPng = Buffer.from(resvg.render().asPng());

  // Fetch background from R2 and composite
  try {
    const bgRes = await fetch(resolved.backgroundUrl);
    if (bgRes.ok) {
      const bgBuf = Buffer.from(await bgRes.arrayBuffer());
      const { width: bgW = svgW * 2, height: bgH = svgH * 2 } = await sharp(bgBuf).metadata();
      const resizedText = await sharp(textPng).resize(bgW, bgH).png().toBuffer();
      return await sharp(bgBuf)
        .composite([{ input: resizedText, top: 0, left: 0 }])
        .png()
        .toBuffer();
    }
  } catch (e) {
    console.error('[render] background fetch failed:', e);
  }

  return textPng;
}

export async function pngToPdf(pngBuffer: Buffer): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  const img = await pdf.embedPng(pngBuffer);
  const page = pdf.addPage([img.width, img.height]);
  page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
  return Buffer.from(await pdf.save());
}
