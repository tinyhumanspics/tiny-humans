import { del, put } from "@vercel/blob";
import { NextResponse } from "next/server";
import { log } from "@/lib/log";
import { matchesPhotoSignature, PHOTO_MAX_BYTES, PHOTO_REQUEST_MAX_BYTES, PHOTO_TYPES } from "@/lib/security/uploads";
import { isStorageConfigured } from "@/lib/settings/server";
import { NO_STORE, parsed, shootsError, shootsGuard } from "@/lib/shoots/route";
import { addSignaturePhoto, checkPoseRoom } from "@/lib/shoots/server";
import { uuidSchema } from "@/lib/shoots/validation";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

const size = (v: FormDataEntryValue | null) => {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 && n <= 10_000 ? n : null;
};

/**
 * Owner only: one photo of a signature pose (already shrunk in the browser to 2000 px). Same checks as the shoot
 * inspo photos (type, real image bytes, size). Stored in Vercel Blob at shoots/poses/<pose id>/… with a random
 * suffix: the address is unguessable and only ever shown in /admin.
 */
export async function POST(req: Request, { params }: Ctx) {
  const blocked = await shootsGuard(req);
  if (blocked) return blocked;
  const id = await parsed(uuidSchema, (await params).id);
  if ("response" in id) return id.response;
  if (!isStorageConfigured()) return NextResponse.json({ error: "Photo storage isn't connected yet." }, { status: 503, headers: NO_STORE });
  const length = Number(req.headers.get("content-length"));
  if (Number.isFinite(length) && length > PHOTO_REQUEST_MAX_BYTES) return NextResponse.json({ error: "That photo is too large (max 4 MB after resizing)." }, { status: 413, headers: NO_STORE });

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "No photo received." }, { status: 400, headers: NO_STORE });
  const ext = PHOTO_TYPES[file.type];
  if (!ext) return NextResponse.json({ error: "Use a JPG, PNG or WebP photo." }, { status: 400, headers: NO_STORE });
  if (file.size > PHOTO_MAX_BYTES) return NextResponse.json({ error: "That photo is too large (max 4 MB after resizing)." }, { status: 413, headers: NO_STORE });
  if (!matchesPhotoSignature(file.type, new Uint8Array(await file.slice(0, 12).arrayBuffer()))) {
    return NextResponse.json({ error: "That file doesn't contain a valid JPG, PNG or WebP photo." }, { status: 400, headers: NO_STORE });
  }

  let pathname: string | null = null;
  try {
    await checkPoseRoom(id.data);
    const blob = await put(`shoots/poses/${id.data}/photo.${ext}`, file, { access: "public", addRandomSuffix: true, contentType: file.type });
    pathname = blob.pathname;
    const photo = await addSignaturePhoto(id.data, {
      blobUrl: blob.url,
      blobPathname: blob.pathname,
      contentType: file.type,
      bytes: file.size,
      width: size(form!.get("width")),
      height: size(form!.get("height")),
    });
    return NextResponse.json({ photo }, { status: 201, headers: NO_STORE });
  } catch (err) {
    // the file went up but the row didn't: take the file back down (best effort)
    if (pathname) await del(pathname).catch((e) => log.error("admin.shoots", "Orphan pose photo not removed", { error: e as Error }));
    return shootsError(err, "pose photo upload");
  }
}
