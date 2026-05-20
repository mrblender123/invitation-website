import { verifyDownloadToken } from '@/lib/download-token';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get('token') ?? '';
  const templateId = searchParams.get('template') ?? '';
  const valid = verifyDownloadToken(token, templateId);
  return Response.json({ valid });
}
