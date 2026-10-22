import { createHash } from "node:crypto";
import { desc, eq } from "drizzle-orm";
import { ApiError } from "@/server/auth/guard";
import { db } from "@/server/db/client";
import { mediaAssets } from "@/server/db/schema";
import { folderForKind, type UploadKind } from "@/lib/upload";
import { audit } from "./audit";

/** Cloudinary credentials live only in the server environment. */
export function cloudinaryConfigured(): boolean {
  return Boolean(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET);
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new ApiError(503, "Cloudinary is not configured on this deployment.", "CLOUDINARY_NOT_CONFIGURED");
  return value;
}

/**
 * Cloudinary signature = SHA1 of the sorted parameters + API secret.
 * Only the *signature* leaves the server; the API secret never does.
 */
function signParams(params: Record<string, string | number>): string {
  const secret = required("CLOUDINARY_API_SECRET");
  const toSign = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join("&");
  return createHash("sha1").update(toSign + secret).digest("hex");
}

export type SignedUpload = {
  configured: true;
  cloudName: string;
  apiKey: string;
  timestamp: number;
  folder: string;
  signature: string;
  uploadUrl: string;
  maxBytes: number;
};

/** Parameters for a direct-from-browser upload; the file never touches our servers. */
export async function signCloudinaryUpload(opts: { kind: UploadKind; userId: string | null; bytes: number }): Promise<SignedUpload> {
  const cloudName = required("CLOUDINARY_CLOUD_NAME");
  const apiKey = required("CLOUDINARY_API_KEY");
  const timestamp = Math.floor(Date.now() / 1000);
  const folder = process.env.CLOUDINARY_FOLDER ? `${process.env.CLOUDINARY_FOLDER}/${folderForKind(opts.kind)}` : folderForKind(opts.kind);
  const params = { folder, timestamp };
  return {
    configured: true,
    cloudName,
    apiKey,
    timestamp,
    folder,
    signature: signParams(params),
    uploadUrl: `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`,
    maxBytes: opts.kind === "document" ? 15 * 1024 * 1024 : 8 * 1024 * 1024,
  };
}

export async function recordAsset(
  input: {
    publicId: string;
    url: string;
    secureUrl?: string;
    format?: string;
    bytes?: number;
    width?: number;
    height?: number;
    folder?: string;
  },
  kind: UploadKind,
  userId: string | null,
): Promise<string> {
  const id = crypto.randomUUID();
  await db
    .insert(mediaAssets)
    .values({
      id,
      publicId: input.publicId,
      url: input.url,
      secureUrl: input.secureUrl ?? input.url,
      format: input.format ?? null,
      bytes: input.bytes ?? null,
      width: input.width ?? null,
      height: input.height ?? null,
      folder: input.folder ?? null,
      kind,
      uploadedById: userId,
    })
    .onConflictDoUpdate({ target: mediaAssets.publicId, set: { url: input.url, secureUrl: input.secureUrl ?? input.url } });
  await audit({ actorUserId: userId, actorLabel: "admin", action: "media.uploaded", targetType: "media", targetId: id, metadata: { kind, publicId: input.publicId } });
  return id;
}

export async function listAssets(kind?: UploadKind, limit = 60) {
  const where = kind ? eq(mediaAssets.kind, kind) : undefined;
  return db.select().from(mediaAssets).where(where).orderBy(desc(mediaAssets.createdAt)).limit(limit);
}

/** Best-effort Cloudinary deletion (the DB row is removed regardless). */
async function destroyCloudinary(publicId: string): Promise<boolean> {
  if (!cloudinaryConfigured()) return false;
  const cloudName = required("CLOUDINARY_CLOUD_NAME");
  const apiKey = required("CLOUDINARY_API_KEY");
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = signParams({ public_id: publicId, timestamp });
  try {
    const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/resources/image/upload`, {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ public_id: publicId, timestamp, api_key: apiKey, signature }),
    });
    return res.ok;
  } catch (error) {
    console.error("[media] Cloudinary delete failed:", error instanceof Error ? error.message : error);
    return false;
  }
}

export async function deleteAsset(id: string, actorId: string): Promise<void> {
  const [asset] = await db.select().from(mediaAssets).where(eq(mediaAssets.id, id)).limit(1);
  if (!asset) throw new ApiError(404, "Media asset not found.", "MEDIA_NOT_FOUND");
  const removed = await destroyCloudinary(asset.publicId);
  await db.delete(mediaAssets).where(eq(mediaAssets.id, id));
  await audit({ actorUserId: actorId, actorLabel: "admin", action: "media.deleted", targetType: "media", targetId: id, metadata: { publicId: asset.publicId, cloudinaryRemoved: removed } });
}
