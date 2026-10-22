import { z } from "zod";
import { UPLOAD_RULES, validateUploadMeta } from "@/lib/upload";
import { assertSameOrigin, requireUser } from "@/server/auth/guard";
import { listAssets, recordAsset, signCloudinaryUpload } from "@/server/services/media";
import { handle, json, readJson } from "@/server/http";

export const dynamic = "force-dynamic";

const kindSchema = z.enum(["location", "robot", "profile", "document", "general"]);

const querySchema = z.object({ kind: kindSchema.optional() });

const signSchema = z.object({
  kind: kindSchema,
  type: z.string().trim().min(3).max(100),
  bytes: z.coerce.number().int().min(1).max(UPLOAD_RULES.maxDocumentBytes),
});

const recordSchema = z.object({
  kind: kindSchema,
  publicId: z.string().trim().min(1).max(300),
  url: z.string().trim().url().max(1000),
  secureUrl: z.string().trim().url().max(1000).optional(),
  format: z.string().trim().max(20).optional(),
  bytes: z.coerce.number().int().min(0).optional(),
  width: z.coerce.number().int().min(0).optional(),
  height: z.coerce.number().int().min(0).optional(),
  folder: z.string().trim().max(300).optional(),
  /** MIME type re-checked server-side so a signed upload cannot smuggle a wrong type. */
  type: z.string().trim().min(3).max(100),
});

/** GET /api/admin/media?kind=… — asset library. */
export async function GET(req: Request) {
  return handle(async () => {
    await requireUser("media.manage");
    const query = querySchema.parse(Object.fromEntries(new URL(req.url).searchParams));
    return json({ rows: await listAssets(query.kind), configured: true });
  });
}

/**
 * POST /api/admin/media — two-step flow in one endpoint:
 *   { action: "sign" }     → returns Cloudinary signed-upload params (file goes browser→Cloudinary)
 *   { action: "record" }   → stores the resulting asset in our DB after a direct upload
 */
export async function POST(req: Request) {
  return handle(async () => {
    assertSameOrigin(req);
    const user = await requireUser("media.manage");
    const body = await readJson(req, z.discriminatedUnion("action", [z.object({ action: z.literal("sign") }).merge(signSchema), z.object({ action: z.literal("record") }).merge(recordSchema)]));

    if (body.action === "sign") {
      const signature = await signCloudinaryUpload({ kind: body.kind, userId: user.id, bytes: body.bytes });
      return json(signature);
    }

    const { type, ...asset } = body;
    const problem = validateUploadMeta({ kind: asset.kind, type, bytes: asset.bytes ?? 0 });
    if (problem) return json({ error: problem, code: "UPLOAD_INVALID" }, { status: 400 });

    const id = await recordAsset(asset, asset.kind, user.id);
    return json({ ok: true, id }, { status: 201 });
  });
}
