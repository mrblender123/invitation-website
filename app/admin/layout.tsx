import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Admin — Pintle',
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return children;
}
