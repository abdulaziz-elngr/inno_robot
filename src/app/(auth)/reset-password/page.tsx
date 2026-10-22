"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useI18n } from "@/lib/i18n/provider";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";

function ResetForm() {
  const { t } = useI18n();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (password !== confirm) {
      setError(t("public.auth.confirmPassword"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/reset", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, newPassword: password }),
      });
      if (!res.ok) {
        setError(t("public.auth.resetInvalid"));
        return;
      }
      setDone(true);
    } catch {
      setError(t("public.auth.resetInvalid"));
    } finally {
      setBusy(false);
    }
  }

  if (!token || done) {
    return (
      <div>
        <p className="rounded-xl border border-warning/30 bg-warning/8 px-4 py-3 text-sm text-muted" role="status">
          {done ? t("public.auth.resetDone") : t("public.auth.resetInvalid")}
        </p>
        <Link href="/login" className="mt-4 inline-block text-sm text-primary hover:underline">
          {t("public.auth.backToLogin")}
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <Field label={t("public.auth.newPassword")} htmlFor="new-password" required error={error}>
        <Input id="new-password" name="new-password" type="password" autoComplete="new-password" required value={password} onChange={(e) => setPassword(e.target.value)} dir="ltr" />
      </Field>
      <Field label={t("public.auth.confirmPassword")} htmlFor="confirm-password" required>
        <Input id="confirm-password" name="confirm-password" type="password" autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} dir="ltr" />
      </Field>
      <Button type="submit" className="w-full" loading={busy}>
        {t("public.auth.resetTitle")}
      </Button>
    </form>
  );
}

export default function ResetPasswordPage() {
  const { t } = useI18n();
  return (
    <div className="surface p-6">
      <h1 className="text-xl font-bold text-fg">{t("public.auth.resetTitle")}</h1>
      <p className="mt-1 mb-5 text-sm text-muted">{t("public.auth.resetSubtitle")}</p>
      <Suspense>
        <ResetForm />
      </Suspense>
    </div>
  );
}
