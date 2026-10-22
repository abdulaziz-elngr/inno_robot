/**
 * Password reset delivery.
 *
 * Default transport is `console`: the reset link is printed to the server log. This keeps
 * the recovery flow fully functional in local development without pretending email is set up.
 * Production deployments should plug a transactional email provider in here (Resend, SES,
 * Postmark, ...) — see docs/DEPLOYMENT.md. The link itself is always generated server-side
 * from APP_BASE_URL and never exposed through a public API response.
 */
export async function sendPasswordResetEmail(to: string, url: string, name: string): Promise<void> {
  const provider = process.env.EMAIL_PROVIDER ?? "console";
  if (provider === "console" || !process.env.EMAIL_API_KEY) {
    console.warn(`\n[email:console] Password reset for ${name} <${to}>\n  ${url}\n`);
    return;
  }
  if (provider === "resend") {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${process.env.EMAIL_API_KEY}` },
        body: JSON.stringify({
          from: process.env.EMAIL_FROM ?? "Inno Robot <no-reply@inno-robot.local>",
          to: [to],
          subject: "Inno Robot — password reset",
          text: `Hello ${name},\n\nReset your password (valid 1 hour):\n${url}\n\nIf you did not request this, ignore this message.`,
        }),
      });
      if (!res.ok) console.error("[email] resend failed:", res.status, (await res.text().catch(() => "")).slice(0, 200));
    } catch (error) {
      console.error("[email] resend error:", error instanceof Error ? error.message : error);
    }
    return;
  }
  console.warn(`[email] unknown EMAIL_PROVIDER "${provider}" — reset link for ${to}: ${url}`);
}
