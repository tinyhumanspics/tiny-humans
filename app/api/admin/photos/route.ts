import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { isAdmin } from "@/lib/admin/auth";
import { matchesPhotoSignature, PHOTO_MAX_BYTES, PHOTO_REQUEST_MAX_BYTES, PHOTO_TYPES } from "@/lib/security/uploads";
import { isStorageConfigured } from "@/lib/settings/server";

export const dynamic = "force-dynamic";

/** Upload one photo. Returns its public URL; it only appears on the site once settings are saved. */
export async function POST(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  if (!isStorageConfigured()) return NextResponse.json({ error: "Storage isn't connected yet." }, { status: 503 });
  const contentLength = Number(req.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > PHOTO_REQUEST_MAX_BYTES) {
    return NextResponse.json({ error: "That photo is too large (max 4 MB after resizing)." }, { status: 413 });
  }
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "No photo received." }, { status: 400 });
  const ext = PHOTO_TYPES[file.type];
  if (!ext) return NextResponse.json({ error: "Use a JPG, PNG or WebP photo." }, { status: 400 });
  if (file.size > PHOTO_MAX_BYTES) return NextResponse.json({ error: "That photo is too large (max 4 MB after resizing)." }, { status: 413 });
  const signature = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  if (!matchesPhotoSignature(file.type, signature)) {
    return NextResponse.json({ error: "That file doesn't contain a valid JPG, PNG or WebP photo." }, { status: 400 });
  }
  const blob = await put(`photos/photo.${ext}`, file, { access: "public", addRandomSuffix: true, contentType: file.type });
  return NextResponse.json({ src: blob.url });
}
