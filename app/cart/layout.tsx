import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Saved for Later — Invitia',
  description: 'Your saved invitation designs, ready to purchase or edit.',
};

export default function CartLayout({ children }: { children: React.ReactNode }) {
  return children;
}
