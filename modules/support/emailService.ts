// modules/support/emailService.ts
import { Resend } from "resend";
import { env } from "../../config/env";

const resend = new Resend(env.RESEND_API_KEY);

// ─── Send reply email to user ─────────────────────────────────────────────────
export async function sendReplyEmail({
  toEmail,
  toName,
  ticketId,
  ticketSubject,
  adminReply,
  originalMessage,
}: {
  toEmail: string;
  toName: string | null;
  ticketId: string;
  ticketSubject: string;
  adminReply: string;
  originalMessage: string;
}) {
  const userName = toName ?? toEmail.split("@")[0];

  await resend.emails.send({
    from:    env.SUPPORT_FROM_EMAIL,
    to:      toEmail,
    subject: `Re: ${ticketSubject} [#${ticketId.slice(0, 8).toUpperCase()}]`,
    html:    buildReplyHtml({ userName, ticketId, ticketSubject, adminReply, originalMessage }),
  });
}

// ─── Send confirmation email after ticket submit ──────────────────────────────
export async function sendConfirmEmail({
  toEmail,
  toName,
  ticketId,
  ticketSubject,
  priority,
}: {
  toEmail: string;
  toName: string | null;
  ticketId: string;
  ticketSubject: string;
  priority: string;
}) {
  const userName = toName ?? toEmail.split("@")[0];

  await resend.emails.send({
    from:    env.SUPPORT_FROM_EMAIL,
    to:      toEmail,
    subject: `We received your request: ${ticketSubject} [#${ticketId.slice(0, 8).toUpperCase()}]`,
    html:    buildConfirmHtml({ userName, ticketId, ticketSubject, priority }),
  });
}

// ─── HTML Templates ───────────────────────────────────────────────────────────
function buildReplyHtml({
  userName, ticketId, ticketSubject, adminReply, originalMessage,
}: {
  userName: string; ticketId: string; ticketSubject: string;
  adminReply: string; originalMessage: string;
}) {
  const safe = (s: string) => s.replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br/>");
  const shortId = ticketId.slice(0, 8).toUpperCase();

  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 0;">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08);">
      <tr><td style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:32px 40px;">
        <h1 style="margin:0;color:#fff;font-size:22px;font-weight:700;">LyraAI Support</h1>
        <p style="margin:6px 0 0;color:rgba(255,255,255,.8);font-size:13px;">Reply to your support ticket</p>
      </td></tr>
      <tr><td style="padding:32px 40px;">
        <p style="margin:0 0 6px;color:#71717a;font-size:13px;">Hi <strong style="color:#18181b;">${userName}</strong>,</p>
        <p style="margin:0 0 24px;color:#18181b;font-size:15px;line-height:1.6;">
          We've replied to your ticket: <strong style="color:#6366f1;">${safe(ticketSubject)}</strong>
          <span style="display:inline-block;margin-left:8px;background:#f0f0ff;color:#6366f1;font-size:11px;font-weight:700;padding:2px 8px;border-radius:20px;">#${shortId}</span>
        </p>
        <div style="background:#f8f8ff;border-left:4px solid #6366f1;border-radius:0 8px 8px 0;padding:20px 24px;margin-bottom:24px;">
          <p style="margin:0 0 10px;color:#6366f1;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;">Support Team Reply</p>
          <p style="margin:0;color:#18181b;font-size:15px;line-height:1.7;">${safe(adminReply)}</p>
        </div>
        <div style="background:#fafafa;border:1px solid #e4e4e7;border-radius:8px;padding:16px 20px;margin-bottom:24px;">
          <p style="margin:0 0 8px;color:#a1a1aa;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;">Your Original Message</p>
          <p style="margin:0;color:#71717a;font-size:14px;line-height:1.6;">${safe(originalMessage)}</p>
        </div>
        <p style="margin:0;color:#71717a;font-size:13px;line-height:1.6;">If you have further questions, reply to this email or submit a new ticket.</p>
      </td></tr>
      <tr><td style="background:#fafafa;border-top:1px solid #f0f0f0;padding:20px 40px;">
        <p style="margin:0;color:#a1a1aa;font-size:12px;">
          Ticket ID: <code style="color:#6366f1;">#${shortId}</code> &nbsp;·&nbsp;
          <a href="mailto:${env.SUPPORT_FROM_EMAIL}" style="color:#6366f1;text-decoration:none;">${env.SUPPORT_FROM_EMAIL}</a>
        </p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}

function buildConfirmHtml({
  userName, ticketId, ticketSubject, priority,
}: {
  userName: string; ticketId: string; ticketSubject: string; priority: string;
}) {
  const shortId = ticketId.slice(0, 8).toUpperCase();
  const priorityColor = priority === "high" ? "#ef4444" : priority === "medium" ? "#f59e0b" : "#22c55e";

  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 0;">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08);">
      <tr><td style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:32px 40px;">
        <h1 style="margin:0;color:#fff;font-size:22px;font-weight:700;">LyraAI Support</h1>
        <p style="margin:6px 0 0;color:rgba(255,255,255,.8);font-size:13px;">Ticket received — we'll be in touch soon</p>
      </td></tr>
      <tr><td style="padding:32px 40px;">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:24px;">
          <div style="width:48px;height:48px;background:#f0fdf4;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:24px;">✅</div>
          <div>
            <p style="margin:0;font-size:18px;font-weight:700;color:#18181b;">Ticket Submitted!</p>
            <p style="margin:4px 0 0;color:#71717a;font-size:13px;">Ticket ID: <strong style="color:#6366f1;">#${shortId}</strong></p>
          </div>
        </div>
        <p style="margin:0 0 20px;color:#18181b;font-size:15px;line-height:1.6;">
          Hi <strong>${userName}</strong>, we received your request about:<br/>
          <strong style="color:#6366f1;">${ticketSubject}</strong>
        </p>
        <div style="display:flex;gap:12px;margin-bottom:24px;">
          <div style="flex:1;background:#fafafa;border:1px solid #e4e4e7;border-radius:8px;padding:14px 16px;text-align:center;">
            <p style="margin:0 0 4px;color:#a1a1aa;font-size:11px;text-transform:uppercase;letter-spacing:.5px;">Priority</p>
            <p style="margin:0;font-weight:700;font-size:14px;color:${priorityColor};text-transform:capitalize;">${priority}</p>
          </div>
          <div style="flex:1;background:#fafafa;border:1px solid #e4e4e7;border-radius:8px;padding:14px 16px;text-align:center;">
            <p style="margin:0 0 4px;color:#a1a1aa;font-size:11px;text-transform:uppercase;letter-spacing:.5px;">Response Time</p>
            <p style="margin:0;font-weight:700;font-size:14px;color:#18181b;">4–8 hours</p>
          </div>
        </div>
        <p style="margin:0;color:#71717a;font-size:13px;line-height:1.6;">Our support team will review your ticket and respond via email.</p>
      </td></tr>
      <tr><td style="background:#fafafa;border-top:1px solid #f0f0f0;padding:20px 40px;">
        <p style="margin:0;color:#a1a1aa;font-size:12px;">
          Ticket ID: <code style="color:#6366f1;">#${shortId}</code> &nbsp;·&nbsp;
          <a href="mailto:${env.SUPPORT_FROM_EMAIL}" style="color:#6366f1;text-decoration:none;">${env.SUPPORT_FROM_EMAIL}</a>
        </p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}