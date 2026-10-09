/** Structure shared by the English and Spanish legal-message catalogs. */
export type LegalBlock = string | { list: string[] };

export interface LegalSection {
  /** Stable across languages so dynamic paragraphs never depend on translated headings. */
  id: string;
  heading: string;
  body: LegalBlock[];
}

export interface LegalDocument {
  title: string;
  lastUpdated: string;
  intro: string;
  sections: LegalSection[];
}

export interface LegalDynamicCopy {
  noDepositBooking: string;
  noDepositRebook: string;
  travelFee: string;
}

/** Fills settings-backed placeholders such as "{notice}" and "{phone}" throughout a legal document. */
export function fillLegal(doc: LegalDocument, values: Record<string, string>): LegalDocument {
  const fill = (text: string) => text.replace(/\{(\w+)\}/g, (all, key: string) => values[key] ?? all);
  return JSON.parse(JSON.stringify(doc), (_key, value) => (typeof value === "string" ? fill(value) : value)) as LegalDocument;
}

/** Replaces the pay-after wording and inserts the deposit refund rules while deposits are enabled. */
export function depositTerms(doc: LegalDocument, copy: LegalDynamicCopy, text: { booking: string; refunds: string }): LegalDocument {
  return {
    ...doc,
    sections: doc.sections.map((section) => {
      if (section.id === "booking") {
        return { ...section, body: section.body.map((block) => (block === copy.noDepositBooking ? text.booking : block)) };
      }
      if (section.id !== "rescheduling") return section;

      const rebookIndex = section.body.findIndex(
        (block) => typeof block === "string" && block.endsWith(copy.noDepositRebook),
      );
      const body = section.body.map((block) =>
        typeof block === "string" && block.endsWith(copy.noDepositRebook)
          ? block.slice(0, -copy.noDepositRebook.length)
          : block,
      );
      const insertAt = rebookIndex < 0 ? body.length : rebookIndex + 1;
      return { ...section, body: [...body.slice(0, insertAt), text.refunds, ...body.slice(insertAt)] };
    }),
  };
}

/** Adds the current /admin travel fee to the packages-and-prices section. */
export function travelTerms(doc: LegalDocument, paragraph: string): LegalDocument {
  return {
    ...doc,
    sections: doc.sections.map((section) =>
      section.id === "packages" ? { ...section, body: [...section.body, paragraph] } : section,
    ),
  };
}
