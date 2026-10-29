import { describe, expect, test } from "vitest";
import { galleryDeliveredEmail } from "@/emails/GalleryDelivered";

const details = { reference: "TH-TEST1", parentName: "Ana Lopez", babyName: "", bundleName: "Little Moments" };
const base = { themeId: "default", reviewUrl: "https://www.tinyhumans.photography/review?t=x", galleryUrl: "https://tinyhumans.pixieset.com/ana/", images: "inline" as const };

describe("Gallery delivered email: download PIN", () => {
  test("shows the PIN under the gallery button, in the family's language", async () => {
    const en = await galleryDeliveredEmail(details, { ...base, downloadPin: "4821" });
    expect(en.html).toContain("Your download PIN: 4821");
    expect(en.html).toContain("Pixieset asks for it when you download your photos.");
    expect(en.html.indexOf("View your gallery")).toBeLessThan(en.html.indexOf("Your download PIN: 4821"));
    expect(en.text).toContain("Your download PIN: 4821\nPixieset asks for it when you download your photos.");

    const es = await galleryDeliveredEmail(details, { ...base, downloadPin: "4821", locale: "es" });
    expect(es.html).toContain("Tu PIN de descarga: 4821");
    expect(es.text).toContain("Pixieset te lo pedirá cuando descargues tus fotos.");
  });

  test("also shows it when no gallery link was pasted", async () => {
    const mail = await galleryDeliveredEmail(details, { ...base, galleryUrl: undefined, downloadPin: "4821" });
    expect(mail.html).toContain("Your download PIN: 4821");
  });

  test("without a PIN the email stays as before", async () => {
    const mail = await galleryDeliveredEmail(details, base);
    expect(mail.html).not.toContain("PIN");
    expect(mail.text).not.toContain("PIN");
  });
});
