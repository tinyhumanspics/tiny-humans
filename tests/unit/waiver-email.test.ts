import { describe, expect, test } from "vitest";
import { waiverCopyEmail } from "@/emails/WaiverCopy";
import { waiverFacts } from "@/lib/waiver/facts";
import { waiverSnapshot, WAIVER_VERSION } from "@/lib/waiver/text";

const facts = (lang: "en" | "es") => waiverFacts({ parentName: "Maria Morales", children: [{ name: "Sofia", age: "Newborn (0–2 weeks)" }], sessionDate: "2026-11-16" }, lang);
const details = (lang: "en" | "es") => ({
  reference: "TH-20261103-4821",
  signerName: "Maria Morales",
  relationship: "parent" as const,
  signedAt: "2026-11-16T15:42:00.000Z",
  uses: { website: true, social: true, ads: false, bts: true, personal: false },
  firstNameOk: true,
  snapshot: waiverSnapshot(lang, facts(lang)),
  sha256: "3f9c2b7e41d0a8c65e17b9d2f40a6c13e8b7d5f2a91c04e6b3d8f7a2c5e19b40",
  signaturePng: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
});

describe("the parent's copy of the photo and video release (owner, Nov 11)", () => {
  test("the exact words they signed, each choice ✓/✗, the signature (inline image) and when", async () => {
    const mail = await waiverCopyEmail(details("en"), { themeId: "default" });
    expect(mail.subject).toBe("Your signed photo and video release");
    expect(mail.html).toContain("Our website and online portfolio");
    expect(mail.text).toContain("✓ Yes  Our website and online portfolio (tinyhumans.photography)");
    expect(mail.text).toContain("✗ No  Ads for Tiny Humans on Instagram and Facebook");
    expect(mail.text).toContain("OK to use Sofia's first name in captions");
    expect(mail.text).toContain("Signed on Monday, November 16, 2026 at 10:42 AM (Miami time)");
    expect(mail.text).toContain(`Version ${WAIVER_VERSION} · Record 3f9c2b7e41d0a8c6 · Booking TH-20261103-4821`);
    expect(mail.html).toContain("cid:th-waiver-signature");
    expect(mail.attachments.some((a) => a.contentId === "th-waiver-signature" && a.contentType === "image/png")).toBe(true);
  });

  test("in the language they signed in", async () => {
    const mail = await waiverCopyEmail(details("es"), { themeId: "default" });
    expect(mail.subject).toBe("Tu autorización de fotos y videos firmada");
    expect(mail.text).toContain("✓ Sí");
    expect(mail.text).toContain("hora de Miami");
  });
});
