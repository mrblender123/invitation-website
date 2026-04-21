'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/app/components/AuthProvider';
import type { Template } from '@/lib/templates';

const ADMIN_EMAIL = 'bycheshin@gmail.com';
const CARD_DISPLAY_WIDTH = 420;
const SNAP_PX = 6;
const MAX_HISTORY = 50;

// ─── types ────────────────────────────────────────────────────────────────────

type Layer = {
  index: number;
  id: string | null;
  originalId: string | null;
  label: string;
  tx: number;
  ty: number;
  restTransform: string;
  fontSize: number | null;
  fill: string | null;
};

type DragState = {
  handleIdx: number;
  startMouseX: number;
  startMouseY: number;
  startPositions: Map<number, { tx: number; ty: number }>;
  preDragLayers: Layer[];
};

type GuideDrag = { axis: 'x' | 'y'; startMouse: number; startGuide: number };

type Marquee = { x1: number; y1: number; x2: number; y2: number }; // in SVG units

// ─── SVG helpers ──────────────────────────────────────────────────────────────

function parseLayers(svgText: string): Layer[] {
  if (typeof document === 'undefined') return [];
  const doc = new DOMParser().parseFromString(svgText, 'image/svg+xml');
  const layers: Layer[] = [];
  doc.querySelectorAll('text').forEach((textEl, idx) => {
    const transform = textEl.getAttribute('transform') ?? '';
    const m = transform.match(/translate\(\s*([+-]?[\d.]+)[\s,]+([+-]?[\d.]+)\s*\)(.*)/);
    if (!m) return;
    const parent = textEl.parentElement;
    const id = parent?.tagName.toLowerCase() === 'g' && parent.id ? parent.id : null;
    const label = textEl.querySelector('tspan')?.textContent?.trim().slice(0, 24) ?? `text-${idx}`;
    const fsSrc = textEl.getAttribute('font-size');
    const fillSrc = textEl.getAttribute('fill');
    layers.push({ index: idx, id, originalId: id, label, tx: parseFloat(m[1]), ty: parseFloat(m[2]), restTransform: m[3], fontSize: fsSrc ? parseFloat(fsSrc) : null, fill: fillSrc ?? null });
  });
  return layers;
}

function buildSvgForSave(svgSource: string, layers: Layer[]): string {
  const doc = new DOMParser().parseFromString(svgSource, 'image/svg+xml');
  doc.querySelectorAll('text').forEach((textEl, idx) => {
    const layer = layers[idx];
    if (!layer) return;
    // Position
    const transform = textEl.getAttribute('transform') ?? '';
    const updated = transform.replace(
      /translate\(\s*[+-]?[\d.]+[\s,]+[+-]?[\d.]+\s*\)/,
      `translate(${Math.round(layer.tx * 10) / 10} ${Math.round(layer.ty * 10) / 10})`,
    );
    textEl.setAttribute('transform', updated);
    // Font size
    if (layer.fontSize !== null) textEl.setAttribute('font-size', String(Math.round(layer.fontSize * 10) / 10));
    // Fill color
    if (layer.fill !== null) textEl.setAttribute('fill', layer.fill);
    // Rename id
    if (layer.originalId && layer.id && layer.id !== layer.originalId) {
      const parent = textEl.parentElement;
      if (parent?.id === layer.originalId) parent.id = layer.id;
    }
  });
  return new XMLSerializer().serializeToString(doc.documentElement);
}

function buildSvgForDisplay(svgSource: string, layers: Layer[]): string {
  const doc = new DOMParser().parseFromString(svgSource, 'image/svg+xml');
  const root = doc.documentElement;
  doc.querySelectorAll('text').forEach((textEl, idx) => {
    const layer = layers[idx];
    if (!layer) return;
    const transform = textEl.getAttribute('transform') ?? '';
    const updated = transform.replace(
      /translate\(\s*[+-]?[\d.]+[\s,]+[+-]?[\d.]+\s*\)/,
      `translate(${Math.round(layer.tx * 10) / 10} ${Math.round(layer.ty * 10) / 10})`,
    );
    textEl.setAttribute('transform', updated);
    if (layer.fontSize !== null) textEl.setAttribute('font-size', String(Math.round(layer.fontSize * 10) / 10));
    if (layer.fill !== null) textEl.setAttribute('fill', layer.fill);
  });
  const style = doc.createElementNS('http://www.w3.org/2000/svg', 'style');
  style.textContent = `
    [font-family="Heebo"]          { font-family: var(--font-heebo, Heebo), sans-serif; }
    [font-family="Secular One"]    { font-family: var(--font-secular-one, "Secular One"), sans-serif; }
    [font-family="Dancing Script"] { font-family: var(--font-dancing-script, "Dancing Script"), cursive; }
    [font-family="Lora"]           { font-family: var(--font-lora, Lora), serif; }
    [font-family="Montserrat"]     { font-family: var(--font-montserrat, Montserrat), sans-serif; }
    [font-family="Oswald"]         { font-family: var(--font-oswald, Oswald), sans-serif; }
    [font-family="'Secular One'"]  { font-family: var(--font-secular-one, "Secular One"), sans-serif; }
  `;
  root.insertBefore(style, root.firstChild);
  root.setAttribute('width', '100%');
  root.setAttribute('height', '100%');
  return new XMLSerializer().serializeToString(root);
}

