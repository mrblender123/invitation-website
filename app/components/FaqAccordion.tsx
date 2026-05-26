'use client';

import { useState } from 'react';

const FAQS = [
  {
    q: 'How much does it cost?',
    a: 'Browsing and customizing is completely free. When you\'re happy with your design, you pay $8.99 to download — your finished invitation arrives as a high-quality PNG straight to your email.',
  },
  {
    q: 'Do I need to create an account?',
    a: 'No account needed. Browse, customize, pay, and receive your invitation — all without signing up.',
  },
  {
    q: 'Can I make changes after I download?',
    a: 'Yes. Every purchase includes up to 3 edits within 7 days. A link in your confirmation email lets you reopen your invitation, make changes, and re-download.',
  },
  {
    q: 'What simchas are supported?',
    a: "We cover the full lifecycle of Jewish celebrations: Bris, Vachnacht, Pidyon Haben, It's a Girl, Upsherin, Bar Mitzvah, Tenoyim, Bavarfen, Wedding, and Sheva Brachos — with more added regularly.",
  },
  {
    q: 'Can I share the invitation digitally?',
    a: 'Absolutely. Share the PNG directly on WhatsApp, email, or any messaging app. It\'s the perfect size for digital sharing.',
  },
  {
    q: 'Can I print the invitation?',
    a: 'Yes. The downloaded image is high resolution and suitable for home printing or a professional print shop.',
  },
  {
    q: 'Can I edit Hebrew text on the templates?',
    a: 'Yes. Templates that include Hebrew fields are fully editable. Just click the field and type your text.',
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
