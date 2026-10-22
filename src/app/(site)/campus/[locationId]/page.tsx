import Link from "next/link";
import { notFound } from "next/navigation";
import { Accessibility, ArrowRight, MapPin, Navigation } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { getServerI18n } from "@/lib/i18n/server";
import { getLocationDetail } from "@/server/services/locations";

export const dynamic = "force-dynamic";

/** Public location detail: verified description + published directions. */
export default async function LocationDetailPage({ params }: { params: Promise<{ locationId: string }> }) {
  const { locationId } = await params;
  const { t, locale } = await getServerI18n();

  const detail = await getLocationDetail(locationId).catch(() => null);
  if (!detail || !detail.location.published) notFound();

  const location = detail.location;
  const name = locale === "ar" ? location.nameAr : location.nameEn;
  const description = locale === "ar" ? location.descriptionAr : location.descriptionEn;
  const directions = locale === "ar" ? location.directionsAr : location.directionsEn;
  const accessibility = location.accessibilityNotes;

  return (
    <div className="container-page max-w-3xl py-10">
      <nav className="mb-6 text-sm text-muted" aria-label="Breadcrumb">
        <Link href="/campus" className="hover:text-primary">{t("public.campus.title")}</Link>
        <span className="mx-2" aria-hidden>/</span>
        <span className="text-fg">{name}</span>
      </nav>

      <header className="mb-6">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-bold text-fg">{name}</h1>
          <Badge variant={location.navigable ? "success" : "outline"}>
            {location.navigable ? t("public.campus.navigationAvailable") : t("public.campus.navigationUnavailable")}
          </Badge>
        </div>

        <dl className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted">
          {detail.building && (
            <div className="flex items-center gap-1.5">
              <MapPin className="size-4 text-primary" aria-hidden />
              <dt className="sr-only">{t("public.campus.building")}</dt>
              <dd>
                {t("public.campus.building")}: {locale === "ar" ? detail.building.nameAr : detail.building.nameEn}
                {location.room ? ` · ${t("public.campus.room")} ${location.room}` : ""}
              </dd>
            </div>
          )}
          {detail.floor && (
            <div>
              <dt className="sr-only">{t("public.campus.floor")}</dt>
              <dd>{t("public.campus.floor")}: {locale === "ar" ? detail.floor.labelAr : detail.floor.labelEn}</dd>
            </div>
          )}
        </dl>
      </header>

      {description && (
        <section className="surface mb-6 p-5">
          <h2 className="font-semibold text-fg">{t("public.campus.title")}</h2>
          <p className="mt-2 leading-relaxed text-muted">{description}</p>
        </section>
      )}

      {directions && (
        <section className="surface mb-6 p-5">
          <h2 className="flex items-center gap-2 font-semibold text-fg">
            <ArrowRight className="size-4 text-primary" aria-hidden />
            {t("public.campus.directions")}
          </h2>
          <p className="mt-2 leading-relaxed text-muted">{directions}</p>
        </section>
      )}

      {accessibility && (
        <section className="surface mb-6 p-5">
          <h2 className="flex items-center gap-2 font-semibold text-fg">
            <Accessibility className="size-4 text-primary" aria-hidden />
            {t("public.campus.accessibility")}
          </h2>
          <p className="mt-2 leading-relaxed text-muted">{accessibility}</p>
        </section>
      )}

      <div className="flex flex-wrap gap-3">
        <Link
          href={`/assistant?topic=${encodeURIComponent(name)}`}
          className="inline-flex h-11 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-white transition-colors hover:bg-primary-deep"
        >
          <Navigation className="size-4" aria-hidden />
          {t("public.campus.askRobot")}
        </Link>
      </div>
    </div>
  );
}
