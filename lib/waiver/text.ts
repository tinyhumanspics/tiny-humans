import { site } from "@/config/site";

/**
 * The photo and video release parents sign on the iPad (owner, Nov 9; wording from docs/shoots/shoots-template.html).
 *
 * DRAFT: before real families sign it, the owner has it reviewed by a Florida lawyer (minors' images in paid ads
 * especially), "Tiny Humans" becomes the legal business name if the business is an LLC, and Alondra checks the
 * Spanish. Any change to these words = a new WAIVER_VERSION. Signed releases keep the exact text they showed
 * (`text_snapshot` + its SHA-256), so older signatures never change.
 *
 * Kept here, not in messages/: it's a versioned legal text that each signature points to.
 */
export const WAIVER_VERSION = "Photo and video release v1 (draft, Nov 2026)";

/**
 * Our Family Story (owner, Nov 11): bundles that include the family get the family release, which also covers the
 * parents, siblings and relatives in the photos. Same choices and promises; its own version (same DRAFT note).
 */
export const FAMILY_WAIVER_VERSION = "Family photo and video release v1 (draft, Nov 2026)";

export type WaiverKind = "baby" | "family";
export const waiverVersionFor = (kind: WaiverKind) => (kind === "family" ? FAMILY_WAIVER_VERSION : WAIVER_VERSION);
/** Which release a stored version is (anything that isn't the family one is the baby release). */
export const waiverKindOf = (version: string): WaiverKind => (version === FAMILY_WAIVER_VERSION ? "family" : "baby");

export const WAIVER_USES = ["website", "social", "ads", "bts", "personal"] as const;
export type WaiverUse = (typeof WAIVER_USES)[number];
export type WaiverLanguage = "en" | "es";
export type WaiverUses = Record<WaiverUse, boolean>;

/** Owner-facing short names (Leads, the signed copy's summary). */
export const USE_SHORT: Record<WaiverUse, string> = { website: "Website", social: "IG + FB", ads: "Ads", bts: "BTS videos", personal: "Our personal IG" };

const EN = {
  owner: "For Adri & Alo",
  cancel: "Cancel",
  cancelSure: "Tap again to cancel",
  next: "Next →",
  title: "Photo and video release",
  intro:
    "Thank you for having us in your home! We'd love to share some of today's photos and videos so other families can see our work. This form asks your permission. Please read it, choose what you're OK with, and sign at the bottom.",
  babiesLabel: "Your little one",
  whereH: "Where we may share them",
  uses: {
    website: "Our website and online portfolio (tinyhumans.photography)",
    social: "Tiny Humans Instagram and Facebook: posts, Stories and Reels",
    ads: "Ads for Tiny Humans on Instagram and Facebook",
    bts: "Behind-the-scenes videos from today (these can show you and your home)",
    personal: "Adri and Alo's personal Instagram, when we share our work",
  } satisfies Record<WaiverUse, string>,
  yesAll: "Yes to all",
  noneHint: "Leave them all unticked to keep your photos private.",
  nameH: "Your baby's name",
  firstName: "OK to use {baby}'s first name in captions",
  promiseH: "What we promise",
  promises: [
    "We never share your last name, your address or where you live, and we never tag your location.",
    "We never sell your photos or give them to anyone else to use.",
    "You can change your mind at any time. Text {phone} or email {email} and we'll stop using them in anything new, and take them off our website and any running ads within 7 days.",
    "Nobody is paid for this, and it doesn't change your gallery or your right to use your own photos.",
  ],
  fineH: "The fine print",
  fine:
    "I am the parent or legal guardian of the child or children named above, and I am 18 or older. I give Tiny Humans permission to use photos and videos taken at this session, of my child or children and of me and my family, only in the places I ticked above, without payment, until I take this permission back. I can take it back at any time for future use, as described above. I agree to sign electronically, and my electronic signature counts the same as a handwritten one. Florida law applies.",
  youH: "About you",
  fullName: "Your full name",
  rel: "You are the baby's",
  parent: "Parent",
  guardian: "Legal guardian",
  agree: "I've read this and I agree.",
  signH: "Sign here with your finger",
  clear: "Clear",
  date: "Date",
  done: "Done",
  donePrivate: "Done: keep our photos private",
  missing: "To finish: {list}.",
  mName: "your name",
  mAgree: 'tick "I agree"',
  mSign: "your signature",
  thanks: "Thank you, {name}!",
  thanksSub: "You're all set. Please hand the iPad back to Adri or Alo.",
  thanksPrivate: "Got it: we'll keep your photos private.",
  lang: "Español",
  signedIn: "Signed in English",
};

