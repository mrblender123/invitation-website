/**
 * Renders the SVG to an offscreen canvas, finds the bounding box of all
 * non-transparent pixels, and returns a tighter version of the SVG whose
 * viewBox hugs that content. Falls back to the original SVG if anything fails.
 */
export async function measureAndTightenSvg(
  svgText: string,
  padding = 6,
): Promise<{ tightSvg: string; aspect: number }> {
  const fallback = { tightSvg: svgText, aspect: 420 / 55 };
  if (typeof document === 'undefined') return fallback;

  try {
    // Parse original viewBox
    const vbMatch = svgText.match(/viewBox="([^"]+)"/);
    if (!vbMatch) return fallback;
    const parts = vbMatch[1].trim().split(/[\s,]+/).map(Number);
    if (parts.length < 4) return fallback;
    const [vbMinX, vbMinY, vbW, vbH] = parts;
    if (!vbW || !vbH) return fallback;

    // Render at a canvas whose aspect ratio matches the viewBox
    const canvasH = 120;
    const canvasW = Math.round((vbW / vbH) * canvasH);

    const blob = new Blob([svgText], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    await new Promise<void>((res, rej) => {
      img.onload = () => res();
      img.onerror = () => rej(new Error('svg load failed'));
      img.src = url;
    });
    URL.revokeObjectURL(url);

    const canvas = document.createElement('canvas');
    canvas.width = canvasW;
    canvas.height = canvasH;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0, canvasW, canvasH);

    // Find the bounding box of all non-transparent pixels
    const data = ctx.getImageData(0, 0, canvasW, canvasH).data;
    let minX = canvasW, maxX = 0, minY = canvasH, maxY = 0;
    let found = false;
    for (let y = 0; y < canvasH; y++) {
      for (let x = 0; x < canvasW; x++) {
        if (data[(y * canvasW + x) * 4 + 3] > 10) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
          found = true;
        }
      }
    }
    if (!found) return fallback;

    // Convert pixel coords → SVG viewBox units
    const scaleX = vbW / canvasW;
    const scaleY = vbH / canvasH;
    const padX = padding * scaleX;
    const padY = padding * scaleY;
    const tightX = vbMinX + minX * scaleX - padX;
    const tightY = vbMinY + minY * scaleY - padY;
    const tightW = (maxX - minX + 1) * scaleX + padX * 2;
    const tightH = (maxY - minY + 1) * scaleY + padY * 2;

    const tightSvg = svgText.replace(
      /viewBox="[^"]+"/,
      `viewBox="${tightX.toFixed(1)} ${tightY.toFixed(1)} ${tightW.toFixed(1)} ${tightH.toFixed(1)}"`,
    );
    return { tightSvg, aspect: tightW / tightH };
  } catch {
    return fallback;
  }
}
