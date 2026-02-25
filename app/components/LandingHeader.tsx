'use client';

import Link from 'next/link';
import { useAuth } from './AuthProvider';
import UserMenu from './UserMenu';

export default function LandingHeader() {
  const { user, loading } = useAuth();

  return (
    <header style={{
      position: 'sticky', top: 0, zIndex: 50,
      borderBottom: '1px solid rgba(255,255,255,0.06)',
      background: 'rgba(9,9,11,0.80)',
      backdropFilter: 'blur(12px)',
    }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 24px', height: 60, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Link href="/" style={{ fontFamily: 'var(--font-playfair)', fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em', color: '#fff', textDecoration: 'none' }}>
          Invitia
        </Link>
        <nav className="landing-nav" style={{ display: 'flex', alignItems: 'center', gap: 32 }}>
          <a href="#features" className="nav-features" style={{ fontSize: 14, color: 'rgba(255,255,255,0.55)', textDecoration: 'none' }}>
            About
          </a>
{!loading && (
            user ? (
              <UserMenu />
            ) : (
              <Link href="/login" style={{
                fontSize: 14, fontWeight: 600, padding: '8px 18px', borderRadius: 8,
                background: 'linear-gradient(135deg, #a1a1aa, #e4e4e7)',
                color: '#fff', textDecoration: 'none',
              }}>
                Sign In
              </Link>
            )
          )}
        </nav>
      </div>
    </header>
  );
}
