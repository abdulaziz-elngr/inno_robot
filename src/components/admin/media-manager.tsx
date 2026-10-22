"use client";

import { useRef, useState } from "react";
import { Upload } from "lucide-react";
import { PageHeader, Panel } from "@/components/admin/primitives";
import { adminFetch, useAsyncData } from "@/components/admin/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Select } from "@/components/ui/field";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { useI18n } from "@/lib/i18n/provider";
import { UPLOAD_RULES, validateUploadMeta } from "@/lib/upload";

type Asset = {
  id: string;
  publicId: string;
  url: string;
  secureUrl: string | null;
  format: string | null;
  bytes: number | null;
  width: number | null;
  height: number | null;
  folder: string | null;
  kind: string;
  pending: boolean;
  createdAt: string;
};

type SignedUpload = {
  configured: boolean;
  cloudName: string;
  apiKey: string;
  timestamp: number;
  folder: string;
  signature: string;
  uploadUrl: string;
  maxBytes: number;
};

const KINDS = ["location", "robot", "profile", "document", "general"] as const;

function formatBytes(bytes: number | null): string {
  if (!bytes) return "â€”";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function MediaManager() {
  const { t } = useI18n();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [kind, setKind] = useState<(typeof KINDS)[number]>("location");
  const [kindFilter, setKindFilter] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data, loading, reload } = useAsyncData(
    () => adminFetch<{ rows: Asset[]; configured: boolean }>(`/api/admin/media${kindFilter ? `?kind=${kindFilter}` : ""}`),
    [kindFilter],
  );

  const rows = data?.rows ?? [];

  async function pickAndUpload(file: File) {
    setBusy(true);
    setError(null);
    const problem = validateUploadMeta({ kind, type: file.type, bytes: file.size });
    if (problem) {
      setError(problem);
      setBusy(false);
      return;
    }
    try {
      // 1. Ask the server for signed upload parameters.
      const signed = await adminFetch<SignedUpload>("/api/admin/media", {
        method: "POST",
        body: JSON.stringify({ action: "sign", kind, type: file.type, bytes: file.size }),
      });

      // 2. Upload directly browser â†’ Cloudinary (the server never proxies the file).
      const body = new FormData();
      body.append("file", file);
      body.append("api_key", signed.apiKey);
      body.append("timestamp", String(signed.timestamp));
      body.append("folder", signed.folder);
      body.append("signature", signed.signature);
      const response = await fetch(signed.uploadUrl, { method: "POST", body });
      const result = (await response.json()) as { public_id?: string; secure_url?: string; url?: string; format?: string; bytes?: number; width?: number; height?: number; error?: { message?: string } };
      if (!response.ok || !result.public_id) {
        throw new Error(result.error?.message ?? `Cloudinary upload failed (${response.status})`);
      }

      // 3. Record the asset in our database (re-validating type/size server-side).
      await adminFetch("/api/admin/media", {
        method: "POST",
        body: JSON.stringify({
          action: "record",
          kind,
          publicId: result.public_id,
          url: result.url ?? result.secure_url ?? "",
          secureUrl: result.secure_url,
          format: result.format,
          bytes: result.bytes ?? file.size,
          width: result.width,
          height: result.height,
          type: file.type,
        }),
      });

      toast({ title: t("admin.content.media.uploaded"), variant: "success" });
      reload();
    } catch (e) {
      const message = e instanceof Error ? e.message : t("admin.content.media.uploadFailed");
      setError(message);
      toast({ title: message, variant: "error" });
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div>
      <PageHeader title={t("admin.content.media.title")} description={t("admin.content.media.description")} />

      <Panel className="mb-6">
        <div className="flex flex-wrap items-end gap-3 px-5 py-4">
          <Field label={t("admin.content.media.kind")} className="w-44">
            <Select value={kind} onChange={(e) => setKind(e.target.value as (typeof KINDS)[number])}>
              <option value="location">{t("admin.content.media.kindLocation")}</option>
              <option value="robot">{t("admin.content.media.kindRobot")}</option>
              <option value="profile">{t("admin.content.media.kindProfile")}</option>
              <option value="general">{t("admin.content.media.kindGeneral")}</option>
            </Select>
          </Field>
          <input
            ref={fileRef}
            type="file"
            accept={(UPLOAD_RULES.allowedImageTypes as readonly string[]).join(",")}
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void pickAndUpload(file);
            }}
          />
          <Button onClick={() => fileRef.current?.click()} loading={busy}>
            <Upload className="size-4" aria-hidden />
            {busy ? t("admin.content.media.uploading") : t("admin.content.media.upload")}
          </Button>
          {error && (
            <div className="w-full">
              <p role="alert" className="text-xs font-medium text-error">
                {error}
              </p>
              {error.toLowerCase().includes("cloudinary") && <p className="mt-1 text-xs text-muted">{t("admin.content.media.notConfiguredHint")}</p>}
            </div>
          )}
        </div>
      </Panel>

      <Panel>
        <div className="flex flex-wrap items-center gap-3 border-b border-border/70 px-4 py-3">
          <Select value={kindFilter} onChange={(e) => setKindFilter(e.target.value)} aria-label={t("admin.content.media.filterKind")} className="w-44">
            <option value="">{t("admin.content.media.filterKind")}</option>
            {KINDS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </Select>
        </div>

        {loading ? (
          <div className="space-y-2 p-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="skeleton h-16 w-full" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <EmptyState title={t("admin.content.media.empty")} description={t("admin.content.media.emptyHint")} />
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>{t("admin.common.name")}</TH>
                <TH>{t("admin.content.media.publicId")}</TH>
                <TH>{t("admin.content.media.kind")}</TH>
                <TH>{t("admin.content.media.dimensions")}</TH>
                <TH>{t("admin.content.media.size")}</TH>
                <TH className="text-end">{t("common.actions")}</TH>
              </TR>
            </THead>
            <TBody>
              {rows.map((row) => (
                <TR key={row.id}>
                  <TD>
                    <div className="flex items-center gap-3">
                      {/* eslint-disable-next-line @next/next/no-img-element -- external Cloudinary URLs cannot use next/image without a remotePatterns entry */}
                      <img src={row.secureUrl ?? row.url} alt="" className="size-10 rounded-lg border border-border/70 object-cover" loading="lazy" />
                      <span className="font-mono text-xs">{row.format ?? "â€”"}</span>
                      {row.pending && <Badge variant="warning">{t("admin.common.notConfigured")}</Badge>}
                    </div>
                  </TD>
                  <TD className="max-w-56 truncate font-mono text-xs text-muted">{row.publicId}</TD>
                  <TD>
                    <Badge variant="outline">{row.kind}</Badge>
                  </TD>
                  <TD className="text-xs text-muted">{row.width && row.height ? `${row.width}Ã—${row.height}` : "â€”"}</TD>
                  <TD className="text-xs text-muted">{formatBytes(row.bytes)}</TD>
                  <TD>
                    <div className="flex justify-end">
                      <a
                        href={row.secureUrl ?? row.url}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-lg px-2.5 py-1 text-sm font-medium text-primary hover:bg-lavender dark:hover:bg-primary/15"
                      >
                        {t("admin.content.media.open")}
                      </a>
                    </div>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Panel>
    </div>
  );
}
