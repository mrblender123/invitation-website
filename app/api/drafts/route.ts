import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { createDraftToken } from '@/lib/draft-token';
const resend = new Resend(process.env.RESEND_API_KEY ?? '');
const EMAIL_LOGO_SRC = 'https://i.imgur.com/t8uy4eg.png';

export async function POST(req: NextRequest) {
  try {
    const { templateId, fieldValues, email } = await req.json();

    if (!templateId || !email) {
      return NextResponse.json({ error: 'Missing templateId or email' }, { status: 400 });
    }

    const token = createDraftToken(templateId, fieldValues ?? {}, email);
    const draftUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://shareyoursimcha.com'}/draft/${token}`;
    const logoSrc = EMAIL_LOGO_SRC;

    const { error: emailError } = await resend.emails.send({
      from: process.env.RESEND_FROM ?? 'Share Your Simcha <noreply@shareyoursimcha.com>',
      to: email,
      subject: 'Your invitation draft is saved',
      headers: {
        'X-Entity-Ref-ID': `draft-${email}-${Date.now()}`,
      },
      text: `Your invitation draft is saved.\n\nContinue editing here (link expires in 7 days):\n${draftUrl}\n\n— Share Your Simcha`,
      html: `
        <div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;padding:40px 24px;color:#1a1a1a;">
          <img src="${logoSrc}" alt="Share Your Simcha" style="height:140px;width:auto;margin-bottom:24px;display:block;" />
          <p style="font-size:16px;line-height:1.6;margin:0 0 16px;">Your invitation draft has been saved.</p>
          <p style="font-size:15px;line-height:1.6;color:#555;margin:0 0 16px;">Use the link below to continue editing. It expires in 7 days.</p>
          <p style="font-size:15px;margin:0 0 32px;"><a href="${draftUrl}" style="color:#0f172a;">Continue editing your invitation</a></p>
          <p style="font-size:12px;color:#bbb;margin:0;">© ${new Date().getFullYear()} Share Your Simcha</p>
        </div>
      `,
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
