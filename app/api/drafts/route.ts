import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { createDraftToken } from '@/lib/draft-token';
const resend = new Resend(process.env.RESEND_API_KEY ?? '');

export async function POST(req: NextRequest) {
  try {
    const { templateId, fieldValues, email } = await req.json();

    if (!templateId || !email) {
      return NextResponse.json({ error: 'Missing templateId or email' }, { status: 400 });
    }

    const token = createDraftToken(templateId, fieldValues ?? {}, email);
    const draftUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://shareyoursimcha.com'}/draft/${token}`;

    const { error: emailError } = await resend.emails.send({
      from: process.env.RESEND_FROM ?? 'Share Your Simcha <noreply@shareyoursimcha.com>',
      to: email,
      subject: 'Your invitation draft is saved',
      headers: {
        'X-Entity-Ref-ID': `draft-${email}-${Date.now()}`,
      },
      text: `Your invitation draft has been saved.\n\nContinue editing here (link expires in 7 days):\n${draftUrl}\n\n— Share Your Simcha`,
      html: `<div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;padding:40px 24px;color:#1a1a1a;font-size:15px;line-height:1.6;">
        <p style="margin:0 0 16px;font-weight:600;">Share Your Simcha</p>
        <p style="margin:0 0 16px;">Your invitation draft has been saved.</p>
        <p style="margin:0 0 16px;">Continue editing here — link expires in 7 days:<br><a href="${draftUrl}" style="color:#0f172a;">${draftUrl}</a></p>
        <p style="margin:0;color:#999;font-size:13px;">— Share Your Simcha</p>
      </div>`,
    });

    if (emailError) {
      console.error('[drafts] Resend error:', emailError);
      return NextResponse.json({ error: `Email error: ${emailError.message}` }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[POST /api/drafts]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
