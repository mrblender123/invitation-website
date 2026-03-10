import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Saved Designs — Pintle',
  description: 'Your saved invitation designs, ready to edit or export.',
};

export default function SavedLayout({ children }: { children: React.ReactNode }) {
  return children;
}
