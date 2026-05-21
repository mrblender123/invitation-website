import { verifyDownloadToken } from '@/lib/download-token';
import { consumeEdit } from '@/lib/edit-tracking';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get('token') ?? '';
  const templateId = searchParams.get('template') ?? '';
  const piId = searchParams.get('pi') ?? '';

  if (!verifyDownloadToken(token, templateId)) {
    return Response.json({ valid: false, editsRemaining: 0 });
  }

  if (piId) {
    const { allowed, editsRemaining } = await consumeEdit(piId);
    return Response.json({ valid: allowed, editsRemaining });
  }

  // Old links without piId — still honour the token
  return Response.json({ valid: true, editsRemaining: null });
}