export type WaiverWords = typeof EN;

const ES: WaiverWords = {
  owner: "Para Adri y Alo",
  cancel: "Cancelar",
  cancelSure: "Toca otra vez para cancelar",
  next: "Siguiente →",
  title: "Autorización de fotos y videos",
  intro:
    "¡Gracias por recibirnos en tu casa! Nos encantaría compartir algunas fotos y videos de hoy para que otras familias conozcan nuestro trabajo. Este formulario te pide permiso. Por favor léelo, elige con qué estás de acuerdo y firma al final.",
  babiesLabel: "Tu pequeño",
  whereH: "Dónde podemos compartirlas",
  uses: {
    website: "Nuestro sitio web y portafolio en línea (tinyhumans.photography)",
    social: "Instagram y Facebook de Tiny Humans: publicaciones, Stories y Reels",
    ads: "Anuncios de Tiny Humans en Instagram y Facebook",
    bts: "Videos detrás de cámaras de hoy (pueden mostrarte a ti y tu casa)",
    personal: "El Instagram personal de Adri y Alo, cuando compartimos nuestro trabajo",
  },
  yesAll: "Sí a todo",
  noneHint: "Si no marcas ninguna, tus fotos se quedan privadas.",
  nameH: "El nombre de tu bebé",
  firstName: "Está bien usar el primer nombre de {baby} en los textos",
  promiseH: "Lo que te prometemos",
  promises: [
    "Nunca compartimos tu apellido, tu dirección ni dónde vives, y nunca etiquetamos tu ubicación.",
    "Nunca vendemos tus fotos ni se las damos a nadie más para que las use.",
    "Puedes cambiar de opinión cuando quieras. Escríbenos al {phone} o a {email} y dejaremos de usarlas en cualquier cosa nueva, y las quitaremos de nuestro sitio web y de los anuncios activos en un plazo de 7 días.",
    "Nadie recibe pago por esto, y no cambia tu galería ni tu derecho a usar tus propias fotos.",
  ],
  fineH: "La letra pequeña",
  fine:
    "Soy el padre, la madre o el tutor legal del niño o los niños nombrados arriba, y tengo 18 años o más. Doy permiso a Tiny Humans para usar fotos y videos tomados en esta sesión, de mi niño o mis niños y de mí y mi familia, solo en los lugares que marqué arriba, sin pago, hasta que retire este permiso. Puedo retirarlo en cualquier momento para usos futuros, como se describe arriba. Acepto firmar electrónicamente, y mi firma electrónica vale lo mismo que una firma a mano. Se aplican las leyes de Florida.",
  youH: "Sobre ti",
  fullName: "Tu nombre completo",
  rel: "Eres del bebé",
  parent: "Padre o madre",
  guardian: "Tutor legal",
  agree: "Lo leí y estoy de acuerdo.",
  signH: "Firma aquí con tu dedo",
  clear: "Borrar",
  date: "Fecha",
  done: "Listo",
  donePrivate: "Listo: mantener nuestras fotos privadas",
  missing: "Para terminar: {list}.",
  mName: "tu nombre",
  mAgree: 'marca "Estoy de acuerdo"',
  mSign: "tu firma",
  thanks: "¡Gracias, {name}!",
  thanksSub: "Todo listo. Por favor devuélvele el iPad a Adri o Alo.",
  thanksPrivate: "Entendido: tus fotos se quedan privadas.",
  lang: "English",
  signedIn: "Firmado en español",
};

/** The family release: only these words differ from the baby release (owner, Nov 11; DRAFT like the rest). */
const FAMILY_EN = {
  title: "Family photo and video release",
  intro:
    "Thank you for having us in your home! We'd love to share some of today's family photos and videos so other families can see our work. This form asks your permission for the photos of your baby and of everyone in your family photos. Please read it, choose what you're OK with, and sign at the bottom.",
  everyone: "Also in the photos",
  nameH: "First names",
  firstName: "OK to use first names in captions ({baby})",
  fine:
    "I am the parent or legal guardian of the child or children named above, and I am 18 or older. I give Tiny Humans permission to use photos and videos taken at this family session, of my child or children, of me and of my family, only in the places I ticked above, without payment, until I take this permission back. For the other people in the photos, I confirm that each adult agreed to this release, and that each child's parent or legal guardian did too. I can take it back at any time for future use, as described above. I agree to sign electronically, and my electronic signature counts the same as a handwritten one. Florida law applies.",
};

