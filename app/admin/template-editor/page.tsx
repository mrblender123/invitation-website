'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/app/components/AuthProvider';
import type { Template, WatermarkConfig } from '@/lib/templates';
import { measureAndTightenSvg } from '@/lib/watermark-utils';

const ADMIN_EMAIL = 'bycheshin@gmail.com';
const SNAP_PX = 6;
const MAX_HISTORY = 50;

// ─── types ────────────────────────────────────────────────────────────────────

type Layer = {
  index: number;
  id: string | null;
  originalId: string | null;
  label: string;
  placeholder: string;
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
    const placeholder = textEl.querySelector('tspan')?.textContent?.trim() ?? '';
    const label = placeholder.slice(0, 24) || `text-${idx}`;
    const fsSrc = textEl.getAttribute('font-size');
    const fwSrc = textEl.getAttribute('font-weight');
    const ffSrc = textEl.getAttribute('font-family');
    const fillSrc = textEl.getAttribute('fill');
    const anchorSrc = textEl.getAttribute('text-anchor') as 'start' | 'middle' | 'end' | null;
    layers.push({ index: idx, id, originalId: id, label, placeholder, tx: parseFloat(m[1]), ty: parseFloat(m[2]), restTransform: m[3], fontSize: fsSrc ? parseFloat(fsSrc) : null, fontWeight: fwSrc ? parseFloat(fwSrc) : null, fontFamily: ffSrc ?? null, fill: fillSrc ?? null, anchor: anchorSrc });
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
    // Placeholder text — update first tspan content
    const firstTspan = textEl.querySelector('tspan');
    if (firstTspan && layer.placeholder !== undefined) firstTspan.textContent = layer.placeholder;
    // Rename id or wrap bare text in <g id> if it was promoted from static
    if (layer.id) {
      const parent = textEl.parentElement;
      if (parent?.tagName.toLowerCase() === 'g' && parent.id) {
        // Already wrapped — just rename if changed
        if (layer.originalId && layer.id !== layer.originalId) parent.id = layer.id;
      } else {
        // Bare text promoted to editable — wrap in <g id>
        const g = doc.createElementNS('http://www.w3.org/2000/svg', 'g');
        g.setAttribute('id', layer.id);
        textEl.parentNode?.insertBefore(g, textEl);
        g.appendChild(textEl);
      }
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
    const firstTspan = textEl.querySelector('tspan');
    if (firstTspan && layer.placeholder !== undefined) firstTspan.textContent = layer.placeholder;
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

// ─── field manager types ──────────────────────────────────────────────────────

type FolderField = { id: string; required: boolean; placeholder: string };
type FolderData  = { folder: string; category: string; name: string; fields: FolderField[] };

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
  const [showDots, setShowDots] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [renamingIdx, setRenamingIdx] = useState<number | null>(null);
  const [showAddLayer, setShowAddLayer] = useState(false);
  const [newLayerId, setNewLayerId] = useState('');
  const [newLayerText, setNewLayerText] = useState('');
  const [dragLayerIdx, setDragLayerIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const [marquee, setMarquee] = useState<Marquee | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [imageOverlays, setImageOverlays] = useState<ImageOverlay[]>([]);
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
  const [imageDrag, setImageDrag] = useState<{ id: string; startMouseX: number; startMouseY: number; startX: number; startY: number } | null>(null);
  const [imageResize, setImageResize] = useState<{ id: string; startMouseX: number; startMouseY: number; startW: number; startH: number } | null>(null);
  const [keyboardInset, setKeyboardInset] = useState(0);
  const [windowWidth, setWindowWidth] = useState(420);
  const [mobilePanel, setMobilePanel] = useState<'list' | 'canvas' | 'layers'>('canvas');
  const [mobileZoom, setMobileZoom] = useState(1);
  const [nudgeStep, setNudgeStep] = useState(1);
  const [multiSelectMode, setMultiSelectMode] = useState(false); // mobile: taps act like shift+click
  const imageInputRef = useRef<HTMLInputElement>(null);

  // ── watermark state ───────────────────────────────────────────────────────────
  const [watermark, setWatermark] = useState<WatermarkConfig | null>(null);
  const [wmFile, setWmFile] = useState<string>('logo_side_01.png');
  const [wmSvgText, setWmSvgText] = useState<string>('');
  const [wmTightSvg, setWmTightSvg] = useState<string>('');
  const [wmAspect, setWmAspect] = useState<number>(420 / 55);
  const [wmDrag, setWmDrag] = useState<{ startMouseX: number; startMouseY: number; startX: number; startY: number } | null>(null);
  const [wmSaving, setWmSaving] = useState(false);
  const [wmMsg, setWmMsg] = useState('');
  const [allWatermarks, setAllWatermarks] = useState<Record<string, WatermarkConfig>>({});
  const wmDragRef = useRef(wmDrag);
  useEffect(() => { wmDragRef.current = wmDrag; }, [wmDrag]);

  // ── field manager state ───────────────────────────────────────────────────
  const [mainTab, setMainTab]           = useState<'editor' | 'fields'>('editor');
  const [fmData, setFmData]             = useState<FolderData[] | null>(null);
  const [fmFolder, setFmFolder]         = useState<FolderData | null>(null);
  const [fmFields, setFmFields]         = useState<FolderField[]>([]);
  const [fmDirty, setFmDirty]           = useState(false);
  const [fmSaving, setFmSaving]         = useState(false);
  const [fmStatus, setFmStatus]         = useState('');
  const [fmDragSrc, setFmDragSrc]       = useState<number | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const rightPanelRef = useRef<HTMLDivElement>(null);
  const colorInputRef = useRef<HTMLInputElement>(null);

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

  // Tracks whether any drag/marquee is active — used by touch forwarder to conditionally prevent scroll
  const anyDragActiveRef = useRef(false);

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

  // Track window width for responsive layout
  useEffect(() => {
    const update = () => setWindowWidth(window.innerWidth);
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
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

  // Load watermark file whenever the selected file changes
  useEffect(() => {
    if (wmFile.endsWith('.png')) {
      const img = new Image();
      img.onload = () => {
        if (img.naturalHeight > 0) setWmAspect(img.naturalWidth / img.naturalHeight);
        setWmTightSvg('');
        setWmSvgText('');
      };
      img.src = `/${wmFile}`;
      return;
    }
    fetch(`/${wmFile}`)
      .then(r => r.text())
      .then(async text => {
        setWmSvgText(text);
        const { tightSvg, aspect } = await measureAndTightenSvg(text);
        setWmTightSvg(tightSvg);
        setWmAspect(aspect);
      })
      .catch(() => {});
  }, [wmFile]);

  // Load SVG
  useEffect(() => {
    if (!selected?.textSvg) return;
    setSvgSource(null); setLayers([]); setSaveMsg(''); setSelection(new Set());
    setHistory([]); setRenamingIdx(null);
    setImageOverlays([]); setSelectedImageId(null);
    setWatermark(null); setWmMsg('');
    // Load saved watermark for this template
    fetch('/api/watermarks')
      .then(r => r.json())
      .then((map: Record<string, WatermarkConfig>) => {
        setAllWatermarks(map);
        if (map[selected.id]) {
          setWatermark(map[selected.id]);
          if (map[selected.id].file) setWmFile(map[selected.id].file!);
        }
      })
      .catch(() => {});
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

  const isMobile = windowWidth < 768;
  const cardDisplayWidth = isMobile ? Math.max(windowWidth - 24, 280) * mobileZoom : 420;
  const scale = selected ? cardDisplayWidth / selected.style.canvasWidth : 1;
  const cardDisplayHeight = selected ? selected.style.canvasHeight * scale : cardDisplayWidth * 1.4;
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

  // Forward touch events to mouse events so all drag handlers work on mobile.
  // Only prevents default scroll when a drag is actually in progress — otherwise
  // the layers list and template list would be un-scrollable on touch.
  useEffect(() => {
    const onTouchMove = (e: TouchEvent) => {
      if (!anyDragActiveRef.current) return; // let normal scroll through when idle
      if (e.cancelable) e.preventDefault();
      const t = e.touches[0];
      if (!t) return;
      window.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, cancelable: true, clientX: t.clientX, clientY: t.clientY }));
    };
    const onTouchEnd = (e: TouchEvent) => {
      anyDragActiveRef.current = false;
      const t = e.changedTouches[0];
      if (!t) return;
      window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, clientX: t.clientX, clientY: t.clientY }));
    };
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onTouchEnd);
    return () => { window.removeEventListener('touchmove', onTouchMove); window.removeEventListener('touchend', onTouchEnd); };
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

  // ── watermark drag ───────────────────────────────────────────────────────────

  useEffect(() => {
    if (!wmDrag) return;
    const onMove = (e: MouseEvent) => {
      const d = wmDragRef.current;
      if (!d) return;
      const dx = (e.clientX - d.startMouseX) / scale;
      const dy = (e.clientY - d.startMouseY) / scale;
      let newX = d.startX + dx;
      let newY = d.startY + dy;
      if (Math.abs(newX - guideX) < SNAP_PX) newX = guideX;
      if (Math.abs(newY - guideY) < SNAP_PX) newY = guideY;
      setWatermark(prev => prev ? { ...prev, x: newX, y: newY } : prev);
    };
    const onUp = () => setWmDrag(null);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [wmDrag, scale, guideX, guideY]);

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
      // I — open color picker
      if (e.key === 'i' || e.key === 'I') {
        e.preventDefault();
        colorInputRef.current?.click();
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

  // On-screen nudge (mobile) — same behavior as the arrow keys
  const nudgeSelection = useCallback((dx: number, dy: number) => {
    if (selection.size === 0) return;
    pushHistory();
    setLayers(prev => prev.map((l, i) => selection.has(i) ? { ...l, tx: l.tx + dx, ty: l.ty + dy } : l));
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

  // ── add / delete layer ────────────────────────────────────────────────────────

  const handleLayerReorder = useCallback((fromIdx: number, toIdx: number) => {
    if (fromIdx === toIdx || !svgSource) return;
    pushHistory();

    // Reorder layers array
    const newLayers = [...layers];
    const [moved] = newLayers.splice(fromIdx, 1);
    newLayers.splice(toIdx, 0, moved);

    // Reorder the actual SVG elements to match
    const doc = new DOMParser().parseFromString(svgSource, 'image/svg+xml');
    const textEls = Array.from(doc.querySelectorAll('text'));
    const rootEls = textEls.map(t => {
      const p = t.parentElement;
      return (p && p.tagName.toLowerCase() === 'g' && p.id) ? p : t;
    });
    // Remove duplicates (safety)
    const unique = rootEls.filter((el, i) => rootEls.indexOf(el) === i);
    const reordered = [...unique];
    const [movedEl] = reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, movedEl);
    unique.forEach(el => el.remove());
    reordered.forEach(el => doc.documentElement.appendChild(el));
    setSvgSource(new XMLSerializer().serializeToString(doc.documentElement));

    // Remap selection indices
    setSelection(prev => {
      const next = new Set<number>();
      prev.forEach(i => {
        if (i === fromIdx) { next.add(toIdx); return; }
        if (fromIdx < toIdx && i > fromIdx && i <= toIdx) { next.add(i - 1); return; }
        if (fromIdx > toIdx && i >= toIdx && i < fromIdx) { next.add(i + 1); return; }
        next.add(i);
      });
      return next;
    });

    setLayers(newLayers);
  }, [svgSource, layers, pushHistory]);

  const handleAddLayer = useCallback(() => {
    if (!svgSource) return;
    const id = newLayerId.trim() || `field_${Date.now()}`;
    const placeholder = newLayerText.trim() || 'New text';
    const cx = svgW / 2;
    const cy = svgH / 2;
    pushHistory();
    const el = `<g id="${id}"><text font-family="Heebo" font-size="24" font-weight="400" fill="#000000" text-anchor="middle" transform="translate(${cx} ${cy})"><tspan x="0">${placeholder}</tspan></text></g>`;
    const newSvg = svgSource.replace(/<\/svg>/, `${el}</svg>`);
    const newLayer: Layer = {
      index: layers.length, id, originalId: id, label: placeholder, placeholder,
      tx: cx, ty: cy, restTransform: '',
      fontSize: 24, fontWeight: 400, fontFamily: 'Heebo', fill: '#000000', anchor: 'middle',
    };
    setSvgSource(newSvg);
    setLayers(prev => { const next = [...prev, newLayer]; setSelection(new Set([next.length - 1])); return next; });
    setNewLayerId(''); setNewLayerText(''); setShowAddLayer(false);
  }, [svgSource, newLayerId, newLayerText, svgW, svgH, layers.length, pushHistory]);

  const handleDeleteLayer = useCallback((idx: number) => {
    if (!svgSource) return;
    pushHistory();
    const doc = new DOMParser().parseFromString(svgSource, 'image/svg+xml');
    const textEls = doc.querySelectorAll('text');
    const textEl = textEls[idx];
    if (textEl) {
      const parent = textEl.parentElement;
      if (parent?.tagName.toLowerCase() === 'g' && parent.id) { parent.remove(); } else { textEl.remove(); }
    }
    setSvgSource(new XMLSerializer().serializeToString(doc.documentElement));
    setLayers(prev => prev.filter((_, i) => i !== idx));
    setSelection(prev => {
      const next = new Set<number>();
      prev.forEach(i => { if (i !== idx) next.add(i > idx ? i - 1 : i); });
      return next;
    });
  }, [svgSource, pushHistory]);

  const handleDuplicateLayer = useCallback((idx: number) => {
    if (!svgSource) return;
    pushHistory();
    const src = layers[idx];
    const doc = new DOMParser().parseFromString(svgSource, 'image/svg+xml');
    const textEls = Array.from(doc.querySelectorAll('text'));
    const textEl = textEls[idx];
    if (!textEl) return;

    const rootEl = (() => {
      const p = textEl.parentElement;
      return (p && p.tagName.toLowerCase() === 'g' && p.id) ? p : textEl;
    })();

    const clone = rootEl.cloneNode(true) as Element;
    const baseId = (src.id ?? `layer_${idx}`).replace(/\*$/, '');
    const suffix = src.id?.endsWith('*') ? '*' : '';
    const newId = `${baseId}_copy${suffix}`;
    if (clone.tagName.toLowerCase() === 'g') {
      clone.setAttribute('id', newId);
    }
    const cloneText = clone.tagName.toLowerCase() === 'text' ? clone : clone.querySelector('text');
    if (cloneText) {
      const newTy = src.ty + 20;
      cloneText.setAttribute('transform', `translate(${src.tx} ${newTy})${src.restTransform}`);
    }
    rootEl.parentNode?.insertBefore(clone, rootEl.nextSibling);

    const newLayer: Layer = {
      ...src,
      index: idx + 1,
      id: newId,
      originalId: newId,
      ty: src.ty + 20,
    };
    setSvgSource(new XMLSerializer().serializeToString(doc.documentElement));
    setLayers(prev => {
      const next = [...prev];
      next.splice(idx + 1, 0, newLayer);
      return next.map((l, i) => ({ ...l, index: i }));
    });
    setSelection(new Set([idx + 1]));
  }, [svgSource, layers, pushHistory]);

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

  const handleSaveWatermark = async () => {
    if (!selected || !watermark || !accessToken) return;
    setWmSaving(true); setWmMsg('');
    const res = await fetch('/api/admin/watermark', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ templateId: selected.id, ...watermark, file: wmFile }),
    });
    const json = await res.json().catch(() => ({}));
    setWmSaving(false);
    setWmMsg(res.ok ? 'Saved ✓' : `Error: ${json.error ?? res.status}`);
    setTimeout(() => setWmMsg(''), 6000);
  };

  const handleRemoveWatermark = async () => {
    if (!selected || !accessToken) return;
    setWatermark(null);
    setWmSaving(true); setWmMsg('');
    const res = await fetch('/api/admin/watermark', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ templateId: selected.id }),
    });
    setWmSaving(false);
    setWmMsg(res.ok ? 'Removed ✓' : 'Error removing');
    setTimeout(() => setWmMsg(''), 3000);
  };

  const handleRevalidate = async () => {
    if (!accessToken) return;
    const res = await fetch('/api/admin/revalidate-templates', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    setSaveMsg(res.ok ? 'Cache cleared ✓' : 'Revalidate failed');
    setTimeout(() => setSaveMsg(''), 3000);
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

  // ── field manager: load overview ─────────────────────────────────────────
  useEffect(() => {
    if (mainTab !== 'fields' || fmData || !accessToken) return;
    fetch('/api/admin/field-overview', { headers: { Authorization: `Bearer ${accessToken}` } })
      .then(r => r.json()).then(setFmData);
  }, [mainTab, fmData, accessToken]);

  const fmSelectFolder = (row: FolderData) => {
    setFmFolder(row);
    setFmFields(row.fields.map(f => ({ ...f })));
    setFmDirty(false);
    setFmStatus('');
  };

  const fmToggle = (idx: number) => {
    setFmFields(prev => prev.map((f, i) => i === idx ? { ...f, required: !f.required } : f));
    setFmDirty(true); setFmStatus('Unsaved changes');
  };

  const fmSave = async () => {
    if (!fmFolder || !accessToken) return;
    setFmSaving(true);
    try {
    const res  = await fetch('/api/admin/update-folder-fields', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ folderPath: fmFolder.folder, fields: fmFields }),
    });
    if (!res.ok) { setFmSaving(false); setFmStatus(`✗ Server error ${res.status}`); return; }
    const data = await res.json();
    setFmSaving(false);
    if (data.ok) {
      setFmDirty(false);
      setFmStatus(data.count === 0 ? '✗ 0 files changed — field IDs may be stale, click Refresh' : `✓ Saved ${data.count} file${data.count === 1 ? '' : 's'}`);
      // update local fmData cache
      setFmData(prev => prev ? prev.map(d => d.folder === fmFolder.folder ? { ...d, fields: fmFields } : d) : prev);
    } else {
      setFmStatus(`✗ ${data.error}`);
    }
    } catch (e) { setFmSaving(false); setFmStatus(`✗ ${e instanceof Error ? e.message : 'Network error'}`); }
  };

  const fmToggleOverview = async (folderPath: string, fieldId: string, required: boolean) => {
    if (!accessToken) return;
    try {
    const res  = await fetch('/api/admin/update-folder-fields', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({
        folderPath,
        fields: (fmData?.find(d => d.folder === folderPath)?.fields ?? []).map(f =>
          f.id === fieldId ? { ...f, required } : f
        ),
      }),
    });
    if (!res.ok) { setFmStatus(`✗ Server error ${res.status}`); return; }
    const data = await res.json();
    if (data.ok) {
      setFmData(prev => prev ? prev.map(d => d.folder === folderPath
        ? { ...d, fields: d.fields.map(f => f.id === fieldId ? { ...f, required } : f) }
        : d
      ) : prev);
      setFmStatus(`✓ ${fieldId} → ${required ? 'required' : 'optional'} in ${folderPath.split('/').pop()}`);
    }
    } catch (e) { setFmStatus(`✗ ${e instanceof Error ? e.message : 'Network error'}`); }
  };

  if (loading || !user || user.email !== ADMIN_EMAIL) return null;

  const border = '1px solid rgba(255,255,255,0.08)';
  const selArray = Array.from(selection);
  const singleSel = selArray.length === 1 ? layers[selArray[0]] : null;
  // Representative layer for toolbar display values (first selected)
  const firstSel = selArray.length > 0 ? layers[selArray[0]] : null;
  const hasSelection = selection.size > 0;


  return (
    <div style={{ height: '100dvh', overflow: 'hidden', background: '#09090b', color: '#fff', display: 'flex', flexDirection: 'column' } as React.CSSProperties}>

      {/* Header */}
      <header style={{ position: 'sticky', top: 0, zIndex: 50, background: 'rgba(9,9,11,0.9)', backdropFilter: 'blur(12px)', borderBottom: border }}>
        <div style={{ maxWidth: 1400, margin: '0 auto', padding: isMobile ? '0 10px' : '0 24px', height: isMobile ? 48 : 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 6 : 12, minWidth: 0 }}>
            <button onClick={() => router.push('/admin')} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: isMobile ? 12 : 13, padding: 0, flexShrink: 0 }}>← Admin</button>
            {!isMobile && <span style={{ color: 'rgba(255,255,255,0.15)' }}>/</span>}
            {/* Tab buttons */}
            {(['editor', 'fields'] as const).map(tab => (
              <button key={tab} onClick={() => setMainTab(tab)} style={{
                fontSize: isMobile ? 12 : 13, fontWeight: 600, padding: isMobile ? '4px 8px' : '4px 12px', borderRadius: 6, border: 'none', cursor: 'pointer',
                background: mainTab === tab ? 'rgba(255,255,255,0.12)' : 'transparent',
                color: mainTab === tab ? '#fff' : 'rgba(255,255,255,0.35)',
                transition: 'all 0.15s', whiteSpace: 'nowrap',
              }}>
                {tab === 'editor' ? (isMobile ? 'Editor' : 'Template Editor') : (isMobile ? 'Fields' : 'Field Manager')}
              </button>
            ))}
            {!isMobile && mainTab === 'editor' && selected && <><span style={{ color: 'rgba(255,255,255,0.15)' }}>/</span><span style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selected.subcategory ?? selected.category} — {selected.name}</span></>}
          </div>
          {mainTab === 'fields' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {fmStatus && <span style={{ fontSize: 13, color: fmStatus.startsWith('✗') || fmStatus.includes('0 file') ? '#f87171' : '#4ade80' }}>{fmStatus}</span>}
              <button onClick={() => { setFmData(null); setFmFolder(null); setFmFields([]); setFmStatus(''); }} title="Reload field data from disk" style={{ padding: '7px 12px', borderRadius: 8, fontSize: 13, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.5)', cursor: 'pointer' }}>↺ Refresh</button>
              {fmFolder && (
                <button onClick={fmSave} disabled={fmSaving || !fmDirty} style={{ padding: '7px 20px', borderRadius: 8, fontSize: 13, fontWeight: 600, background: fmDirty ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.15)', color: fmDirty ? '#fff' : 'rgba(255,255,255,0.3)', cursor: fmDirty ? 'pointer' : 'not-allowed' }}>
                  {fmSaving ? 'Saving…' : 'Save to folder'}
                </button>
              )}
            </div>
          )}
          {mainTab === 'editor' && selected && (
            <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 6 : 12, flexShrink: 0 }}>
              {history.length > 0 && (
                <button
                  onClick={() => { const h = historyRef.current; if (!h.length) return; setLayers(h[h.length - 1]); setHistory(h.slice(0, -1)); }}
                  style={{ fontSize: 12, padding: '4px 8px', borderRadius: 6, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', whiteSpace: 'nowrap' }}
                  title="Undo (⌘Z)"
                >
                  ↩ {!isMobile && `Undo (${history.length})`}
                </button>
              )}
              {saveMsg && !isMobile && <span style={{ fontSize: 13, color: saveMsg.includes('Error') ? '#f87171' : '#4ade80' }}>{saveMsg}</span>}
              <button onClick={handleSave} disabled={saving || !svgSource} style={{ padding: isMobile ? '6px 12px' : '7px 20px', borderRadius: 8, fontSize: isMobile ? 12 : 13, fontWeight: 600, background: saving ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.15)', color: saving ? 'rgba(255,255,255,0.3)' : '#fff', cursor: saving ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap' }}>
                {saving ? 'Saving…' : 'Save'}
              </button>
              {!isMobile && <button onClick={handleRevalidate} style={{ padding: '7px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)', color: 'rgba(255,255,255,0.5)', cursor: 'pointer' }} title="Bust the /api/templates cache so changes appear immediately">
                ↺ Refresh cache
              </button>}
            </div>
          )}
        </div>
      </header>

      {/* ── Field Manager tab ──────────────────────────────────────────────── */}
      {mainTab === 'fields' && (
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          {/* Folder list */}
          <div style={{ width: 220, borderRight: border, overflowY: 'auto', flexShrink: 0 }}>
            <div style={{ padding: '10px 12px 6px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.08em', color: 'rgba(255,255,255,0.3)' }}>Folders</div>
            {!fmData && <div style={{ padding: 16, color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>Loading…</div>}
            {fmData && (() => {
              const cats: Record<string, FolderData[]> = {};
              for (const d of fmData) {
                if (!cats[d.category]) cats[d.category] = [];
                cats[d.category].push(d);
              }
              return Object.entries(cats).map(([cat, rows]) => (
                <div key={cat}>
                  <div style={{ padding: '8px 12px 4px', fontSize: 11, color: 'rgba(255,255,255,0.25)', fontWeight: 600 }}>{cat}</div>
                  {rows.map(row => (
                    <button key={row.folder} onClick={() => fmSelectFolder(row)}
                      style={{ width: '100%', textAlign: 'left', padding: '6px 16px', background: fmFolder?.folder === row.folder ? 'rgba(255,255,255,0.08)' : 'none', border: 'none', borderLeft: fmFolder?.folder === row.folder ? '2px solid rgba(255,255,255,0.35)' : '2px solid transparent', color: fmFolder?.folder === row.folder ? '#fff' : 'rgba(255,255,255,0.5)', fontSize: 13, cursor: 'pointer' }}>
                      {row.name}
                    </button>
                  ))}
                </div>
              ));
            })()}
          </div>

          {/* Main area */}
          <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
            {!fmFolder ? (
              /* Overview: all folders */
              <div>
                <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>Overview</h2>
                <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)', marginBottom: 24 }}>Click any badge to toggle REQ/OPT — saves immediately to all templates in that folder.</p>
                {!fmData && <div style={{ color: 'rgba(255,255,255,0.3)' }}>Loading…</div>}
                {fmData && (() => {
                  const cats: Record<string, FolderData[]> = {};
                  for (const d of fmData) {
                    if (!cats[d.category]) cats[d.category] = [];
                    cats[d.category].push(d);
                  }
                  return Object.entries(cats).map(([cat, rows]) => (
                    <div key={cat} style={{ marginBottom: 24 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.08em', color: 'rgba(255,255,255,0.3)', marginBottom: 10 }}>{cat}</div>
                      {rows.map(row => (
                        <div key={row.folder} style={{ background: 'rgba(255,255,255,0.03)', border, borderRadius: 10, padding: '10px 14px', marginBottom: 8, display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.6)', width: 110, flexShrink: 0, paddingTop: 2 }}>{row.name}</div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                            {row.fields.map(f => (
                              <button key={f.id} onClick={() => fmToggleOverview(row.folder, f.id, !f.required)}
                                title={`${f.required ? 'required' : 'optional'} — click to toggle`}
                                style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 99, border: 'none', cursor: 'pointer', transition: '0.12s', background: f.required ? 'rgba(74,222,128,0.15)' : 'rgba(255,255,255,0.06)', color: f.required ? '#4ade80' : 'rgba(255,255,255,0.4)', fontFamily: 'monospace' }}>
                                {f.id}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  ));
                })()}
              </div>
            ) : (
              /* Per-folder editor */
              <div style={{ maxWidth: 500 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                  <button onClick={() => setFmFolder(null)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: 13, padding: 0 }}>← Overview</button>
                  <h2 style={{ fontSize: 16, fontWeight: 600 }}>{fmFolder.name}</h2>
                </div>
                <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)', marginBottom: 16 }}>Drag to reorder · click badge to toggle REQ/OPT · applies to all templates in this folder.</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {fmFields.map((f, idx) => (
                    <div key={f.id}
                      draggable
                      onDragStart={() => setFmDragSrc(idx)}
                      onDragOver={e => e.preventDefault()}
                      onDrop={() => {
                        if (fmDragSrc === null || fmDragSrc === idx) return;
                        const next = [...fmFields];
                        const [moved] = next.splice(fmDragSrc, 1);
                        next.splice(idx, 0, moved);
                        setFmFields(next);
                        setFmDragSrc(null);
                        setFmDirty(true); setFmStatus('Unsaved changes');
                      }}
                      onDragEnd={() => setFmDragSrc(null)}
                      style={{ background: 'rgba(255,255,255,0.04)', border, borderRadius: 10, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10, cursor: 'grab', opacity: fmDragSrc === idx ? 0.4 : 1 }}>
                      <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: 12 }}>⠿</span>
                      <button onClick={() => fmToggle(idx)}
                        style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 99, border: 'none', cursor: 'pointer', flexShrink: 0, background: f.required ? 'rgba(74,222,128,0.15)' : 'rgba(255,255,255,0.06)', color: f.required ? '#4ade80' : 'rgba(255,255,255,0.4)' }}>
                        {f.required ? 'REQ' : 'OPT'}
                      </button>
                      <span style={{ fontSize: 13, fontWeight: 600, fontFamily: 'monospace', flex: 1 }}>{f.id}</span>
                      <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.25)', direction: 'rtl', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.placeholder}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Contextual toolbar (Photoshop-style options bar) ────────────────── */}
      {mainTab === 'editor' && <>
      <div style={{
        borderBottom: border, background: 'rgba(9,9,11,0.97)', flexShrink: 0,
        height: 44, display: 'flex', alignItems: 'center', gap: 0, paddingLeft: 8, paddingRight: 8, overflowX: 'auto',
        ...(isMobile ? { zoom: 1.2, WebkitOverflowScrolling: 'touch' as const } : {}),
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
                ref={colorInputRef}
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
        <div style={{ width: isMobile ? '100%' : 240, borderRight: isMobile ? 'none' : border, overflowY: 'auto', display: isMobile && mobilePanel !== 'list' ? 'none' : 'flex', flexDirection: 'column' }}>
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
            const numSort = (a: Template, b: Template) => {
              const num = (s: string) => { const m = s.match(/(\d+)/); return m ? parseInt(m[1]) : 0; };
              return num(a.name) - num(b.name);
            };
            const cats = new Map<string, Map<string, Template[]>>();
            for (const t of filteredTemplates) {
              if (!cats.has(t.category)) cats.set(t.category, new Map());
              const sub = t.subcategory ?? '';
              const catMap = cats.get(t.category)!;
              if (!catMap.has(sub)) catMap.set(sub, []);
              catMap.get(sub)!.push(t);
            }
            // Sort each group numerically
            for (const subMap of cats.values())
              for (const items of subMap.values())
                items.sort(numSort);
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
                                onClick={() => { setSelected(t); if (isMobile) setMobilePanel('canvas'); }}
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
                              onClick={() => { setSelected(t); if (isMobile) setMobilePanel('canvas'); }}
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
        <div style={{ flex: 1, overflow: 'auto', padding: 0, background: '#1a1a1a', display: isMobile && mobilePanel !== 'canvas' ? 'none' : 'flex', justifyContent: isMobile && mobileZoom > 1 ? 'flex-start' : 'center', alignItems: 'flex-start' }}>

          {!selected && <div style={{ color: 'rgba(255,255,255,0.2)', fontSize: 15, margin: 'auto', paddingTop: 80 }}>Select a template to start editing</div>}

          {selected && (
              <div style={{ background: '#3a3a3a', padding: isMobile ? 8 : 24, display: 'flex', flexDirection: 'column', alignItems: 'center', width: 'max-content', minWidth: '100%', boxSizing: 'border-box' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
                  {!isMobile && <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>
                    Click · Shift+click · drag to box-select · ⌘A all · arrow keys · ⌘Z undo
                  </span>}
                  <input ref={imageInputRef} type="file" accept="image/png,image/jpeg,image/webp" style={{ display: 'none' }} onChange={handleImageInsert} />
                  {isMobile && (
                    <button onClick={() => setMobileZoom(z => z >= 2 ? 1 : z + 0.5)} style={{ fontSize: 12, padding: '5px 12px', borderRadius: 6, background: mobileZoom > 1 ? 'rgba(99,200,255,0.15)' : 'rgba(255,255,255,0.04)', border: `1px solid ${mobileZoom > 1 ? 'rgba(99,200,255,0.4)' : 'rgba(255,255,255,0.1)'}`, color: mobileZoom > 1 ? 'rgba(99,200,255,0.9)' : 'rgba(255,255,255,0.5)', cursor: 'pointer', fontWeight: 600 }}>
                      🔍 {mobileZoom}×
                    </button>
                  )}
                  {isMobile && (
                    <button onClick={() => setMultiSelectMode(v => !v)} style={{ fontSize: 12, padding: '5px 12px', borderRadius: 6, background: multiSelectMode ? 'rgba(99,200,255,0.18)' : 'rgba(255,255,255,0.04)', border: `1px solid ${multiSelectMode ? 'rgba(99,200,255,0.6)' : 'rgba(255,255,255,0.1)'}`, color: multiSelectMode ? 'rgba(99,200,255,0.9)' : 'rgba(255,255,255,0.5)', cursor: 'pointer', fontWeight: 600 }}>
                      {multiSelectMode ? '✓ Multi' : 'Multi'}
                    </button>
                  )}
                  <button onClick={() => imageInputRef.current?.click()} style={{ fontSize: isMobile ? 12 : 11, padding: isMobile ? '5px 12px' : '3px 10px', borderRadius: 6, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)', cursor: 'pointer' }}>
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
                  onTouchStart={e => { e.preventDefault(); anyDragActiveRef.current = true; const t = e.touches[0]; handleCanvasMouseDown({ clientX: t.clientX, clientY: t.clientY, shiftKey: false, metaKey: false, button: 0, preventDefault: () => {}, stopPropagation: () => {} } as unknown as React.MouseEvent); }}
                  style={{ position: 'relative', width: cardDisplayWidth, height: cardDisplayHeight, borderRadius: 8, overflow: 'hidden', userSelect: 'none', cursor: dragging ? 'grabbing' : guideDrag ? (guideDrag.axis === 'x' ? 'ew-resize' : 'ns-resize') : marquee ? 'crosshair' : 'default' }}
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

                  {/* Watermark overlay */}
                  {watermark && (wmFile.endsWith('.png') || wmTightSvg) && (() => {
                    const isPng = wmFile.endsWith('.png');
                    const wh = watermark.w / wmAspect;
                    const left = (watermark.x - watermark.w / 2) * scale;
                    const top  = (watermark.y - wh / 2) * scale;
                    const w    = watermark.w * scale;
                    const h    = wh * scale;
                    const imgSrc = isPng
                      ? `/${wmFile}`
                      : `data:image/svg+xml;charset=utf-8,${encodeURIComponent(wmTightSvg.replace(/fill="(?!none)[^"]*"/g, `fill="${watermark.color}"`))}`;
                    return (
                      <div
                        onMouseDown={e => {
                          e.stopPropagation();
                          setWmDrag({ startMouseX: e.clientX, startMouseY: e.clientY, startX: watermark.x, startY: watermark.y });
                        }}
                        style={{
                          position: 'absolute', left, top, width: w, height: h,
                          cursor: wmDrag ? 'grabbing' : 'grab',
                          outline: '1px dashed rgba(255,200,100,0.6)',
                          zIndex: 12, opacity: watermark.opacity,
                          transform: `rotate(${watermark.rotation ?? 0}deg)`,
                          transformOrigin: 'center center',
                        }}
                      >
                        <img src={imgSrc} style={{ width: '100%', height: '100%', display: 'block', pointerEvents: 'none' }} draggable={false} alt="watermark" />
                      </div>
                    );
                  })()}

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

                  {/* Layer handles — always rendered for selection; visually hidden when showDots is off */}
                  {layers.map((layer, idx) => {
                    const isActive = dragging?.handleIdx === idx;
                    const isSel = selection.has(idx);
                    const isHov = hoveredIdx === idx;
                    const isField = layer.id !== null;
                    const visible = showDots || isSel || isHov;
                    return (
                      <div
                        key={idx}
                        onMouseDown={e => { e.stopPropagation(); handleMouseDown(e, idx); }}
                        onTouchStart={e => { e.stopPropagation(); e.preventDefault(); anyDragActiveRef.current = true; const t = e.touches[0]; handleMouseDown({ clientX: t.clientX, clientY: t.clientY, shiftKey: multiSelectMode, stopPropagation: () => {}, preventDefault: () => {} } as unknown as React.MouseEvent, idx); }}
                        onClick={e => e.stopPropagation()}
                        onMouseEnter={() => setHoveredIdx(idx)}
                        onMouseLeave={() => setHoveredIdx(null)}
                        style={{
                          position: 'absolute',
                          left: layer.tx * scale, top: layer.ty * scale,
                          transform: 'translate(-50%, -50%)',
                          width: isActive || isHov || isSel ? (isMobile ? 26 : 20) : (isMobile ? 18 : 14),
                          height: isActive || isHov || isSel ? (isMobile ? 26 : 20) : (isMobile ? 18 : 14),
                          borderRadius: '50%',
                          background: visible ? (isField ? '#f09b00' : 'rgba(255,255,255,0.7)') : 'transparent',
                          border: visible ? `2px solid ${isSel ? '#fff' : 'rgba(0,0,0,0.5)'}` : '2px solid transparent',
                          cursor: isActive ? 'grabbing' : 'grab',
                          zIndex: 20,
                          boxShadow: visible && isSel
                            ? (selection.size > 1 ? '0 0 0 3px rgba(99,200,255,0.6)' : '0 0 0 3px rgba(255,255,255,0.5)')
                            : undefined,
                          outline: visible && isSel ? `2px solid ${selection.size > 1 ? 'rgba(99,200,255,0.4)' : 'rgba(255,255,255,0.4)'}` : undefined,
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
        <div ref={rightPanelRef} style={{ width: isMobile ? '100%' : 230, borderLeft: isMobile ? 'none' : border, overflowY: 'auto', display: isMobile && mobilePanel !== 'layers' ? 'none' : 'flex', flexDirection: 'column' }}>
          {selected && (
            <div style={{ padding: '12px 16px', paddingBottom: 12 + keyboardInset }}>

                {/* Layer list */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                  <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', margin: 0, flex: 1 }}>Layers</p>
                  {isMobile && (
                    <button
                      onClick={() => setMultiSelectMode(v => !v)}
                      title="Toggle multi-select mode"
                      style={{ fontSize: 10, padding: '2px 8px', borderRadius: 4, background: multiSelectMode ? 'rgba(99,200,255,0.18)' : 'rgba(255,255,255,0.06)', border: `1px solid ${multiSelectMode ? 'rgba(99,200,255,0.6)' : 'rgba(255,255,255,0.1)'}`, color: multiSelectMode ? 'rgba(99,200,255,0.9)' : 'rgba(255,255,255,0.5)', cursor: 'pointer', whiteSpace: 'nowrap', fontWeight: multiSelectMode ? 700 : 400 }}
                    >{multiSelectMode ? '✓ Multi' : 'Multi'}</button>
                  )}
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
                  <button
                    onClick={() => { setShowAddLayer(v => !v); setNewLayerId(''); setNewLayerText(''); }}
                    title="Add new text layer"
                    style={{ fontSize: 10, padding: '2px 8px', borderRadius: 4, background: 'rgba(74,222,128,0.12)', border: '1px solid rgba(74,222,128,0.3)', color: '#4ade80', cursor: 'pointer', whiteSpace: 'nowrap', fontWeight: 600 }}
                  >+ Layer</button>
                </div>

                {/* Add layer form */}
                {showAddLayer && (
                  <div style={{ background: 'rgba(74,222,128,0.05)', border: '1px solid rgba(74,222,128,0.2)', borderRadius: 8, padding: '10px', marginBottom: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <input
                      autoFocus
                      placeholder="Field ID (e.g. host_name)"
                      value={newLayerId}
                      onChange={e => setNewLayerId(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleAddLayer(); if (e.key === 'Escape') setShowAddLayer(false); }}
                      style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 5, color: '#fff', fontSize: 12, padding: '5px 8px', outline: 'none', width: '100%', boxSizing: 'border-box' }}
                    />
                    <input
                      placeholder="Placeholder text"
                      value={newLayerText}
                      onChange={e => setNewLayerText(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleAddLayer(); if (e.key === 'Escape') setShowAddLayer(false); }}
                      style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 5, color: '#fff', fontSize: 12, padding: '5px 8px', outline: 'none', width: '100%', boxSizing: 'border-box' }}
                    />
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={handleAddLayer} style={{ flex: 1, padding: '5px 0', borderRadius: 5, border: 'none', background: '#4ade80', color: '#000', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Add</button>
                      <button onClick={() => setShowAddLayer(false)} style={{ padding: '5px 10px', borderRadius: 5, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: 'rgba(255,255,255,0.4)', fontSize: 12, cursor: 'pointer' }}>✕</button>
                    </div>
                  </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {layers.map((layer, idx) => {
                    const isSel = selection.has(idx);
                    const isHov = hoveredIdx === idx && !isSel;
                    const isMultiSel = isSel && selection.size > 1;
                    const isRenaming = renamingIdx === idx;
                    const isDragOver = dragOverIdx === idx && dragLayerIdx !== idx;
                    const isDragging = dragLayerIdx === idx;
                    return (
                      <div
                        key={idx}
                        draggable={!isMobile}
                        onDragStart={e => { e.stopPropagation(); setDragLayerIdx(idx); e.dataTransfer.effectAllowed = 'move'; }}
                        onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDragOverIdx(idx); }}
                        onDragLeave={() => setDragOverIdx(null)}
                        onDrop={e => { e.preventDefault(); if (dragLayerIdx !== null) handleLayerReorder(dragLayerIdx, idx); setDragLayerIdx(null); setDragOverIdx(null); }}
                        onDragEnd={() => { setDragLayerIdx(null); setDragOverIdx(null); }}
                        onClick={e => { e.stopPropagation(); toggleSelect(idx, e.shiftKey || multiSelectMode); }}
                        onMouseEnter={() => setHoveredIdx(idx)}
                        onMouseLeave={() => setHoveredIdx(null)}
                        style={{
                          padding: isMobile ? '10px 10px' : '5px 10px', borderRadius: 6, cursor: 'grab',
                          opacity: isDragging ? 0.4 : 1,
                          background: isDragOver ? 'rgba(99,200,255,0.1)' : isSel ? 'rgba(255,255,255,0.07)' : isHov ? 'rgba(255,255,255,0.03)' : 'transparent',
                          border: `1px solid ${isDragOver ? 'rgba(99,200,255,0.5)' : isSel ? (isMultiSel ? 'rgba(99,200,255,0.3)' : 'rgba(255,255,255,0.2)') : 'transparent'}`,
                          display: 'flex', alignItems: 'center', gap: 7,
                          transition: 'border-color 0.1s, background 0.1s',
                        }}
                      >
                        {/* Drag handle */}
                        <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: 11, cursor: 'grab', flexShrink: 0, lineHeight: 1, userSelect: 'none' }}>⠿</span>
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
                              {/* Required / Optional toggle — all layers; clicking static promotes it to editable */}
                              {(() => {
                                const currentId = layer.id ?? '';
                                const isRequired = currentId.endsWith('*');
                                const isStatic = layer.id === null;
                                return (
                                  <button
                                    onClick={e => {
                                      e.stopPropagation();
                                      if (isStatic) {
                                        // Promote static text to editable field
                                        renameLayer(idx, `line_${idx}*`);
                                      } else {
                                        const baseId = currentId.replace(/\*$/, '');
                                        renameLayer(idx, isRequired ? baseId : baseId + '*');
                                      }
                                    }}
                                    title={isStatic ? 'Static text — click to make an editable field' : isRequired ? 'Required (always shown) — click to make optional' : 'Optional (hidden behind "Show all fields") — click to make required'}
                                    style={{
                                      background: isStatic ? 'rgba(255,255,255,0.03)' : isRequired ? 'rgba(74,222,128,0.15)' : 'rgba(255,255,255,0.06)',
                                      border: `1px solid ${isStatic ? 'rgba(255,255,255,0.08)' : isRequired ? 'rgba(74,222,128,0.4)' : 'rgba(255,255,255,0.12)'}`,
                                      borderRadius: 4,
                                      color: isStatic ? 'rgba(255,255,255,0.15)' : isRequired ? '#4ade80' : 'rgba(255,255,255,0.3)',
                                      cursor: 'pointer', padding: '1px 5px', fontSize: 9, lineHeight: 1.4,
                                      flexShrink: 0, fontWeight: 600, whiteSpace: 'nowrap',
                                    }}
                                  >
                                    {isStatic ? 'STA' : isRequired ? 'REQ' : 'OPT'}
                                  </button>
                                );
                              })()}
                              {isSel && !isMultiSel && layer.id !== null && (
                                <button
                                  onClick={e => { e.stopPropagation(); setRenamingIdx(idx); }}
                                  title="Rename field id"
                                  style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.25)', cursor: 'pointer', padding: '0 2px', fontSize: 11, lineHeight: 1, flexShrink: 0 }}
                                >✎</button>
                              )}
                              {isSel && !isMultiSel && (
                                <button
                                  onClick={e => { e.stopPropagation(); handleDuplicateLayer(idx); }}
                                  title="Duplicate layer"
                                  style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.35)', cursor: 'pointer', padding: '0 2px', fontSize: 12, lineHeight: 1, flexShrink: 0 }}
                                >⧉</button>
                              )}
                              {isSel && !isMultiSel && (
                                <button
                                  onClick={e => { e.stopPropagation(); if (confirm(`Delete layer "${layer.id ?? layer.label}"?`)) handleDeleteLayer(idx); }}
                                  title="Delete layer"
                                  style={{ background: 'none', border: 'none', color: 'rgba(239,68,68,0.5)', cursor: 'pointer', padding: '0 2px', fontSize: 12, lineHeight: 1, flexShrink: 0 }}
                                >🗑</button>
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

                {/* Placeholder text editor — shown when a single editable layer is selected */}
                {singleSel && singleSel.id !== null && (
                  <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                    <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', margin: '0 0 8px' }}>Placeholder text</p>
                    <input
                      type="text"
                      value={singleSel.placeholder}
                      dir="auto"
                      onChange={e => {
                        const val = e.target.value;
                        setLayers(prev => prev.map((l, i) =>
                          i === selArray[0] ? { ...l, placeholder: val, label: val.slice(0, 24) || l.label } : l
                        ));
                      }}
                      style={{
                        width: '100%', boxSizing: 'border-box',
                        background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.15)',
                        borderRadius: 6, color: '#fff', fontSize: 13,
                        padding: '6px 10px', outline: 'none', fontFamily: 'inherit',
                      }}
                    />
                    <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)', margin: '5px 0 0' }}>
                      This is the default text shown in the invitation editor.
                    </p>
                  </div>
                )}

                {/* Watermark section */}
                <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                    <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: 'rgba(255,255,255,0.3)', margin: 0, flex: 1 }}>Watermark</p>
                    {wmMsg && <span style={{ fontSize: 11, color: wmMsg.includes('Error') ? '#f87171' : '#4ade80' }}>{wmMsg}</span>}
                  </div>

                  {!watermark ? (
                    <button
                      onClick={() => setWatermark({ x: svgW / 2, y: svgH - 40, w: Math.round(svgW * 0.35), color: '#bfa67c', opacity: 0.8 })}
                      style={{ fontSize: 12, padding: '6px 12px', borderRadius: 7, background: 'rgba(191,166,124,0.12)', border: '1px solid rgba(191,166,124,0.3)', color: '#bfa67c', cursor: 'pointer', width: '100%' }}
                    >
                      + Add Watermark
                    </button>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 8 }}>
                      {/* Watermark file selector */}
                      <div style={{ display: 'flex', gap: 4 }}>
                        {[
                          { file: 'companyname.svg',  label: 'Logo' },
                          { file: '111.svg',          label: 'Text' },
                          { file: 'logo_side_01.png', label: 'Side' },
                        ].map(({ file, label }) => (
                          <button key={file} onClick={() => setWmFile(file)}
                            style={{ flex: 1, fontSize: 11, padding: '4px 0', borderRadius: 5, cursor: 'pointer',
                              background: wmFile === file ? 'rgba(191,166,124,0.25)' : 'rgba(255,255,255,0.05)',
                              border: wmFile === file ? '1px solid rgba(191,166,124,0.6)' : '1px solid rgba(255,255,255,0.12)',
                              color: wmFile === file ? '#bfa67c' : 'rgba(255,255,255,0.45)' }}>
                            {label}
                          </button>
                        ))}
                      </div>

                      {/* Color — hidden for PNG watermarks (can't recolor a raster image) */}
                      {!wmFile.endsWith('.png') && (
                      <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', width: 50 }}>Color</span>
                        <input type="color" value={watermark.color} onChange={e => setWatermark(w => w ? { ...w, color: e.target.value } : w)}
                          style={{ width: 26, height: 24, padding: '1px', background: 'none', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 4, cursor: 'pointer' }} />
                        <input type="text" value={watermark.color} onChange={e => setWatermark(w => w ? { ...w, color: e.target.value } : w)}
                          style={{ flex: 1, background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 5, color: '#fff', fontSize: 11, padding: '3px 6px', outline: 'none', fontFamily: 'monospace' }} />
                      </label>
                      )}

                      {/* Opacity */}
                      <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', width: 50 }}>Opacity</span>
                        <input type="range" min="0.05" max="1" step="0.05" value={watermark.opacity}
                          onChange={e => setWatermark(w => w ? { ...w, opacity: parseFloat(e.target.value) } : w)}
                          style={{ flex: 1, accentColor: '#bfa67c' }} />
                        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', width: 28, textAlign: 'right' as const }}>{Math.round(watermark.opacity * 100)}%</span>
                      </label>

                      {/* Size */}
                      <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', width: 50 }}>Size</span>
                        <input type="range" min="20" max={svgW} step="1" value={watermark.w}
                          onChange={e => setWatermark(w => w ? { ...w, w: parseFloat(e.target.value) } : w)}
                          style={{ flex: 1, accentColor: '#bfa67c' }} />
                        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', width: 28, textAlign: 'right' as const }}>{Math.round(watermark.w)}</span>
                      </label>

                      {/* Rotation */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', width: 50 }}>Rotate</span>
                        {[
                          { label: '↺ 90°', delta: -90 },
                          { label: '↻ 90°', delta: 90 },
                          { label: '⇆ Flip', delta: 180 },
                        ].map(({ label, delta }) => (
                          <button key={label}
                            onClick={() => setWatermark(w => w ? { ...w, rotation: ((w.rotation ?? 0) + delta + 360) % 360 } : w)}
                            style={{ flex: 1, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 5, color: '#fff', fontSize: 11, padding: '4px 0', cursor: 'pointer' }}>
                            {label}
                          </button>
                        ))}
                        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', width: 30, textAlign: 'right' as const }}>{Math.round(watermark.rotation ?? 0)}°</span>
                      </div>


                      {/* Default Style button */}
                      {(() => {
                        const b01 = allWatermarks["It's a boy-Bris-B-01"];
                        if (!b01) return null;
                        return (
                          <button
                            onClick={() => setWatermark(w => w ? { ...w, ...b01, color: '#d0bf98' } : { ...b01, color: '#d0bf98' })}
                            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.05)', cursor: 'pointer', width: '100%' }}>
                            <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#d0bf98', flexShrink: 0 }} />
                            <span style={{ fontSize: 11, color: '#808080' }}>Default Style</span>
                          </button>
                        );
                      })()}

                      {/* Buttons */}
                      <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                        <button onClick={handleSaveWatermark} disabled={wmSaving}
                          style={{ flex: 1, padding: '6px 0', borderRadius: 6, border: 'none', background: '#bfa67c', color: '#000', fontSize: 12, fontWeight: 700, cursor: wmSaving ? 'not-allowed' : 'pointer', opacity: wmSaving ? 0.5 : 1 }}>
                          {wmSaving ? 'Saving…' : 'Save Watermark'}
                        </button>
                        <button onClick={handleRemoveWatermark}
                          style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid rgba(255,80,80,0.3)', background: 'rgba(255,80,80,0.12)', color: 'rgba(255,120,120,0.9)', fontSize: 12, cursor: 'pointer' }}>
                          Remove
                        </button>
                      </div>
                    </div>
                  )}
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

      {/* Mobile nudge bar — fine positioning without arrow keys */}
      {isMobile && mobilePanel === 'canvas' && selected && hasSelection && (() => {
        const nBtn: React.CSSProperties = {
          width: 42, height: 38, borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)',
          background: 'rgba(255,255,255,0.08)', color: '#fff', fontSize: 16, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, padding: 0,
        };
        return (
          <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', borderTop: border, background: 'rgba(9,9,11,0.97)', overflowX: 'auto' }}>
            <button style={nBtn} onClick={() => nudgeSelection(-nudgeStep, 0)}>←</button>
            <button style={nBtn} onClick={() => nudgeSelection(nudgeStep, 0)}>→</button>
            <button style={nBtn} onClick={() => nudgeSelection(0, -nudgeStep)}>↑</button>
            <button style={nBtn} onClick={() => nudgeSelection(0, nudgeStep)}>↓</button>
            <button
              onClick={() => setNudgeStep(s => s === 1 ? 10 : s === 10 ? 0.1 : 1)}
              style={{ ...nBtn, width: 52, fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.7)' }}
              title="Nudge step size"
            >{nudgeStep}px</button>
            <div style={{ width: 1, height: 24, background: 'rgba(255,255,255,0.12)', flexShrink: 0 }} />
            <button style={{ ...nBtn, width: 48, fontSize: 12, fontWeight: 600, color: 'rgba(99,200,255,0.9)', background: 'rgba(99,200,255,0.08)', border: '1px solid rgba(99,200,255,0.25)' }} onClick={() => align('cx')}>⊕ X</button>
            <button style={{ ...nBtn, width: 48, fontSize: 12, fontWeight: 600, color: 'rgba(99,200,255,0.9)', background: 'rgba(99,200,255,0.08)', border: '1px solid rgba(99,200,255,0.25)' }} onClick={() => align('cy')}>⊕ Y</button>
            <button
              style={{ ...nBtn, width: 44, opacity: history.length ? 1 : 0.35 }}
              onClick={() => { const h = historyRef.current; if (!h.length) return; setLayers(h[h.length - 1]); setHistory(h.slice(0, -1)); }}
            >↩</button>
            {firstSel && (
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', marginLeft: 'auto', paddingLeft: 6 }}>
                {Math.round(firstSel.tx * 10) / 10}, {Math.round(firstSel.ty * 10) / 10}
              </span>
            )}
          </div>
        );
      })()}

      {/* Mobile bottom tab bar */}
      {isMobile && (
        <div style={{ flexShrink: 0, display: 'flex', borderTop: border, background: 'rgba(9,9,11,0.97)', paddingBottom: keyboardInset > 0 ? 0 : 'env(safe-area-inset-bottom, 0px)' }}>
          {([
            { key: 'list',   label: 'Templates', icon: '📁' },
            { key: 'canvas', label: 'Editor',    icon: '🖼' },
            { key: 'layers', label: 'Layers',    icon: '⚙︎' },
          ] as const).map(({ key, label, icon }) => (
            <button
              key={key}
              onClick={() => setMobilePanel(key)}
              style={{
                flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                gap: 3, padding: '8px 0', border: 'none', cursor: 'pointer',
                background: mobilePanel === key ? 'rgba(255,255,255,0.08)' : 'transparent',
                color: mobilePanel === key ? '#fff' : 'rgba(255,255,255,0.4)',
                borderTop: mobilePanel === key ? '2px solid rgba(255,255,255,0.5)' : '2px solid transparent',
                fontSize: 10, fontWeight: 600, letterSpacing: '0.05em',
              }}
            >
              <span style={{ fontSize: 18, lineHeight: 1 }}>{icon}</span>
              {label}
            </button>
          ))}
        </div>
      )}
      </>}
    </div>
  );
}
