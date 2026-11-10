import "server-only";
import { del } from "@vercel/blob";
import { isStorageConfigured } from "@/lib/settings/server";

/**
 * Deletes a shoot's photo/video files from Vercel Blob (paths "shoots/<shoot id>/…"). Called BEFORE their rows are
 * deleted (lib/shoots/server.ts), so a failure throws and the row stays for another try. Only "shoots/" paths are
 * accepted: a bug elsewhere can never delete the website's own pictures. Without Blob (local tests) there are no files.
 */
export async function removeShootFiles(pathnames: string[]): Promise<void> {
  const files = pathnames.filter((p) => p.startsWith("shoots/"));
  if (!files.length) return;
  if (!isStorageConfigured()) throw new Error("Blob storage isn't connected, so the photos can't be removed yet.");
  await del(files);
}
