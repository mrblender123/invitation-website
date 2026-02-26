'use client';

import { forwardRef, useEffect, useState } from 'react';
import type { Template, SvgField } from '@/lib/templates';

type Props = {
  template: Template;
  fieldValues: Record<string, string>;
  scale?: number;
};

function injectFieldValues(
  svgText: string,
  fields: SvgField[],
  values: Record<string, string>,
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

  for (const field of fields) {
    const group = doc.getElementById(field.id);
    if (!group) continue;

    const tspan = group.querySelector('tspan');
    if (!tspan) continue;

    const value = values[field.id];
    if (value !== undefined && value !== '') {
      tspan.textContent = value;
    }
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
  { template, fieldValues, scale = 1 },
  ref,
) {
  const { canvasWidth, canvasHeight } = template.style;
  const [svgContent, setSvgContent] = useState<string | null>(null);

  useEffect(() => {
    if (!template.textSvg) return;
    fetch(template.textSvg)
      .then(r => r.text())
      .then(text => setSvgContent(text))
      .catch(() => setSvgContent(null));
  }, [template.textSvg]);

  const injectedSvg =
    svgContent && template.fields
      ? injectFieldValues(svgContent, template.fields, fieldValues)
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
