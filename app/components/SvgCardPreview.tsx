'use client';

import { forwardRef, useEffect, useState } from 'react';
import type { Template, SvgField } from '@/lib/templates';

type Props = {
  template: Template;
  fieldValues: Record<string, string>;
  scale?: number;
  activeFieldId?: string | null;
};

// Reuse a single canvas element for all measurements (lightweight, no GPU alloc)
let _measureCanvas: HTMLCanvasElement | null = null;
let _measureCtx: CanvasRenderingContext2D | null = null;

function measureTextWidth(text: string, fontFamily: string, fontSize: number): number {
  if (typeof document === 'undefined' || !text) return 0;
  try {
    if (!_measureCanvas) {
      _measureCanvas = document.createElement('canvas');
      _measureCtx = _measureCanvas.getContext('2d');
    }
    const ctx = _measureCtx;
    if (!ctx) return 0;
    // Use the first font name from the SVG font-family list
    const fontName = fontFamily.replace(/['"]/g, '').split(',')[0].trim();
    ctx.font = `${fontSize}px "${fontName}"`;
    return ctx.measureText(text).width;
  } catch {
    return 0;
  }
}

function injectFieldValues(
  svgText: string,
  fields: SvgField[],
  values: Record<string, string>,
  activeFieldId?: string | null,
): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgText, 'image/svg+xml');
  const root = doc.documentElement;

  // Make the SVG fill its container
  root.setAttribute('width', '100%');
  root.setAttribute('height', '100%');

  // Strip * from all group IDs so getElementById works with clean IDs
  doc.querySelectorAll('g[id]').forEach(g => {
    const id = g.getAttribute('id') ?? '';
    if (id.includes('*')) g.setAttribute('id', id.replace(/\*/g, ''));
  });

  // Get SVG viewBox width for centering calculations
  const viewBox = root.getAttribute('viewBox')?.split(/[\s,]+/) ?? [];
  const svgWidth = parseFloat(viewBox[2] ?? '0');

  for (const field of fields) {
    const group = doc.getElementById(field.id);
    if (!group) continue;

    const textEl = group.querySelector('text');
    const tspan = textEl?.querySelector('tspan');
    if (!tspan || !textEl) continue;

    const value = values[field.id];
    if (value === undefined) continue;

    // Capture original SVG text before any mutation
    const originalText = (tspan.textContent ?? '').trim();

    // If value matches the original SVG placeholder text, leave the field completely
    // untouched — let the SVG render at its designed position with no adjustments.
    if (value === originalText) continue;

    tspan.textContent = value; // '' clears the text

    // Skip multi-tspan elements — centering logic only handles single-tspan fields
    const tspanCount = textEl.querySelectorAll('tspan').length;
    if (svgWidth <= 0 || tspanCount > 1) continue;

    const originalAnchor = textEl.getAttribute('text-anchor') ?? 'start';
    const hasUserValue = value !== '';

    // For explicitly-centered designs (text-anchor="middle"): always re-center.
    // For positioned designs: keep at original SVG position until user types something.
    // data-no-center: text content was already updated above — keep all
    // SVG positioning attributes exactly as designed, no centering at all.
    if (textEl.getAttribute('data-no-center') === 'true') continue;

    if (originalAnchor !== 'middle' && !hasUserValue) continue;

    textEl.setAttribute('text-anchor', 'middle');

    const transform = textEl.getAttribute('transform') ?? '';
    const fontFamily = textEl.getAttribute('font-family') ?? 'sans-serif';
    const fontSize = parseFloat(textEl.getAttribute('font-size') ?? '12');

    if (originalAnchor === 'middle') {
      // Explicitly centered design: keep text at the card's horizontal midpoint.
      const sxMatch = transform.match(/scale\(\s*([\d.+-]+)/);
      const sx = sxMatch ? parseFloat(sxMatch[1]) : 1;
      const txMatch = transform.match(/translate\(\s*([\d.+-]+)/);
      const tx = txMatch ? parseFloat(txMatch[1]) : 0;
      const localCenterX = sx > 0 ? (svgWidth / 2 - tx) / sx : svgWidth / 2;
      tspan.setAttribute('x', String(Math.round(localCenterX * 10) / 10));
    } else {
      // Positioned design: center new text at the same point as the original placeholder.
      const originalWidth = measureTextWidth(originalText, fontFamily, fontSize);
      const localCenterX = originalWidth / 2;
      tspan.setAttribute('x', String(Math.round(localCenterX * 10) / 10));
    }
  }

  // Highlight the active field and dim all others
  if (activeFieldId) {
    for (const field of fields) {
      const group = doc.getElementById(field.id);
      if (!group) continue;
      group.setAttribute('data-field-state', field.id === activeFieldId ? 'active' : 'other');
    }

    const style = doc.createElementNS('http://www.w3.org/2000/svg', 'style');
    style.textContent = `
      [data-field-state="active"] text {
        filter: drop-shadow(0 0 3px rgba(255,255,255,0.35));
      }
      [data-field-state="other"] {
        opacity: 0.3;
        transition: opacity 0.25s;
      }
    `;
    root.insertBefore(style, root.firstChild);
  }

  return new XMLSerializer().serializeToString(root);
}

/**
 * Renders a card with a PNG background and an SVG text overlay.
 *
 * The forwarded ref points to the full-resolution inner div (no CSS transform)
 * so that html2canvas captures it at full pixel resolution.
 * The outer div clips it down to the scaled display size.
 */
const SvgCardPreview = forwardRef<HTMLDivElement, Props>(function SvgCardPreview(
  { template, fieldValues, scale = 1, activeFieldId },
  ref,
) {
  const { canvasWidth, canvasHeight } = template.style;
  const [svgContent, setSvgContent] = useState<string | null>(null);

  useEffect(() => {
    if (!template.textSvg) return;
    fetch(template.textSvg)
      .then(r => r.text())
      .then(async text => {
        // If the SVG imports a Typekit kit, load the fonts at the document level.
        // @font-face inside SVG <style> is ignored by browsers — fonts must be
        // declared in the document head to be usable by inline SVG text elements.
        if (text.includes('use.typekit.net')) {
          // Remove the @import from the SVG — WebFontLoader handles loading instead
          text = text.replace(/@import url\(["']?[^"')]*use\.typekit\.net[^"')]*["']?\)\s*;?/g, '');
          // Use WebFontLoader to load the Typekit kit — the official Adobe method
          await new Promise<void>(resolve => {
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            const WebFont = require('webfontloader');
            WebFont.load({
              typekit: { id: 'fjv7kfq' },
              active: () => resolve(),
              inactive: () => resolve(), // resolve even on failure so SVG still renders
            });
          });
        }
        setSvgContent(text);
      })
      .catch(() => setSvgContent(null));
  }, [template.textSvg]);

  const injectedSvg =
    svgContent && template.fields
      ? injectFieldValues(svgContent, template.fields, fieldValues, activeFieldId)
      : svgContent;

  return (
    /* Outer: clips to the scaled display size */
    <div style={{
      width: canvasWidth * scale,
      height: canvasHeight * scale,
      overflow: 'hidden',
      flexShrink: 0,
      position: 'relative',
    }}>
      {/* Scale wrapper — transform lives here, NOT on the ref'd element */}
      <div style={{
        transform: `scale(${scale})`,
        transformOrigin: 'top left',
      }}>
        {/* Inner: full-resolution content — ref this for html2canvas */}
        <div ref={ref} style={{ width: canvasWidth, height: canvasHeight, position: 'relative', background: '#000' }}>

          {/* PNG background */}
          <img
            src={template.thumbnailSrc}
            alt={template.name}
            width={canvasWidth}
            height={canvasHeight}
            style={{ display: 'block', userSelect: 'none' }}
            draggable={false}
            crossOrigin="anonymous"
          />

          {/* SVG text overlay */}
          {injectedSvg && (
            <div
              data-svg-overlay="true"
              style={{
                position: 'absolute',
                inset: 0,
                width: canvasWidth,
                height: canvasHeight,
                overflow: 'hidden',
              }}
              dangerouslySetInnerHTML={{ __html: injectedSvg }}
            />
          )}
        </div>
      </div>
    </div>
  );
});

export default SvgCardPreview;
