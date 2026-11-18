import { createAuthenticatedClient } from '@/lib/supabase';
export async function requireAdmin(request: Request) {
  const token = request.headers.get('authorization')?.match(/^Bearer (.+)$/)?.[1];
  if (!token) return false;
  const { data, error } = await createAuthenticatedClient(token).auth.getUser();
  return !error && data.user?.email === 'bycheshin@gmail.com';
}
export const privateHeaders = { 'Cache-Control': 'private, no-store' };
