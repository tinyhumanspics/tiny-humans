import { del, put } from "@vercel/blob";
import { NextResponse } from "next/server";
import { log } from "@/lib/log";
import { matchesPhotoSignature, PHOTO_MAX_BYTES, PHOTO_REQUEST_MAX_BYTES, PHOTO_TYPES } from "@/lib/security/uploads";
import { isStorageConfigured } from "@/lib/settings/server";
import { NO_STORE, parsed, shootsError, shootsGuard } from "@/lib/shoots/route";
import { addInspoFile, ensureShootRowId } from "@/lib/shoots/server";
import { shootKeySchema } from "@/lib/shoots/validation";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

const size = (v: FormDataEntryValue | null) => {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 && n <= 10_000 ? n : null;
};

/**
 * Owner only: one inspo / BTS photo (already shrunk in the browser to 2000 px). Same checks as /admin → Photos
 * (type, real image bytes, size). Stored in Vercel Blob at shoots/<shoot id>/… with a random suffix: the store is
 * public (the website's pictures live there), so the address is unguessable and only ever shown in /admin.
 */
export async function POST(req: Request, { params }: Ctx) {
  const blocked = await shootsGuard(req);
  if (blocked) return blocked;
  const key = await parsed(shootKeySchema, (await params).id);
  if ("response" in key) return key.response;
  if (!isStorageConfigured()) return NextResponse.json({ error: "Photo storage isn't connected yet." }, { status: 503, headers: NO_STORE });
  const length = Number(req.headers.get("content-length"));
  if (Number.isFinite(length) && length > PHOTO_REQUEST_MAX_BYTES) return NextResponse.json({ error: "That photo is too large (max 4 MB after resizing)." }, { status: 413, headers: NO_STORE });

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  const group = form?.get("group");
  if (!(file instanceof File)) return NextResponse.json({ error: "No photo received." }, { status: 400, headers: NO_STORE });
  if (group !== "inspo" && group !== "bts") return NextResponse.json({ error: "Pick Inspo or BTS." }, { status: 400, headers: NO_STORE });
  const ext = PHOTO_TYPES[file.type];
  if (!ext) return NextResponse.json({ error: "Use a JPG, PNG or WebP photo." }, { status: 400, headers: NO_STORE });
  if (file.size > PHOTO_MAX_BYTES) return NextResponse.json({ error: "That photo is too large (max 4 MB after resizing)." }, { status: 413, headers: NO_STORE });
  if (!matchesPhotoSignature(file.type, new Uint8Array(await file.slice(0, 12).arrayBuffer()))) {
    return NextResponse.json({ error: "That file doesn't contain a valid JPG, PNG or WebP photo." }, { status: 400, headers: NO_STORE });
  }

  let pathname: string | null = null;
  try {
    const shootId = await ensureShootRowId(key.data);
    const blob = await put(`shoots/${shootId}/${group}.${ext}`, file, { access: "public", addRandomSuffix: true, contentType: file.type });
    pathname = blob.pathname;
    const item = await addInspoFile(key.data, {
      group,
      type: "image",
      blobUrl: blob.url,
      blobPathname: blob.pathname,
      contentType: file.type,
      bytes: file.size,
      width: size(form!.get("width")),
      height: size(form!.get("height")),
    });
    return NextResponse.json({ item }, { status: 201, headers: NO_STORE });
  } catch (err) {
    // the file went up but the row didn't: take the file back down (best effort)
    if (pathname) await del(pathname).catch((e) => log.error("admin.shoots", "Orphan photo not removed", { error: e as Error }));
    return shootsError(err, "photo upload");
  }
}
