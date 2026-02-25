'use client';

import { useEffect, useState } from 'react';
import type { Template } from '@/lib/templates';

type FieldKey = 'title' | 'name' | 'date';

const FIELDS: { key: FieldKey; label: string; color: string }[] = [
  { key: 'title', label: 'Title / Event', color: '#f59e0b' },
  { key: 'name',  label: 'Name',          color: '#10b981' },
  { key: 'date',  label: 'Date & Time',   color: '#60a5fa' },
];

export default function CalibratePage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [templateId, setTemplateId] = useState('');
  const [activeField, setActiveField] = useState<FieldKey>('title');
  const [coords, setCoords] = useState<Record<FieldKey, { x: number; y: number }>>({
    title: { x: 222, y: 230 },
    name:  { x: 222, y: 310 },
    date:  { x: 222, y: 375 },
  });
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch('/api/templates')
      .then(r => r.json())
      .then(({ templates: data }: { templates: Template[] }) => {
        // Calibration is only useful for non-SVG (legacy InvitationCard) templates
        const legacy = (data ?? []).filter(t => !t.textSvg);
        setTemplates(legacy);
        if (legacy.length > 0) {
          const first = legacy[0];
          setTemplateId(first.id);
          setCoords({
            title: { x: first.style.titleX ?? 222, y: first.style.titleY ?? 230 },
            name:  { x: first.style.nameX  ?? 222, y: first.style.nameY  ?? 310 },
            date:  { x: first.style.dateX  ?? 222, y: first.style.dateY  ?? 375 },
          });
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const template = templates.find(t => t.id === templateId);

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#09090b', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: 'rgba(255,255,255,0.4)' }}>Loading…</p>
      </div>
    );
  }

  if (templates.length === 0) {
    return (
      <div style={{ minHeight: '100vh', background: '#09090b', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: 'rgba(255,255,255,0.4)' }}>No legacy templates found. This tool is only needed for non-SVG templates.</p>
      </div>
    );
  }

  if (!template) return null;

  const { canvasWidth, canvasHeight } = template.style;

  const handleImageClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.round(e.clientX - rect.left);
    const y = Math.round(e.clientY - rect.top);
    setCoords(prev => ({ ...prev, [activeField]: { x, y } }));
  };

  const configSnippet =
