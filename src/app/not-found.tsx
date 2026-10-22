import Link from "next/link";
import { getServerI18n } from "@/lib/i18n/server";
import { RobotMark } from "@/components/brand/logo";

export default async function NotFound() {
  const { t } = await getServerI18n();
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-bg px-4 text-center">
      <RobotMark className="size-16 opacity-90" />
      <div>
        <p className="text-sm font-semibold text-primary">404</p>
        <h1 className="mt-1 text-2xl font-bold text-fg">{t("public.notFound.title")}</h1>
        <p className="mt-2 text-sm text-muted">{t("public.notFound.body")}</p>
      </div>
      <Link href="/" className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-deep">
        {t("public.notFound.backHome")}
      </Link>
    </div>
  );
}
