import { createClient } from '@supabase/supabase-js';

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export async function initEditRecord(piId: string, templateId: string) {
  await db().from('invitation_edits').upsert(
    { payment_intent_id: piId, template_id: templateId, edits_remaining: 3 },
    { onConflict: 'payment_intent_id', ignoreDuplicates: true },
  );
}

export async function consumeEdit(
  piId: string,
): Promise<{ allowed: boolean; editsRemaining: number }> {
  const { data } = await db()
    .from('invitation_edits')
    .select('edits_remaining')
    .eq('payment_intent_id', piId)
    .single();

  if (!data || data.edits_remaining <= 0) return { allowed: false, editsRemaining: 0 };

  const newCount = data.edits_remaining - 1;
  await db()
    .from('invitation_edits')
    .update({ edits_remaining: newCount })
    .eq('payment_intent_id', piId);

  return { allowed: true, editsRemaining: newCount };
}
