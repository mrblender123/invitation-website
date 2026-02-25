'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

type CartItem = {
  id: string;
  templateId: string;
  templateName: string;
  category: string;
  thumbnailSrc: string;
  fieldValues: Record<string, string>;
  savedAt: number;
};

export default function CartPage() {
  const router = useRouter();
  const [items, setItems] = useState<CartItem[]>([]);

  useEffect(() => {
    const raw = localStorage.getItem('invitia-cart');
    if (raw) {
      try { setItems(JSON.parse(raw)); } catch {}
    }
  }, []);

  const removeItem = (id: string) => {
    const updated = items.filter(i => i.id !== id);
    setItems(updated);
    localStorage.setItem('invitia-cart', JSON.stringify(updated));
  };

  const handleEdit = (item: CartItem) => {
    localStorage.setItem('invitia-template-load', JSON.stringify({
      templateId: item.templateId,
      fieldValues: item.fieldValues,
    }));
    router.push('/templates');
  };

  return (
    <div style={{ minHeight: '100vh', background: '#09090b', color: '#fff', fontFamily: 'var(--font-inter), system-ui, sans-serif' }}>

      {/* Header */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 50,
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        background: 'rgba(9,9,11,0.85)',
        backdropFilter: 'blur(12px)',
      }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px', height: 60, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Link href="/" style={{ fontFamily: 'var(--font-playfair)', fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em', color: '#fff', textDecoration: 'none' }}>
            Invitia
          </Link>
        </div>
      </header>

      <div className="page-content" style={{ maxWidth: 720, margin: '0 auto', padding: '56px 24px 80px' }}>

        <button
          onClick={() => router.back()}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: 'rgba(255,255,255,0.4)', fontSize: 14, padding: '0 0 36px',
          }}
        >
          ← Back
        </button>

        <h1 style={{ fontFamily: 'var(--font-playfair)', fontSize: 'clamp(24px, 3vw, 36px)', fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 8 }}>
          Saved for Later
        </h1>
        <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.35)', marginBottom: 40 }}>
          {items.length === 0 ? 'Your cart is empty.' : `${items.length} design${items.length > 1 ? 's' : ''} saved`}
        </p>

        {items.length === 0 ? (
          <div style={{
            textAlign: 'center', padding: '60px 0',
            border: '1px dashed rgba(255,255,255,0.1)', borderRadius: 16,
          }}>
            <p style={{ fontSize: 32, marginBottom: 12 }}>🛒</p>
            <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.4)', marginBottom: 24 }}>
              Nothing saved yet. Browse templates and hit &quot;Save for Later&quot;.
            </p>
            <Link href="/templates" className="silver-btn" style={{ padding: '12px 28px', fontSize: 14 }}>
              Browse Templates
            </Link>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {items.map(item => (
              <div
                key={item.id}
                className="cart-item"
                style={{
                  display: 'flex', gap: 16, alignItems: 'center',
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 12, padding: 16,
                }}
              >
                {/* Thumbnail */}
                <img
                  src={item.thumbnailSrc}
                  alt={item.templateName}
                  style={{ width: 72, height: 96, objectFit: 'cover', borderRadius: 8, flexShrink: 0 }}
                />

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.3)', marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    {item.category}
                  </p>
                  <p style={{ fontSize: 16, fontWeight: 600, marginBottom: 6, fontFamily: 'var(--font-playfair)' }}>
                    {item.templateName}
                  </p>
                  <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>
                    Saved {new Date(item.savedAt).toLocaleDateString()}
                  </p>
                </div>

                {/* Actions */}
                <div className="cart-item-actions" style={{ display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0 }}>
                  <button
                    style={{
                      padding: '8px 16px', borderRadius: 7,
                      background: 'linear-gradient(135deg, #b8973a 0%, #f0d060 50%, #b8973a 100%)',
                      color: '#1a1200', border: 'none',
                      fontWeight: 700, fontSize: 13, cursor: 'pointer',
                    }}
                  >
                    Buy
                  </button>
                  <button
                    onClick={() => handleEdit(item)}
                    style={{
                      padding: '8px 16px', borderRadius: 7,
                      background: 'rgba(255,255,255,0.06)',
                      color: 'rgba(255,255,255,0.6)',
                      border: '1px solid rgba(255,255,255,0.12)',
                      fontWeight: 600, fontSize: 13, cursor: 'pointer',
                    }}
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => removeItem(item.id)}
                    style={{
                      padding: '8px 16px', borderRadius: 7,
                      background: 'transparent',
                      color: 'rgba(255,255,255,0.3)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      fontWeight: 500, fontSize: 13, cursor: 'pointer',
                    }}
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}

            {/* Checkout CTA */}
            <div style={{
              marginTop: 24,
              padding: '24px',
              background: 'rgba(240,208,96,0.05)',
              border: '1px solid rgba(240,208,96,0.15)',
              borderRadius: 12,
              textAlign: 'center',
            }}>
              <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', marginBottom: 16 }}>
                Ready to order? Purchase all {items.length} design{items.length > 1 ? 's' : ''} at once.
              </p>
              <button
                style={{
                  padding: '13px 40px', borderRadius: 8,
                  background: 'linear-gradient(135deg, #b8973a 0%, #f0d060 50%, #b8973a 100%)',
                  color: '#1a1200', border: 'none',
                  fontWeight: 700, fontSize: 15, cursor: 'pointer',
                  letterSpacing: '0.02em',
                }}
              >
                Proceed to Checkout
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
