import { createServiceClient } from '@/lib/supabase';
import type { Order } from './orders';
export const ORDER_COLUMNS = 'id,type,email,template_id,template_name,payment_intent_id,amount_cents,created_at';
export async function addTracking(orders: Order[]): Promise<{ orders: Order[]; warning?: string }> {
  const ids = orders.filter(o => o.payment_intent_id).map(o => o.payment_intent_id!);
  if (!ids.length) return { orders };
  const tracking = new Map<string, { email_sent: boolean; edits_remaining: number }>();
  for (let i = 0; i < ids.length; i += 200) {
    const { data, error } = await createServiceClient().from('invitation_edits')
      .select('payment_intent_id,email_sent,edits_remaining').in('payment_intent_id', ids.slice(i, i + 200));
    if (error) return { orders, warning: 'Email and edit tracking is temporarily unavailable. Order records are still shown.' };
    for (const row of data ?? []) tracking.set(row.payment_intent_id, row);
  }
  return { orders: orders.map(o => ({ ...o, email_claimed: tracking.get(o.payment_intent_id ?? '')?.email_sent ?? null,
    edits_remaining: tracking.get(o.payment_intent_id ?? '')?.edits_remaining ?? null })) };
}