const FAMILY_ES: typeof FAMILY_EN = {
  title: "Autorización de fotos y videos familiares",
  intro:
    "¡Gracias por recibirnos en tu casa! Nos encantaría compartir algunas fotos y videos familiares de hoy para que otras familias conozcan nuestro trabajo. Este formulario te pide permiso para las fotos de tu bebé y de todos los que aparecen en tus fotos familiares. Por favor léelo, elige con qué estás de acuerdo y firma al final.",
  everyone: "También en las fotos",
  nameH: "Nombres",
  firstName: "Está bien usar los primeros nombres en los textos ({baby})",
  fine:
    "Soy el padre, la madre o el tutor legal del niño o los niños nombrados arriba, y tengo 18 años o más. Doy permiso a Tiny Humans para usar fotos y videos tomados en esta sesión familiar, de mi niño o mis niños, de mí y de mi familia, solo en los lugares que marqué arriba, sin pago, hasta que retire este permiso. Sobre las demás personas en las fotos, confirmo que cada adulto aceptó esta autorización, y que el padre, la madre o el tutor legal de cada niño también la aceptó. Puedo retirarlo en cualquier momento para usos futuros, como se describe arriba. Acepto firmar electrónicamente, y mi firma electrónica vale lo mismo que una firma a mano. Se aplican las leyes de Florida.",
};

const fill = (text: string, values: Record<string, string>) => text.replace(/\{(\w+)\}/g, (m, k: string) => values[k] ?? m);

/** The words for one language (and release), with the studio's phone and email filled in. */
export function waiverWords(lang: WaiverLanguage, kind: WaiverKind = "baby"): WaiverWords {
  const base = lang === "es" ? ES : EN;
  const fam = lang === "es" ? FAMILY_ES : FAMILY_EN;
  const w = kind === "family" ? { ...base, title: fam.title, intro: fam.intro, nameH: fam.nameH, firstName: fam.firstName, fine: fam.fine } : base;
  const contact = { phone: site.contact.phone, email: site.contact.email ?? "" };
  return { ...w, promises: w.promises.map((p) => fill(p, contact)) };
}

export const fillWords = fill;

/** Who and when, as shown at the top of the release. */
export interface WaiverFacts {
  familyName: string;
  /** "Sofia" / "Ava and Mila" (null when no baby name was given: the first-name choice is then left out). */
  babyNames: string | null;
  /** "Mon Nov 16" style line, already in the signing language. */
  dateLabel: string;
  /** Family release only: who else the parent listed ("Maria (Mom), Leo (Brother)"); null = nobody listed. */
  everyone?: string | null;
  /** Family release only: every first name given (babies first), for the captions choice; null = none. */
  firstNames?: string | null;
}

/**
 * Exactly what the parent reads, as data: stored with the signature (`text_snapshot`) and hashed, so a signed copy
 * always shows the words it was signed with, even after the wording changes.
 */
export function waiverSnapshot(lang: WaiverLanguage, facts: WaiverFacts, kind: WaiverKind = "baby") {
  const w = waiverWords(lang, kind);
  const family = kind === "family";
  const everyone = family && facts.everyone ? ` · ${(lang === "es" ? FAMILY_ES : FAMILY_EN).everyone}: ${facts.everyone}` : "";
  const names = family ? (facts.firstNames ?? null) : facts.babyNames;
  return {
    version: waiverVersionFor(kind),
    language: lang,
    title: w.title,
    intro: w.intro,
    facts: `${w.babiesLabel}: ${facts.babyNames ?? "—"}${everyone} · ${facts.familyName} · ${facts.dateLabel}`,
    whereHeading: w.whereH,
    uses: WAIVER_USES.map((key) => ({ key, label: w.uses[key] })),
    noneHint: w.noneHint,
    firstName: names ? { heading: w.nameH, label: fill(w.firstName, { baby: names }) } : null,
    promisesHeading: w.promiseH,
    promises: w.promises,
    fineHeading: w.fineH,
    fine: w.fine,
    youHeading: w.youH,
    labels: { fullName: w.fullName, relationship: w.rel, parent: w.parent, guardian: w.guardian, agree: w.agree, sign: w.signH, date: w.date },
  };
}

export type WaiverSnapshot = ReturnType<typeof waiverSnapshot>;

/** "Website, IG + FB, Ads" or "None: keep photos private". */
export function usesSummary(uses: Partial<WaiverUses>): string {
  const yes = WAIVER_USES.filter((k) => uses[k]).map((k) => USE_SHORT[k]);
  return yes.length ? yes.join(", ") : "None: keep photos private";
}

/** What the booking's "Photo use" permission becomes: OK to feature on the website or social media. */
export const photosConsentOf = (uses: Partial<WaiverUses>) => Boolean(uses.website || uses.social);
