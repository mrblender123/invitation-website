import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Invitation Templates | Joy Send — Vachnacht, Bris, Bar Mitzvah & More',
  description: 'Browse and customize Jewish simcha invitation templates — vachnacht, bris, bar mitzvah, sheva brachos, upsherin, tenoyim and weddings. Personalize with your details and download instantly.',
};

export default function TemplatesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
