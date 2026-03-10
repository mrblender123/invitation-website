import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Gallery — Pintle',
  description: 'Browse and manage your saved invitation designs.',
};

export default function GalleryLayout({ children }: { children: React.ReactNode }) {
  return children;
}
