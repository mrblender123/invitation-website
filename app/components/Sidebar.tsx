'use client';

import { useState } from 'react';

export type Confinements = {
  preset: string;
};

export const AI_PRESETS = [
  { label: 'Classic Elegant', description: 'Traditional Hebrew wedding style' },
  { label: 'Modern Minimalist', description: 'Clean, contemporary lines' },
  { label: 'Floral & Romantic', description: 'Soft blooms, pastel garden' },
  { label: 'Jerusalem Stone', description: 'Heritage & stone-inspired' },
  { label: 'Luxury Gold & Ivory', description: 'Opulent, premium stationery' },
];

type SidebarProps = {
  data: { eventTitle: string; hostName: string; dateTime: string };
  confinements: Confinements;
  canvasWidth: number;
  canvasHeight: number;
  overlayOpacity: number;
  glowIntensity: number;
  vignetteIntensity: number;
  onVignetteIntensityChange: (value: number) => void;
  titleSize: number;
  nameSize: number;
  dateSize: number;
  titleX: number;
  titleY: number;
  nameX: number;
  nameY: number;
  dateX: number;
  dateY: number;
  titleColor: string;
  nameColor: string;
  dateColor: string;
  titleFont: string;
  nameFont: string;
  dateFont: string;
  isLoading: boolean;
  onUpdate: (field: string, value: string) => void;
  onConfinementUpdate: (field: keyof Confinements, value: string) => void;
  onOverlayOpacityChange: (value: number) => void;
  onGlowIntensityChange: (value: number) => void;
  onTitleSizeChange: (value: number) => void;
  onNameSizeChange: (value: number) => void;
  onDateSizeChange: (value: number) => void;
  onTitleXChange: (value: number) => void;
  onTitleYChange: (value: number) => void;
  onNameXChange: (value: number) => void;
  onNameYChange: (value: number) => void;
  onDateXChange: (value: number) => void;
  onDateYChange: (value: number) => void;
  onTitleColorChange: (value: string) => void;
  onNameColorChange: (value: string) => void;
  onDateColorChange: (value: string) => void;
  onTitleFontChange: (value: string) => void;
  onNameFontChange: (value: string) => void;
  onDateFontChange: (value: string) => void;
  onGenerate: () => void;
};

const FONTS = [
  { label: 'Playfair Display', value: '"Playfair Display", serif' },
  { label: 'Lora', value: 'Lora, serif' },
  { label: 'Georgia', value: 'Georgia, serif' },
  { label: 'Inter', value: 'Inter, sans-serif' },
  { label: 'Montserrat', value: 'Montserrat, sans-serif' },
  { label: 'Oswald', value: 'Oswald, sans-serif' },
  { label: 'Dancing Script', value: '"Dancing Script", cursive' },
  { label: 'Courier New', value: '"Courier New", monospace' },
];


