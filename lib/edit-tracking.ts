import { createClient } from '@supabase/supabase-js';

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export async function initEditRecord(piId: string, templateId: string) {
  const { error } = await db().from('invitation_edits').upsert(
    { payment_intent_id: piId, template_id: templateId, edits_remaining: 3, email_sent: false },
    { onConflict: 'payment_intent_id', ignoreDuplicates: true },
  );
  if (error) throw new Error(`Failed to initialize edit record: ${error.message}`);
}

// Read-only check — does NOT decrement. Used by verify-token on page load.
export async function checkEditCount(
  piId: string,
): Promise<{ allowed: boolean; editsRemaining: number; notFound?: boolean }> {
  const { data } = await db()
    .from('invitation_edits')
    .select('edits_remaining')
    .eq('payment_intent_id', piId)
    .single();

  if (!data) return { allowed: false, editsRemaining: 0, notFound: true };
  return { allowed: data.edits_remaining > 0, editsRemaining: data.edits_remaining };
}

// Atomically decrement with optimistic concurrency — called only on actual download.
export async function consumeEdit(
  piId: string,
): Promise<{ allowed: boolean; editsRemaining: number; notFound?: boolean }> {
  const MAX_RETRIES = 5;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const { data } = await db()
      .from('invitation_edits')
      .select('edits_remaining')
      .eq('payment_intent_id', piId)
      .single();

    if (!data) return { allowed: false, editsRemaining: 0, notFound: true };
    if (data.edits_remaining <= 0) return { allowed: false, editsRemaining: 0 };

    const current = data.edits_remaining;
    const newCount = current - 1;

    // Only update if edits_remaining still equals what we just read (optimistic lock)
    const { data: updated } = await db()
      .from('invitation_edits')
      .update({ edits_remaining: newCount })
      .eq('payment_intent_id', piId)
      .eq('edits_remaining', current)
      .select('edits_remaining');

    if (updated && updated.length > 0) {
      return { allowed: true, editsRemaining: newCount };
    }
    // Another concurrent request updated it first — retry
  }

  // All retries exhausted — fetch final state
  const { data: final } = await db()
    .from('invitation_edits')
    .select('edits_remaining')
    .eq('payment_intent_id', piId)
    .single();

  return { allowed: false, editsRemaining: final?.edits_remaining ?? 0 };
}

// Atomically claim delivery. Only skip when the database confirms an existing
// claim; Supabase returns errors in the result rather than always throwing.
export async function markEmailSent(piId: string): Promise<boolean> {
  try {
    const { data, error } = await db()
      .from('invitation_edits')
      .update({ email_sent: true })
      .eq('payment_intent_id', piId)
      .eq('email_sent', false)   // only update if not already sent
      .select('payment_intent_id');

    if (error) throw new Error(error.message);
    if (data && data.length > 0) return true;

    // No updated row can also mean initialization failed or the row is missing.
    // Neither is proof that a purchase email was sent.
    return !await wasEmailSent(piId);
  } catch (error) {
    console.error('[email-delivery] Unable to claim delivery for pi=%s; allowing send:', piId, error);
    return true; // if DB fails, allow send so user isn't left without their file
  }
}

// Reset email_sent flag so the email can be retried after a send failure.
export async function resetEmailSent(piId: string): Promise<void> {
  try {
    const { error } = await db()
      .from('invitation_edits')
      .update({ email_sent: false })
      .eq('payment_intent_id', piId);
    if (error) throw new Error(error.message);
  } catch (error) {
    console.error('[email-delivery] Unable to release delivery claim for pi=%s:', piId, error);
  }
}

// Read-only: has the purchase email already been sent for this payment?
// A database outage is not proof of delivery: allow the backup email to run.
export async function wasEmailSent(piId: string): Promise<boolean> {
  try {
    const { data, error } = await db()
      .from('invitation_edits')
      .select('email_sent')
      .eq('payment_intent_id', piId)
      .single();
    if (error) throw new Error(error.message);
    return data?.email_sent === true;
  } catch (error) {
    console.error('[email-delivery] Unable to verify delivery for pi=%s; treating as unsent:', piId, error);
    return false;
  }
}
