import type { Metadata } from "next";
import Link from "next/link";
import { Search, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input, Select } from "@/components/ui/field";
import { getServerI18n } from "@/lib/i18n/server";
import { listBuildings, listPublishedLocations } from "@/server/services/locations";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getServerI18n();
  return { title: t("public.campus.title") };
}

/** Public campus directory: search + filter over published locations only. */
export default async function CampusPage({ searchParams }: { searchParams: Promise<{ q?: string; building?: string }> }) {
  const { t, locale } = await getServerI18n();
  const params = await searchParams;
  const q = params.q?.trim() || undefined;
  const buildingId = params.building || undefined;

  const [locations, buildings] = await Promise.all([
    listPublishedLocations({ q, buildingId, limit: 60 }),
    listBuildings(),
  ]);

  return (
    <div className="container-page py-10">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-fg">{t("public.campus.title")}</h1>
        <p className="mt-2 text-muted">{t("public.campus.subtitle")}</p>
      </header>

      {/* Search + filter */}
      <form className="mb-6 flex flex-col gap-3 sm:flex-row" method="get">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-subtle" aria-hidden />
          <Input name="q" defaultValue={q ?? ""} placeholder={t("public.campus.searchPlaceholder")} className="ps-9" aria-label={t("public.campus.searchPlaceholder")} />
        </div>
        <Select name="building" defaultValue={buildingId ?? ""} aria-label={t("public.campus.allBuildings")} className="sm:w-64">
          <option value="">{t("public.campus.allBuildings")}</option>
          {buildings.map((building) => (
            <option key={building.id} value={building.id}>
              {locale === "ar" ? building.nameAr : building.nameEn}
            </option>
          ))}
        </Select>
        <button type="submit" className="inline-flex h-10 items-center rounded-xl bg-primary px-5 text-sm font-semibold text-white transition-colors hover:bg-primary-deep">
          {t("public.campus.searchPlaceholder")}
        </button>
      </form>

      <p className="mb-4 text-sm text-subtle">{t("public.campus.resultsCount", { count: locations.length })}</p>

      {locations.length === 0 ? (
        <div className="surface flex flex-col items-center gap-2 py-16 text-center">
          <MapPin className="size-8 text-subtle" aria-hidden />
          <p className="font-medium text-fg">{t("public.campus.empty")}</p>
          <p className="text-sm text-muted">{t("public.campus.emptyHint")}</p>
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {locations.map((location) => (
            <li key={location.id}>
              <Link href={`/campus/${location.id}`} className="surface block h-full p-5 transition-colors hover:border-primary/40">
                <div className="flex items-start justify-between gap-2">
                  <h2 className="font-semibold text-fg">{locale === "ar" ? location.nameAr : location.nameEn}</h2>
                  {location.navigable && <Badge variant="success">{t("public.campus.navigationAvailable")}</Badge>}
                </div>
                {location.buildingNameEn && (
                  <p className="mt-2 text-sm text-muted">
                    {t("public.campus.building")}: {locale === "ar" ? location.buildingNameAr : location.buildingNameEn}
                    {location.room ? ` · ${t("public.campus.room")} ${location.room}` : ""}
                  </p>
                )}
                {(location.descriptionEn || location.descriptionAr) && (
                  <p className="mt-2 line-clamp-2 text-sm text-subtle">{locale === "ar" ? location.descriptionAr : location.descriptionEn}</p>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
