'use client';

import { Sun, Moon } from 'lucide-react';
import { useTheme } from './ThemeProvider';

export default function ThemeToggle() {
  const { theme, toggle } = useTheme();

  return (
    <button
      onClick={toggle}
      aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      style={{
        background: 'none',
        border: '1px solid var(--card-border)',
        borderRadius: 8,
        padding: '6px 8px',
        cursor: 'pointer',
        color: 'var(--fg)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'border-color 0.2s, color 0.2s',
        flexShrink: 0,
      }}
    >
      {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  );
}
