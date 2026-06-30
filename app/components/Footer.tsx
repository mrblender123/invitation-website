export default function Footer() {
  return (
    <footer style={{
      borderTop: '1px solid var(--border)',
      padding: '48px 24px 32px',
      fontFamily: 'var(--font-inter), system-ui, sans-serif',
      position: 'relative',
      zIndex: 1,
    }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 40, marginBottom: 40 }}>

          {/* Brand */}
          <div style={{ maxWidth: 260 }}>
            <img src="/logo.svg" alt="Share Your Simcha" style={{ height: 60, width: 'auto', marginBottom: 10 }} />
            <p style={{ fontSize: 13, lineHeight: 1.7, color: 'var(--muted-faint)', margin: 0 }}>
              Beautiful invitation designs for every simcha. Customize, download, and share in minutes.
            </p>
          </div>

          {/* Links */}
          <div style={{ display: 'flex', gap: 56, flexWrap: 'wrap' }}>
            <div>
              <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted-faint)', margin: '0 0 14px' }}>
                Browse
              </p>
              {["It's a Boy", "It's a Girl", 'Bar Mitzvah', 'Wedding', 'Bavarfen'].map(cat => (
                <a key={cat} href={`/templates?category=${encodeURIComponent(cat)}`} className="footer-link">
                  {cat}
                </a>
              ))}
            </div>
            <div>
              <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted-faint)', margin: '0 0 14px' }}>
                More
              </p>
              {[
                { label: 'Templates', href: '/templates' },
                { label: 'About', href: '/about' },
                { label: 'Contact', href: '/contact' },
              ].map(({ label, href }) => (
                <a key={label} href={href} className="footer-link">
                  {label}
                </a>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div style={{
          borderTop: '1px solid var(--border)',
          paddingTop: 20,
          display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 8,
        }}>
          <p style={{ fontSize: 12, color: 'var(--muted-faint)', margin: 0 }}>
            © {new Date().getFullYear()} Share Your Simcha. All rights reserved.
          </p>
          <a href="/admin" style={{ fontSize: 12, color: 'transparent', textDecoration: 'none', userSelect: 'none' }}>Admin</a>
        </div>
      </div>
    </footer>
  );
}
