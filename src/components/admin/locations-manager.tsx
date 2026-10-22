"use client";

import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { PageHeader, Panel, PanelBody } from "@/components/admin/primitives";
import { adminFetch, useAsyncData } from "@/components/admin/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { useI18n } from "@/lib/i18n/provider";

type Building = { id: string; code: string; nameEn: string; nameAr: string; orderIndex: number };
type Floor = { id: string; buildingId: string; labelEn: string; labelAr: string; orderIndex: number };
type LocationRow = {
  id: string;
  key: string;
  nameEn: string;
  nameAr: string;
  buildingId: string | null;
  buildingNameEn: string | null;
  room: string | null;
  published: boolean;
  navigable: boolean;
  imageUrl: string | null;
};

const emptyLocation = {
  key: "",
  nameEn: "",
  nameAr: "",
  descriptionEn: "",
  descriptionAr: "",
  directionsEn: "",
  directionsAr: "",
  buildingId: "",
  floorId: "",
  room: "",
  latitude: "",
  longitude: "",
  imageUrl: "",
  accessibilityNotes: "",
  published: false,
  navigable: false,
};

const emptyBuilding = { code: "", nameEn: "", nameAr: "", orderIndex: "0" };
const emptyFloor = { buildingId: "", labelEn: "", labelAr: "", orderIndex: "0" };

const PAGE_SIZE = 20;