`titleX: ${coords.title.x}, titleY: ${coords.title.y},
nameX:  ${coords.name.x},  nameY:  ${coords.name.y},
dateX:  ${coords.date.x},  dateY:  ${coords.date.y},`;

  const handleCopy = () => {
    navigator.clipboard.writeText(configSnippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{
      minHeight: '100vh', background: '#09090b', color: '#fff',
      fontFamily: 'system-ui, sans-serif', padding: 32,
    }}>

      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Template Calibration</h1>
          <span style={{
            fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 99,
            background: 'rgba(251,191,36,0.15)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.3)',
            letterSpacing: '0.06em',
          }}>
            DEV ONLY
          </span>
        </div>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', margin: 0 }}>
          Click on the image to set where each text field appears. Image is shown at exact canvas size ({canvasWidth}×{canvasHeight}px) — coordinates are 1:1.
        </p>
      </div>

      {/* Template picker */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <label style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)' }}>Template:</label>
        <select
          value={templateId}
          onChange={e => {
            setTemplateId(e.target.value);
            const t = templates.find(x => x.id === e.target.value);
            if (t) setCoords({
              title: { x: t.style.titleX ?? 222, y: t.style.titleY ?? 230 },
              name:  { x: t.style.nameX  ?? 222, y: t.style.nameY  ?? 310 },
              date:  { x: t.style.dateX  ?? 222, y: t.style.dateY  ?? 375 },
            });
          }}
          style={{
            background: '#18181b', border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: 6, color: '#fff', padding: '6px 10px', fontSize: 13,
          }}
        >
          {templates.map(t => <option key={t.id} value={t.id}>{t.name} ({t.category})</option>)}
        </select>
      </div>

      {/* Field selector */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 28 }}>
        <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', marginRight: 4 }}>Placing:</span>
        {FIELDS.map(f => (
          <button
            key={f.key}
            onClick={() => setActiveField(f.key)}
            style={{
              padding: '7px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600,
              cursor: 'pointer', border: 'none',
              background: activeField === f.key ? f.color : 'rgba(255,255,255,0.07)',
              color: activeField === f.key ? '#000' : 'rgba(255,255,255,0.55)',
              outline: activeField === f.key ? `2px solid ${f.color}` : 'none',
              outlineOffset: 2,
            }}
          >
            {f.label}
          </button>
        ))}
        <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.25)', marginLeft: 6 }}>
          ← then click the image
        </span>
      </div>

      <div style={{ display: 'flex', gap: 40, alignItems: 'flex-start', flexWrap: 'wrap' }}>

        {/* ── Image canvas ── */}
        <div
          onClick={handleImageClick}
          style={{
            position: 'relative',
            width: canvasWidth,
            height: canvasHeight,
            cursor: 'crosshair',
            flexShrink: 0,
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 4,
            userSelect: 'none',
          }}
        >
          {/* The PNG at exact canvas size */}
          <img
            src={template.thumbnailSrc}
            alt={template.name}
            style={{ width: '100%', height: '100%', display: 'block', pointerEvents: 'none' }}
            draggable={false}
          />

          {/* Grid overlay */}
          <div style={{
            position: 'absolute', inset: 0, pointerEvents: 'none',
            backgroundImage: 'linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)',
            backgroundSize: '50px 50px',
          }} />

          {/* Marker for each field */}
          {FIELDS.map(f => {
            const c = coords[f.key];
            const isActive = activeField === f.key;
            return (
              <div key={f.key} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
                <div style={{
                  position: 'absolute',
                  left: c.x - 24, top: c.y,
                  width: 48, height: 1,
                  background: f.color,
                  opacity: isActive ? 1 : 0.55,
                }} />
                <div style={{
                  position: 'absolute',
                  left: c.x, top: c.y - 24,
                  width: 1, height: 48,
                  background: f.color,
                  opacity: isActive ? 1 : 0.55,
                }} />
                <div style={{
                  position: 'absolute',
                  left: c.x - 5, top: c.y - 5,
                  width: 10, height: 10,
                  borderRadius: '50%',
                  background: f.color,
                  border: '2px solid #fff',
                  boxShadow: `0 0 8px ${f.color}`,
                  opacity: isActive ? 1 : 0.7,
                }} />
                <div style={{
                  position: 'absolute',
                  left: c.x + 10, top: c.y - 20,
                  fontSize: 10, fontWeight: 700,
                  color: f.color,
                  background: 'rgba(0,0,0,0.8)',
                  padding: '2px 5px', borderRadius: 3,
                  whiteSpace: 'nowrap',
                  opacity: isActive ? 1 : 0.7,
                }}>
                  {f.label} ({c.x}, {c.y})
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Coordinates panel ── */}
        <div style={{ minWidth: 300, maxWidth: 360 }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 16 }}>
            Current Positions
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 28 }}>
            {FIELDS.map(f => (
              <div
                key={f.key}
                onClick={() => setActiveField(f.key)}
                style={{
                  background: activeField === f.key ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${activeField === f.key ? f.color + '80' : 'rgba(255,255,255,0.08)'}`,
                  borderRadius: 10, padding: '12px 16px', cursor: 'pointer',
                  transition: 'border-color 0.15s',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 6 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: f.color, flexShrink: 0 }} />
                  <span style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                    {f.label}
                  </span>
                  {activeField === f.key && (
                    <span style={{ marginLeft: 'auto', fontSize: 10, color: f.color, fontWeight: 600 }}>ACTIVE</span>
                  )}
                </div>
                <div style={{ fontFamily: 'monospace', fontSize: 18, fontWeight: 700, color: '#fff' }}>
                  x: {coords[f.key].x} &nbsp;·&nbsp; y: {coords[f.key].y}
                </div>
              </div>
            ))}
          </div>

          {/* Config snippet */}
          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
            Paste into template style config
          </p>
          <pre style={{
            background: '#0d0d0f',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 8, padding: '14px 16px',
            fontSize: 12, color: '#86efac',
            fontFamily: 'monospace', lineHeight: 1.8,
            whiteSpace: 'pre', marginBottom: 12,
            overflowX: 'auto',
          }}>
            {configSnippet}
          </pre>

          <button
            onClick={handleCopy}
            style={{
              width: '100%', padding: '11px 0', borderRadius: 8, fontSize: 14,
              fontWeight: 600, cursor: 'pointer', border: 'none',
              background: copied ? '#16a34a' : 'rgba(255,255,255,0.09)',
              color: '#fff', transition: 'background 0.2s',
            }}
          >
            {copied ? '✓ Copied!' : 'Copy Config'}
          </button>

          <div style={{
            marginTop: 24, padding: '14px 16px',
            background: 'rgba(251,191,36,0.07)',
            border: '1px solid rgba(251,191,36,0.2)',
            borderRadius: 10,
          }}>
            <p style={{ fontSize: 12, color: 'rgba(251,191,36,0.8)', margin: '0 0 6px', fontWeight: 600 }}>
              How to use
            </p>
            <ol style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', margin: 0, paddingLeft: 16, lineHeight: 1.8 }}>
              <li>Pick a field above (Title / Name / Date)</li>
              <li>Click where that text should appear on the card</li>
              <li>Repeat for each field</li>
              <li>Copy the config and use it in the template style</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}
