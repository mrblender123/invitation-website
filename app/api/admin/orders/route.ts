import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { requireAdmin, privateHeaders } from '@/lib/admin/auth';
import { addTracking, ORDER_COLUMNS } from '@/lib/admin/order-data';
import { summarizeOrders, type Order } from '@/lib/admin/orders';
export async function GET(req: NextRequest) {
  try {
    if (!await requireAdmin(req)) return NextResponse.json({ error: 'Admin sign-in required.' }, { status: 403, headers: privateHeaders });
    const p = req.nextUrl.searchParams;
    if (p.get('overview') === '1') {
      const orders: Order[] = [];
      const since = new Date(Date.now() - 31 * 86400000).toISOString();
      let truncated = false;
      for (let offset = 0; offset < 10000; offset += 500) {
        const { data, error } = await createServiceClient().from('orders').select(ORDER_COLUMNS)
          .gte('created_at', since).order('created_at', { ascending: false }).order('id').range(offset, offset + 499);
        if (error) throw error;
        orders.push(...(data ?? []) as Order[]);
        if ((data?.length ?? 0) < 500) break;
        if (offset === 9500) truncated = true;
      }
      const tracked = await addTracking(orders);
      return NextResponse.json({ ...summarizeOrders(tracked.orders), warnings: [
        ...(tracked.warning ? [tracked.warning] : []),
        ...(truncated ? ['This overview includes only the latest 10,000 records. Totals may be incomplete.'] : []),
      ] }, { headers: privateHeaders });
    }
    const page = Math.max(1, Math.min(100000, parseInt(p.get('page') ?? '1') || 1));
    const size = 25;
    let query = createServiceClient().from('orders').select(ORDER_COLUMNS, { count: 'exact' });
    const type = p.get('type');
    if (type === 'purchase' || type === 'draft') query = query.eq('type', type);
    // Strip PostgREST filter syntax; the query remains a literal search term.
    const q = (p.get('q') ?? '').replace(/[^\p{L}\p{N}@ .+_-]/gu, '').slice(0, 120).trim().replace(/_/g, '\\_');
    if (q) query = query.or(`email.ilike.%${q}%,template_id.ilike.%${q}%,template_name.ilike.%${q}%,payment_intent_id.ilike.%${q}%`);
    for (const [param, op] of [['from', 'gte'], ['to', 'lte']] as const) {
      const value = p.get(param);
      if (value) {
        if (!Number.isFinite(Date.parse(value))) return NextResponse.json({ error: 'Invalid date filter.' }, { status: 400, headers: privateHeaders });
        query = query[op]('created_at', new Date(value).toISOString());
      }
    }
    const { data, count, error } = await query.order('created_at', { ascending: false }).order('id').range((page - 1) * size, page * size - 1);
    if (error) throw error;
    const tracked = await addTracking((data ?? []) as Order[]);
    return NextResponse.json({ orders: tracked.orders, total: count ?? 0, page, pageSize: size, warning: tracked.warning }, { headers: privateHeaders });
  } catch (error) {
    console.error('[admin/orders] Load failed', error instanceof Error ? error.message : 'database error');
    return NextResponse.json({ error: 'Orders could not be loaded. Please retry; your records have not been changed.' }, { status: 503, headers: privateHeaders });
  }
}
