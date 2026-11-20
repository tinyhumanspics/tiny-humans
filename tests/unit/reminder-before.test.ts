import { describe, expect, test } from "vitest";
import { sessionReminderEmail } from "@/emails/SessionReminder";
import en from "@/messages/en.json";
import es from "@/messages/es.json";

const details = {
  reference: "TH-20261205-4821",
  parentName: "Sofia Martinez",
  bundleName: "Our Little Story",
  date: "2026-12-05",
  start: "10:00",
  end: "12:00",
  location: "1500 Bay Rd, Miami Beach, FL 33139",
  depositPaid: true,
};
const opts = { themeId: "default", today: "2026-12-04", images: "inline" as const };

describe("day-before reminder: Before we arrive (owner, Nov 20)", () => {
  test("three groups, the arrival steps numbered, in the HTML and the plain text; the old checklist is gone", async () => {
    const mail = await sessionReminderEmail("24h", details, opts);
    const b = en.emails.reminder24.before;
    for (const heading of [b.title, b.nightTitle, b.dayTitle, b.arriveTitle]) expect(mail.html).toContain(heading);
    expect(mail.text).toContain(`${b.title}\n\n${b.nightTitle}:\n- ${b.night[0]}`);
    expect(mail.text).toContain(`${b.arriveTitle}:\n1. ${b.arrive[0]}\n2. ${b.arrive[1]}`);
    expect(mail.text).not.toContain(en.emails.common.arrival);
    expect(mail.text).not.toContain("A quick checklist");
  });

  test("the family line shows only for a bundle with family, with its name", async () => {
    const plain = await sessionReminderEmail("24h", details, opts);
    expect(plain.text).not.toContain("Booked ");
    const family = await sessionReminderEmail("24h", { ...details, bundleName: "Our Family Story", familyBundle: "Nuestra historia familiar" }, { ...opts, locale: "es" });
    expect(family.text).toContain("- ¿Reservaste Nuestra historia familiar? Que todos");
    expect(family.text).toContain(`${es.emails.reminder24.before.title}\n\n${es.emails.reminder24.before.nightTitle}:`);
  });

  test("sent on the session day: the night-before items lead On the day, without their heading", async () => {
    const mail = await sessionReminderEmail("24h", { ...details, familyBundle: "Our Family Story" }, { ...opts, today: details.date });
    const b = en.emails.reminder24.before;
    expect(mail.text).not.toContain(b.nightTitle);
    expect(mail.html).not.toContain(b.nightTitle);
    expect(mail.text).toContain(`${b.dayTitle}:\n- ${b.night[0]}`);
    expect(mail.text).toContain(`- Booked Our Family Story? Have everyone who's joining dressed and ready. Soft, solid colors (no logos or busy patterns) look best.\n- ${b.day[0]}`);
  });
});
