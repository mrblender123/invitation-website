import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Jewish Simcha Invitation Templates | Share Your Simcha',
  description: 'Browse Jewish simcha invitation templates. Choose your design, fill in your details, and download a print-ready PNG & PDF in minutes — bris, bar mitzvah, tenoyim, upsherin, sheva brachos & more.',
};

export default function TemplatesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
