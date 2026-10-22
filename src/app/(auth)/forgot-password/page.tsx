"use client";

import { useState } from "react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n/provider";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";

/** Password reset request. The response is identical whether or not the email exists. */
export default function ForgotPasswordPage() {
  const { t } = useI18n();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await fetch("/api/auth/forgot", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });
    } catch {
      /* the success message is deliberately identical on network errors (no account leakage) */
    } finally {
      setBusy(false);
      setSent(true);
    }
  }

  return (
    <div className="surface p-6">
      <h1 className="text-xl font-bold text-fg">{t("public.auth.forgotTitle")}</h1>
      <p className="mt-1 mb-5 text-sm text-muted">{t("public.auth.forgotSubtitle")}</p>
      {sent ? (
        <div>
          <p className="rounded-xl border border-success/30 bg-success/8 px-4 py-3 text-sm text-muted" role="status">
            {t("public.auth.forgotSent")}
          </p>
          <Link href="/login" className="mt-4 inline-block text-sm text-primary hover:underline">
            {t("public.auth.backToLogin")}
          </Link>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <Field label={t("public.auth.email")} htmlFor="email" required>
            <Input id="email" name="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} dir="ltr" />
          </Field>
          <Button type="submit" className="w-full" loading={busy}>
            {t("public.auth.sendReset")}
          </Button>
          <Link href="/login" className="block text-center text-sm text-primary hover:underline">
            {t("public.auth.backToLogin")}
          </Link>
        </form>
      )}
    </div>
  );
}
