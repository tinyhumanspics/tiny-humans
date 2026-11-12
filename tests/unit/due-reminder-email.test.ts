import { describe, expect, test } from "vitest";
import { dueDepositReminderEmail } from "@/emails/DueDepositReminder";

const details = { parentName: "Camila Reyes", bundleName: "Our Little Story", dueDate: "2027-01-20", amountCents: 5000, bundlePriceCents: 29900, offerLabel: null };
const payUrl = "https://www.tinyhumans.photography/due-date/return?r=TH-D-TEST&s=sig";

describe("Leads → Not paid: the deposit reminder for a “Not born yet” family (owner, Nov 11)", () => {
  test("English: their bundle and due date, the deposit button to their own page, their saved price", async () => {
    const mail = await dueDepositReminderEmail(details, { themeId: "default", payUrl });
    expect(mail.subject).toBe("Finish reserving your Tiny Humans spot");
    expect(mail.text).toContain("Your spot is almost reserved, Camila");
    expect(mail.text).toContain("You started reserving Our Little Story with your due date, Wednesday, January 20, 2027. Pay the $50 deposit to reserve your spot.");
    expect(mail.text).toContain("Your details are saved, so it only takes a minute. Your price: $299.");
    expect(mail.text).toContain(`Pay the deposit: ${payUrl}`);
    expect(mail.html).toContain(`href="${payUrl.replace("&", "&amp;")}"`);
    expect(mail.html).toContain("Pay the $50 deposit");
    // React must not split a sentence with <!-- --> (one string per text run)
    expect(mail.html).not.toMatch(/Camila<!-- -->/);
  });

  test("Spanish, and an offer price says which offer it was", async () => {
    const mail = await dueDepositReminderEmail({ ...details, bundlePriceCents: 24900, offerLabel: "Thanksgiving offer" }, { themeId: "default", payUrl, locale: "es" });
    expect(mail.subject).toBe("Termina de reservar tu lugar en Tiny Humans");
    expect(mail.text).toContain("Tu lugar está casi reservado, Camila");
    expect(mail.text).toContain("Paga el depósito de $50 para reservar tu lugar.");
    expect(mail.text).toContain("Tu precio: $249 (Thanksgiving offer).");
    expect(mail.html).toContain("Pagar el depósito de $50");
  });

  test("the automatic one (payment page closed unpaid): its button opens their reservation page, which works any time", async () => {
    const mail = await dueDepositReminderEmail(details, { themeId: "default", payUrl, auto: true });
    expect(mail.subject).toBe("Finish reserving your Tiny Humans spot");
    expect(mail.text).toContain("Your spot is reserved once the deposit is paid. The button opens a secure payment page; it works any time.");
    expect(mail.text).not.toContain("stays open for one day");
    const es = await dueDepositReminderEmail(details, { themeId: "default", payUrl, auto: true, locale: "es" });
    expect(es.text).toContain("Tu lugar queda reservado cuando pagas el depósito.");
  });
});
