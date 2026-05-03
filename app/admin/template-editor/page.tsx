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
  fontWeight: number | null;
  fontFamily: string | null;
  fill: string | null;
  anchor: 'start' | 'middle' | 'end' | null;
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

type ImageOverlay = {
  id: string;
  src: string;       // base64 data URL
  x: number;         // SVG-unit position (center x)
  y: number;         // SVG-unit position (center y)
  w: number;         // SVG-unit width
  h: number;         // SVG-unit height
};

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
    const fwSrc = textEl.getAttribute('font-weight');
    const ffSrc = textEl.getAttribute('font-family');
    const fillSrc = textEl.getAttribute('fill');
    const anchorSrc = textEl.getAttribute('text-anchor') as 'start' | 'middle' | 'end' | null;
    layers.push({ index: idx, id, originalId: id, label, tx: parseFloat(m[1]), ty: parseFloat(m[2]), restTransform: m[3], fontSize: fsSrc ? parseFloat(fsSrc) : null, fontWeight: fwSrc ? parseFloat(fwSrc) : null, fontFamily: ffSrc ?? null, fill: fillSrc ?? null, anchor: anchorSrc });
  });
  return layers;
}

function buildSvgForSave(svgSource: string, layers: Layer[], imageOverlays: ImageOverlay[]): string {
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
    if (layer.fontWeight !== null) textEl.setAttribute('font-weight', String(layer.fontWeight));
    if (layer.fontFamily !== null) textEl.setAttribute('font-family', layer.fontFamily);
    if (layer.fill !== null) textEl.setAttribute('fill', layer.fill);
    if (layer.anchor !== null) textEl.setAttribute('text-anchor', layer.anchor ?? 'middle');
    // Rename id
    if (layer.originalId && layer.id && layer.id !== layer.originalId) {
      const parent = textEl.parentElement;
      if (parent?.id === layer.originalId) parent.id = layer.id;
    }
  });
  // Remove any previously saved <image> elements, then append current overlays
  doc.documentElement.querySelectorAll('image').forEach(el => el.remove());
  imageOverlays.forEach(img => {
    const el = doc.createElementNS('http://www.w3.org/2000/svg', 'image');
    el.setAttribute('href', img.src);
    el.setAttribute('x', String(Math.round((img.x - img.w / 2) * 10) / 10));
    el.setAttribute('y', String(Math.round((img.y - img.h / 2) * 10) / 10));
    el.setAttribute('width', String(Math.round(img.w * 10) / 10));
    el.setAttribute('height', String(Math.round(img.h * 10) / 10));
    doc.documentElement.appendChild(el);
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
    if (layer.fontWeight !== null) textEl.setAttribute('font-weight', String(layer.fontWeight));
    if (layer.fontFamily !== null) textEl.setAttribute('font-family', layer.fontFamily);
    if (layer.fill !== null) textEl.setAttribute('fill', layer.fill);
    if (layer.anchor !== null) textEl.setAttribute('text-anchor', layer.anchor ?? 'middle');
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
  const [showDots, setShowDots] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [renamingIdx, setRenamingIdx] = useState<number | null>(null);
  const [marquee, setMarquee] = useState<Marquee | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [imageOverlays, setImageOverlays] = useState<ImageOverlay[]>([]);
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
  const [imageDrag, setImageDrag] = useState<{ id: string; startMouseX: number; startMouseY: number; startX: number; startY: number } | null>(null);
  const [imageResize, setImageResize] = useState<{ id: string; startMouseX: number; startMouseY: number; startW: number; startH: number } | null>(null);
  const [keyboardInset, setKeyboardInset] = useState(0);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const rightPanelRef = useRef<HTMLDivElement>(null);

  // Refs for undo (avoid stale closures)
  const layersRef = useRef(layers);
  useEffect(() => { layersRef.current = layers; }, [layers]);
  const historyRef = useRef<Layer[][]>([]);
  useEffect(() => { historyRef.current = history; }, [history]);

  // Refs for image drag/resize (avoid stale closures in mousemove useEffect)
  const imageDragRef = useRef(imageDrag);
  useEffect(() => { imageDragRef.current = imageDrag; }, [imageDrag]);
  const imageResizeRef = useRef(imageResize);
  useEffect(() => { imageResizeRef.current = imageResize; }, [imageResize]);

  // Track keyboard height via visualViewport (iOS Safari doesn't resize layout viewport)
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const handler = () => {
      const inset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      setKeyboardInset(inset);
    };
    vv.addEventListener('resize', handler);
    vv.addEventListener('scroll', handler);
    return () => { vv.removeEventListener('resize', handler); vv.removeEventListener('scroll', handler); };
  }, []);

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
    setImageOverlays([]); setSelectedImageId(null);
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

  // ── image overlay drag/resize ─────────────────────────────────────────────────

  useEffect(() => {
    if (!imageDrag && !imageResize) return;
    const onMove = (e: MouseEvent) => {
      const currentDrag = imageDragRef.current;
      const currentResize = imageResizeRef.current;
      if (currentDrag) {
        const dx = (e.clientX - currentDrag.startMouseX) / scale;
        const dy = (e.clientY - currentDrag.startMouseY) / scale;
        setImageOverlays(prev => prev.map(img => img.id === currentDrag.id ? { ...img, x: currentDrag.startX + dx, y: currentDrag.startY + dy } : img));
      }
      if (currentResize) {
        const dx = (e.clientX - currentResize.startMouseX) / scale;
        const newW = Math.max(10, currentResize.startW + dx);
        const ratio = currentResize.startH / currentResize.startW;
        setImageOverlays(prev => prev.map(img => img.id === currentResize.id ? { ...img, w: newW, h: newW * ratio } : img));
      }
    };
    const onUp = () => {
      setImageDrag(null);
      setImageResize(null);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [imageDrag, imageResize, scale]);

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

  const setLayerStyle = useCallback((idx: number, prop: 'fontSize' | 'fontWeight' | 'fontFamily' | 'fill' | 'anchor', val: string | number) => {
    if ((prop === 'fontSize' || prop === 'fontWeight') && isNaN(val as number)) return;
    pushHistory();
    setLayers(prev => prev.map((l, i) => i === idx ? { ...l, [prop]: val } : l));
  }, [pushHistory]);

  // Apply a style change to every selected layer at once
  const setSelectionStyle = useCallback((prop: 'fontSize' | 'fontWeight' | 'fontFamily' | 'fill' | 'anchor', val: string | number) => {
    if ((prop === 'fontSize' || prop === 'fontWeight') && isNaN(val as number)) return;
    pushHistory();
    setLayers(prev => prev.map((l, i) => selection.has(i) ? { ...l, [prop]: val } : l));
  }, [selection, pushHistory]);

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
    const content = buildSvgForSave(svgSource, layers, imageOverlays);
    const res = await fetch('/api/admin/update-svg', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ svgPublicPath: selected.textSvg, svgContent: content }),
    });
    setSaving(false);
    if (res.ok) { setSvgSource(content); setLayers(parseLayers(content)); setSaveMsg('Saved ✓'); setTimeout(() => setSaveMsg(''), 3000); }
    else setSaveMsg('Error saving');
  };

  const handleImageMouseDown = useCallback((e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setSelectedImageId(id);
    const img = imageOverlays.find(i => i.id === id);
    if (!img) return;
    setImageDrag({ id, startMouseX: e.clientX, startMouseY: e.clientY, startX: img.x, startY: img.y });
  }, [imageOverlays]);

  const handleImageResizeMouseDown = useCallback((e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setSelectedImageId(id);
    const img = imageOverlays.find(i => i.id === id);
    if (!img) return;
    setImageResize({ id, startMouseX: e.clientX, startMouseY: e.clientY, startW: img.w, startH: img.h });
  }, [imageOverlays]);

  const handleImageInsert = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const src = ev.target?.result as string;
      const img = new Image();
      img.onload = () => {
        const aspect = img.height / img.width;
        const defaultW = svgW * 0.3;
        const overlay: ImageOverlay = {
          id: `img_${Date.now()}`,
          src,
          x: svgW / 2,
          y: svgH / 2,
          w: defaultW,
          h: defaultW * aspect,
        };
        setImageOverlays(prev => [...prev, overlay]);
        setSelectedImageId(overlay.id);
      };
      img.src = src;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }, [svgW, svgH]);

  if (loading || !user || user.email !== ADMIN_EMAIL) return null;

  const border = '1px solid rgba(255,255,255,0.08)';
  const selArray = Array.from(selection);
  const singleSel = selArray.length === 1 ? layers[selArray[0]] : null;
  // Representative layer for toolbar display values (first selected)
  const firstSel = selArray.length > 0 ? layers[selArray[0]] : null;
  const hasSelection = selection.size > 0;


  return (
    <div style={{ height: '100vh', overflow: 'hidden', background: '#09090b', color: '#fff', display: 'flex', flexDirection: 'column' }}>

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

      {/* ── Contextual toolbar (Photoshop-style options bar) ────────────────── */}
      <div style={{
        borderBottom: border, background: 'rgba(9,9,11,0.97)', flexShrink: 0,
        height: 44, display: 'flex', alignItems: 'center', gap: 0, paddingLeft: 8, paddingRight: 8, overflowX: 'auto',
      }}>
        {!hasSelection || !selected ? (
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.2)', paddingLeft: 8 }}>
            Select a layer to edit its properties
          </span>
        ) : (
          <>
            {/* Layer label */}
            <span style={{ fontSize: 12, fontWeight: 600, color: firstSel?.id ? '#f09b00' : 'rgba(255,255,255,0.6)', whiteSpace: 'nowrap', paddingLeft: 8, paddingRight: 12 }}>
              {selection.size > 1 ? `${selection.size} layers` : (firstSel?.id ?? `static-${selArray[0]}`)}
            </span>
            <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.1)', flexShrink: 0 }} />

            {/* X / Y — single selection only */}
            {singleSel && (
              <>
                {(['tx', 'ty'] as const).map(axis => (
                  <label key={axis} style={{ display: 'flex', alignItems: 'center', gap: 3, paddingLeft: 10 }}>
                    <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', width: 10 }}>{axis === 'tx' ? 'X' : 'Y'}</span>
                    <input
                      type="number" step="0.1"
                      value={Math.round(singleSel[axis] * 10) / 10}
                      onChange={e => setLayerCoord(selArray[0], axis, parseFloat(e.target.value))}
                      style={{ width: 58, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 5, color: '#fff', fontSize: 12, padding: '3px 6px', outline: 'none', fontVariantNumeric: 'tabular-nums' }}
                    />
                  </label>
                ))}
                <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.1)', flexShrink: 0, marginLeft: 10 }} />
              </>
            )}

            {/* Font size */}
            <label style={{ display: 'flex', alignItems: 'center', gap: 3, paddingLeft: 10 }}>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', whiteSpace: 'nowrap' }}>Size</span>
              <input
                type="number" step="0.5" min="1"
                value={firstSel?.fontSize ?? ''}
                placeholder="–"
                onChange={e => setSelectionStyle('fontSize', parseFloat(e.target.value))}
                style={{ width: 52, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 5, color: '#fff', fontSize: 12, padding: '3px 6px', outline: 'none' }}
              />
            </label>

            {/* Font weight */}
            <label style={{ display: 'flex', alignItems: 'center', gap: 4, paddingLeft: 10 }}>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', whiteSpace: 'nowrap' }}>Wt</span>
              <input
                type="range" min="100" max="900" step="100"
                value={firstSel?.fontWeight ?? 400}
                onChange={e => setSelectionStyle('fontWeight', parseInt(e.target.value))}
                onPointerUp={() => pushHistory()}
                style={{ width: 72, accentColor: 'rgba(255,255,255,0.6)', cursor: 'pointer' }}
              />
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', width: 28, fontVariantNumeric: 'tabular-nums' }}>{firstSel?.fontWeight ?? 400}</span>
            </label>
            <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.1)', flexShrink: 0, marginLeft: 6 }} />

            {/* Font family */}
            <label style={{ display: 'flex', alignItems: 'center', gap: 4, paddingLeft: 10 }}>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', whiteSpace: 'nowrap' }}>Font</span>
              <select
                value={firstSel?.fontFamily ?? ''}
                onChange={e => setSelectionStyle('fontFamily', e.target.value)}
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 5, color: '#fff', fontSize: 12, padding: '3px 6px', outline: 'none', cursor: 'pointer' }}
              >
                <option value="Heebo">Heebo</option>
                <option value="Frank Ruhl Libre">Frank Ruhl Libre</option>
                <option value="Secular One">Secular One</option>
                <option value="Playpen Sans Hebrew">Playpen Sans Hebrew</option>
                <option value="Dancing Script">Dancing Script</option>
                <option value="Lora">Lora</option>
                <option value="Montserrat">Montserrat</option>
                <option value="Oswald">Oswald</option>
              </select>
            </label>
            <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.1)', flexShrink: 0, marginLeft: 10 }} />

            {/* Color */}
            <label style={{ display: 'flex', alignItems: 'center', gap: 4, paddingLeft: 10 }}>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>Color</span>
              <input
                type="color"
                value={firstSel?.fill && /^#[0-9a-f]{6}$/i.test(firstSel.fill) ? firstSel.fill : '#ffffff'}
                onChange={e => setSelectionStyle('fill', e.target.value)}
                style={{ width: 26, height: 24, padding: '1px', background: 'none', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 4, cursor: 'pointer', flexShrink: 0 }}
              />
              <input
                type="text"
                value={firstSel?.fill ?? ''}
                onChange={e => setSelectionStyle('fill', e.target.value)}
                style={{ width: 72, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 5, color: '#fff', fontSize: 11, padding: '3px 6px', outline: 'none', fontFamily: 'monospace' }}
              />
            </label>
            <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.1)', flexShrink: 0, marginLeft: 10 }} />

            {/* Text anchor */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, paddingLeft: 10 }}>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>Anchor</span>
              <div style={{ display: 'flex', gap: 2 }}>
                {(['start', 'middle', 'end'] as const).map(a => (
                  <button
                    key={a}
                    onClick={() => setSelectionStyle('anchor', a)}
                    title={a === 'start' ? 'Left (start)' : a === 'middle' ? 'Center' : 'Right (end)'}
                    style={{
                      width: 28, height: 24, border: `1px solid ${firstSel?.anchor === a ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.15)'}`,
                      borderRadius: 4, background: firstSel?.anchor === a ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.04)',
                      cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, color: 'rgba(255,255,255,0.8)',
                    }}
                  >
                    <svg width="14" height="10" viewBox="0 0 14 10" fill="none">
                      {a === 'start'  && <><line x1="1" y1="2" x2="13" y2="2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><line x1="1" y1="5" x2="9"  y2="5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><line x1="1" y1="8" x2="11" y2="8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></>}
                      {a === 'middle' && <><line x1="1" y1="2" x2="13" y2="2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><line x1="3" y1="5" x2="11" y2="5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><line x1="2" y1="8" x2="12" y2="8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></>}
                      {a === 'end'    && <><line x1="1"  y1="2" x2="13" y2="2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><line x1="5"  y1="5" x2="13" y2="5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><line x1="3"  y1="8" x2="13" y2="8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></>}
                    </svg>
                  </button>
                ))}
              </div>
            </div>
            <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.1)', flexShrink: 0, marginLeft: 10 }} />

            {/* Snap to guide */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, paddingLeft: 10 }}>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', whiteSpace: 'nowrap' }}>Snap</span>
              <button
                onClick={() => align('cx')} disabled={!hasSelection}
                title={`Align to vertical guide X: ${Math.round(guideX * 10) / 10}`}
                style={{ padding: '3px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, background: 'rgba(99,200,255,0.08)', border: '1px solid rgba(99,200,255,0.25)', color: hasSelection ? 'rgba(99,200,255,0.9)' : 'rgba(99,200,255,0.25)', cursor: hasSelection ? 'pointer' : 'not-allowed', whiteSpace: 'nowrap' }}
              >⊕ X</button>
              <button
                onClick={() => align('cy')} disabled={!hasSelection}
                title={`Align to horizontal guide Y: ${Math.round(guideY * 10) / 10}`}
                style={{ padding: '3px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, background: 'rgba(99,200,255,0.08)', border: '1px solid rgba(99,200,255,0.25)', color: hasSelection ? 'rgba(99,200,255,0.9)' : 'rgba(99,200,255,0.25)', cursor: hasSelection ? 'pointer' : 'not-allowed', whiteSpace: 'nowrap' }}
              >⊕ Y</button>
              <span style={{ fontSize: 11, color: 'rgba(99,200,255,0.4)', whiteSpace: 'nowrap' }}>
                {Math.round(guideX * 10) / 10} / {Math.round(guideY * 10) / 10}
              </span>
              <button
                onClick={() => { setGuideX(svgW / 2); setGuideY(svgH / 2); }}
                title="Reset guides to canvas center"
                style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.3)', cursor: 'pointer' }}
              >↺</button>
            </div>
          </>
        )}
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* Left: template list */}
        <div style={{ width: 240, borderRight: border, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '8px 10px 4px', flexShrink: 0 }}>
            <input
              type="text"
              placeholder="Search templates…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ width: '100%', boxSizing: 'border-box', padding: '6px 10px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.06)', color: '#fff', fontSize: 13, outline: 'none' }}
            />
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
          {templates.length === 0 && <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.2)', padding: '16px' }}>Loading…</p>}
          {(() => {
            const filteredTemplates = search.trim()
              ? templates.filter(t => [t.name, t.category, t.subcategory ?? ''].some(s => s.toLowerCase().includes(search.toLowerCase())))
              : templates;
            const cats = new Map<string, Map<string, Template[]>>();
            for (const t of filteredTemplates) {
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
              const catOpen = collapsed.has(cat);
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
                    const subOpen = collapsed.has(subKey);
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
        </div>

        {/* Center: workspace */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 0, background: '#1a1a1a', display: 'flex', justifyContent: 'center', alignItems: 'flex-start' }}>

          {!selected && <div style={{ color: 'rgba(255,255,255,0.2)', fontSize: 15, margin: 'auto', paddingTop: 80 }}>Select a template to start editing</div>}

          {selected && (
              <div style={{ background: '#3a3a3a', padding: 24, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 8 }}>
                  <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>
                    Click · Shift+click · drag to box-select · ⌘A all · arrow keys · ⌘Z undo
                  </span>
                  <input ref={imageInputRef} type="file" accept="image/png,image/jpeg,image/webp" style={{ display: 'none' }} onChange={handleImageInsert} />
                  <button onClick={() => imageInputRef.current?.click()} style={{ fontSize: 11, padding: '3px 10px', borderRadius: 6, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)', cursor: 'pointer' }}>
                    + Image
                  </button>
                  <button onClick={() => setShowDots(v => !v)} style={{ marginLeft: 'auto', fontSize: 11, padding: '3px 10px', borderRadius: 6, background: showDots ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)', cursor: 'pointer' }}>
                    {showDots ? 'Hide dots' : 'Show dots'}
                  </button>
                  <button onClick={() => setShowGuides(v => !v)} style={{ fontSize: 11, padding: '3px 10px', borderRadius: 6, background: showGuides ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)', cursor: 'pointer' }}>
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

                  {/* Image overlays */}
                  {imageOverlays.map(img => {
                    const isSel = selectedImageId === img.id;
                    const left = (img.x - img.w / 2) * scale;
                    const top = (img.y - img.h / 2) * scale;
                    const w = img.w * scale;
                    const h = img.h * scale;
                    return (
                      <div key={img.id} style={{ position: 'absolute', left, top, width: w, height: h, cursor: 'grab', outline: isSel ? '2px solid rgba(99,200,255,0.8)' : 'none', zIndex: 10 }}
                        onMouseDown={e => handleImageMouseDown(e, img.id)}>
                        <img src={img.src} style={{ width: '100%', height: '100%', display: 'block', pointerEvents: 'none' }} draggable={false} alt="" />
                        {isSel && (
                          <div onMouseDown={e => handleImageResizeMouseDown(e, img.id)}
                            style={{ position: 'absolute', right: -5, bottom: -5, width: 12, height: 12, background: 'rgba(99,200,255,0.9)', borderRadius: 2, cursor: 'se-resize', zIndex: 11 }} />
                        )}
                      </div>
                    );
                  })}

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
                  {showDots && layers.map((layer, idx) => {
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
          )}
        </div>

        {/* Right panel */}
        <div ref={rightPanelRef} style={{ width: 230, borderLeft: border, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
          {selected && (
            <div style={{ padding: '12px 16px', paddingBottom: 12 + keyboardInset }}>

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
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
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
                          padding: '5px 10px', borderRadius: 6, cursor: 'pointer',
                          background: isSel ? 'rgba(255,255,255,0.07)' : isHov ? 'rgba(255,255,255,0.03)' : 'transparent',
                          border: `1px solid ${isSel ? (isMultiSel ? 'rgba(99,200,255,0.3)' : 'rgba(255,255,255,0.2)') : 'transparent'}`,
                          display: 'flex', alignItems: 'center', gap: 7,
                        }}
                      >
                        <div style={{ width: 7, height: 7, borderRadius: '50%', flexShrink: 0, background: layer.id ? '#f09b00' : 'rgba(255,255,255,0.35)' }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          {isRenaming && layer.id !== null ? (
                            <input
                              autoFocus type="text" defaultValue={layer.id}
                              onClick={e => e.stopPropagation()}
                              onBlur={e => { renameLayer(idx, e.target.value); setRenamingIdx(null); }}
                              onKeyDown={e => {
                                if (e.key === 'Enter') { renameLayer(idx, e.currentTarget.value); setRenamingIdx(null); }
                                if (e.key === 'Escape') setRenamingIdx(null);
                                e.stopPropagation();
                              }}
                              style={{ background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(99,200,255,0.5)', borderRadius: 4, color: '#63c8ff', fontSize: 12, fontWeight: 600, padding: '1px 5px', width: '100%', outline: 'none' }}
                            />
                          ) : (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                              <span style={{ fontSize: 12, fontWeight: 500, color: layer.id ? '#f09b00' : 'rgba(255,255,255,0.6)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0 }}>
                                {layer.id ?? `static-${idx}`}
                              </span>
                              {isSel && !isMultiSel && layer.id !== null && (
                                <button
                                  onClick={e => { e.stopPropagation(); setRenamingIdx(idx); }}
                                  title="Rename field id"
                                  style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.25)', cursor: 'pointer', padding: '0 2px', fontSize: 11, lineHeight: 1, flexShrink: 0 }}
                                >✎</button>
                              )}
                            </div>
                          )}
                        </div>
                        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', fontVariantNumeric: 'tabular-nums', textAlign: 'right', flexShrink: 0, lineHeight: 1.4 }}>
                          <div>{Math.round(layer.tx * 10) / 10}</div>
                          <div>{Math.round(layer.ty * 10) / 10}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Image overlay controls */}
                {selectedImageId && (() => {
                  const img = imageOverlays.find(i => i.id === selectedImageId);
                  if (!img) return null;
                  return (
                    <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                      <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', marginBottom: 10 }}>Image</p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', width: 14 }}>W</span>
                          <input type="number" step="1" min="1" value={Math.round(img.w)} onChange={e => setImageOverlays(prev => prev.map(i => i.id === selectedImageId ? { ...i, w: parseFloat(e.target.value) || i.w, h: (parseFloat(e.target.value) || i.w) * (i.h / i.w) } : i))}
                            style={{ width: 70, background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 6, color: '#fff', fontSize: 12, padding: '4px 8px', outline: 'none' }} />
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', width: 14 }}>H</span>
                          <input type="number" step="1" min="1" value={Math.round(img.h)} onChange={e => setImageOverlays(prev => prev.map(i => i.id === selectedImageId ? { ...i, h: parseFloat(e.target.value) || i.h } : i))}
                            style={{ width: 70, background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 6, color: '#fff', fontSize: 12, padding: '4px 8px', outline: 'none' }} />
                        </label>
                        <button onClick={() => { setImageOverlays(prev => prev.filter(i => i.id !== selectedImageId)); setSelectedImageId(null); }}
                          style={{ marginTop: 4, fontSize: 11, padding: '4px 10px', borderRadius: 6, background: 'rgba(255,80,80,0.15)', border: '1px solid rgba(255,80,80,0.3)', color: 'rgba(255,120,120,0.9)', cursor: 'pointer' }}>
                          Remove image
                        </button>
                      </div>
                    </div>
                  );
                })()}

              </div>
          )}
        </div>
      </div>
    </div>
  );
}
