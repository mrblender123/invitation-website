import { readdir, readFile } from 'fs/promises';
import path from 'path';
import sharp from 'sharp';
import { PDFDocument } from 'pdf-lib';
import { createCanvas, GlobalFonts, Image } from '@napi-rs/canvas';

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

let fontsRegistered = false;
async function registerFonts() {
  if (fontsRegistered) return;
  const fontsDir = path.join(process.cwd(), 'public', 'fonts');
  try {
    const files = await readdir(fontsDir);
    for (const file of files.filter(f => /\.ttf$/i.test(f))) {
      const fontPath = path.join(fontsDir, file);
      const family = file
        .replace(/\.ttf$/i, '')
        .replace(/\[.*?\]/g, '')
        .replace(/-(?:Regular|Medium|SemiBold|Bold|ExtraBold|Black|Light|Thin)$/i, '')
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .trim();
      GlobalFonts.registerFromPath(fontPath, family);
    }
  } catch { /* fonts dir missing */ }
  fontsRegistered = true;
}

// Mirror of client-side drawSvgTextToCanvas, adapted for @napi-rs/canvas
type Ctx2D = ReturnType<ReturnType<typeof createCanvas>['getContext']>;

function parseTr(t: string) {
  const tx = t.match(/translate\(\s*([\d.+-]+)(?:[,\s]+([\d.+-]+))?\s*\)/);
  const rot = t.match(/rotate\(\s*([\d.+-]+)/);
  const sc = t.match(/scale\(\s*([\d.+-]+)(?:[,\s]+([\d.+-]+))?\s*\)/);
  return {
    tx: tx ? +tx[1] : 0,
    ty: tx?.[2] ? +tx[2] : 0,
    rot: rot ? +rot[1] * Math.PI / 180 : 0,
    sx: sc ? +sc[1] : 1,
    sy: sc?.[2] ? +sc[2] : (sc ? +sc[1] : 1),
  };
}


function drawSvgTextToCanvas(
  ctx: Ctx2D,
  svgText: string,
  canvasW: number,
  canvasH: number,
) {
  // Parse SVG in a minimal way without a DOM — extract text elements via regex
  // We iterate <text> blocks and their <tspan> children
  const textBlockRe = /<text([^>]*)>([\s\S]*?)<\/text>/g;
  const tspanRe = /<tspan([^>]*)>([\s\S]*?)<\/tspan>/g;

  const vbMatch = svgText.match(/viewBox=["']([^"']+)["']/);
  const vbParts = vbMatch?.[1].trim().split(/[\s,]+/) ?? [];
  const svgW = vbParts.length >= 4 ? parseFloat(vbParts[2]) : canvasW;
  const svgH = vbParts.length >= 4 ? parseFloat(vbParts[3]) : canvasH;
  const kx = canvasW / svgW;
  const ky = canvasH / svgH;

  function attr(attrs: string, name: string): string | null {
    const m = attrs.match(new RegExp(`\\b${name}=["']([^"']*)["']`));
    return m ? m[1] : null;
  }

  let textMatch: RegExpExecArray | null;
  while ((textMatch = textBlockRe.exec(svgText)) !== null) {
    const textAttrs = textMatch[1];
    const textInner = textMatch[2];

    const family = (attr(textAttrs, 'font-family') ?? 'Heebo').replace(/['"]/g, '').split(',')[0].trim();
    const weight = attr(textAttrs, 'font-weight') ?? '400';
    const anchor = attr(textAttrs, 'text-anchor') ?? 'start';
    const trRaw = attr(textAttrs, 'transform') ?? '';
    const { tx, ty, rot, sx, sy } = parseTr(trRaw);

    let curY = 0;
    let tspanMatch: RegExpExecArray | null;
    tspanRe.lastIndex = 0;

    while ((tspanMatch = tspanRe.exec(textInner)) !== null) {
      const tsAttrs = tspanMatch[1];
      const text = tspanMatch[2].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'");
      if (!text.trim()) continue;

      const x = parseFloat(attr(tsAttrs, 'x') ?? '0');
      const yVal = attr(tsAttrs, 'y');
      const dyVal = attr(tsAttrs, 'dy');
      if (yVal !== null) curY = parseFloat(yVal);
      if (dyVal !== null) curY += parseFloat(dyVal);

      const sizeSrc = attr(tsAttrs, 'font-size') ?? attr(textAttrs, 'font-size') ?? '12';
      const size = parseFloat(sizeSrc);
      const fill = attr(tsAttrs, 'fill') ?? attr(textAttrs, 'fill') ?? '#000';

      ctx.save();
      ctx.scale(kx, ky);
      ctx.translate(tx, ty);
      if (rot) ctx.rotate(rot);
      ctx.scale(sx, sy);
      ctx.font = `${weight} ${size}px "${family}"`;
      ctx.fillStyle = fill;
      ctx.textAlign = anchor === 'middle' ? 'center' : anchor === 'end' ? 'right' : 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(text, x, curY);
      ctx.restore();
    }
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

  await registerFonts();

  const svgContent = await readFile(resolved.svgPath, 'utf-8');
  const injected = injectFieldValues(svgContent, fieldValues);

  const vbMatch = injected.match(/viewBox=["']([^"']+)["']/);
  const vbParts = vbMatch?.[1].trim().split(/[\s,]+/) ?? [];
  const svgW = vbParts.length >= 4 ? Math.round(parseFloat(vbParts[2])) : 444;
  const svgH = vbParts.length >= 4 ? Math.round(parseFloat(vbParts[3])) : 630;

  const SCALE = 2;
  const outW = svgW * SCALE;
  const outH = svgH * SCALE;

  const canvas = createCanvas(outW, outH);
  const ctx = canvas.getContext('2d');

  // Draw background from R2
  try {
    const bgRes = await fetch(resolved.backgroundUrl);
    if (bgRes.ok) {
      const bgBuf = Buffer.from(await bgRes.arrayBuffer());
      const bgPng = await sharp(bgBuf).resize(outW, outH).png().toBuffer();
      const img = new Image();
      img.src = bgPng;
      ctx.drawImage(img, 0, 0, outW, outH);
    }
  } catch (e) {
    console.error('[render] background error:', e);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, outW, outH);
  }

  // Draw text layer
  drawSvgTextToCanvas(ctx, injected, outW, outH);

  return canvas.toBuffer('image/png');
}

export async function pngToPdf(pngBuffer: Buffer): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  const img = await pdf.embedPng(pngBuffer);
  const page = pdf.addPage([img.width, img.height]);
  page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
  return Buffer.from(await pdf.save());
}