export function LocationsManager({ initialPage }: { initialPage: number }) {
  const { t, locale } = useI18n();
  const toast = useToast();

  const [tab, setTab] = useState<"locations" | "buildings">("locations");
  const [page, setPage] = useState(initialPage);
  const [q, setQ] = useState("");
  const [buildingFilter, setBuildingFilter] = useState("");

  const [locationDialog, setLocationDialog] = useState(false);
  const [editingLocation, setEditingLocation] = useState<LocationRow | null>(null);
  const [locationForm, setLocationForm] = useState({ ...emptyLocation });
  const [locationError, setLocationError] = useState<string | null>(null);
  const [savingLocation, setSavingLocation] = useState(false);

  const [buildingDialog, setBuildingDialog] = useState(false);
  const [editingBuilding, setEditingBuilding] = useState<Building | null>(null);
  const [buildingForm, setBuildingForm] = useState({ ...emptyBuilding });
  const [buildingError, setBuildingError] = useState<string | null>(null);

  const [floorDialog, setFloorDialog] = useState(false);
  const [floorForm, setFloorForm] = useState({ ...emptyFloor });
  const [floorError, setFloorError] = useState<string | null>(null);

  const query = useMemo(() => {
    const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
    if (q) params.set("q", q);
    if (buildingFilter) params.set("buildingId", buildingFilter);
    return params.toString();
  }, [page, q, buildingFilter]);

  const { data, error, loading, reload } = useAsyncData(
    () => adminFetch<{ rows: LocationRow[]; total: number }>(`/api/admin/locations?${query}`),
    [query],
  );
  const { data: buildingsData, reload: reloadBuildings } = useAsyncData(() => adminFetch<{ rows: Building[] }>("/api/admin/buildings"), [tab]);
  const { data: floorsData, reload: reloadFloors } = useAsyncData(
    () => adminFetch<{ rows: Floor[] }>(`/api/admin/floors${buildingFilter ? `?buildingId=${buildingFilter}` : ""}`),
    [buildingFilter, tab],
  );

  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;
  const buildings = buildingsData?.rows ?? [];
  const floors = floorsData?.rows ?? [];

  /* â”€â”€ Locations â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

  function openCreateLocation() {
    setLocationForm({
      ...emptyLocation,
      buildingId: buildingFilter,
      floorId: floors.find((f) => f.buildingId === buildingFilter)?.id ?? "",
    });
    setEditingLocation(null);
    setLocationError(null);
    setLocationDialog(true);
  }

  function openEditLocation(row: LocationRow) {
    setLocationForm({
      ...emptyLocation,
      key: row.key,
      nameEn: row.nameEn,
      nameAr: row.nameAr,
      buildingId: row.buildingId ?? "",
      floorId: "",
      room: row.room ?? "",
      imageUrl: row.imageUrl ?? "",
      published: row.published,
      navigable: row.navigable,
    });
    setEditingLocation(row);
    setLocationError(null);
    setLocationDialog(true);
  }

  async function saveLocation() {
    setSavingLocation(true);
    setLocationError(null);
    const payload = {
      key: locationForm.key,
      nameEn: locationForm.nameEn,
      nameAr: locationForm.nameAr,
      descriptionEn: locationForm.descriptionEn,
      descriptionAr: locationForm.descriptionAr,
      directionsEn: locationForm.directionsEn,
      directionsAr: locationForm.directionsAr,
      buildingId: locationForm.buildingId || null,
      floorId: locationForm.floorId || null,
      room: locationForm.room,
      latitude: locationForm.latitude === "" ? null : locationForm.latitude,
      longitude: locationForm.longitude === "" ? null : locationForm.longitude,
      imageUrl: locationForm.imageUrl,
      accessibilityNotes: locationForm.accessibilityNotes,
      published: locationForm.published,
      navigable: locationForm.navigable,
    };
    try {
      if (editingLocation) {
        await adminFetch(`/api/admin/locations/${editingLocation.id}`, { method: "PATCH", body: JSON.stringify(payload) });
      } else {
        await adminFetch("/api/admin/locations", { method: "POST", body: JSON.stringify(payload) });
      }
      toast({ title: editingLocation ? t("admin.common.saved") : t("admin.common.created"), variant: "success" });
      setLocationDialog(false);
      setEditingLocation(null);
      reload();
    } catch (e) {
      setLocationError(e instanceof Error ? e.message : t("admin.common.loadError"));
    } finally {
      setSavingLocation(false);
    }
  }

  async function deleteLocation(row: LocationRow) {
    const name = locale === "ar" ? row.nameAr : row.nameEn;
    if (!window.confirm(t("admin.content.locations.deleteTitle", { name }))) return;
    try {
      await adminFetch(`/api/admin/locations/${row.id}`, { method: "DELETE" });
      toast({ title: t("admin.content.locations.deleted"), variant: "success" });
      reload();
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : t("admin.common.loadError"), variant: "error" });
    }
  }

  /* â”€â”€ Buildings â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

  function openCreateBuilding() {
    setBuildingForm({ ...emptyBuilding });
    setEditingBuilding(null);
    setBuildingError(null);
    setBuildingDialog(true);
  }

  function openEditBuilding(row: Building) {
    setBuildingForm({ code: row.code, nameEn: row.nameEn, nameAr: row.nameAr, orderIndex: String(row.orderIndex) });
    setEditingBuilding(row);
    setBuildingError(null);
    setBuildingDialog(true);
  }

  async function saveBuilding() {
    const payload = {
      code: buildingForm.code,
      nameEn: buildingForm.nameEn,
      nameAr: buildingForm.nameAr,
      orderIndex: Number(buildingForm.orderIndex) || 0,
    };
    try {
      if (editingBuilding) {
        await adminFetch(`/api/admin/buildings/${editingBuilding.id}`, { method: "PATCH", body: JSON.stringify(payload) });
      } else {
        await adminFetch("/api/admin/buildings", { method: "POST", body: JSON.stringify(payload) });
      }
      toast({ title: editingBuilding ? t("admin.common.saved") : t("admin.common.created"), variant: "success" });
      setBuildingDialog(false);
      setEditingBuilding(null);
      reloadBuildings();
    } catch (e) {
      setBuildingError(e instanceof Error ? e.message : t("admin.common.loadError"));
    }
  }

  async function saveFloor() {
    if (!floorForm.buildingId) {
      setFloorError(t("admin.content.locations.buildingRequired"));
      return;
    }
    try {
      await adminFetch("/api/admin/floors", {
        method: "POST",
        body: JSON.stringify({
          buildingId: floorForm.buildingId,
          labelEn: floorForm.labelEn,
          labelAr: floorForm.labelAr,
          orderIndex: Number(floorForm.orderIndex) || 0,
        }),
      });
      toast({ title: t("admin.common.created"), variant: "success" });
      setFloorDialog(false);
      reloadFloors();
    } catch (e) {
      setFloorError(e instanceof Error ? e.message : t("admin.common.loadError"));
    }
  }

  const floorsForBuilding = (buildingId: string) => floors.filter((f) => f.buildingId === buildingId);

  return (
    <div>
      <PageHeader
        title={t("admin.content.locations.title")}
        description={t("admin.content.locations.description")}
        actions={
          tab === "locations" ? (
            <Button onClick={openCreateLocation}>
              <Plus className="size-4" aria-hidden />
              {t("admin.content.locations.add")}
            </Button>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={() => {
                  setFloorForm({ ...emptyFloor, buildingId: buildingFilter });
                  setFloorError(null);
                  setFloorDialog(true);
                }}
              >
                <Plus className="size-4" aria-hidden />
                {t("admin.content.locations.addFloor")}
              </Button>
              <Button onClick={openCreateBuilding}>
                <Plus className="size-4" aria-hidden />
                {t("admin.content.locations.addBuilding")}
              </Button>
            </>
          )
        }
      />

      <div className="mb-4 flex gap-1 rounded-lg bg-lavender/60 p-1 dark:bg-primary/10" role="tablist">
        {(["locations", "buildings"] as const).map((key) => (
          <button
            key={key}
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition ${
              tab === "locations" ? "bg-card text-fg shadow-sm" : "text-muted hover:text-fg"
            }`}
          >
            {key === "locations" ? t("admin.content.locations.tabLocations") : t("admin.content.locations.tabBuildings")}
          </button>
        ))}
      </div>

      {tab === "locations" ? (
        <Panel>
          <div className="flex flex-wrap items-center gap-3 border-b border-border/70 px-4 py-3">
            <Input
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
              placeholder={t("admin.content.locations.searchPlaceholder")}
              aria-label={t("common.search")}
              className="max-w-xs flex-1"
            />
            <Select
              value={buildingFilter}
              onChange={(e) => {
                setBuildingFilter(e.target.value);
                setPage(1);
              }}
              aria-label={t("admin.content.locations.building")}
              className="w-48"
            >
              <option value="">{t("admin.content.locations.filterBuilding")}</option>
              {buildings.map((building) => (
                <option key={building.id} value={building.id}>
                  {locale === "ar" ? building.nameAr : building.nameEn}
                </option>
              ))}
            </Select>
          </div>

          {loading ? (
            <div className="space-y-2 p-4">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="skeleton h-10 w-full" />
              ))}
            </div>
          ) : error ? (
            <PanelBody>
              <p className="text-sm text-error">{error}</p>
              <Button variant="outline" size="sm" className="mt-3" onClick={reload}>
                {t("common.retry")}
              </Button>
            </PanelBody>
          ) : rows.length === 0 ? (
            <EmptyState title={t("admin.content.locations.empty")} description={t("admin.content.locations.emptyHint")} />
          ) : (
            <>
              <Table>
                <THead>
                  <TR>
                    <TH>{t("admin.common.key")}</TH>
                    <TH>{t("admin.common.nameEn")}</TH>
                    <TH>{t("admin.content.locations.building")}</TH>
                    <TH>{t("admin.content.locations.room")}</TH>
                    <TH>{t("common.status")}</TH>
                    <TH className="text-end">{t("common.actions")}</TH>
                  </TR>
                </THead>
                <TBody>
                  {rows.map((row) => (
                    <TR key={row.id}>
                      <TD className="font-mono text-xs">{row.key}</TD>
                      <TD className="font-medium">{locale === "ar" ? row.nameAr : row.nameEn}</TD>
                      <TD className="text-muted">{row.buildingNameEn ?? t("admin.content.locations.noBuilding")}</TD>
                      <TD className="text-muted">{row.room ?? "â€”"}</TD>
                      <TD>
                        <div className="flex flex-wrap gap-1">
                          <Badge variant={row.published ? "success" : "outline"}>{row.published ? t("admin.common.published") : t("admin.common.draft")}</Badge>
                          {row.navigable && <Badge variant="info">{t("admin.content.locations.navigable")}</Badge>}
                        </div>
                      </TD>
                      <TD>
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => openEditLocation(row)}>
                            {t("common.edit")}
                          </Button>
                          <Button variant="ghost" size="sm" className="text-error" onClick={() => void deleteLocation(row)}>
                            {t("common.delete")}
                          </Button>
                        </div>
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
              <Pagination page={page} pageSize={PAGE_SIZE} total={total} />
            </>
          )}
        </Panel>
      ) : (
        <div className="space-y-6">
          <Panel>
            <Table>
              <THead>
                <TR>
                  <TH>{t("admin.common.code")}</TH>
                  <TH>{t("admin.common.nameEn")}</TH>
                  <TH>{t("admin.common.nameAr")}</TH>
                  <TH>{t("admin.content.locations.orderIndex")}</TH>
                  <TH>{t("admin.content.locations.floors")}</TH>
                  <TH className="text-end">{t("common.actions")}</TH>
                </TR>
              </THead>
              <TBody>
                {buildings.map((building) => (
                  <TR key={building.id}>
                    <TD className="font-mono text-xs">{building.code}</TD>
                    <TD className="font-medium">{building.nameEn}</TD>
                    <TD dir="rtl">{building.nameAr}</TD>
                    <TD className="text-muted">{building.orderIndex}</TD>
                    <TD>
                      <div className="flex flex-wrap gap-1">
                        {floorsForBuilding(building.id).map((floor) => (
                          <Badge key={floor.id} variant="outline">
                            {locale === "ar" ? floor.labelAr : floor.labelEn}
                          </Badge>
                        ))}
                      </div>
                    </TD>
                    <TD>
                      <div className="flex justify-end">
                        <Button variant="ghost" size="sm" onClick={() => openEditBuilding(building)}>
                          {t("common.edit")}
                        </Button>
                      </div>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
            {buildings.length === 0 && <EmptyState title={t("admin.content.locations.buildings")} description={t("admin.content.locations.buildingsHint")} />}
          </Panel>
        </div>
      )}

      {/* Location create / edit */}
      <Dialog
        open={locationDialog}
        onClose={() => {
          setLocationDialog(false);
          setEditingLocation(null);
        }}
        title={
          editingLocation
            ? t("admin.common.editTitle", { name: editingLocation.nameEn })
            : t("admin.common.createTitle", { name: t("admin.content.locations.title") })
        }
        className="max-w-2xl"
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => {
                setLocationDialog(false);
                setEditingLocation(null);
              }}
            >
              {t("common.cancel")}
            </Button>
            <Button onClick={() => void saveLocation()} loading={savingLocation} disabled={!locationForm.key || !locationForm.nameEn || !locationForm.nameAr}>
              {t("common.save")}
            </Button>
          </>
        }
      >
        <div className="grid max-h-[60vh] gap-4 overflow-y-auto sm:grid-cols-2">
          <Field label={t("admin.common.key")} required error={locationError}>
            <Input value={locationForm.key} onChange={(e) => setLocationForm({ ...locationForm, key: e.target.value })} dir="ltr" />
          </Field>
          <Field label={t("admin.content.locations.room")}>
            <Input value={locationForm.room} onChange={(e) => setLocationForm({ ...locationForm, room: e.target.value })} />
          </Field>
          <Field label={t("admin.common.nameEn")} required>
            <Input value={locationForm.nameEn} onChange={(e) => setLocationForm({ ...locationForm, nameEn: e.target.value })} dir="ltr" />
          </Field>
          <Field label={t("admin.common.nameAr")} required>
            <Input value={locationForm.nameAr} onChange={(e) => setLocationForm({ ...locationForm, nameAr: e.target.value })} dir="rtl" />
          </Field>
          <Field label={t("admin.content.locations.building")}>
            <Select
              value={locationForm.buildingId}
              onChange={(e) => setLocationForm({ ...locationForm, buildingId: e.target.value, floorId: "" })}
            >
              <option value="">{t("admin.content.locations.noBuilding")}</option>
              {buildings.map((building) => (
                <option key={building.id} value={building.id}>
                  {locale === "ar" ? building.nameAr : building.nameEn}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t("admin.content.locations.floor")}>
            <Select value={locationForm.floorId} onChange={(e) => setLocationForm({ ...locationForm, floorId: e.target.value })}>
              <option value="">{t("admin.content.locations.noFloor")}</option>
              {floorsForBuilding(locationForm.buildingId).map((floor) => (
                <option key={floor.id} value={floor.id}>
                  {locale === "ar" ? floor.labelAr : floor.labelEn}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t("admin.content.locations.descriptionEn")}>
            <Textarea rows={2} value={locationForm.descriptionEn} onChange={(e) => setLocationForm({ ...locationForm, descriptionEn: e.target.value })} dir="ltr" />
          </Field>
          <Field label={t("admin.content.locations.descriptionAr")}>
            <Textarea rows={2} value={locationForm.descriptionAr} onChange={(e) => setLocationForm({ ...locationForm, descriptionAr: e.target.value })} dir="rtl" />
          </Field>
          <Field label={t("admin.content.locations.directionsEn")}>
            <Textarea rows={2} value={locationForm.directionsEn} onChange={(e) => setLocationForm({ ...locationForm, directionsEn: e.target.value })} dir="ltr" />
          </Field>
          <Field label={t("admin.content.locations.directionsAr")}>
            <Textarea rows={2} value={locationForm.directionsAr} onChange={(e) => setLocationForm({ ...locationForm, directionsAr: e.target.value })} dir="rtl" />
          </Field>
          <Field label={t("admin.content.locations.latitude")}>
            <Input inputMode="decimal" value={locationForm.latitude} onChange={(e) => setLocationForm({ ...locationForm, latitude: e.target.value })} dir="ltr" />
          </Field>
          <Field label={t("admin.content.locations.longitude")}>
            <Input inputMode="decimal" value={locationForm.longitude} onChange={(e) => setLocationForm({ ...locationForm, longitude: e.target.value })} dir="ltr" />
          </Field>
          <Field label={t("admin.content.locations.imageUrl")}>
            <Input value={locationForm.imageUrl} onChange={(e) => setLocationForm({ ...locationForm, imageUrl: e.target.value })} dir="ltr" />
          </Field>
          <Field label={t("admin.content.locations.accessibility")}>
            <Input value={locationForm.accessibilityNotes} onChange={(e) => setLocationForm({ ...locationForm, accessibilityNotes: e.target.value })} />
          </Field>
          <div className="flex items-center gap-6 pt-2">
            <Switch checked={locationForm.published} onChange={(checked) => setLocationForm({ ...locationForm, published: checked })} label={t("admin.content.locations.published")} />
            <Switch checked={locationForm.navigable} onChange={(checked) => setLocationForm({ ...locationForm, navigable: checked })} label={t("admin.content.locations.navigable")} />
          </div>
        </div>
      </Dialog>

      {/* Building create / edit */}
      <Dialog
        open={buildingDialog}
        onClose={() => {
          setBuildingDialog(false);
          setEditingBuilding(null);
        }}
        title={
          editingBuilding
            ? t("admin.common.editTitle", { name: editingBuilding.nameEn })
            : t("admin.common.createTitle", { name: t("admin.content.locations.buildings") })
        }
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => {
                setBuildingDialog(false);
                setEditingBuilding(null);
              }}
            >
              {t("common.cancel")}
            </Button>
            <Button onClick={() => void saveBuilding()} disabled={!buildingForm.code || !buildingForm.nameEn || !buildingForm.nameAr}>
              {t("common.save")}
            </Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("admin.common.code")} required error={buildingError}>
            <Input value={buildingForm.code} onChange={(e) => setBuildingForm({ ...buildingForm, code: e.target.value })} dir="ltr" />
          </Field>
          <Field label={t("admin.content.locations.orderIndex")}>
            <Input type="number" min={0} value={buildingForm.orderIndex} onChange={(e) => setBuildingForm({ ...buildingForm, orderIndex: e.target.value })} />
          </Field>
          <Field label={t("admin.common.nameEn")} required>
            <Input value={buildingForm.nameEn} onChange={(e) => setBuildingForm({ ...buildingForm, nameEn: e.target.value })} dir="ltr" />
          </Field>
          <Field label={t("admin.common.nameAr")} required>
            <Input value={buildingForm.nameAr} onChange={(e) => setBuildingForm({ ...buildingForm, nameAr: e.target.value })} dir="rtl" />
          </Field>
        </div>
      </Dialog>

      {/* Floor create */}
      <Dialog
        open={floorDialog}
        onClose={() => setFloorDialog(false)}
        title={t("admin.common.createTitle", { name: t("admin.content.locations.floors") })}
        footer={
          <>
            <Button variant="outline" onClick={() => setFloorDialog(false)}>
              {t("common.cancel")}
            </Button>
            <Button onClick={() => void saveFloor()} disabled={!floorForm.buildingId || !floorForm.labelEn || !floorForm.labelAr}>
              {t("common.save")}
            </Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("admin.content.locations.building")} required error={floorError}>
            <Select value={floorForm.buildingId} onChange={(e) => setFloorForm({ ...floorForm, buildingId: e.target.value })}>
              <option value="" disabled>
                {t("admin.common.selectPlaceholder")}
              </option>
              {buildings.map((building) => (
                <option key={building.id} value={building.id}>
                  {locale === "ar" ? building.nameAr : building.nameEn}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t("admin.content.locations.orderIndex")}>
            <Input type="number" min={0} value={floorForm.orderIndex} onChange={(e) => setFloorForm({ ...floorForm, orderIndex: e.target.value })} />
          </Field>
          <Field label={t("admin.content.locations.labelEn")} required>
            <Input value={floorForm.labelEn} onChange={(e) => setFloorForm({ ...floorForm, labelEn: e.target.value })} dir="ltr" />
          </Field>
          <Field label={t("admin.content.locations.labelAr")} required>
            <Input value={floorForm.labelAr} onChange={(e) => setFloorForm({ ...floorForm, labelAr: e.target.value })} dir="rtl" />
          </Field>
        </div>
      </Dialog>
    </div>
  );
}
