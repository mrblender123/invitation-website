import { verifyDownloadToken } from '@/lib/download-token';
import { checkEditCount } from '@/lib/edit-tracking';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get('token') ?? '';
  const templateId = searchParams.get('template') ?? '';
  const piId = searchParams.get('pi') ?? '';

  if (!verifyDownloadToken(token, templateId)) {
    return Response.json({ valid: false, editsRemaining: 0 });
  }

  if (piId) {
    try {
      const { allowed, editsRemaining, notFound } = await checkEditCount(piId);
      if (notFound) return Response.json({ valid: true, editsRemaining: null });
      return Response.json({ valid: allowed, editsRemaining });
    } catch {
      // Supabase unavailable — don't block the user
    }
  }

  return Response.json({ valid: true, editsRemaining: null });
}
