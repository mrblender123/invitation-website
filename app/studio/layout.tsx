import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Studio — Pintle',
  description: 'Design your invitation with AI-generated backgrounds and full typography control.',
};

export default function StudioLayout({ children }: { children: React.ReactNode }) {
  return children;
}
