import { z } from "@/lib/validation/zod";
import { FAMILY_WAIVER_VERSION, WAIVER_VERSION } from "./text";

/** The signature PNG: what the browser sends must really be a small PNG of a sensible size. */
export const SIGNATURE_MAX_BYTES = 100_000;
const PNG_PREFIX = "data:image/png;base64,";
const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/** Decodes and checks a signature data URL; null when it isn't a valid, small PNG. */
export function decodeSignature(dataUrl: string): { base64: string; bytes: number; width: number; height: number } | null {
  if (!dataUrl.startsWith(PNG_PREFIX)) return null;
  const base64 = dataUrl.slice(PNG_PREFIX.length);
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) return null;
  let raw: string;
  try {
    raw = atob(base64);
  } catch {
    return null;
  }
  if (raw.length > SIGNATURE_MAX_BYTES || raw.length < 33) return null;
  for (let i = 0; i < PNG_MAGIC.length; i++) if (raw.charCodeAt(i) !== PNG_MAGIC[i]) return null;
  if (raw.slice(12, 16) !== "IHDR") return null;
  const u32 = (at: number) => ((raw.charCodeAt(at) << 24) | (raw.charCodeAt(at + 1) << 16) | (raw.charCodeAt(at + 2) << 8) | raw.charCodeAt(at + 3)) >>> 0;
  const width = u32(16);
  const height = u32(20);
  if (width < 100 || width > 2000 || height < 40 || height > 1000) return null;
  return { base64, bytes: raw.length, width, height };
}

const reference = z.string().trim().regex(/^TH-\d{8}-[A-Z0-9]{4,8}$/, "That booking reference isn't right.");

/** POST /api/admin/waiver: what the iPad sends when the parent taps Done. */
export const signSchema = z
  .object({
    reference,
    version: z.string().refine((v) => v === WAIVER_VERSION || v === FAMILY_WAIVER_VERSION, "This form was updated. Please close it and start again."),
    language: z.enum(["en", "es"]),
    uses: z.object({ website: z.boolean(), social: z.boolean(), ads: z.boolean(), bts: z.boolean(), personal: z.boolean() }).strict(),
    firstNameOk: z.boolean(),
    signerName: z.string().trim().min(2, "Please write your full name.").max(120, "That name is too long."),
    relationship: z.enum(["parent", "guardian"]),
    agree: z.literal(true, { message: 'Please tick "I agree".' }),
    signature: z.string().max(Math.ceil((SIGNATURE_MAX_BYTES * 4) / 3) + PNG_PREFIX.length + 4, "That signature is too large.").refine((s) => decodeSignature(s) !== null, "Please sign again."),
  })
  .strict();
export type SignInput = z.infer<typeof signSchema>;

export const referenceSchema = reference;
export const waiverIdSchema = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/, "Not found.");
