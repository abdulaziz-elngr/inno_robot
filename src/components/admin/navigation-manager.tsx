"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { PageHeader, Panel, PanelBody } from "@/components/admin/primitives";
import { adminFetch, useAsyncData } from "@/components/admin/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { useI18n } from "@/lib/i18n/provider";

type Destination = {
  id: string;
  key: string;
  nameEn: string;
  nameAr: string;
  requiresConfirmation: boolean;
  active: boolean;
  locationId: string | null;
  locationKey: string | null;
  locationNavigable: boolean | null;
  routeCount: number;
};
type Route = {
  id: string;
  destinationId: string;
  destinationKey: string;
  destinationNameEn: string;
  destinationNameAr: string;
  mode: "PREDEFINED" | "ESCORT" | "UNAVAILABLE";
  steps: Array<{ en: string; ar: string }>;
  active: boolean;
};
type LocationOption = { id: string; key: string; nameEn: string; nameAr: string; navigable: boolean };

const emptyDestination = { key: "", nameEn: "", nameAr: "", locationId: "", requiresConfirmation: true, active: true };

export function NavigationManager() {
  const { t, locale } = useI18n();
  const toast = useToast();

  const { data: destinationsData, loading, error, reload } = useAsyncData(() => adminFetch<{ rows: Destination[] }>("/api/admin/navigation/destinations"), []);
  const { data: routesData, reload: reloadRoutes } = useAsyncData(() => adminFetch<{ rows: Route[] }>("/api/admin/navigation/routes"), []);
  const { data: locationsData } = useAsyncData(() => adminFetch<{ rows: LocationOption[]; total: number }>("/api/admin/locations?pageSize=100"), []);

  const destinations = destinationsData?.rows ?? [];
  const routes = routesData?.rows ?? [];
  const locations = locationsData?.rows ?? [];

  /* Destination dialog */
  const [destinationDialog, setDestinationDialog] = useState(false);
  const [destinationForm, setDestinationForm] = useState({ ...emptyDestination });
  const [destinationError, setDestinationError] = useState<string | null>(null);

  /* Route dialog */
  const [routeDialog, setRouteDialog] = useState(false);
  const [routeDestinationId, setRouteDestinationId] = useState("");
  const [routeMode, setRouteMode] = useState<Route["mode"]>("PREDEFINED");
  const [routeSteps, setRouteSteps] = useState<Array<{ en: string; ar: string }>>([{ en: "", ar: "" }]);
  const [routeError, setRouteError] = useState<string | null>(null);

  function openDestination(key?: string) {
    const existing = key ? destinations.find((d) => d.key === key) : undefined;
    setDestinationForm(
      existing
        ? {
            key: existing.key,
            nameEn: existing.nameEn,
            nameAr: existing.nameAr,
            locationId: existing.locationId ?? "",
            requiresConfirmation: existing.requiresConfirmation,
            active: existing.active,
          }
        : { ...emptyDestination },
    );
    setDestinationError(null);
    setDestinationDialog(true);
  }

  async function saveDestination() {
    const payload = {
      key: destinationForm.key,
      nameEn: destinationForm.nameEn,
      nameAr: destinationForm.nameAr,
      locationId: destinationForm.locationId || null,
      requiresConfirmation: destinationForm.requiresConfirmation,
      active: destinationForm.active,
    };
    try {
      await adminFetch("/api/admin/navigation/destinations", { method: "POST", body: JSON.stringify(payload) });
      toast({ title: t("admin.content.navigation.saved"), variant: "success" });
      setDestinationDialog(false);
      reload();
    } catch (e) {
      setDestinationError(e instanceof Error ? e.message : t("admin.common.loadError"));
    }
  }

  async function removeDestination(row: Destination) {
    if (!window.confirm(t("admin.common.deleteTitle", { name: row.nameEn }))) return;
    try {
      await adminFetch(`/api/admin/navigation/destinations/${row.id}`, { method: "DELETE" });
      toast({ title: t("admin.common.deleted"), variant: "success" });
      reload();
      reloadRoutes();
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : t("admin.common.loadError"), variant: "error" });
    }
  }

  function openRoute(destinationId: string) {
    const existing = routes.find((r) => r.destinationId === destinationId);
    setRouteDestinationId(destinationId);
    setRouteMode(existing?.mode ?? "PREDEFINED");
    setRouteSteps(existing?.steps?.length ? existing.steps.map((s) => ({ en: s.en, ar: s.ar })) : [{ en: "", ar: "" }]);
    setRouteError(null);
    setRouteDialog(true);
  }

  async function saveRoute() {
    const steps = routeSteps
      .map((s) => ({ en: s.en.trim(), ar: s.ar.trim() }))
      .filter((s) => s.en || s.ar);
    if (!steps.length) {
      setRouteError(t("admin.content.navigation.addStep"));
      return;
    }
    try {
      await adminFetch("/api/admin/navigation/routes", {
        method: "POST",
        body: JSON.stringify({ destinationId: routeDestinationId, mode: routeMode, steps, active: true }),
      });
      toast({ title: t("admin.content.navigation.saved"), variant: "success" });
      setRouteDialog(false);
      reloadRoutes();
      reload();
    } catch (e) {
      setRouteError(e instanceof Error ? e.message : t("admin.common.loadError"));
    }
  }

  return (
    <div>
      <PageHeader
        title={t("admin.content.navigation.title")}
        description={t("admin.content.navigation.description")}
        actions={
          <Button onClick={() => openDestination()}>
            <Plus className="size-4" aria-hidden />
            {t("admin.content.navigation.addDestination")}
          </Button>
        }
      />

      <Panel className="mb-6">
        <div className="border-b border-border/70 px-5 py-4">
          <h2 className="text-sm font-semibold text-fg">{t("admin.content.navigation.destinations")}</h2>
          <p className="mt-0.5 text-xs text-muted">{t("admin.content.navigation.destinationsHint")}</p>
        </div>
        {loading ? (
          <div className="space-y-2 p-4">
            <div className="skeleton h-10 w-full" />
          </div>
        ) : error ? (
          <PanelBody>
            <p className="text-sm text-error">{error}</p>
          </PanelBody>
        ) : destinations.length === 0 ? (
          <EmptyState title={t("admin.content.navigation.emptyDestinations")} description={t("admin.content.navigation.destinationsHint")} />
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>{t("admin.common.key")}</TH>
                <TH>{t("admin.common.nameEn")}</TH>
                <TH>{t("admin.content.navigation.location")}</TH>
                <TH>{t("admin.content.navigation.mode")}</TH>
                <TH>{t("common.status")}</TH>
                <TH className="text-end">{t("common.actions")}</TH>
              </TR>
            </THead>
            <TBody>
              {destinations.map((row) => (
                <TR key={row.id}>
                  <TD className="font-mono text-xs">{row.key}</TD>
                  <TD className="font-medium">{locale === "ar" ? row.nameAr : row.nameEn}</TD>
                  <TD className="text-muted">{row.locationKey ?? t("admin.content.navigation.noLocation")}</TD>
                  <TD>
                    <Badge variant={row.routeCount > 0 ? "info" : "outline"}>{row.routeCount > 0 ? t("admin.content.navigation.routes") : "â€”"}</Badge>
                  </TD>
                  <TD>
                    <div className="flex gap-1">
                      <Badge variant={row.active ? "success" : "outline"}>{row.active ? t("admin.content.navigation.active") : t("common.inactive")}</Badge>
                      {row.requiresConfirmation && <Badge variant="warning">{t("admin.content.navigation.requiresConfirmation")}</Badge>}
                    </div>
                  </TD>
                  <TD>
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={() => openRoute(row.id)}>
                        {t("admin.content.navigation.routes")}
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => openDestination(row.key)}>
                        {t("common.edit")}
                      </Button>
                      <Button variant="ghost" size="sm" className="text-error" onClick={() => void removeDestination(row)}>
                        {t("common.delete")}
                      </Button>
                    </div>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Panel>

      <Panel>
        <div className="border-b border-border/70 px-5 py-4">
          <h2 className="text-sm font-semibold text-fg">{t("admin.content.navigation.routes")}</h2>
          <p className="mt-0.5 text-xs text-muted">{t("admin.content.navigation.routesHint")}</p>
        </div>
        {routes.length === 0 ? (
          <EmptyState title={t("admin.content.navigation.emptyRoutes")} description={t("admin.content.navigation.noDestination")} />
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>{t("admin.content.navigation.destination")}</TH>
                <TH>{t("admin.content.navigation.mode")}</TH>
                <TH>{t("admin.content.navigation.stepEn")}</TH>
                <TH>{t("common.status")}</TH>
                <TH className="text-end">{t("common.actions")}</TH>
              </TR>
            </THead>
            <TBody>
              {routes.map((row) => (
                <TR key={row.id}>
                  <TD className="font-medium">{locale === "ar" ? row.destinationNameAr : row.destinationNameEn}</TD>
                  <TD>
                    <Badge variant="outline">
                      {row.mode === "PREDEFINED"
                        ? t("admin.content.navigation.modePredefined")
                        : row.mode === "ESCORT"
                          ? t("admin.content.navigation.modeEscort")
                          : t("admin.content.navigation.modeUnavailable")}
                    </Badge>
                  </TD>
                  <TD className="max-w-md text-xs text-muted">
                    <ol className="list-decimal ps-4">
                      {row.steps.slice(0, 3).map((step, index) => (
                        <li key={index}>{locale === "ar" ? step.ar : step.en}</li>
                      ))}
                      {row.steps.length > 3 && <li>â€¦</li>}
                    </ol>
                  </TD>
                  <TD>
                    <Badge variant={row.active ? "success" : "outline"}>{row.active ? t("admin.content.navigation.active") : t("common.inactive")}</Badge>
                  </TD>
                  <TD>
                    <div className="flex justify-end">
                      <Button variant="ghost" size="sm" onClick={() => openRoute(row.destinationId)}>
                        {t("common.edit")}
                      </Button>
                    </div>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Panel>

      {/* Destination dialog */}
      <Dialog
        open={destinationDialog}
        onClose={() => setDestinationDialog(false)}
        title={t("admin.content.navigation.addDestination")}
        footer={
          <>
            <Button variant="outline" onClick={() => setDestinationDialog(false)}>
              {t("common.cancel")}
            </Button>
            <Button onClick={() => void saveDestination()} disabled={!destinationForm.key || !destinationForm.nameEn || !destinationForm.nameAr}>
              {t("common.save")}
            </Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("admin.common.key")} required error={destinationError}>
            <Input value={destinationForm.key} onChange={(e) => setDestinationForm({ ...destinationForm, key: e.target.value })} dir="ltr" />
          </Field>
          <Field label={t("admin.content.navigation.location")}>
            <Select value={destinationForm.locationId} onChange={(e) => setDestinationForm({ ...destinationForm, locationId: e.target.value })}>
              <option value="">{t("admin.content.navigation.noLocation")}</option>
              {locations.map((location) => (
                <option key={location.id} value={location.id}>
                  {locale === "ar" ? location.nameAr : location.nameEn}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t("admin.common.nameEn")} required>
            <Input value={destinationForm.nameEn} onChange={(e) => setDestinationForm({ ...destinationForm, nameEn: e.target.value })} dir="ltr" />
          </Field>
          <Field label={t("admin.common.nameAr")} required>
            <Input value={destinationForm.nameAr} onChange={(e) => setDestinationForm({ ...destinationForm, nameAr: e.target.value })} dir="rtl" />
          </Field>
          <div className="flex items-center gap-6 pt-2">
            <Switch
              checked={destinationForm.requiresConfirmation}
              onChange={(checked) => setDestinationForm({ ...destinationForm, requiresConfirmation: checked })}
              label={t("admin.content.navigation.requiresConfirmation")}
            />
            <Switch checked={destinationForm.active} onChange={(checked) => setDestinationForm({ ...destinationForm, active: checked })} label={t("admin.content.navigation.active")} />
          </div>
        </div>
      </Dialog>

      {/* Route dialog */}
      <Dialog
        open={routeDialog}
        onClose={() => setRouteDialog(false)}
        title={t("admin.content.navigation.addRoute")}
        className="max-w-2xl"
        footer={
          <>
            <Button variant="outline" onClick={() => setRouteDialog(false)}>
              {t("common.cancel")}
            </Button>
            <Button onClick={() => void saveRoute()}>{t("common.save")}</Button>
          </>
        }
      >
        <div className="grid max-h-[60vh] gap-4 overflow-y-auto">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("admin.content.navigation.destination")}>
              <Select value={routeDestinationId} onChange={(e) => setRouteDestinationId(e.target.value)}>
                {destinations.map((destination) => (
                  <option key={destination.id} value={destination.id}>
                    {locale === "ar" ? destination.nameAr : destination.nameEn}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t("admin.content.navigation.mode")}>
              <Select value={routeMode} onChange={(e) => setRouteMode(e.target.value as Route["mode"])}>
                <option value="PREDEFINED">{t("admin.content.navigation.modePredefined")}</option>
                <option value="ESCORT">{t("admin.content.navigation.modeEscort")}</option>
                <option value="UNAVAILABLE">{t("admin.content.navigation.modeUnavailable")}</option>
              </Select>
            </Field>
          </div>

          <div className="space-y-3">
            {routeSteps.map((step, index) => (
              <div key={index} className="grid gap-3 rounded-xl border border-border/70 p-3 sm:grid-cols-[1fr_1fr_auto]">
                <Field label={`${t("admin.content.navigation.stepEn")} ${index + 1}`}>
                  <Input value={step.en} onChange={(e) => setRouteSteps(routeSteps.map((s, i) => (i === index ? { ...s, en: e.target.value } : s)))} dir="ltr" />
                </Field>
                <Field label={`${t("admin.content.navigation.stepAr")} ${index + 1}`}>
                  <Input value={step.ar} onChange={(e) => setRouteSteps(routeSteps.map((s, i) => (i === index ? { ...s, ar: e.target.value } : s)))} dir="rtl" />
                </Field>
                <div className="flex items-end pb-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setRouteSteps(routeSteps.length > 1 ? routeSteps.filter((_, i) => i !== index) : routeSteps)}
                    disabled={routeSteps.length === 1}
                  >
                    {t("admin.content.navigation.removeStep")}
                  </Button>
                </div>
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setRouteSteps([...routeSteps, { en: "", ar: "" }])}
              disabled={routeSteps.length >= 30}
            >
              <Plus className="size-4" aria-hidden />
              {t("admin.content.navigation.addStep")}
            </Button>
            {routeError && (
              <p role="alert" className="text-xs font-medium text-error">
                {routeError}
              </p>
            )}
          </div>
        </div>
      </Dialog>
    </div>
  );
}
