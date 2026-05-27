import { NextRequest, NextResponse } from 'next/server';
import { verifyDraftToken } from '@/lib/draft-token';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await params;
    const draft = verifyDraftToken(token);

    if (!draft) {
      // Expired tokens return null the same way — client checks status 410 for expiry message
      return NextResponse.json({ error: 'Draft not found or expired' }, { status: 410 });
    }

    return NextResponse.json({
      templateId: draft.templateId,
      fieldValues: draft.fieldValues,
    });
  } catch (err) {
    console.error('[GET /api/drafts/:token]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
