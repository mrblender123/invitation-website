import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';

// Public read endpoint — returns the saved field order + req/opt for a folder.
// Used by the customer-facing template editor to apply category config.
export async function GET(req: NextRequest) {
  const folder = req.nextUrl.searchParams.get('folder');
  if (!folder) return NextResponse.json([]);

  const { data, error } = await createServiceClient()
    .from('category_field_config')
    .select('field_id, required, sort_order')
    .eq('folder', folder)
    .order('sort_order');

  if (error) return NextResponse.json([]);
  return NextResponse.json(data ?? [], {
    headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60' },
  });
}
