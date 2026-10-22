/** Shared upload rules enforced by both the client picker and the server signing endpoint. */
export const UPLOAD_RULES = {
  maxImageBytes: 8 * 1024 * 1024,
  maxDocumentBytes: 15 * 1024 * 1024,
  allowedImageTypes: ["image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml"] as const,
  allowedDocumentTypes: ["application/pdf"] as const,
  folders: ["inno-robot/locations", "inno-robot/robot", "inno-robot/profiles", "inno-robot/documents", "inno-robot/general"] as const,
} as const;

export type UploadKind = "location" | "robot" | "profile" | "document" | "general";

export function folderForKind(kind: UploadKind): string {
  switch (kind) {
    case "location":
      return "inno-robot/locations";
    case "robot":
      return "inno-robot/robot";
    case "profile":
      return "inno-robot/profiles";
    case "document":
      return "inno-robot/documents";
    default:
      return "inno-robot/general";
  }
}

export function validateUploadMeta(opts: { kind: UploadKind; type: string; bytes: number }): string | null {
  const isImage = (UPLOAD_RULES.allowedImageTypes as readonly string[]).includes(opts.type);
  const isDocument = (UPLOAD_RULES.allowedDocumentTypes as readonly string[]).includes(opts.type);
  if (!isImage && !isDocument) return `File type ${opts.type} is not allowed.`;
  const limit = isDocument ? UPLOAD_RULES.maxDocumentBytes : UPLOAD_RULES.maxImageBytes;
  if (opts.bytes > limit) return `File exceeds the ${Math.round(limit / 1024 / 1024)} MB limit.`;
  if (opts.kind === "document" && !isDocument) return "Documents must be PDF files.";
  if (opts.kind !== "document" && !isImage) return "This slot only accepts images.";
  return null;
}
