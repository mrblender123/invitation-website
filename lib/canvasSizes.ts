export type CanvasSizeKey = 'portrait' | 'square' | 'a4' | 'landscape' | 'story';

export type CanvasSize = {
  key: CanvasSizeKey;
  label: string;
  description: string;
  width: number;
  height: number;
  icon: string;
};

export const CANVAS_SIZES: CanvasSize[] = [
  {
    key: 'portrait',
    label: 'Portrait',
    description: 'Classic invitation format',
    width: 450,
    height: 800,
    icon: '◻',
  },
  {
    key: 'square',
    label: 'Square',
    description: 'Instagram post · 1:1',
    width: 600,
    height: 600,
    icon: '⬜',
  },
  {
    key: 'a4',
    label: 'A4 / Letter',
    description: 'Print-ready format',
    width: 595,
    height: 842,
    icon: '📄',
  },
  {
    key: 'landscape',
    label: 'Landscape',
    description: 'Event banner · 16:9',
    width: 800,
    height: 450,
    icon: '▬',
  },
  {
    key: 'story',
    label: 'Story / Reel',
    description: 'Instagram & TikTok · 9:16',
    width: 540,
    height: 960,
    icon: '▯',
  },
];

export const DEFAULT_SIZE = CANVAS_SIZES[0];

export function getSizeByKey(key: string): CanvasSize {
  return CANVAS_SIZES.find(s => s.key === key) ?? DEFAULT_SIZE;
}

export function defaultPositions(w: number, h: number) {
  return {
    titleX: Math.round(w / 2),
    titleY: Math.round(h * 0.28),
    nameX: Math.round(w / 2),
    nameY: Math.round(h * 0.40),
    dateX: Math.round(w / 2),
    dateY: Math.round(h * 0.52),
  };
}
