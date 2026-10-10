export const PHOTO_MAX_BYTES = 4 * 1024 * 1024;
export const PHOTO_REQUEST_MAX_BYTES = PHOTO_MAX_BYTES + 512 * 1024;

export const PHOTO_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const startsWith = (bytes: Uint8Array, signature: number[]) => signature.every((byte, index) => bytes[index] === byte);

/** The browser-supplied MIME type is untrusted, so also check the file signature. */
export function matchesPhotoSignature(type: string, bytes: Uint8Array): boolean {
  if (type === "image/jpeg") return startsWith(bytes, [0xff, 0xd8, 0xff]);
  if (type === "image/png") return startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (type === "image/webp") {
    return startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
  }
  return false;
}
