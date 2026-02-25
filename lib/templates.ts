export type TemplateStyle = {
  canvasWidth: number;
  canvasHeight: number;
  // Legacy studio-based fields (optional)
  overlayOpacity?: number;
  glowIntensity?: number;
  vignetteIntensity?: number;
  titleX?: number; titleY?: number;
  nameX?: number;  nameY?: number;
  dateX?: number;  dateY?: number;
  titleSize?: number; nameSize?: number; dateSize?: number;
  titleColor?: string; nameColor?: string; dateColor?: string;
  titleFont?: string;  nameFont?: string;  dateFont?: string;
};

export type SvgField = {
  id: string;          // matches <g id="..."> in the SVG overlay file
  label: string;       // shown in the editor UI
  placeholder: string; // default text hint
  rtl?: boolean;       // true for Hebrew / Arabic text
};

export type Template = {
  id: string;
  name: string;
  category: string;
  thumbnailSrc: string;
  textSvg?: string;    // path to SVG text overlay in /public/templates/{category}/
  fields?: SvgField[]; // auto-discovered from SVG <g id> elements
  style: TemplateStyle;
};
