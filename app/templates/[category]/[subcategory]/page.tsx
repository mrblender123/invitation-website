import type { Metadata } from 'next';
import { SUB_DISPLAY_NAMES } from '@/lib/categories';
import TemplatesPage from '../../page';

function titleCase(slug: string): string {
  return slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

export async function generateMetadata(
  { params }: { params: Promise<{ category: string; subcategory: string }> }
): Promise<Metadata> {
  const { category: catSlug, subcategory: subSlug } = await params;
  const subName = SUB_DISPLAY_NAMES[titleCase(subSlug)] ?? titleCase(subSlug);
  return {
    title: `${subName} Invitations | Share Your Simcha`,
    description: `${subName} invitation templates. Customize in Hebrew or Yiddish and download instantly for $8.99.`,
    alternates: { canonical: `/templates/${catSlug}/${subSlug}` },
  };
}

export default function Page() {
  return <TemplatesPage />;
}
