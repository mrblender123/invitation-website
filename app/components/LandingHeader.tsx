'use client';

import Link from 'next/link';
import { useAuth } from './AuthProvider';
import UserMenu from './UserMenu';

export default function LandingHeader() {
  const { user, loading } = useAuth();

  return (
    <header>
      <div style={{
        maxWidth: 1100,
        margin: '0 auto',
        height: 56,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 24px',
      }}>
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

        <nav className="landing-nav" style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
          <Link
            href="/about"
            style={{
              fontSize: 14,
              color: 'var(--muted)',
              textDecoration: 'none',
              transition: 'color 0.18s',
            }}
            onMouseOver={e => (e.currentTarget.style.color = 'var(--foreground)')}
            onMouseOut={e => (e.currentTarget.style.color = 'var(--muted)')}
          >
            About
          </Link>
          {!loading && user && <UserMenu />}
        </nav>
      </div>
    </header>
  );
}
