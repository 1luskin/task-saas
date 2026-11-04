import "server-only";
import { APP_NAME } from "@/config/app";

/**
 * E-Mail-Versand über Brevo (EU, Paris) – ohne BREVO_API_KEY wird nur protokolliert (ohne Adresse).
 * Andere Anbieter: nur diese Datei austauschen.
 */
export interface Mail {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export async function sendEmail(mail: Mail): Promise<boolean> {
  const key = process.env.BREVO_API_KEY;
  const from = process.env.EMAIL_FROM ?? "noreply@example.de";
  if (!key) {
    console.info(`[email] (kein BREVO_API_KEY) Betreff: ${mail.subject}`);
    return false;
  }
  try {
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": key, "Content-Type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        sender: { email: from, name: process.env.EMAIL_FROM_NAME ?? APP_NAME },
        to: [{ email: mail.to }],
        subject: mail.subject,
        htmlContent: mail.html,
        textContent: mail.text,
      }),
    });
    if (!res.ok) console.error("[email] Versand fehlgeschlagen", res.status);
    return res.ok;
  } catch (e) {
    console.error("[email]", (e as Error).message);
    return false;
  }
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Einheitliches, dunkles Layout (inline-CSS, mailtauglich). Alle Inhalte werden escaped. */
export function layout(opts: { title: string; lines: string[]; cta?: { label: string; url: string }; footer?: string }): { html: string; text: string } {
  const html = `<!doctype html><html><body style="margin:0;background:#1E2125;font-family:Arial,Helvetica,sans-serif;color:#ECEEF0">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#1E2125;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" style="max-width:560px;background:#272B30;border-radius:18px;padding:28px">
<tr><td style="font-size:14px;color:#A0A8B1;padding-bottom:12px">${esc(APP_NAME)}</td></tr>
<tr><td style="font-size:22px;font-weight:bold;padding-bottom:16px">${esc(opts.title)}</td></tr>
${opts.lines.map((l) => `<tr><td style="font-size:15px;line-height:1.5;color:#C8CDD3;padding-bottom:10px">${esc(l)}</td></tr>`).join("")}
${opts.cta ? `<tr><td style="padding:14px 0"><a href="${esc(opts.cta.url)}" style="display:inline-block;background:#56728A;color:#ffffff;text-decoration:none;font-weight:bold;padding:14px 22px;border-radius:12px">${esc(opts.cta.label)}</a></td></tr>` : ""}
<tr><td style="font-size:12px;color:#A0A8B1;padding-top:16px">${esc(opts.footer ?? "")}</td></tr>
</table></td></tr></table></body></html>`;
  const text = [opts.title, "", ...opts.lines, opts.cta ? `\n${opts.cta.label}: ${opts.cta.url}` : "", opts.footer ? `\n${opts.footer}` : ""].join("\n");
  return { html, text };
}
