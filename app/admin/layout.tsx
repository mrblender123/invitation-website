import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Admin — Joy Note',
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return children;
}
