import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Sign In — Pintle',
  description: 'Sign in to save and manage your invitation designs.',
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
