import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM =
  process.env.RESEND_FROM || "Rivorea Notes <onboarding@resend.dev>";

export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}) {
  try {
    const { error } = await resend.emails.send({ from: FROM, to, subject, html });
    if (error) {
      console.error("Resend error:", error);
    }
  } catch (error) {
    console.error("Failed to send email:", error);
  }
}

export function resetPasswordEmailHTML(url: string, name: string) {
  return `
<!DOCTYPE html>
<html>
  <body style="margin:0;padding:0;background:#f4f4f5;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td align="center" style="padding:40px 16px;">
          <table role="presentation" width="100%" style="max-width:480px;background:#ffffff;border-radius:12px;border:1px solid #e4e4e7;padding:32px;">
            <tr>
              <td>
                <h1 style="margin:0 0 8px;font-size:20px;color:#18181b;">Reset your password</h1>
                <p style="margin:0 0 16px;font-size:14px;color:#71717a;">
                  Hi ${name || "there"},
                </p>
                <p style="margin:0 0 24px;font-size:14px;color:#52525b;line-height:1.6;">
                  We received a request to reset the password for your Rivorea Notes account.
                  Click the button below to choose a new password. This link expires in 1 hour.
                </p>
                <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
                  <tr>
                    <td style="background:#18181b;border-radius:8px;">
                      <a href="${url}" style="display:inline-block;padding:12px 24px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;">
                        Reset password
                      </a>
                    </td>
                  </tr>
                </table>
                <p style="margin:0 0 8px;font-size:13px;color:#a1a1aa;">
                  If the button doesn't work, paste this link into your browser:
                </p>
                <p style="margin:0 0 24px;font-size:13px;word-break:break-all;">
                  <a href="${url}" style="color:#2563eb;">${url}</a>
                </p>
                <p style="margin:0;font-size:13px;color:#a1a1aa;">
                  If you didn't request a password reset, you can safely ignore this email.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}
