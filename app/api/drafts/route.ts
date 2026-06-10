import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { createDraftToken } from '@/lib/draft-token';
const resend = new Resend(process.env.RESEND_API_KEY ?? '');
const EMAIL_LOGO_SRC = 'https://i.imgur.com/sInuEHF.png';

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
      html: `
        <div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;padding:40px 24px;color:#1a1a1a;">
          <img src="${logoSrc}" alt="Share Your Simcha" style="height:70px;width:auto;margin-bottom:24px;display:block;" />
          <h1 style="font-size:22px;font-weight:700;margin:0 0 12px;">Your draft is saved</h1>
          <p style="font-size:15px;line-height:1.6;color:#555;margin:0 0 32px;">
            Click the button below to pick up where you left off.
            This link expires in <strong>7 days</strong>.
          </p>
          <a href="${draftUrl}"
             style="display:inline-block;background:#0f172a;color:#fff;text-decoration:none;padding:14px 28px;border-radius:9999px;font-size:15px;font-weight:600;margin-bottom:32px;">
            Continue Editing →
          </a>
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
