/** Measures the actual rendered bounding box of the first <text> element in an SVG string.
 *  Returns a tighter version of the SVG (new viewBox that hugs the text) + its aspect ratio.
 *  Falls back to the original if measurement fails. */
export function measureAndTightenSvg(
  svgText: string,
  padding = 6,
): Promise<{ tightSvg: string; aspect: number }> {
  const fallback = { tightSvg: svgText, aspect: 420 / 55 };
  return new Promise(resolve => {
    if (typeof document === 'undefined') { resolve(fallback); return; }
    const div = document.createElement('div');
    div.style.cssText =
      'position:fixed;top:-9999px;left:-9999px;width:1000px;height:500px;overflow:visible;pointer-events:none;opacity:0;';
    div.innerHTML = svgText;
    document.body.appendChild(div);

    requestAnimationFrame(() => {
      const textEl = div.querySelector('text') as SVGTextElement | null;
      let result = fallback;
      if (textEl) {
        try {
          const bbox = textEl.getBBox();
          if (bbox.width > 0 && bbox.height > 0) {
            const vbX = bbox.x - padding;
            const vbY = bbox.y - padding;
            const vbW = bbox.width + padding * 2;
            const vbH = bbox.height + padding * 2;
            const tightSvg = svgText.replace(
              /viewBox="[^"]*"/,
              `viewBox="${vbX.toFixed(1)} ${vbY.toFixed(1)} ${vbW.toFixed(1)} ${vbH.toFixed(1)}"`,
            );
            result = { tightSvg, aspect: vbW / vbH };
          }
        } catch { /* getBBox can throw in some environments */ }
      }
      try { document.body.removeChild(div); } catch {}
      resolve(result);
    });
  });
}
