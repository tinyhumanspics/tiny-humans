import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { isAdmin } from "@/lib/admin/auth";
import { isStorageConfigured } from "@/lib/settings/server";

export const dynamic = "force-dynamic";

const MAX_BYTES = 4 * 1024 * 1024; // the browser resizes photos before upload
const TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

/** Upload one photo. Returns its public URL; it only appears on the site once settings are saved. */
export async function POST(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  if (!isStorageConfigured()) return NextResponse.json({ error: "Storage isn't connected yet." }, { status: 503 });
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "No photo received." }, { status: 400 });
  const ext = TYPES[file.type];
  if (!ext) return NextResponse.json({ error: "Use a JPG, PNG or WebP photo." }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "That photo is too large (max 4 MB after resizing)." }, { status: 400 });
  const blob = await put(`photos/photo.${ext}`, file, { access: "public", addRandomSuffix: true, contentType: file.type });
  return NextResponse.json({ src: blob.url });
}
