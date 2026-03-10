'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useAuth } from './AuthProvider';
import UserMenu from './UserMenu';

const CATEGORIES = [
  { key: "It's a Boy",    icon: '👶🏻' },
  { key: "It's a Girl",   icon: '🎀' },
  { key: 'Upsherin',      icon: '✂️' },
  { key: 'Bar Mitzvah',   icon: '13' },
  { key: 'Tenoyim',       icon: '📜' },
  { key: 'Vort',          icon: '🥂' },
  { key: 'Wedding',       icon: '💍' },
  { key: 'Sheva Brachos', icon: '🍷' },
];

export default function LandingHeader({ liquid }: { liquid?: boolean }) {
  const { user, loading } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <>
      <header style={liquid ? {
        position: 'sticky',
        top: 0,
        zIndex: 100,
        background: 'rgba(255,255,255,0.62)',
        backdropFilter: 'blur(14px) saturate(1.5)',
        WebkitBackdropFilter: 'blur(14px) saturate(1.5)',
        borderBottom: '1px solid rgba(0,0,0,0.07)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.92), 0 2px 12px rgba(0,0,0,0.06)',
      } : undefined}>
        {/* Main nav row */}
        <div style={{
          maxWidth: 1100,
          margin: '0 auto',
          height: 56,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 24px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {/* Hamburger — mobile only, left side */}
            {liquid && (
              <button
                className="hamburger-btn"
                onClick={() => setMenuOpen(o => !o)}
                aria-label="Open menu"
                style={{
                  background: 'rgba(0,0,0,0.06)',
                  border: '1px solid rgba(0,0,0,0.08)',
                  borderRadius: 10,
                  cursor: 'pointer',
                  width: 36, height: 36,
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 4,
                  padding: 0,
                }}
              >
                <span style={{ display: 'block', width: 16, height: 1.5, background: 'var(--foreground)', borderRadius: 2 }} />
                <span style={{ display: 'block', width: 16, height: 1.5, background: 'var(--foreground)', borderRadius: 2 }} />
                <span style={{ display: 'block', width: 10, height: 1.5, background: 'var(--foreground)', borderRadius: 2 }} />
              </button>
            )}

            <Link
              href="/"
              style={{
                fontFamily: 'var(--font-playfair)',
                fontSize: 20,
                fontWeight: 700,
                letterSpacing: '-0.02em',
                color: 'var(--foreground)',
                textDecoration: 'none',
              }}
            >
              Pintle
            </Link>
          </div>

          {/* Desktop nav */}
          <nav className="landing-nav" style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
            <Link
              href="/about"
              style={{ fontSize: 14, color: 'var(--muted)', textDecoration: 'none', transition: 'color 0.18s' }}
              onMouseOver={e => (e.currentTarget.style.color = 'var(--foreground)')}
              onMouseOut={e => (e.currentTarget.style.color = 'var(--muted)')}
            >
              About
            </Link>
            {!loading && user && <UserMenu />}
          </nav>
        </div>

        {/* Category sub-bar — hidden on mobile via CSS */}
        {liquid && (
          <div className="category-subbar" style={{
            borderTop: '1px solid rgba(0,0,0,0.05)',
            overflowX: 'auto',
            scrollbarWidth: 'none',
          }}>
            <div style={{
              maxWidth: 1100,
              margin: '0 auto',
              padding: '0 24px',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              height: 38,
            }}>
              {CATEGORIES.map(cat => (
                <Link
                  key={cat.key}
                  href={`/templates?category=${encodeURIComponent(cat.key)}`}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 5,
                    padding: '4px 12px', borderRadius: 999,
                    fontSize: 12, fontWeight: 500,
                    color: 'var(--muted)', textDecoration: 'none',
                    whiteSpace: 'nowrap', transition: 'background 0.15s, color 0.15s',
                  }}
                  onMouseOver={e => { e.currentTarget.style.background = 'rgba(0,0,0,0.06)'; e.currentTarget.style.color = 'var(--foreground)'; }}
                  onMouseOut={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--muted)'; }}
                >
                  <span style={{ fontSize: 13 }}>{cat.icon}</span>
                  {cat.key}
                </Link>
              ))}
            </div>
          </div>
        )}
      </header>

      {/* Mobile drawer — outside header, no portal needed */}
      {liquid && menuOpen && (
        <>
          {/* Backdrop */}
          <div
            onClick={() => setMenuOpen(false)}
            style={{
              position: 'fixed', inset: 0, zIndex: 200,
              background: 'rgba(0,0,0,0.2)',
            }}
          />
          {/* Drawer — slides from left */}
          <div style={{
            position: 'fixed', top: 0, left: 0, bottom: 0,
            width: 260, zIndex: 201,
            background: 'rgba(255,255,255,0.96)',
            borderRight: '1px solid rgba(0,0,0,0.07)',
            boxShadow: '4px 0 24px rgba(0,0,0,0.1)',
            display: 'flex', flexDirection: 'column',
            paddingTop: 16,
            overflowY: 'auto',
          }}>
            {/* Close button */}
            <button
              onClick={() => setMenuOpen(false)}
              style={{
                alignSelf: 'flex-start', marginLeft: 18, marginBottom: 12,
                background: 'none', border: 'none',
                fontSize: 24, cursor: 'pointer',
                color: 'var(--muted)', lineHeight: 1,
              }}
            >×</button>

            <p style={{
              fontSize: 11, fontWeight: 600, letterSpacing: '0.1em',
              color: 'var(--muted-faint)', textTransform: 'uppercase',
              padding: '0 20px', marginBottom: 6,
            }}>
              Categories
            </p>

            {CATEGORIES.map(cat => (
              <Link
                key={cat.key}
                href={`/templates?category=${encodeURIComponent(cat.key)}`}
                onClick={() => setMenuOpen(false)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '12px 20px',
                  fontSize: 14, fontWeight: 500,
                  color: 'var(--foreground)', textDecoration: 'none',
                }}
              >
                <span style={{ fontSize: 18, width: 26, textAlign: 'center' }}>{cat.icon}</span>
                {cat.key}
              </Link>
            ))}

            <div style={{ height: 1, background: 'rgba(0,0,0,0.06)', margin: '12px 20px' }} />

            <Link
              href="/about"
              onClick={() => setMenuOpen(false)}
              style={{ display: 'block', padding: '12px 20px', fontSize: 14, color: 'var(--muted)', textDecoration: 'none' }}
            >
              About
            </Link>
          </div>
        </>
      )}
    </>
  );
}
