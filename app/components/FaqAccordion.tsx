'use client';

import { useState } from 'react';

const FAQS = [
  {
    q: 'Is Pintle free to use?',
    a: 'Yes — browsing templates and customizing your invitation is completely free. You can download your finished design at no cost.',
  },
  {
    q: 'Do I need to create an account?',
    a: 'No account is required to browse or customize. Creating an account lets you save your work and come back to it later.',
  },
  {
    q: 'What simchas are supported?',
    a: "We cover the full lifecycle of Jewish celebrations: It's a Boy, It's a Girl, Upsherin, Bar Mitzvah, Tenoyim, Vort, Wedding, and Sheva Brachos — with more on the way.",
  },
  {
    q: 'Can I share the invitation digitally?',
    a: 'Absolutely. Download your invitation as a high-quality image and share it directly on WhatsApp, email, or any messaging app.',
  },
  {
    q: 'Can I print the invitation?',
    a: 'Yes. The downloaded image is high resolution and suitable for home printing or a professional print shop.',
  },
  {
    q: 'Can I edit Hebrew text on the templates?',
    a: 'Yes. Templates that include Hebrew fields are fully editable. Just tap or click the field and type your text.',
  },
];

export default function FaqAccordion() {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {FAQS.map((faq, i) => {
        const isOpen = open === i;
        return (
          <div
            key={i}
            style={{
              borderRadius: 14,
              border: '1px solid var(--border)',
              background: isOpen ? 'rgba(0,0,0,0.03)' : 'transparent',
              transition: 'background 0.2s',
              overflow: 'hidden',
            }}
          >
            <button
              onClick={() => setOpen(isOpen ? null : i)}
              style={{
                width: '100%',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 16,
                padding: '22px 28px',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                textAlign: 'left',
                color: 'var(--foreground)',
              }}
            >
              <span style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.4 }}>{faq.q}</span>
              <span style={{
                fontSize: 18,
                color: 'var(--muted)',
                flexShrink: 0,
                transform: isOpen ? 'rotate(45deg)' : 'rotate(0deg)',
                transition: 'transform 0.22s cubic-bezier(0.2,0,0.2,1)',
                display: 'inline-block',
                lineHeight: 1,
              }}>
                +
              </span>
            </button>

            <div style={{
              maxHeight: isOpen ? 300 : 0,
              overflow: 'hidden',
              transition: 'max-height 0.28s cubic-bezier(0.2,0,0.2,1)',
            }}>
              <p style={{ margin: 0, padding: '0 28px 22px', fontSize: 15, lineHeight: 1.75, color: 'var(--muted)' }}>
                {faq.a}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
