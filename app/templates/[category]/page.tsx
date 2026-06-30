import type { Metadata } from 'next';
import { categoryFromSlug } from '@/app/lib/slugs';
import TemplatesPage from '../page';

const META: Record<string, { title: string; description: string }> = {
  "It's a Boy":    { title: "It's a Boy Invitations | Share Your Simcha",   description: "Beautiful bris, shulem zucher, vachnacht and kiddush invitations. Customize in Hebrew or Yiddish and download instantly for $8.99." },
  "It's a Girl":   { title: "It's a Girl Invitations | Share Your Simcha",   description: "Elegant kiddush invitations for a baby girl. Customize in Hebrew or Yiddish and download instantly for $8.99." },
  'Bar Mitzvah':   { title: "Bar Mitzvah Invitations | Share Your Simcha",   description: "Professional bar mitzvah invitations in Hebrew, Yiddish and English. Customize and download instantly for $8.99." },
  'Upsherin':      { title: "Upsherin Invitations | Share Your Simcha",      description: "Upsherin invitations in Hebrew and Yiddish. Customize and download instantly for $8.99." },
  'Tenoyim':       { title: "Tenoyim Invitations | Share Your Simcha",       description: "Beautiful tenoyim invitations for the chusen and kallah side. Customize in Hebrew or Yiddish and download for $8.99." },
  'Bavarfen':      { title: "Bavarfen Invitations | Share Your Simcha",      description: "Bavarfen and chusen invite templates in Hebrew and Yiddish. Customize and download instantly for $8.99." },
  'Wedding':       { title: "Jewish Wedding Invitations | Share Your Simcha", description: "Elegant Jewish wedding invitations in Hebrew, Yiddish and English. Customize and download instantly for $8.99." },
  'Sheva Brachos': { title: "Sheva Brachos Invitations | Share Your Simcha", description: "Sheva brachos invitations in Hebrew and Yiddish. Customize and download instantly for $8.99." },
};

export async function generateMetadata(
  { params }: { params: Promise<{ category: string }> }
): Promise<Metadata> {
  const { category: slug } = await params;
  const cat = categoryFromSlug(slug);
  const meta = cat ? (META[cat] ?? null) : null;
  return {
    title: meta?.title ?? `${slug.replace(/-/g, ' ')} Invitations | Share Your Simcha`,
    description: meta?.description ?? '',
  };
}

export default function Page() {
  return <TemplatesPage />;
}