// ─── component ────────────────────────────────────────────────────────────────

export default function TemplateEditorPage() {
  const { user, loading, accessToken } = useAuth();
  const router = useRouter();

  const [templates, setTemplates] = useState<Template[]>([]);
  const [selected, setSelected] = useState<Template | null>(null);
  const [svgSource, setSvgSource] = useState<string | null>(null);
  const [layers, setLayers] = useState<Layer[]>([]);
  const [history, setHistory] = useState<Layer[][]>([]);
  const [dragging, setDragging] = useState<DragState | null>(null);
  const [guideDrag, setGuideDrag] = useState<GuideDrag | null>(null);
  const [guideX, setGuideX] = useState(180);
  const [guideY, setGuideY] = useState(252);
  const [selection, setSelection] = useState<Set<number>>(new Set());
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [snapActive, setSnapActive] = useState<{ x: boolean; y: boolean }>({ x: false, y: false });
  const [showGuides, setShowGuides] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [renamingIdx, setRenamingIdx] = useState<number | null>(null);
  const [marquee, setMarquee] = useState<Marquee | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const canvasRef = useRef<HTMLDivElement>(null);

  // Refs for undo (avoid stale closures)
  const layersRef = useRef(layers);
  useEffect(() => { layersRef.current = layers; }, [layers]);
  const historyRef = useRef<Layer[][]>([]);
  useEffect(() => { historyRef.current = history; }, [history]);

  // Auth guard
  useEffect(() => {
    if (loading) return;
    if (!user) { router.replace('/login'); return; }
    if (user.email !== ADMIN_EMAIL) router.replace('/');
  }, [user, loading, router]);

  // Load templates
  useEffect(() => {
    fetch('/api/templates')
      .then(r => r.json())
      .then(d => setTemplates((d.templates ?? []).filter((t: Template) => t.textSvg)));
  }, []);

  // Load SVG
  useEffect(() => {
    if (!selected?.textSvg) return;
    setSvgSource(null); setLayers([]); setSaveMsg(''); setSelection(new Set());
    setHistory([]); setRenamingIdx(null);
    const w = selected.style.canvasWidth;
    const h = selected.style.canvasHeight;
    setGuideX(w / 2);
    setGuideY(h / 2);
    fetch(selected.textSvg)
      .then(r => r.text())
      .then(text => {
        text = text.replace(/@import url\([^)]+\)\s*;?/g, '');
        setSvgSource(text);
        setLayers(parseLayers(text));
      });
  }, [selected]);

  const scale = selected ? CARD_DISPLAY_WIDTH / selected.style.canvasWidth : 1;
  const cardDisplayHeight = selected ? selected.style.canvasHeight * scale : CARD_DISPLAY_WIDTH * 1.4;
  const svgW = selected?.style.canvasWidth ?? 360;
  const svgH = selected?.style.canvasHeight ?? 504;

  const displaySvg = useMemo(() => {
    if (!svgSource || layers.length === 0) return null;
    return buildSvgForDisplay(svgSource, layers);
  }, [svgSource, layers]);

  // ── undo ─────────────────────────────────────────────────────────────────────

  const pushHistory = useCallback(() => {
    setHistory(h => [...h.slice(-(MAX_HISTORY - 1)), layersRef.current]);
  }, []);

  // Cmd/Ctrl+Z undo
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        const h = historyRef.current;
        if (h.length === 0) return;
        setLayers(h[h.length - 1]);
        setHistory(h.slice(0, -1));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // ── selection helpers ────────────────────────────────────────────────────────

  const toggleSelect = useCallback((idx: number, shift: boolean) => {
    setSelection(prev => {
      if (shift) {
        const next = new Set(prev);
        if (next.has(idx)) next.delete(idx); else next.add(idx);
        return next;
      }
      if (prev.size === 1 && prev.has(idx)) return new Set();
      return new Set([idx]);
    });
  }, []);

  // ── layer drag ───────────────────────────────────────────────────────────────

  const handleMouseDown = useCallback((e: React.MouseEvent, idx: number) => {
    e.preventDefault(); e.stopPropagation();

    const newSelection = e.shiftKey
      ? (() => { const s = new Set(selection); s.has(idx) ? s.delete(idx) : s.add(idx); return s; })()
      : selection.has(idx) ? selection : new Set([idx]);

    setSelection(newSelection);

    const startPositions = new Map<number, { tx: number; ty: number }>();
    newSelection.forEach(i => { startPositions.set(i, { tx: layers[i].tx, ty: layers[i].ty }); });

    setDragging({ handleIdx: idx, startMouseX: e.clientX, startMouseY: e.clientY, startPositions, preDragLayers: layers });
  }, [layers, selection]);

  useEffect(() => {
    if (!dragging) { setSnapActive({ x: false, y: false }); return; }

    const onMove = (e: MouseEvent) => {
      const dx = (e.clientX - dragging.startMouseX) / scale;
      const dy = (e.clientY - dragging.startMouseY) / scale;

      const start = dragging.startPositions.get(dragging.handleIdx)!;
      let snapX = false, snapY = false;
      let finalDx = dx, finalDy = dy;
      if (Math.abs(start.tx + dx - guideX) < SNAP_PX) { finalDx = guideX - start.tx; snapX = true; }
      if (Math.abs(start.ty + dy - guideY) < SNAP_PX) { finalDy = guideY - start.ty; snapY = true; }

      setSnapActive({ x: snapX, y: snapY });
      setLayers(prev => prev.map((l, i) => {
        const s = dragging.startPositions.get(i);
        if (!s) return l;
        return { ...l, tx: s.tx + finalDx, ty: s.ty + finalDy };
      }));
    };

    const onUp = () => {
      pushHistory();
      // Restore preDragLayers as the history entry
      setHistory(h => {
        // Replace the just-pushed entry with the actual pre-drag state
        const last = h[h.length - 1];
        if (last === dragging.preDragLayers) return h;
        return [...h.slice(0, -1), dragging.preDragLayers];
      });
      setDragging(null);
      setSnapActive({ x: false, y: false });
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [dragging, scale, guideX, guideY, pushHistory]);

  // ── guide drag ───────────────────────────────────────────────────────────────

  const handleGuideMouseDown = useCallback((e: React.MouseEvent, axis: 'x' | 'y') => {
    e.preventDefault(); e.stopPropagation();
    setGuideDrag({ axis, startMouse: axis === 'x' ? e.clientX : e.clientY, startGuide: axis === 'x' ? guideX : guideY });
  }, [guideX, guideY]);

  useEffect(() => {
    if (!guideDrag) return;
    const onMove = (e: MouseEvent) => {
      if (guideDrag.axis === 'x') {
        let newX = guideDrag.startGuide + (e.clientX - guideDrag.startMouse) / scale;
        newX = Math.max(0, Math.min(svgW, newX));
        if (Math.abs(newX - svgW / 2) < SNAP_PX) newX = svgW / 2;
        setGuideX(newX);
      } else {
        let newY = guideDrag.startGuide + (e.clientY - guideDrag.startMouse) / scale;
        newY = Math.max(0, Math.min(svgH, newY));
        if (Math.abs(newY - svgH / 2) < SNAP_PX) newY = svgH / 2;
        setGuideY(newY);
      }
    };
    const onUp = () => setGuideDrag(null);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [guideDrag, scale, svgW, svgH]);

  // ── marquee selection ────────────────────────────────────────────────────────

  const handleCanvasMouseDown = useCallback((e: React.MouseEvent) => {
    // Only fire on the canvas background itself (handles stopPropagation their own mousedown)
    const rect = canvasRef.current!.getBoundingClientRect();
    const x = (e.clientX - rect.left) / scale;
    const y = (e.clientY - rect.top) / scale;
    setMarquee({ x1: x, y1: y, x2: x, y2: y });
  }, [scale]);

  useEffect(() => {
    if (!marquee) return;
    const onMove = (e: MouseEvent) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      setMarquee(prev => prev ? { ...prev, x2: (e.clientX - rect.left) / scale, y2: (e.clientY - rect.top) / scale } : null);
    };
    const onUp = (e: MouseEvent) => {
      if (!marquee) return;
      const dx = Math.abs(marquee.x2 - marquee.x1);
      const dy = Math.abs(marquee.y2 - marquee.y1);
      if (dx > 4 / scale || dy > 4 / scale) {
        // Box select: find all layers whose translate point is inside the rectangle
        const minX = Math.min(marquee.x1, marquee.x2);
        const maxX = Math.max(marquee.x1, marquee.x2);
        const minY = Math.min(marquee.y1, marquee.y2);
        const maxY = Math.max(marquee.y1, marquee.y2);
        const inBox = new Set(
          layers.flatMap((layer, idx) =>
            layer.tx >= minX && layer.tx <= maxX && layer.ty >= minY && layer.ty <= maxY ? [idx] : []
          )
        );
        setSelection(e.shiftKey ? prev => new Set([...prev, ...inBox]) : inBox);
      } else {
        // Simple click on empty area — deselect
        if (!e.shiftKey) setSelection(new Set());
      }
      setMarquee(null);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [marquee, scale, layers]);

  // ── keyboard nudge ───────────────────────────────────────────────────────────

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT') return;
      // Cmd+A / Ctrl+A — select all
      if ((e.metaKey || e.ctrlKey) && e.key === 'a') {
        e.preventDefault();
        setSelection(new Set(layers.map((_, i) => i)));
        return;
      }
      if (selection.size === 0) return;
      if (e.metaKey || e.ctrlKey) return;
      const step = e.shiftKey ? 10 : e.altKey ? 0.1 : 1;
      let dx = 0, dy = 0;
      if (e.key === 'ArrowLeft')  { dx = -step; e.preventDefault(); }
      if (e.key === 'ArrowRight') { dx =  step; e.preventDefault(); }
      if (e.key === 'ArrowUp')    { dy = -step; e.preventDefault(); }
      if (e.key === 'ArrowDown')  { dy =  step; e.preventDefault(); }
      if (dx || dy) {
        pushHistory();
        setLayers(prev => prev.map((l, i) => selection.has(i) ? { ...l, tx: l.tx + dx, ty: l.ty + dy } : l));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selection, pushHistory]);

  // ── alignment ────────────────────────────────────────────────────────────────

  const align = useCallback((action: 'cx' | 'cy' | 'left' | 'right' | 'top' | 'bottom') => {
    if (selection.size === 0) return;
    pushHistory();
    setLayers(prev => prev.map((l, i) => {
      if (!selection.has(i)) return l;
      switch (action) {
        case 'cx':     return { ...l, tx: guideX };
        case 'cy':     return { ...l, ty: guideY };
        case 'left':   return { ...l, tx: 0 };
        case 'right':  return { ...l, tx: svgW };
        case 'top':    return { ...l, ty: 0 };
        case 'bottom': return { ...l, ty: svgH };
      }
    }));
  }, [selection, guideX, guideY, svgW, svgH, pushHistory]);

  const setLayerCoord = useCallback((idx: number, axis: 'tx' | 'ty', val: number) => {
    if (isNaN(val)) return;
    pushHistory();
    setLayers(prev => prev.map((l, i) => i === idx ? { ...l, [axis]: val } : l));
  }, [pushHistory]);

  const setLayerStyle = useCallback((idx: number, prop: 'fontSize' | 'fill', val: string | number) => {
    if (prop === 'fontSize' && isNaN(val as number)) return;
    pushHistory();
    setLayers(prev => prev.map((l, i) => i === idx ? { ...l, [prop]: val } : l));
  }, [pushHistory]);

  // ── rename ────────────────────────────────────────────────────────────────────

  const renameLayer = useCallback((idx: number, newId: string) => {
    const cleaned = newId.trim().replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_\-*]/g, '');
    if (!cleaned) return;
    setLayers(prev => prev.map((l, i) => i === idx ? { ...l, id: cleaned } : l));
  }, []);

  // ── save ──────────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!selected?.textSvg || !svgSource || !accessToken) return;
    setSaving(true); setSaveMsg('');
    const content = buildSvgForSave(svgSource, layers);
    const res = await fetch('/api/admin/update-svg', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ svgPublicPath: selected.textSvg, svgContent: content }),
    });
    setSaving(false);
    if (res.ok) { setSvgSource(content); setLayers(parseLayers(content)); setSaveMsg('Saved ✓'); setTimeout(() => setSaveMsg(''), 3000); }
    else setSaveMsg('Error saving');
  };

  if (loading || !user || user.email !== ADMIN_EMAIL) return null;

  const border = '1px solid rgba(255,255,255,0.08)';
  const selArray = Array.from(selection);
  const singleSel = selArray.length === 1 ? layers[selArray[0]] : null;
  const hasSelection = selection.size > 0;

  const AlignBtn = ({ action, title, children }: { action: Parameters<typeof align>[0]; title: string; children: React.ReactNode }) => (
    <button
      onClick={() => align(action)}
      title={title}
      disabled={!hasSelection}
      style={{
        padding: '5px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600,
        background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
        color: !hasSelection ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.75)',
        cursor: !hasSelection ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap',
      }}
    >{children}</button>
  );

  return (
    <div style={{ minHeight: '100vh', background: '#09090b', color: '#fff', display: 'flex', flexDirection: 'column' }}>

      {/* Header */}
      <header style={{ position: 'sticky', top: 0, zIndex: 50, background: 'rgba(9,9,11,0.9)', backdropFilter: 'blur(12px)', borderBottom: border }}>
        <div style={{ maxWidth: 1400, margin: '0 auto', padding: '0 24px', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button onClick={() => router.push('/admin')} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: 13, padding: 0 }}>← Admin</button>
            <span style={{ color: 'rgba(255,255,255,0.15)' }}>/</span>
            <span style={{ fontSize: 14, fontWeight: 600 }}>Template Editor</span>
            {selected && <><span style={{ color: 'rgba(255,255,255,0.15)' }}>/</span><span style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>{selected.subcategory ?? selected.category} — {selected.name}</span></>}
          </div>
          {selected && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {history.length > 0 && (
                <button
                  onClick={() => { const h = historyRef.current; if (!h.length) return; setLayers(h[h.length - 1]); setHistory(h.slice(0, -1)); }}
                  style={{ fontSize: 12, padding: '4px 10px', borderRadius: 6, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)', cursor: 'pointer' }}
                  title="Undo (⌘Z)"
                >
                  ↩ Undo ({history.length})
                </button>
              )}
              {saveMsg && <span style={{ fontSize: 13, color: saveMsg.includes('Error') ? '#f87171' : '#4ade80' }}>{saveMsg}</span>}
              <button onClick={handleSave} disabled={saving || !svgSource} style={{ padding: '7px 20px', borderRadius: 8, fontSize: 13, fontWeight: 600, background: saving ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.15)', color: saving ? 'rgba(255,255,255,0.3)' : '#fff', cursor: saving ? 'not-allowed' : 'pointer' }}>
                {saving ? 'Saving…' : 'Save to SVG'}
              </button>
            </div>
          )}
        </div>
      </header>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* Left: template list */}
        <div style={{ width: 240, borderRight: border, overflowY: 'auto', padding: '8px 0' }}>
          {templates.length === 0 && <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.2)', padding: '16px' }}>Loading…</p>}
          {(() => {
            const cats = new Map<string, Map<string, Template[]>>();
            for (const t of templates) {
              if (!cats.has(t.category)) cats.set(t.category, new Map());
              const sub = t.subcategory ?? '';
              const catMap = cats.get(t.category)!;
              if (!catMap.has(sub)) catMap.set(sub, []);
              catMap.get(sub)!.push(t);
            }
            const toggle = (key: string) => setCollapsed(prev => {
              const next = new Set(prev);
              next.has(key) ? next.delete(key) : next.add(key);
              return next;
            });
            return Array.from(cats.entries()).map(([cat, subMap]) => {
              const catOpen = !collapsed.has(cat);
              return (
                <div key={cat}>
                  {/* Category row */}
                  <button
                    onClick={() => toggle(cat)}
                    style={{ width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: 600 }}
                  >
                    <span style={{ fontSize: 10, opacity: 0.5, transition: 'transform 0.15s', transform: catOpen ? 'rotate(90deg)' : 'rotate(0deg)', display: 'inline-block' }}>▶</span>
                    <span style={{ fontSize: 16, lineHeight: 1 }}>📁</span>
                    <span style={{ flex: 1 }}>{cat}</span>
                  </button>

                  {catOpen && Array.from(subMap.entries()).map(([sub, items]) => {
                    const subKey = `${cat}/${sub}`;
                    const subOpen = !collapsed.has(subKey);
                    // If there's a subcategory, show a sub-folder row; otherwise list files directly
                    return (
                      <div key={sub}>
                        {sub ? (
                          <>
                            <button
                              onClick={() => toggle(subKey)}
                              style={{ width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px 6px 28px', background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.55)', fontSize: 13 }}
                            >
                              <span style={{ fontSize: 10, opacity: 0.4, transition: 'transform 0.15s', transform: subOpen ? 'rotate(90deg)' : 'rotate(0deg)', display: 'inline-block' }}>▶</span>
                              <span style={{ fontSize: 14, lineHeight: 1 }}>📂</span>
                              <span style={{ flex: 1 }}>{sub}</span>
                            </button>
                            {subOpen && items.map(t => (
                              <button
                                key={t.id}
                                onClick={() => setSelected(t)}
                                style={{
                                  width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 6,
                                  padding: '6px 12px 6px 44px',
                                  background: selected?.id === t.id ? 'rgba(255,255,255,0.08)' : 'none',
                                  border: 'none', cursor: 'pointer',
                                  color: selected?.id === t.id ? '#fff' : 'rgba(255,255,255,0.5)',
                                  fontSize: 13,
                                  borderLeft: selected?.id === t.id ? '2px solid rgba(255,255,255,0.35)' : '2px solid transparent',
                                }}
                              >
                                <span style={{ fontSize: 13, lineHeight: 1, opacity: 0.6 }}>🖼</span>
                                {t.name}
                              </button>
                            ))}
                          </>
                        ) : (
                          items.map(t => (
                            <button
                              key={t.id}
                              onClick={() => setSelected(t)}
                              style={{
                                width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 6,
                                padding: '6px 12px 6px 28px',
                                background: selected?.id === t.id ? 'rgba(255,255,255,0.08)' : 'none',
                                border: 'none', cursor: 'pointer',
                                color: selected?.id === t.id ? '#fff' : 'rgba(255,255,255,0.5)',
                                fontSize: 13,
                                borderLeft: selected?.id === t.id ? '2px solid rgba(255,255,255,0.35)' : '2px solid transparent',
                              }}
                            >
                              <span style={{ fontSize: 13, lineHeight: 1, opacity: 0.6 }}>🖼</span>
                              {t.name}
                            </button>
                          ))
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            });
          })()}
        </div>

        {/* Right: editor */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '32px 40px', display: 'flex', gap: 40, alignItems: 'flex-start' }}>

          {!selected && <div style={{ color: 'rgba(255,255,255,0.2)', fontSize: 15, margin: 'auto', paddingTop: 80 }}>Select a template to start editing</div>}

          {selected && (
            <>
              {/* Card */}
              <div style={{ flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 8 }}>
                  <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>
                    Click · Shift+click · drag to box-select · ⌘A all · arrow keys · ⌘Z undo
                  </span>
                  <button onClick={() => setShowGuides(v => !v)} style={{ marginLeft: 'auto', fontSize: 11, padding: '3px 10px', borderRadius: 6, background: showGuides ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)', cursor: 'pointer' }}>
                    {showGuides ? 'Hide guides' : 'Show guides'}
                  </button>
                </div>
                <div style={{ display: 'flex', gap: 12, marginBottom: 10 }}>
                  <span style={{ fontSize: 11, color: '#f09b00' }}>● editable</span>
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>● static</span>
                  {selection.size > 1 && <span style={{ fontSize: 11, color: 'rgba(99,200,255,0.8)' }}>{selection.size} selected</span>}
                  {showGuides && <span style={{ fontSize: 11, color: 'rgba(99,200,255,0.4)' }}>· drag blue handles to move guides</span>}
                </div>

                <div
                  ref={canvasRef}
                  onMouseDown={handleCanvasMouseDown}
                  style={{ position: 'relative', width: CARD_DISPLAY_WIDTH, height: cardDisplayHeight, borderRadius: 8, overflow: 'hidden', userSelect: 'none', cursor: dragging ? 'grabbing' : guideDrag ? (guideDrag.axis === 'x' ? 'ew-resize' : 'ns-resize') : marquee ? 'crosshair' : 'default' }}
                >
                  <img src={selected.backgroundSrc} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block' }} draggable={false} />
                  {displaySvg && <div style={{ position: 'absolute', inset: 0 }} dangerouslySetInnerHTML={{ __html: displaySvg }} />}

                  {/* Guide lines */}
                  {showGuides && (
                    <>
                      {/* Vertical guide line */}
                      <div style={{ position: 'absolute', top: 0, bottom: 0, left: guideX * scale, width: 1, borderLeft: snapActive.x ? '1px solid #0f0' : '1px dashed rgba(99,200,255,0.5)', pointerEvents: 'none', zIndex: 15 }} />
                      {/* Vertical guide drag handle (top) */}
                      <div
                        onMouseDown={e => { e.stopPropagation(); handleGuideMouseDown(e, 'x'); }}
                        title={`Vertical guide — X: ${Math.round(guideX * 10) / 10}  (drag to move)`}
                        style={{
                          position: 'absolute', top: 0, left: guideX * scale,
                          transform: 'translateX(-50%)',
                          width: 14, height: 18,
                          background: snapActive.x ? '#0f0' : 'rgba(99,200,255,0.85)',
                          borderRadius: '0 0 4px 4px',
                          cursor: 'ew-resize',
                          zIndex: 25,
                        }}
                      />

                      {/* Horizontal guide line */}
                      <div style={{ position: 'absolute', left: 0, right: 0, top: guideY * scale, height: 1, borderTop: snapActive.y ? '1px solid #0f0' : '1px dashed rgba(99,200,255,0.5)', pointerEvents: 'none', zIndex: 15 }} />
                      {/* Horizontal guide drag handle (left) */}
                      <div
                        onMouseDown={e => { e.stopPropagation(); handleGuideMouseDown(e, 'y'); }}
                        title={`Horizontal guide — Y: ${Math.round(guideY * 10) / 10}  (drag to move)`}
                        style={{
                          position: 'absolute', left: 0, top: guideY * scale,
                          transform: 'translateY(-50%)',
                          width: 18, height: 14,
                          background: snapActive.y ? '#0f0' : 'rgba(99,200,255,0.85)',
                          borderRadius: '0 4px 4px 0',
                          cursor: 'ns-resize',
                          zIndex: 25,
                        }}
                      />
                    </>
                  )}

                  {/* Marquee rectangle */}
                  {marquee && (() => {
                    const x = Math.min(marquee.x1, marquee.x2) * scale;
                    const y = Math.min(marquee.y1, marquee.y2) * scale;
                    const w = Math.abs(marquee.x2 - marquee.x1) * scale;
                    const h = Math.abs(marquee.y2 - marquee.y1) * scale;
                    return (
                      <div style={{ position: 'absolute', left: x, top: y, width: w, height: h, border: '1px solid rgba(99,200,255,0.9)', background: 'rgba(99,200,255,0.08)', pointerEvents: 'none', zIndex: 30 }} />
                    );
                  })()}

                  {/* Layer handles */}
                  {layers.map((layer, idx) => {
                    const isActive = dragging?.handleIdx === idx;
                    const isSel = selection.has(idx);
                    const isHov = hoveredIdx === idx;
                    const isField = layer.id !== null;
                    return (
                      <div
                        key={idx}
                        onMouseDown={e => { e.stopPropagation(); handleMouseDown(e, idx); }}
                        onClick={e => e.stopPropagation()}
                        onMouseEnter={() => setHoveredIdx(idx)}
                        onMouseLeave={() => setHoveredIdx(null)}
                        style={{
                          position: 'absolute',
                          left: layer.tx * scale, top: layer.ty * scale,
                          transform: 'translate(-50%, -50%)',
                          width: isActive || isHov || isSel ? 20 : 14,
                          height: isActive || isHov || isSel ? 20 : 14,
                          borderRadius: '50%',
                          background: isField ? '#f09b00' : 'rgba(255,255,255,0.7)',
                          border: `2px solid ${isSel ? '#fff' : 'rgba(0,0,0,0.5)'}`,
                          cursor: isActive ? 'grabbing' : 'grab',
                          zIndex: 20,
                          boxShadow: isSel
                            ? (selection.size > 1 ? '0 0 0 3px rgba(99,200,255,0.6)' : '0 0 0 3px rgba(255,255,255,0.5)')
                            : undefined,
                          outline: isSel ? `2px solid ${selection.size > 1 ? 'rgba(99,200,255,0.4)' : 'rgba(255,255,255,0.4)'}` : undefined,
                          outlineOffset: '4px',
                          transition: isActive ? 'none' : 'width 0.1s, height 0.1s',
                        }}
                        title={layer.id ?? layer.label}
                      />
                    );
                  })}
                </div>
              </div>

              {/* Right panel */}
              <div style={{ minWidth: 280 }}>

                {/* Alignment toolbar */}
                <div style={{ marginBottom: 20 }}>
                  <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', marginBottom: 6 }}>
                    Align
                    {selection.size > 1 && <span style={{ color: 'rgba(99,200,255,0.8)', textTransform: 'none', letterSpacing: 0 }}> — {selection.size} layers</span>}
                    {singleSel && <span style={{ color: singleSel.id ? '#f09b00' : 'rgba(255,255,255,0.6)', textTransform: 'none', letterSpacing: 0 }}> — {singleSel.id ?? `static-${selArray[0]}`}</span>}
                    {!hasSelection && <span style={{ color: 'rgba(255,255,255,0.15)', textTransform: 'none', letterSpacing: 0 }}> (select a layer)</span>}
                  </p>
                  {/* Guide info */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <span style={{ fontSize: 11, color: 'rgba(99,200,255,0.6)' }}>Guide X: {Math.round(guideX * 10) / 10}</span>
                    <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)' }}>·</span>
                    <span style={{ fontSize: 11, color: 'rgba(99,200,255,0.6)' }}>Y: {Math.round(guideY * 10) / 10}</span>
                    <button
                      onClick={() => { setGuideX(svgW / 2); setGuideY(svgH / 2); }}
                      style={{ fontSize: 10, padding: '2px 7px', borderRadius: 4, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.4)', cursor: 'pointer' }}
                      title="Reset guides to canvas center"
                    >reset</button>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    <AlignBtn action="cx" title="Snap to vertical guide (X)">⊕ Guide X</AlignBtn>
                    <AlignBtn action="cy" title="Snap to horizontal guide (Y)">⊕ Guide Y</AlignBtn>
                    <AlignBtn action="left" title="Align to left edge">← Left</AlignBtn>
                    <AlignBtn action="right" title="Align to right edge">Right →</AlignBtn>
                    <AlignBtn action="top" title="Align to top edge">↑ Top</AlignBtn>
                    <AlignBtn action="bottom" title="Align to bottom edge">↓ Bottom</AlignBtn>
                  </div>
                </div>

                {/* Layer list */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                  <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', margin: 0, flex: 1 }}>Layers</p>
                  <button
                    onClick={() => setSelection(new Set(layers.map((_, i) => i)))}
                    title="Select all (⌘A)"
                    style={{ fontSize: 10, padding: '2px 8px', borderRadius: 4, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', whiteSpace: 'nowrap' }}
                  >All</button>
                  <button
                    onClick={() => setSelection(new Set(layers.flatMap((l, i) => l.id ? [i] : [])))}
                    title="Select all editable fields"
                    style={{ fontSize: 10, padding: '2px 8px', borderRadius: 4, background: 'rgba(240,155,0,0.12)', border: '1px solid rgba(240,155,0,0.25)', color: '#f09b00', cursor: 'pointer', whiteSpace: 'nowrap' }}
                  >Editable</button>
                  {selection.size > 0 && (
                    <button
                      onClick={() => setSelection(new Set())}
                      title="Deselect all"
                      style={{ fontSize: 10, padding: '2px 8px', borderRadius: 4, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.3)', cursor: 'pointer', whiteSpace: 'nowrap' }}
                    >None</button>
                  )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {layers.map((layer, idx) => {
                    const isSel = selection.has(idx);
                    const isHov = hoveredIdx === idx && !isSel;
                    const isMultiSel = isSel && selection.size > 1;
                    const isRenaming = renamingIdx === idx;
                    return (
                      <div
                        key={idx}
                        onClick={e => { e.stopPropagation(); toggleSelect(idx, e.shiftKey); }}
                        onMouseEnter={() => setHoveredIdx(idx)}
                        onMouseLeave={() => setHoveredIdx(null)}
                        style={{
                          padding: '8px 12px', borderRadius: 8, cursor: 'pointer',
                          background: isSel ? 'rgba(255,255,255,0.07)' : isHov ? 'rgba(255,255,255,0.03)' : 'transparent',
                          border: `1px solid ${isSel ? (isMultiSel ? 'rgba(99,200,255,0.3)' : 'rgba(255,255,255,0.2)') : 'transparent'}`,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: isSel && !isMultiSel ? 8 : 0 }}>
                          <div style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, background: layer.id ? '#f09b00' : 'rgba(255,255,255,0.4)' }} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            {/* Rename input or label */}
                            {isRenaming && layer.id !== null ? (
                              <input
                                autoFocus
                                type="text"
                                defaultValue={layer.id}
                                onClick={e => e.stopPropagation()}
                                onBlur={e => { renameLayer(idx, e.target.value); setRenamingIdx(null); }}
                                onKeyDown={e => {
                                  if (e.key === 'Enter') { renameLayer(idx, e.currentTarget.value); setRenamingIdx(null); }
                                  if (e.key === 'Escape') setRenamingIdx(null);
                                  e.stopPropagation();
                                }}
                                style={{ background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(99,200,255,0.5)', borderRadius: 4, color: '#63c8ff', fontSize: 12, fontWeight: 600, padding: '2px 6px', width: '100%', outline: 'none' }}
                              />
                            ) : (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                <div style={{ fontSize: 12, fontWeight: 600, color: layer.id ? '#f09b00' : 'rgba(255,255,255,0.7)' }}>
                                  {layer.id ?? `static-${idx}`}
                                </div>
                                {isSel && layer.id !== null && (
                                  <button
                                    onClick={e => { e.stopPropagation(); setRenamingIdx(idx); }}
                                    title="Rename field id"
                                    style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', cursor: 'pointer', padding: '0 2px', fontSize: 12, lineHeight: 1 }}
                                  >✎</button>
                                )}
                              </div>
                            )}
                            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{layer.label}</div>
                          </div>
                          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', fontVariantNumeric: 'tabular-nums', textAlign: 'right', flexShrink: 0 }}>
                            <div>x {Math.round(layer.tx * 10) / 10}</div>
                            <div>y {Math.round(layer.ty * 10) / 10}</div>
                          </div>
                        </div>

                        {/* X/Y inputs — only for single selection */}
                        {isSel && !isMultiSel && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }} onClick={e => e.stopPropagation()}>
                            {/* Position */}
                            <div style={{ display: 'flex', gap: 8 }}>
                              {(['tx', 'ty'] as const).map(axis => (
                                <label key={axis} style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1 }}>
                                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', width: 10 }}>{axis === 'tx' ? 'x' : 'y'}</span>
                                  <input
                                    type="number" step="0.1"
                                    value={Math.round(layer[axis] * 10) / 10}
                                    onChange={e => setLayerCoord(idx, axis, parseFloat(e.target.value))}
                                    style={{ flex: 1, background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 6, color: '#fff', fontSize: 12, padding: '4px 8px', fontVariantNumeric: 'tabular-nums', outline: 'none' }}
                                  />
                                </label>
                              ))}
                            </div>
                            {/* Font size + color */}
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                              <label style={{ display: 'flex', alignItems: 'center', gap: 4, flex: '0 0 auto' }}>
                                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', whiteSpace: 'nowrap' }}>size</span>
                                <input
                                  type="number" step="0.5" min="1"
                                  value={layer.fontSize ?? ''}
                                  placeholder="–"
                                  onChange={e => setLayerStyle(idx, 'fontSize', parseFloat(e.target.value))}
                                  style={{ width: 64, background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 6, color: '#fff', fontSize: 12, padding: '4px 8px', outline: 'none' }}
                                />
                              </label>
                              <label style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1, minWidth: 0 }}>
                                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>color</span>
                                <input
                                  type="color"
                                  value={layer.fill && /^#[0-9a-f]{6}$/i.test(layer.fill) ? layer.fill : '#ffffff'}
                                  onChange={e => setLayerStyle(idx, 'fill', e.target.value)}
                                  style={{ width: 28, height: 26, padding: '2px', background: 'none', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 5, cursor: 'pointer', flexShrink: 0 }}
                                />
                                <input
                                  type="text"
                                  value={layer.fill ?? ''}
                                  onChange={e => setLayerStyle(idx, 'fill', e.target.value)}
                                  style={{ flex: 1, minWidth: 0, background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 6, color: '#fff', fontSize: 11, padding: '4px 6px', outline: 'none', fontFamily: 'monospace' }}
                                />
                              </label>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
