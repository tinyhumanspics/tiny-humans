import { describe, expect, test } from "vitest";
import { sessionReminderEmail } from "@/emails/SessionReminder";
import { looksOf } from "@/lib/pricing/looks";
import en from "@/messages/en.json";
import es from "@/messages/es.json";

/**
 * Owner, Nov 25: both reminders say what the bundle includes, look by look; the day-before one asks for the backdrop
 * when none is picked (the backdrop page has closed by then).
 */
const looks = looksOf("2 looks\nCozy Wrap: swaddled and sleeping on your first backdrop.\nLittle Nest: a second backdrop with a prop, like a basket or tiny bed.")!;
const estilos = looksOf("2 estilos\nArropadito: envuelto y dormidito sobre tu primer fondo.\nNidito: un segundo fondo con un accesorio, como una canastita o una camita.")!;
const details = {
  reference: "TH-20261205-4821",
  parentName: "Sofia Martinez",
  bundleName: "Our Little Story",
  date: "2026-12-05",
  start: "10:00",
  end: "12:00",
  location: "1500 Bay Rd, Miami Beach, FL 33139",
  depositPaid: true,
  setups: 2,
  looks: { bundle: "Our Little Story", looks },
};
const opts = { themeId: "default", today: "2026-12-04", images: "inline" as const };

describe("the bundle's looks in both reminders", () => {
  test("EN: the box with the bundle, its count and each look, in the HTML and the plain text", async () => {
    for (const kind of ["72h", "24h"] as const) {
      const mail = await sessionReminderEmail(kind, { ...details, backdrops: ["burgundy", "pink"] }, opts);
      expect(mail.html).toContain(en.emails.looks.title);
      expect(mail.html).toContain("Our Little Story · 2 looks");
      expect(mail.html).toContain("<b>Little Nest:</b> a second backdrop with a prop, like a basket or tiny bed.");
      expect(mail.text).toContain("What your bundle includes: Our Little Story · 2 looks\n- Cozy Wrap: swaddled and sleeping on your first backdrop.\n- Little Nest: a second backdrop with a prop, like a basket or tiny bed.");
    }
  });

  test("ES: the Spanish name and looks", async () => {
    const mail = await sessionReminderEmail("72h", { ...details, looks: { bundle: "Nuestra Pequeña Historia", looks: estilos } }, { ...opts, locale: "es" });
    expect(mail.html).toContain(es.emails.looks.title);
    expect(mail.text).toContain("Lo que incluye tu paquete: Nuestra Pequeña Historia · 2 estilos\n- Arropadito: envuelto y dormidito sobre tu primer fondo.");
  });

  test("a bundle without looks text: no box", async () => {
    for (const kind of ["72h", "24h"] as const) {
      const mail = await sessionReminderEmail(kind, { ...details, looks: null }, opts);
      expect(mail.html).not.toContain(en.emails.looks.title);
      expect(mail.text).not.toContain(en.emails.looks.title);
    }
  });
});

describe("the day-before reminder asks for the backdrop until one is picked", () => {
  test("none picked: every backdrop offered, how many to pick, reply or text us", async () => {
    const mail = await sessionReminderEmail("24h", details, opts);
    const m = en.emails.backdrops;
    expect(mail.html).toContain(m.stillTitleMany);
    expect(mail.html).toContain("Your bundle includes 2 backdrops.");
    expect(mail.html).toContain("Sage Green");
    expect(mail.html).not.toContain("Cream");
    expect(mail.text).toContain("We still need your 2 backdrops: reply or text us your picks as soon as you can (Blue Aura, Burgundy, Sage Green, Pink, White, Beige or Wooden). Text us at");
    // sent for real, the drawn textures go along as attachments, as in the 72-hour email
    const cid = await sessionReminderEmail("24h", details, { ...opts, images: "cid" });
    expect(cid.attachments.some((a) => a.contentId?.startsWith("th-backdrop-"))).toBe(true);
  });

  test("one setup: the singular ask; ES too", async () => {
    const one = await sessionReminderEmail("24h", { ...details, setups: 1 }, opts);
    expect(one.html).toContain(en.emails.backdrops.stillTitle);
    expect(one.html).toContain(en.emails.backdrops.stillText);
    const esMail = await sessionReminderEmail("24h", { ...details, setups: 1 }, { ...opts, locale: "es" });
    expect(esMail.html).toContain(es.emails.backdrops.stillTitle);
    expect(esMail.text).toContain("Todavía nos falta tu fondo: responde o envíanos un mensaje de texto con tu elección lo antes posible (Azul Aura,");
  });

  test("already picked: no ask and no swatches", async () => {
    const mail = await sessionReminderEmail("24h", { ...details, backdrops: ["burgundy"] }, opts);
    expect(mail.html).not.toContain(en.emails.backdrops.stillTitle);
    expect(mail.html).not.toContain(en.emails.backdrops.stillTitleMany);
    expect(mail.text).not.toContain("We still need");
  });
});
