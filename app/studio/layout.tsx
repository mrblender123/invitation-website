import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Studio — Joy Note',
  description: 'Design your invitation with custom backgrounds and full typography control.',
};

export default function StudioLayout({ children }: { children: React.ReactNode }) {
  return children;
}
