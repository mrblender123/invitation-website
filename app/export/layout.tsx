import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Export — Joy Send',
  description: 'Download your invitation as a high-resolution PNG.',
};

export default function ExportLayout({ children }: { children: React.ReactNode }) {
  return children;
}
