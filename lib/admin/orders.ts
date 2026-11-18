export const ADMIN_TIME_ZONE = 'America/New_York';
export type Order = {
  id: string; type: 'purchase' | 'draft'; email: string; template_id: string;
  template_name: string | null; field_values?: Record<string, string> | null;
  payment_intent_id: string | null; amount_cents: number | null; created_at: string;
  email_claimed?: boolean | null; edits_remaining?: number | null;
};
export type OrderDetail = {
  order: Order; payment: string; currency: string; amount: number; refunded: number;
  stripeUrl: string | null; emailStatus: string; emailSentAt: string | null;
  recipient: string | null; canRecover: boolean; recoveryReason: string | null; warnings: string[];
};
export type Overview = {
  today: { purchases: number; revenue: number }; purchases: number; revenue: number; drafts: number;
  needsReview: Order[]; recent: Order[]; days: { date: string; revenue: number; sales: number }[];
  warnings: string[];
};
export const dayKey = (date: Date | string) => new Intl.DateTimeFormat('en-CA', {
  timeZone: ADMIN_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
}).format(new Date(date));
export const money = (cents: number, currency = 'USD') => new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(cents / 100);
export const orderDate = (iso: string) => new Intl.DateTimeFormat('en-US', {
  timeZone: ADMIN_TIME_ZONE, year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
}).format(new Date(iso));
export function needsDeliveryReview(order: Order, now = Date.now()) {
  return order.type === 'purchase' && order.email_claimed !== true && now - Date.parse(order.created_at) > 180000;
}
export function summarizeOrders(orders: Order[], now = new Date()): Omit<Overview, 'warnings'> {
  const todayKey = dayKey(now);
  // Noon UTC stays on the intended New York calendar day across DST transitions.
  const noon = new Date(`${todayKey}T12:00:00Z`);
  const days = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(noon); d.setUTCDate(d.getUTCDate() - 29 + i);
    return { date: dayKey(d), revenue: 0, sales: 0 };
  });
  const included = orders.filter(o => dayKey(o.created_at) >= days[0].date && dayKey(o.created_at) <= todayKey);
  for (const o of included) {
    if (o.type !== 'purchase') continue;
    const day = days.find(d => d.date === dayKey(o.created_at));
    if (day) { day.sales++; day.revenue += o.amount_cents ?? 0; }
  }
  const purchases = included.filter(o => o.type === 'purchase');
  return {
    today: { purchases: days[29].sales, revenue: days[29].revenue },
    purchases: purchases.length, revenue: purchases.reduce((n, o) => n + (o.amount_cents ?? 0), 0),
    drafts: included.filter(o => o.type === 'draft').length,
    needsReview: included.filter(o => needsDeliveryReview(o, now.getTime())),
    recent: [...included].sort((a,b) => b.created_at.localeCompare(a.created_at)).slice(0, 6), days,
  };
}
export function paymentState(pi: { status: string }, charge: { refunded?: boolean; disputed?: boolean; amount_refunded?: number } | null) {
  if (charge?.disputed) return 'disputed';
  if (charge?.refunded) return 'refunded';
  if (charge?.amount_refunded) return 'partially_refunded';
  return pi.status;
}
export function recoveryReason(payment: string, edits: number | null, hasFields: boolean) {
  if (!['succeeded', 'partially_refunded'].includes(payment)) return 'A confirmed payment that has not been fully refunded is required.';
  if (edits === null) return 'Edit allowance could not be verified. Retry before creating a link.';
  if (edits <= 0) return 'This purchase has no edits remaining.';
  if (!hasFields) return 'Saved invitation details are missing. Review this order before sending a link.';
  return null;
}
export const statusLabel = (value: string) => ({
  succeeded: 'Paid', partially_refunded: 'Partially refunded', requires_payment_method: 'Payment incomplete',
  requires_action: 'Action required', requires_confirmation: 'Unconfirmed', processing: 'Processing',
  canceled: 'Canceled', refunded: 'Refunded', disputed: 'Disputed', unknown: 'Unavailable',
  not_applicable: 'Not applicable', untracked: 'Delivery not tracked', claim_recorded: 'Delivery unverified',
  no_send_record: 'No send recorded', accepted: 'Accepted by email service', sent: 'Sent', delivered: 'Delivered',
  opened: 'Opened', clicked: 'Clicked', bounced: 'Bounced', complained: 'Spam complaint',
  delivery_delayed: 'Delayed', failed: 'Failed', queued: 'Queued', scheduled: 'Scheduled',
}[value] ?? value.replaceAll('_', ' '));
