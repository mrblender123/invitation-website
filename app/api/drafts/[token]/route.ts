import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await params;
    const supabase = createServiceClient();

    const { data, error } = await supabase
      .from('drafts')
      .select('template_id, field_values, expires_at')
      .eq('token', token)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: 'Draft not found' }, { status: 404 });
    }

    if (new Date(data.expires_at) < new Date()) {
      return NextResponse.json({ error: 'Draft has expired' }, { status: 410 });
    }

    return NextResponse.json({
      templateId: data.template_id,
      fieldValues: data.field_values,
    });
  } catch (err) {
    console.error('[GET /api/drafts/:token]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
