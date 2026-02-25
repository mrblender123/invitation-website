'use client';

import { useState } from 'react';

// Standard Israeli Hebrew keyboard (QWERTY-aligned, left-to-right)
const HEBREW_ROWS: string[][] = [
  ['/', "'", 'ק', 'ר', 'א', 'ט', 'ו', 'ן', 'מ', 'פ'],
  ['ש', 'ד', 'ג', 'כ', 'ע', 'י', 'ח', 'ל', 'ך', 'ף'],
  ['ז', 'ס', 'ב', 'ה', 'נ', 'ם', 'צ', 'ת', 'ץ'],
];

const EN_LOWER: string[][] = [
  ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
  ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
  ['z', 'x', 'c', 'v', 'b', 'n', 'm'],
];

const EN_UPPER: string[][] = [
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
  ['Z', 'X', 'C', 'V', 'B', 'N', 'M'],
];

interface Props {
  lang: 'he' | 'en';
  onKey: (char: string) => void;
  onBackspace: () => void;
  onDone: () => void;
}

const KEY_BASE: React.CSSProperties = {
  height: 44,
  flex: 1,
  minWidth: 28,
  background: 'rgba(255,255,255,0.09)',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 7,
  color: '#fff',
  fontSize: 17,
  fontWeight: 500,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  userSelect: 'none',
  WebkitUserSelect: 'none',
  flexShrink: 0,
  transition: 'background 0.08s',
};

const UTILITY_KEY: React.CSSProperties = {
  ...KEY_BASE,
  flex: 'none',
  width: 46,
  background: 'rgba(255,255,255,0.05)',
  fontSize: 15,
};

export default function VirtualKeyboard({ lang, onKey, onBackspace, onDone }: Props) {
  const [caps, setCaps] = useState(true); // start with uppercase for English

  const rows = lang === 'he' ? HEBREW_ROWS : (caps ? EN_UPPER : EN_LOWER);

  const press = (e: React.MouseEvent | React.TouchEvent, fn: () => void) => {
    e.preventDefault();
    fn();
  };

  return (
    <div
      style={{
        marginTop: 8,
        background: 'rgba(22,22,26,0.98)',
        border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: 14,
        padding: '10px 8px 12px',
        boxShadow: '0 12px 40px rgba(0,0,0,0.6)',
      }}
    >

      {/* Key rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        {rows.map((row, ri) => (
          <div key={ri} style={{ display: 'flex', gap: 5, justifyContent: 'center' }}>

            {/* Caps toggle on English row 3 */}
            {lang === 'en' && ri === 2 && (
              <button
                onMouseDown={e => press(e, () => setCaps(c => !c))}
                onTouchStart={e => press(e, () => setCaps(c => !c))}
                style={{
                  ...UTILITY_KEY,
                  background: caps ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.05)',
                  fontSize: 17,
                }}
              >
                ⇧
              </button>
            )}

            {row.map(char => (
              <button
                key={char}
                onMouseDown={e => press(e, () => onKey(char))}
                onTouchStart={e => press(e, () => onKey(char))}
                style={KEY_BASE}
              >
                {char}
              </button>
            ))}

            {/* Backspace on row 3 */}
            {ri === 2 && (
              <button
                onMouseDown={e => press(e, onBackspace)}
                onTouchStart={e => press(e, onBackspace)}
                style={UTILITY_KEY}
              >
                ⌫
              </button>
            )}
          </div>
        ))}

        {/* Bottom row */}
        <div style={{ display: 'flex', gap: 5 }}>
          {/* Hebrew geresh/gershayim */}
          {lang === 'he' && (
            <>
              <button
                onMouseDown={e => press(e, () => onKey('׳'))}
                onTouchStart={e => press(e, () => onKey('׳'))}
                style={{ ...UTILITY_KEY, fontSize: 14 }}
              >
                ׳
              </button>
              <button
                onMouseDown={e => press(e, () => onKey('״'))}
                onTouchStart={e => press(e, () => onKey('״'))}
                style={{ ...UTILITY_KEY, fontSize: 14 }}
              >
                ״
              </button>
            </>
          )}

          <button
            onMouseDown={e => press(e, () => onKey('!'))}
            onTouchStart={e => press(e, () => onKey('!'))}
            style={{ ...UTILITY_KEY, fontSize: 18, fontWeight: 700 }}
          >
            !
          </button>

          <button
            onMouseDown={e => press(e, () => onKey(' '))}
            onTouchStart={e => press(e, () => onKey(' '))}
            style={{
              ...KEY_BASE,
              flex: 1,
              fontSize: 13,
              color: 'rgba(255,255,255,0.35)',
              fontWeight: 500,
            }}
          >
            space
          </button>

          {lang === 'he' && (
            <button
              onMouseDown={e => press(e, () => onKey('-'))}
              onTouchStart={e => press(e, () => onKey('-'))}
              style={{ ...UTILITY_KEY, fontSize: 18 }}
            >
              -
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