export default function Sidebar({
  data,
  confinements,
  canvasWidth,
  canvasHeight,
  overlayOpacity,
  glowIntensity,
  vignetteIntensity,
  onVignetteIntensityChange,
  titleSize,
  nameSize,
  dateSize,
  titleX,
  titleY,
  nameX,
  nameY,
  dateX,
  dateY,
  titleColor,
  nameColor,
  dateColor,
  titleFont,
  nameFont,
  dateFont,
  isLoading,
  onUpdate,
  onConfinementUpdate,
  onOverlayOpacityChange,
  onGlowIntensityChange,
  onTitleSizeChange,
  onNameSizeChange,
  onDateSizeChange,
  onTitleXChange,
  onTitleYChange,
  onNameXChange,
  onNameYChange,
  onDateXChange,
  onDateYChange,
  onTitleColorChange,
  onNameColorChange,
  onDateColorChange,
  onTitleFontChange,
  onNameFontChange,
  onDateFontChange,
  onGenerate,
}: SidebarProps) {
  const [openPanel, setOpenPanel] = useState<'title' | 'name' | 'date' | null>(null);

  const textFields = [
    {
      field: 'eventTitle' as const,
      label: 'Event Title',
      panel: 'title' as const,
      size: titleSize, minSize: 20, maxSize: 120, onSizeChange: onTitleSizeChange,
      x: titleX, y: titleY, onXChange: onTitleXChange, onYChange: onTitleYChange,
      color: titleColor, onColorChange: onTitleColorChange,
      font: titleFont, onFontChange: onTitleFontChange,
    },
    {
      field: 'hostName' as const,
      label: 'Host Name',
      panel: 'name' as const,
      size: nameSize, minSize: 12, maxSize: 80, onSizeChange: onNameSizeChange,
      x: nameX, y: nameY, onXChange: onNameXChange, onYChange: onNameYChange,
      color: nameColor, onColorChange: onNameColorChange,
      font: nameFont, onFontChange: onNameFontChange,
    },
    {
      field: 'dateTime' as const,
      label: 'Date & Time',
      panel: 'date' as const,
      size: dateSize, minSize: 16, maxSize: 100, onSizeChange: onDateSizeChange,
      x: dateX, y: dateY, onXChange: onDateXChange, onYChange: onDateYChange,
      color: dateColor, onColorChange: onDateColorChange,
      font: dateFont, onFontChange: onDateFontChange,
    },
  ];

  return (
    <div className="w-80 h-full bg-gray-900 p-6 flex flex-col gap-6 border-r border-gray-800 text-white overflow-y-auto">
      <h1 className="text-xl font-bold text-zinc-400">Invitation Studio</h1>

      {/* Per-text fields with inline edit panels */}
      <div className="flex flex-col gap-3">
        {textFields.map(({ field, label, panel, size, minSize, maxSize, onSizeChange, x, y, onXChange, onYChange, color, onColorChange, font, onFontChange }) => (
          <div key={field}>
            <label className="text-xs uppercase text-gray-500 block mb-1">{label}</label>
            <div className="flex gap-2">
              <input
                className="flex-1 min-w-0 bg-gray-800 border border-gray-700 p-2 rounded outline-none focus:border-zinc-400"
                value={data[field]}
                onChange={(e) => onUpdate(field, e.target.value)}
              />
              <button
                onClick={() => setOpenPanel(openPanel === panel ? null : panel)}
                className={`px-3 rounded border text-sm transition-colors ${
                  openPanel === panel
                    ? 'border-zinc-400 bg-zinc-800/40 text-zinc-400'
                    : 'border-gray-700 text-gray-400 hover:border-gray-500 hover:text-gray-300'
                }`}
                title="Edit style"
              >
                ✏
              </button>
            </div>

            {openPanel === panel && (
              <div className="mt-2 pl-3 border-l-2 border-zinc-500/60 flex flex-col gap-3">
                <div>
                  <div className="flex justify-between mb-1">
                    <label className="text-xs uppercase text-gray-500">Size</label>
                    <span className="text-xs text-gray-400">{size}px</span>
                  </div>
                  <input type="range" min={minSize} max={maxSize} value={size}
                    onChange={(e) => onSizeChange(Number(e.target.value))}
                    className="w-full accent-zinc-400 cursor-pointer" />
                </div>

                <div>
                  <div className="flex justify-between mb-1">
                    <label className="text-xs uppercase text-gray-500">X Position</label>
                    <span className="text-xs text-gray-400">{x}</span>
                  </div>
                  <input type="range" min={0} max={canvasWidth} value={x}
                    onChange={(e) => onXChange(Number(e.target.value))}
                    className="w-full accent-zinc-400 cursor-pointer" />
                </div>

                <div>
                  <div className="flex justify-between mb-1">
                    <label className="text-xs uppercase text-gray-500">Y Position</label>
                    <span className="text-xs text-gray-400">{y}</span>
                  </div>
                  <input type="range" min={0} max={canvasHeight} value={y}
                    onChange={(e) => onYChange(Number(e.target.value))}
                    className="w-full accent-zinc-400 cursor-pointer" />
                </div>

                <div>
                  <label className="text-xs uppercase text-gray-500 block mb-1">Color</label>
                  <div className="flex items-center gap-3">
                    <input type="color" value={color}
                      onChange={(e) => onColorChange(e.target.value)}
                      className="w-10 h-10 rounded cursor-pointer bg-transparent border-0 p-0" />
                    <span className="text-sm text-gray-400 font-mono">{color.toUpperCase()}</span>
                  </div>
                </div>

                <div>
                  <label className="text-xs uppercase text-gray-500 block mb-1">Font</label>
                  <select value={font} onChange={(e) => onFontChange(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 p-2 rounded outline-none focus:border-zinc-400 text-white"
                    style={{ fontFamily: font }}>
                    {FONTS.map(({ label: fontLabel, value: fontValue }) => (
                      <option key={fontValue} value={fontValue} style={{ fontFamily: fontValue }}>
                        {fontLabel}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="border-t border-gray-700" />

      {/* Overlay & Glow */}
      <div className="flex flex-col gap-4">
        <p className="text-xs uppercase text-gray-500 tracking-widest">Overlay & Glow</p>

        <div>
          <div className="flex justify-between mb-2">
            <label className="text-xs uppercase text-gray-500">Background Darkness</label>
            <span className="text-xs text-gray-400">{Math.round(overlayOpacity * 100)}%</span>
          </div>
          <input
            type="range" min="0" max="85"
            value={Math.round(overlayOpacity * 100)}
            onChange={(e) => onOverlayOpacityChange(Number(e.target.value) / 100)}
            className="w-full accent-zinc-400 cursor-pointer"
          />
        </div>

        <div>
          <div className="flex justify-between mb-2">
            <label className="text-xs uppercase text-gray-500">Glow Intensity</label>
            <span className="text-xs text-gray-400">{glowIntensity}</span>
          </div>
          <input
            type="range" min="0" max="20" value={glowIntensity}
            onChange={(e) => onGlowIntensityChange(Number(e.target.value))}
            className="w-full accent-zinc-400 cursor-pointer"
          />
        </div>

        <div>
          <div className="flex justify-between mb-2">
            <label className="text-xs uppercase text-gray-500">Vignette</label>
            <span className="text-xs text-gray-400">{Math.round(vignetteIntensity * 100)}%</span>
          </div>
          <input
            type="range" min="0" max="100"
            value={Math.round(vignetteIntensity * 100)}
            onChange={(e) => onVignetteIntensityChange(Number(e.target.value) / 100)}
            className="w-full accent-zinc-400 cursor-pointer"
          />
        </div>
      </div>

      <div className="border-t border-gray-700" />

      {/* AI confinements */}
      <div className="flex flex-col gap-3">
        <p className="text-xs uppercase text-gray-500 tracking-widest">AI Background Style</p>
        {AI_PRESETS.map((p) => {
          const selected = confinements.preset === p.label;
          return (
            <button
              key={p.label}
              onClick={() => onConfinementUpdate('preset', p.label)}
              style={{
                textAlign: 'left', padding: '10px 14px', borderRadius: 8,
                border: selected ? '1px solid rgba(161,161,170,0.8)' : '1px solid rgba(255,255,255,0.1)',
                background: selected ? 'rgba(161,161,170,0.15)' : 'rgba(255,255,255,0.03)',
                cursor: 'pointer', transition: 'all 0.15s',
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 600, color: selected ? '#c084fc' : 'rgba(255,255,255,0.85)', marginBottom: 2 }}>
                {p.label}
              </div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>
                {p.description}
              </div>
            </button>
          );
        })}
      </div>

      <button
        onClick={onGenerate}
        disabled={isLoading}
        className="mt-auto w-full py-4 bg-gradient-to-r from-zinc-400 to-zinc-300 font-bold rounded-xl active:scale-95 transition-all disabled:opacity-60 disabled:cursor-not-allowed disabled:active:scale-100"
      >
        {isLoading ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            Generating…
          </span>
        ) : (
          '✨ Generate AI Background'
        )}
      </button>
    </div>
  );
}
