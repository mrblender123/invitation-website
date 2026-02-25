import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Templates — Invitia',
  description: 'Browse ready-made invitation templates for weddings, bar mitzvahs, and more.',
};

export default function TemplatesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
