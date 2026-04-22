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

  // Strip * from all group IDs so getElementById works with clean IDs
  doc.querySelectorAll('g[id]').forEach(g => {
    const id = g.getAttribute('id') ?? '';
    if (id.includes('*')) g.setAttribute('id', id.replace(/\*/g, ''));
  });

  // Make the SVG fill its container
  root.setAttribute('width', '100%');
  root.setAttribute('height', '100%');

  // Get SVG viewBox for centering calculations
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

    // data-no-center: content was already updated — preserve all SVG positioning exactly.
    if (textEl.getAttribute('data-no-center') === 'true') continue;

    // For positioned (start) designs: only apply centering once the user has typed something.
    if (originalAnchor !== 'middle' && !hasUserValue) continue;

    textEl.setAttribute('text-anchor', 'middle');

    const fontFamily = textEl.getAttribute('font-family') ?? 'sans-serif';
    const fontSize = parseFloat(textEl.getAttribute('font-size') ?? '12');

    if (originalAnchor === 'middle') {
      // Text was already centered at its translate-X — just keep tspan at x=0.
      tspan.setAttribute('x', '0');
    } else {
      // Positioned design: center the new text at the same visual midpoint as the
      // original placeholder (translate-X + scale * originalWidth/2).
      const originalWidth = measureTextWidth(originalText, fontFamily, fontSize);
      tspan.setAttribute('x', String(Math.round((originalWidth / 2) * 10) / 10));
    }
  }

  // Map font-family names to next/font CSS variables so the self-hosted fonts
  // are actually used (SVG presentation attributes reference the plain name like
  // "Heebo" but next/font loads it under a scoped name only accessible via var()).
  const fontMapStyle = doc.createElementNS('http://www.w3.org/2000/svg', 'style');
  fontMapStyle.textContent = `
    [font-family="Heebo"]          { font-family: var(--font-heebo, Heebo), sans-serif; }
    [font-family="Secular One"]    { font-family: var(--font-secular-one, "Secular One"), sans-serif; }
    [font-family="Dancing Script"] { font-family: var(--font-dancing-script, "Dancing Script"), cursive; }
    [font-family="Lora"]           { font-family: var(--font-lora, Lora), serif; }
    [font-family="Montserrat"]     { font-family: var(--font-montserrat, Montserrat), sans-serif; }
    [font-family="Oswald"]         { font-family: var(--font-oswald, Oswald), sans-serif; }
  `;
  root.insertBefore(fontMapStyle, root.firstChild);

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
      .then(text => {
        // Strip any @import rules — fonts are loaded via the page's CSS
        text = text.replace(/@import url\([^)]+\)\s*;?/g, '');
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
            src={template.backgroundSrc}
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
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
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
