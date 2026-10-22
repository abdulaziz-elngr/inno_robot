"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useI18n } from "@/lib/i18n/provider";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";

function LoginForm() {
  const { t, locale } = useI18n();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = (await res.json().catch(() => null)) as { code?: string } | null;
      if (!res.ok) {
        setError(data?.code === "RATE_LIMITED" ? t("public.auth.rateLimited") : data?.code === "INACTIVE" ? t("public.auth.inactive") : t("public.auth.invalid"));
        return;
      }
      const next = searchParams.get("next");
      router.replace(next && next.startsWith("/") ? next : "/admin");
      router.refresh();
    } catch {
      setError(t("public.auth.invalid"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <Field label={t("public.auth.email")} htmlFor="email" required>
        <Input id="email" name="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} dir="ltr" />
      </Field>
      <Field label={t("public.auth.password")} htmlFor="password" required error={error}>
        <Input id="password" name="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} dir="ltr" />
      </Field>
      <Button type="submit" className="w-full" loading={busy}>
        {busy ? t("public.auth.signingIn") : t("public.auth.submit")}
      </Button>
      <div className="flex justify-between text-sm">
        <Link href="/forgot-password" className="text-primary hover:underline">
          {t("public.auth.forgot")}
        </Link>
        <Link href="/" className="text-muted hover:text-fg" lang={locale}>
          {t("public.nav.home")}
        </Link>
      </div>
    </form>
  );
}

export default function LoginPage() {
  const { t } = useI18n();
  return (
    <div className="surface p-6">
      <h1 className="text-xl font-bold text-fg">{t("public.auth.loginTitle")}</h1>
      <p className="mt-1 mb-5 text-sm text-muted">{t("public.auth.loginSubtitle")}</p>
      <Suspense>
        <LoginForm />
      </Suspense>
    </div>
  );
}
